/* Run: node --test tests/calendar-v2.test.cjs
   Dummy financial data only. Never use real browser storage in tests. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/calendar-model.js');
const income=(id,date,cents,repeat='once')=>({id,date,cents,kind:'income',name:'Тестове надходження',repeat,note:''});
const expense=(id,date,cents,repeat='once')=>({id,date,cents,kind:'expense',name:'Тестовий рахунок',repeat,note:''});
const state=(events,done={})=>({version:1,opening:0,events,done});
const collect=(events,from,to,others={})=>M.collect({state:state(events),...others},from,to);
test('correct local-date arithmetic and month navigation',()=>{
 assert.equal(M.validDate('2026-02-29'),false);
 assert.equal(M.validDate('2028-02-29'),true);
 assert.equal(M.shiftMonth('2026-12',1),'2027-01');
 assert.equal(M.shiftMonth('2027-01',-1),'2026-12');
 assert.equal(M.addDays('2026-12-31',1),'2027-01-01');
});
test('repeating salary due on the 31st correctly clamps February and resumes March 31',()=>{
 const salary=income('salary','2026-01-31',8000000,'monthly');
 const rows=collect([salary],'2026-02-01','2026-03-31');
 assert.deepEqual(rows.map(e=>e.date),['2026-02-28','2026-03-31']);
});
test('leap February is used when original date is 31st',()=>{
 const rows=collect([income('salary','2028-01-31',8000000,'monthly')],'2028-02-01','2028-02-29');
 assert.equal(rows[0].date,'2028-02-29');
});
test('previously saved calendar v1 income and expense items still render',()=>{
 const rows=collect([income('x','2026-10-25',10000),expense('y','2026-10-26',2500)],'2026-10-01','2026-10-31');
 assert.equal(rows.length,2);
 assert.equal(rows[0].kind,'income');
 assert.equal(rows[1].kind,'expense');
});
test('planned reserve deposits reduce available forecast without classifying as purchases',()=>{
 const reserve={id:'r',date:'2026-10-25',name:'Тестовий резерв',kind:'reserve_deposit',repeat:'monthly',cents:100000};
 const rows=collect([reserve],'2026-10-21','2026-10-30');
 assert.equal(rows.length,1);
 assert.equal(rows[0].category,'reserve');
 assert.equal(M.cashDelta(rows[0]),-100000);
});
test('a credit due from the credit register is a reminder, not a double debit',()=>{
 const debts={credits:[{id:'loan',name:'Тест',due:'2026-10-26',balance:1000000,minimum:70000}]};
 const rows=collect([],'2026-10-21','2026-10-30',{debts});
 assert.equal(rows.length,1);
 assert.equal(rows[0].origin,'debt');
 assert.equal(M.cashDelta(rows[0]),0);
});
test('zero-balance credits do not show as pending payment',()=>{
 const debts={credits:[{id:'closed',name:'Закритий',due:'2026-10-26',balance:0,minimum:70000}]};
 assert.equal(collect([],'2026-10-21','2026-10-30',{debts}).length,0);
});
test('actual salary from journal appears as a confirmed fact, not a future forecast',()=>{
 const ledger={entries:[{id:'actual',date:'2026-10-22',status:'actual',kind:'income',cents:3000000,category:'Зарплата',note:''}]};
 const rows=collect([],'2026-10-21','2026-10-31',{ledger});
 assert.equal(rows[0].origin,'actual');
 assert.equal(M.describeStatus(rows[0],'2026-10-21'),'Факт у журналі');
 assert.equal(M.cashDelta(rows[0]),0);
});
test('pending salary from journal contributes to a future forecast',()=>{
 const ledger={entries:[{id:'planned',date:'2026-10-27',status:'planned',kind:'income',cents:2500000,category:'Зарплата',note:''}]};
 const rows=collect([],'2026-10-21','2026-10-31',{ledger});
 assert.equal(rows[0].origin,'ledger');
 assert.equal(M.cashDelta(rows[0]),2500000);
});
test('monthly completion is stored for each occurrence, not for the whole series',()=>{
 const item=income('salary','2026-10-25',100000,'monthly');
 const stored=state([item],{'salary|2026-10-25':true});
 const rows=M.collect({state:stored},'2026-10-01','2026-11-30');
 assert.equal(rows[0].date,'2026-10-25');
 assert.equal(rows[0].done,true);
 assert.equal(rows[1].date,'2026-11-25');
 assert.equal(rows[1].done,false);
});
test('done future events are omitted from projected cashflow but retained in the calendar',()=>{
 const stored=state([expense('bill','2026-10-23',50000)],{'bill|2026-10-23':true});
 const rows=M.collect({state:stored},'2026-10-22','2026-10-31');
 assert.equal(rows.length,1);
 assert.equal(rows[0].done,true);
 assert.deepEqual(M.metrics(rows,'2026-10-21',30,100000),{income:0,outgoing:0,ending:100000});
});
test('unpaid items in the past are included in the action list and today is distinct',()=>{
 const rows=collect([expense('old','2026-10-18',10000),expense('today','2026-10-21',1000),expense('next','2026-10-26',3000)],'2026-10-15','2026-10-31');
 assert.equal(M.nextActions(rows,'2026-10-21',7).length,3);
 assert.equal(rows.filter(e=>e.date==='2026-10-21').length,1);
});
test('projected incoming and outgoing money remain in integer cents',()=>{
 const entries=[income('salary','2026-10-27',100000),expense('rent','2026-10-29',40000),{id:'reserve',date:'2026-11-01',name:'Резерв',kind:'reserve_deposit',repeat:'once',cents:20000}];
 const rows=collect(entries,'2026-10-21','2026-11-20');
 assert.deepEqual(M.metrics(rows,'2026-10-21',30,50000),{income:100000,outgoing:60000,ending:90000});
});

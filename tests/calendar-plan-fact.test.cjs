/* npm-free regression suite: node --test tests/calendar-plan-fact.test.cjs
   Only synthetic entries; never copies personal financial data. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});
for(const name of ['calendar-model.js','calendar-actions.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',name),'utf8'),context);
const M=context.FCCalendarModel,A=context.FCCalendarActions;
const K={calendar:'calendar',ledger:'ledger',debts:'debts',reserve:'reserve'};
const now='2026-10-21';
const sample=(kind='income',id='plan')=>({
 calendar:{version:1,opening:0,events:[{id,date:now,name:'Тестова подія',kind,cents:100000,repeat:'monthly',note:''}],done:{},overrides:{},settled:{}},
 ledger:{version:1,debtCents:0,entries:[]},
 debts:{version:1,credits:[],history:[]},
 reserve:{saved:0}
});
const instance=(data,id='plan',date=now)=>M.occurrence(data.calendar,data.calendar.events.find(x=>x.id===id),date,data.ledger);
const token=(data,id='plan')=>({eventId:id,occurrence:now,expected:M.fingerprint(instance(data,id))});
const fact=(data,args={})=>A.book(data,K,{...token(data),date:now,cents:100000,operationId:'new-'+data.ledger.entries.length,historyId:'history-'+data.debts.history.length,today:now,finalize:true,...args});
test('new plan fact creates one actual journal entry with durable calendar link',()=>{
 const d=sample();fact(d);
 assert.equal(d.ledger.entries.length,1);
 assert.equal(d.ledger.entries[0].status,'actual');
 assert.equal(d.ledger.entries[0].calendarKey,'plan|'+now);
 assert.equal(instance(d).settled,true);
 assert.equal(M.cashDelta(instance(d)),0);
});
test('existing actual imported entry is linked without creating a second transaction',()=>{
 const d=sample(),existing={id:'imported',date:now,kind:'income',status:'actual',cents:100000,category:'Зарплата',note:'',source:'privat24'};
 d.ledger.entries.push(existing);
 fact(d,{existingId:'imported'});
 assert.equal(d.ledger.entries.length,1);
 assert.equal(existing.calendarKey,'plan|'+now);
 assert.equal(instance(d).paid,100000);
});
test('same actual entry cannot be linked twice or booked again after settlement',()=>{
 const d=sample(),existing={id:'imported',date:now,kind:'income',status:'actual',cents:100000,category:'Зарплата',note:''};
 d.ledger.entries.push(existing);fact(d,{existingId:'imported'});
 assert.throws(()=>fact(d,{existingId:'imported'}),/вже внесено/);
});
test('partial booking retains the outstanding amount until another fact arrives',()=>{
 const d=sample();fact(d,{operationId:'part1',cents:40000,finalize:false});
 assert.equal(instance(d).paid,40000);
 assert.equal(instance(d).remaining,60000);
 assert.equal(instance(d).done,false);
 fact(d,{operationId:'part2',cents:60000,finalize:true});
 assert.equal(instance(d).paid,100000);
 assert.equal(instance(d).done,true);
 assert.equal(d.ledger.entries.length,2);
});
test('credit booking changes debt balance and creates exactly one credit history record',()=>{
 const d=sample('debt_payment');
 d.calendar.events[0].creditId='credit-1';
 d.debts.credits=[{id:'credit-1',name:'Кредит',balance:150000,minimum:50000,due:now}];
 fact(d,{operationId:'p1',historyId:'h1',cents:50000,finalize:false});
 assert.equal(d.debts.credits[0].balance,100000);
 assert.equal(d.debts.history.length,1);
 assert.equal(d.debts.history[0].operationId,'p1');
 assert.equal(d.ledger.entries[0].creditId,'credit-1');
});
test('credit booking cannot overpay current balance',()=>{
 const d=sample('debt_payment');
 d.calendar.events[0].creditId='credit-1';
 d.debts.credits=[{id:'credit-1',name:'Кредит',balance:20000,minimum:10000,due:now}];
 assert.throws(()=>fact(d,{operationId:'p1',historyId:'h1'}),/перевищує/);
 assert.equal(d.ledger.entries.length,0);
});
test('completed next-month recurrence remains a separate independent plan',()=>{
 const d=sample();fact(d);
 const future=instance(d,'plan','2026-11-21');
 assert.equal(future.done,false);
 assert.equal(future.remaining,100000);
});
test('unlink retains the real payment and credit accounting unchanged',()=>{
 const d=sample('debt_payment');
 d.calendar.events[0].creditId='credit-1';
 d.debts.credits=[{id:'credit-1',name:'Кредит',balance:150000,minimum:50000,due:now}];
 fact(d,{operationId:'payment',historyId:'history',cents:50000,finalize:true});
 A.unlink(d,K,{...token(d),operationId:'payment'});
 assert.equal(d.ledger.entries.length,1);
 assert.equal(d.debts.history.length,1);
 assert.equal(d.debts.credits[0].balance,100000);
 assert.equal(d.ledger.entries[0].calendarKey,undefined);
 assert.equal(instance(d).paid,0);
});
test('journal plan is converted in place with planned amount retained',()=>{
 const d=sample();d.ledger.entries.push({id:'journal-plan',date:'2026-10-22',kind:'expense',cents:75000,status:'planned',category:'Оренда',note:''});
 const e=d.ledger.entries[0],expected=JSON.stringify([e.id,e.date,e.kind,e.cents,e.category,e.note,e.status,e.calendarKey||'']);
 A.confirmPlanned(d,K,{entryId:e.id,expected,date:now,cents:80000,today:now});
 assert.equal(d.ledger.entries.length,1);
 assert.equal(e.status,'actual');
 assert.equal(e.date,now);
 assert.equal(e.cents,80000);
 assert.equal(e.plannedCents,75000);
 assert.equal(e.plannedDate,'2026-10-22');
});
test('journal conversion rejects a repeated click and stale snapshots',()=>{
 const d=sample();d.ledger.entries.push({id:'journal-plan',date:now,kind:'income',cents:75000,status:'planned',category:'Зарплата',note:''});
 const e=d.ledger.entries[0],expected=JSON.stringify([e.id,e.date,e.kind,e.cents,e.category,e.note,e.status,e.calendarKey||'']);
 A.confirmPlanned(d,K,{entryId:e.id,expected,date:now,cents:75000,today:now});
 assert.throws(()=>A.confirmPlanned(d,K,{entryId:e.id,expected,date:now,cents:75000,today:now}),/вже виконано/);
});
test('journal conversion rejects out-of-balance reserve withdrawals',()=>{
 const d=sample();d.reserve.saved=100;
 d.ledger.entries.push({id:'w',date:now,kind:'reserve_withdrawal',cents:20000,status:'planned',category:'Резерв',note:''});
 const e=d.ledger.entries[0],expected=JSON.stringify([e.id,e.date,e.kind,e.cents,e.category,e.note,e.status,e.calendarKey||'']);
 assert.throws(()=>A.confirmPlanned(d,K,{entryId:'w',expected,date:now,cents:20000,today:now}),/Недостатньо/);
 assert.equal(e.status,'planned');
});
test('journal conversion rejects direct loan payment bypassing credit register',()=>{
 const d=sample();d.ledger.entries.push({id:'loan-plan',date:now,kind:'debt_payment',cents:5000,status:'planned',category:'Кредит',note:''});
 const e=d.ledger.entries[0],expected=JSON.stringify([e.id,e.date,e.kind,e.cents,e.category,e.note,e.status,e.calendarKey||'']);
 assert.throws(()=>A.confirmPlanned(d,K,{entryId:e.id,expected,date:now,cents:5000,today:now}),/Кредитні платежі/);
});
test('booking rejects future real dates and stale fingerprints',()=>{
 const d=sample(),p={...token(d),date:'2026-11-01',cents:100000,operationId:'future',today:now,finalize:true};
 assert.throws(()=>A.book(d,K,p),/майбутню дату/);
 const stale=token(d);
 d.calendar.events[0].cents=50000;
 assert.throws(()=>A.book(d,K,{...stale,date:now,cents:50000,operationId:'stale',today:now,finalize:true}),/змінилися/);
});

test('journal confirmation uses original category, not normalized color category from calendar',()=>{
 const d=sample();
 d.ledger.entries.push({id:'rent-plan',date:now,kind:'expense',cents:65000,status:'planned',category:'Оренда квартири',note:'Жовтень'});
 const shown=M.collect({state:d.calendar,ledger:d.ledger},now,now).find(e=>e.id==='rent-plan');
 assert.equal(shown.category,'expense');
 assert.equal(shown.name,'Оренда квартири');
 const raw=d.ledger.entries.find(x=>x.id===shown.id);
 const expected=JSON.stringify([raw.id,raw.date,raw.kind,raw.cents,raw.category,raw.note,raw.status,raw.calendarKey||'']);
 A.confirmPlanned(d,K,{entryId:shown.id,expected,date:now,cents:62000,today:now});
 assert.equal(raw.status,'actual');
 assert.equal(raw.plannedCents,65000);
});

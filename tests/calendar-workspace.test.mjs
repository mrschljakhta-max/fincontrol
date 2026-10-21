import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../assets/calendar-model.js');
await import('../assets/calendar-actions.js');
const M=globalThis.FCCalendarModel,A=globalThis.FCCalendarActions;
const K={calendar:'calendar',ledger:'ledger',debts:'debts'};
const event=(overrides={})=>({id:'bill',name:'Test rent',date:'2026-10-21',kind:'expense',cents:10000,repeat:'once',note:'',...overrides});
const make=(e=event())=>({calendar:M.normalize({events:[e]}),ledger:{version:1,debtCents:0,entries:[]},debts:{version:1,credits:[],history:[]}});
const input=d=>({state:d.calendar,ledger:d.ledger,debts:d.debts});
const item=d=>M.occurrence(d.calendar,d.calendar.events[0],d.calendar.events[0].date,d.ledger);
const request=(d,o={})=>({eventId:'bill',occurrence:d.calendar.events[0].date,expected:M.fingerprint(item(d)),date:'2026-10-21',today:'2026-10-21',cents:4000,operationId:'op-1',historyId:'history-1',finalize:false,...o});
const open=(d,amount=50000)=>Object.assign(d.calendar,{opening:amount,openingDate:'2026-10-21',openingActual:[]});
test('weekly, twice monthly and month-end recurrence cross month boundaries without duplicate days',()=>{
 for(const [e,from,to,expected] of [
 [event({date:'2026-10-30',repeat:'weekly'}),'2026-11-01','2026-11-20',['2026-11-06','2026-11-13','2026-11-20']],
 [event({date:'2026-01-29',repeat:'twice_monthly',secondDay:31}),'2026-02-01','2026-03-31',['2026-02-28','2026-03-29','2026-03-31']],
 [event({date:'2028-01-01',repeat:'month_end'}),'2028-01-01','2028-03-31',['2028-01-31','2028-02-29','2028-03-31']]]){
  assert.deepEqual(M.collect(input(make(e)),from,to).map(x=>x.date),expected);
 }
});
test('moving one occurrence across periods neither duplicates it nor shifts the recurring series',()=>{
 const d=make(event({date:'2026-01-31',repeat:'monthly'}));
 d.calendar.overrides['bill|2026-02-28']={date:'2026-03-03'};
 assert.equal(M.collect(input(d),'2026-02-01','2026-02-28').length,0);
 assert.deepEqual(M.collect(input(d),'2026-03-01','2026-03-31').map(e=>[e.date,e.occurrence]),[['2026-03-03','2026-02-28'],['2026-03-31','2026-03-31']]);
});
test('no default zero-bank balance is inferred from legacy calendar state',()=>{
 const d=make();d.calendar.opening=90000;
 assert.equal(M.project(input(d),'2026-10-21').known,false);
 open(d,0);assert.equal(M.project(input(d),'2026-10-21').firstDeficit,'2026-10-21');
});
test('partial and complete bookings keep cash forecast stable and never count plan and fact twice',()=>{
 const d=make();open(d);
 assert.equal(M.project(input(d),'2026-10-21').ending,40000);
 A.book(d,K,request(d));
 assert.equal(item(d).paid,4000);assert.equal(item(d).remaining,6000);assert.equal(item(d).done,false);
 assert.equal(M.project(input(d),'2026-10-21').ending,40000);
 assert.equal(M.collect(input(d),'2026-10-21','2026-10-21').length,1);
 A.book(d,K,request(d,{cents:6000,operationId:'op-2',finalize:true}));
 assert.equal(item(d).settled,true);assert.equal(M.project(input(d),'2026-10-21').ending,40000);
 assert.throws(()=>A.book(d,K,request(d,{operationId:'op-3'})),/вже внесено/);
});
test('finalizing below plan records a difference; deleting the linked actual reopens the plan',()=>{
 const d=make();A.book(d,K,request(d,{cents:8000,finalize:true}));
 assert.equal(item(d).difference,-2000);assert.equal(item(d).settled,true);
 d.ledger.entries=[];assert.equal(item(d).settled,false);assert.equal(item(d).remaining,10000);
});
test('linking an existing actual changes no monetary record and refuses reused links',()=>{
 const d=make();d.ledger.entries.push({id:'imported',date:'2026-10-21',status:'actual',kind:'expense',cents:10000,category:'Test',note:''});
 open(d,40000);d.calendar.openingActual=[{id:'imported',date:'2026-10-21',delta:-10000}];
 A.book(d,K,request(d,{existingId:'imported',finalize:true}));
 assert.equal(d.ledger.entries.length,1);assert.equal(item(d).paid,10000);assert.equal(M.project(input(d),'2026-10-21').ending,40000);
 d.calendar.events.push(event({id:'another'}));const another=M.occurrence(d.calendar,d.calendar.events[1],'2026-10-21',d.ledger);
 assert.throws(()=>A.book(d,K,{...request(d),eventId:'another',expected:M.fingerprint(another),existingId:'imported'}),/вже прив’язана/);
});
test('credit actual updates the matching balance and history and checks fresh outstanding amount',()=>{
 const d=make(event({kind:'debt_payment',creditId:'credit'}));d.debts.credits.push({id:'credit',name:'Test credit',balance:25000,minimum:10000,due:'2026-10-21'});
 assert.equal(M.collect(input(d),'2026-10-21','2026-10-21').length,1);
 A.book(d,K,request(d));assert.equal(d.debts.credits[0].balance,21000);assert.equal(d.debts.history[0].operationId,'op-1');assert.equal(d.ledger.entries[0].creditId,'credit');
 assert.throws(()=>A.book(d,K,request(d,{cents:22000,operationId:'op-2'})),/перевищує/);
 assert.equal(d.debts.credits[0].balance,21000);
});
test('existing credit facts are linked without deducting the credit balance again',()=>{
 const d=make(event({kind:'debt_payment',creditId:'credit'}));d.debts.credits.push({id:'credit',name:'Test',balance:90000,minimum:10000});
 d.ledger.entries.push({id:'credit-op',date:'2026-10-21',kind:'debt_payment',status:'actual',cents:10000,creditId:'credit',category:'Test',note:''});
 A.book(d,K,request(d,{existingId:'credit-op',finalize:true}));assert.equal(d.debts.credits[0].balance,90000);assert.equal(d.debts.history.length,0);
});
test('stale forms and future-dated actuals are rejected before records change',()=>{
 const d=make(),old=request(d);d.calendar.events[0].cents=15000;
 assert.throws(()=>A.book(d,K,old),/змінилися/);assert.equal(d.ledger.entries.length,0);
 assert.throws(()=>A.book(d,K,request(d,{date:'2026-10-22'})),/майбутню/);assert.equal(d.ledger.entries.length,0);
});
test('editing future instances preserves previous paid history and protects already paid future dates',()=>{
 const d=make(event({date:'2026-09-21',repeat:'monthly'}));
 A.book(d,K,request(d,{cents:10000,finalize:true,date:'2026-09-21'}));
 const october=M.occurrence(d.calendar,d.calendar.events[0],'2026-10-21',d.ledger);
 A.edit(d,K,{eventId:'bill',occurrence:'2026-10-21',expected:M.fingerprint(october),scope:'future',newId:'new-series',values:event({id:undefined,date:'2026-10-21',cents:12000,repeat:'monthly'})});
 assert.equal(d.calendar.events[0].until,'2026-10-20');assert.equal(item(d).paid,10000);assert.equal(d.calendar.events[1].id,'new-series');
 assert.deepEqual(M.collect(input(d),'2026-10-01','2026-11-30').filter(e=>e.origin==='calendar').map(e=>e.cents),[12000,12000]);
 // Explicit input values never include IDs in the UI; use a separate case for paid-future protection.
 const d2=make(event({repeat:'monthly'}));A.book(d2,K,request(d2,{cents:10000,finalize:true}));
 assert.throws(()=>A.edit(d2,K,{...request(d2),scope:'future',newId:'new',values:{...event(),repeat:'monthly'}}),/виконані/);
});
test('opening snapshot adjusts for new facts and deletion of facts without replaying old transactions',()=>{
 const d=make(event({date:'2026-10-22'}));d.ledger.entries=[{id:'old',date:'2026-10-21',status:'actual',kind:'income',cents:50000}];open(d,50000);d.calendar.openingActual=[{id:'old',date:'2026-10-21',delta:50000}];
 assert.equal(M.project(input(d),'2026-10-21').ending,40000);
 d.ledger.entries.push({id:'new',date:'2026-10-21',status:'actual',kind:'expense',cents:1000});assert.equal(M.project(input(d),'2026-10-21').ending,39000);
 d.ledger.entries=d.ledger.entries.filter(e=>e.id!=='old');assert.equal(M.project(input(d),'2026-10-21').ending,-11000);
});
test('past overdue plans do not turn into invented debits in the forecast',()=>{
 const d=make(event({date:'2026-10-20'}));open(d,20000);assert.equal(M.project(input(d),'2026-10-21').ending,20000);
});
test('failed store transaction rolls back calendar, credit balance and actual ledger together',async()=>{
 const map=new Map();let fail=false;const storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem(k,v){if(fail&&k==='fincontrol-debts-v1'){fail=false;throw Error('Quota');}map.set(k,String(v))},removeItem:k=>map.delete(k)};
 const ctx=vm.createContext({localStorage:storage,Event,dispatchEvent(){},navigator:{},console});
 for(const f of ['store.js','calendar-model.js','calendar-actions.js'])vm.runInContext(fs.readFileSync(new URL('../assets/'+f,import.meta.url),'utf8'),ctx);
 const S=ctx.FCStore;await S.ready;const d=make(event({kind:'debt_payment',creditId:'c'}));d.debts.credits.push({id:'c',name:'Test',balance:10000,minimum:1000,due:'2026-10-21'});
 const keys=[S.K.calendar,S.K.ledger,S.K.debts];await S.update(keys,x=>{for(const k of ['calendar','ledger','debts'])x[S.K[k]]=d[k]});const before=[...map];fail=true;
 await assert.rejects(S.update(keys,x=>ctx.FCCalendarActions.book(x,S.K,request(d))),/Не вдалося/);
 assert.deepEqual([...map],before);
});

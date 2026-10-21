import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../assets/finance.js');
const M=globalThis.FCFinance;
const entry=(id,date,kind,cents,category='Тест',status='actual')=>({id,date,kind,cents,category,status,note:''});
test('ranges exclude future dates and include empty calendar months',()=>{
 const all=M.clean([entry('a','2026-01-01','income',90000),entry('b','2026-03-02','expense',30000),entry('c','2026-04-01','income',999999),entry('d','2026-02-10','expense',55555,'Тест','planned')]);
 const r=M.range('custom',all,'2026-03-10','2026-01-01','2026-03-31'),m=M.metrics(M.filter(all,r),r);
 assert.equal(m.income,90000);assert.equal(m.expense,30000);assert.equal(m.avgIncome,30000);assert.equal(m.avgExpense,10000);assert.equal(m.months[1].expense,0);assert.equal(m.count,2);
 assert.equal(M.monthKeys(M.range('custom',[],'2026-01-01','2024-01-01','2026-01-31')).length,25);
 assert.throws(()=>M.range('custom',[],'2026-01-01','2026-03-01','2026-02-01'));
 assert.equal(M.validDate('2026-02-29'),false);assert.equal(M.validDate('2024-02-29'),true);
});
test('accounting excludes transfers, review and cash withdrawals from net',()=>{
 const es=['income','expense','debt_payment','refund','reserve_deposit','reserve_withdrawal','internal_transfer','cash_withdrawal','review'].map((kind,i)=>entry(String(i),'2026-01-01',kind,[100000,30000,10000,2000,5000,1000,90000,80000,70000][i]));
 const t=M.totals(es);assert.equal(t.net,62000);assert.equal(t.available,58000);
 const f=M.flow(es);assert.equal(f.total,103000);assert.equal(f.sources.reduce((s,x)=>s+x.value,0),f.targets.reduce((s,x)=>s+x.value,0));assert.equal(f.excluded,240000);
 const deficit=M.flow([entry('a','2026-01-01','expense',5000)]);assert.equal(deficit.sources[0].deficit,true);assert.equal(deficit.sources[0].value,5000);
});
test('grouped categories preserve amounts and linked filtering',()=>{
 const es=Array.from({length:9},(_,i)=>entry('e'+i,'2026-01-01','expense',(i+1)*100,'Категорія '+i));
 const r=M.range('all',es),f=M.flow(es),others=f.targets.find(x=>x.categories);
 assert.equal(others.categories.length,4);assert.equal(M.totals(M.filter(es,r,{categories:others.categories})).expense,others.value);
 assert.equal(M.metrics(es,r).median,500);assert.equal(M.filter(es,r,{bucket:[300,600]}).length,3);
});
test('sequential goals use the same month remainder and integer cents',()=>{
 const g={configured:true,debt:150,target:100,reserve:0,home:100,saved:0};
 const p=M.project(g,200,0,3);assert.deepEqual(p.events,[1,2,2]);assert.equal(p.points[1].reserve,50);assert.equal(p.points[2].home,100);assert.equal(p.points[2].debt,0);
 assert.deepEqual(M.project(g,0,0,3).events,[null,null,null]);
 const interest=M.project({...g,debt:100000},1000,12,12);assert.equal(interest.points[12].debt,100000);assert.equal(interest.events[0],null);
});
test('goal snapshots retain null for missing configuration and reserve ledger movements',()=>{
 assert.equal(M.goals({},[]).configured,false);assert.equal(M.goals({},[]).debt,null);
 const g=M.goals({debts:{credits:[{balance:10000}],history:[{kind:'payment',amount:5000}]},reserve:{saved:100,target:500},home:{priceUsd:100,rate:40,fees:5,renovation:100,saved:20},plan:{income1:20000,income2:10000,coffee:1000,smoking:0,other:2000}},[entry('r','2026-01-01','reserve_deposit',1000)]);
 assert.equal(g.reserve,11000);assert.equal(g.home,430000);assert.equal(g.budget,27000);assert.equal(g.paid,5000);
});
const source=fs.readFileSync(new URL('../assets/store.js',import.meta.url),'utf8');
function setup(shared={map:new Map(),queue:Promise.resolve(),fail:null}){
 const storage={get length(){return shared.map.size},key:i=>[...shared.map.keys()][i],getItem:k=>shared.map.get(k)??null,setItem(k,v){if(shared.fail?.(k,v))throw Error('Quota exceeded');shared.map.set(k,String(v))},removeItem:k=>shared.map.delete(k)};
 const context=vm.createContext({localStorage:storage,Event,dispatchEvent(){},navigator:{locks:{request(name,fn){const p=shared.queue.then(fn,fn);shared.queue=p.catch(()=>{});return p}}},URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob,document:{createElement:()=>({click(){}})},setTimeout:fn=>fn(),console});
 vm.runInContext(source,context);return {S:context.FCStore,shared,storage};
}
const plain=x=>JSON.parse(JSON.stringify(x));
test('two tabs add records without stale overwrites; legacy stale writes rejected',async()=>{
 const a=setup();await a.S.ready;const b=setup(a.shared);await b.S.ready;const key=a.S.K.ledger;
 await Promise.all([a.S.update([key],d=>{d[key]??=a.S.emptyLedger();d[key].entries.push(entry('a','2026-01-01','income',100))}),b.S.update([key],d=>{d[key]??=b.S.emptyLedger();d[key].entries.push(entry('b','2026-01-01','expense',50))})]);
 assert.equal(a.S.read(key).entries.length,2);assert.throws(()=>a.S.legacySet(key,JSON.stringify(a.S.emptyLedger())),/іншій вкладці/);
});
test('failed multi-module write restores both debt and ledger',async()=>{
 const {S,shared}=setup();await S.ready;const a=S.K.debts,b=S.K.ledger;await S.update([a,b],d=>{d[a]={version:1,credits:[{id:'c',name:'Кредит',balance:1000,minimum:100}],history:[]};d[b]=S.emptyLedger()});
 const before=[shared.map.get(a),shared.map.get(b)];let fails=0;shared.fail=k=>k===b&&fails++===0;
 await assert.rejects(S.update([a,b],d=>{d[a].credits[0].balance=900;d[b].entries.push(entry('x','2026-01-01','debt_payment',100))}),/Не вдалося/);
 assert.deepEqual([shared.map.get(a),shared.map.get(b)],before);assert.equal(shared.map.has('fincontrol-transaction-v2'),false);
});
test('full backup restores every module; legacy partial restore protects linked payments',async()=>{
 const {S,shared}=setup();await S.ready;const ledger=S.emptyLedger();ledger.entries.push({...entry('x','2026-01-01','debt_payment',100),creditId:'c'});await S.set(S.K.ledger,ledger);await S.set('fincontrol-custom-module',{value:'майбутній модуль'});
 const backup=await S.backup();assert.equal(backup.format,'fincontrol-full-backup');assert.ok(backup.data['fincontrol-custom-module']);
 await assert.rejects(S.restore(S.emptyLedger()),/кредитні платежі/);await S.set('fincontrol-custom-module',{value:'зміни'});await S.restore(backup);assert.deepEqual(plain(S.read('fincontrol-custom-module')),{value:'майбутній модуль'});
 shared.map.set(S.K.ledger,'{corrupt');await S.restore(backup);assert.equal(S.read(S.K.ledger).entries.length,1);
});
test('invalid data and duplicate IDs cannot replace saved ledger',async()=>{
 const {S}=setup();await S.ready;const ledger=S.emptyLedger();ledger.entries=[entry('x','2026-01-01','income',100),entry('x','2026-01-02','income',100)];await assert.rejects(S.set(S.K.ledger,ledger),/Некоректні дані/);assert.equal(S.read(S.K.ledger),null);
 assert.equal(S.csvCell('=1+1'),'"\'=1+1"');assert.equal(S.csvCell('hello;"world"'),'"hello;""world"""');
});
test('interrupted write journal restores the previous state on startup',async()=>{
 const shared={map:new Map([['fincontrol-custom-module','{"value":2}'],['fincontrol-transaction-v2',JSON.stringify({before:{'fincontrol-custom-module':'{"value":1}'}})]]),queue:Promise.resolve(),fail:null};
 const {S}=setup(shared);await S.ready;assert.equal(S.read('fincontrol-custom-module').value,1);assert.equal(shared.map.has('fincontrol-transaction-v2'),false);
});

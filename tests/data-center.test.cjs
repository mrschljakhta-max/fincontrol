/* Run with: node --test tests/data-center.test.cjs
   Only built-in Node modules; no financial records or external services. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'..','assets',name),'utf8');
const storeCode=source('store.js'),transferCode=source('data-transfer.js');
function browser(init={}){
 const map=new Map(Object.entries(init));
 const storage={
  get length(){return map.size},
  key(i){return [...map.keys()][i]??null},
  getItem(k){return map.has(k)?map.get(k):null},
  setItem(k,v){map.set(k,String(v))},
  removeItem(k){map.delete(k)}
 };
 const ctx={localStorage:storage,navigator:{},URL:{createObjectURL:()=>('blob:local-test'),revokeObjectURL:()=>{}},Blob:class FakeBlob{},setTimeout:()=>0,document:{createElement:()=>({click(){}})}};
 ctx.globalThis=ctx;
 vm.createContext(ctx);
 vm.runInContext(storeCode,ctx);
 vm.runInContext(transferCode,ctx);
 return {storage,S:ctx.FCStore,X:ctx.FCDataTransfer};
}
const entry={id:'test-entry',date:'2026-10-21',kind:'income',status:'actual',category:'Тест',note:'Тестова транзакція',cents:10000};
const ledger={version:1,debtCents:0,entries:[entry]};
const debt={version:1,credits:[{id:'credit-test',name:'Тест',balance:10000,minimum:1000,due:'2026-11-01'}],history:[]};
const raw=(v)=>JSON.stringify(v);
const backup=(data)=>({format:'fincontrol-full-backup',version:2,createdAt:'2026-10-21T00:00:00.000Z',data});
test('backup preflight counts modules and does not modify storage',async()=>{
 const b=browser({'fincontrol-offline-v1':raw({...ledger,entries:[]})});
 await b.S.ready;
 const before=b.storage.getItem('fincontrol-offline-v1');
 const doc=backup({'fincontrol-offline-v1':raw(ledger),'fincontrol-debts-v1':raw(debt)});
 const checked=b.X.inspectBackup(doc,b.S);
 assert.equal(checked.info.transactions,1);
 assert.equal(checked.info.credits,1);
 assert.equal(checked.info.keys,2);
 assert.equal(b.storage.getItem('fincontrol-offline-v1'),before);
});
test('diff distinguishes additions, replacement, deletion and identical modules',()=>{
 const b=browser();
 const current={'fincontrol-offline-v1':raw({...ledger,entries:[]}), 'fincontrol-calendar-v1':raw({version:1,opening:0,events:[]}), 'fincontrol-goals-v1':raw({monthly:10,extra:0,buffer:15})};
 const incoming={'fincontrol-offline-v1':raw(ledger),'fincontrol-debts-v1':raw(debt),'fincontrol-goals-v1':current['fincontrol-goals-v1']};
 const diff=b.X.compare(current,incoming);
 assert.equal(diff.summary.add,1);
 assert.equal(diff.summary.replace,1);
 assert.equal(diff.summary.delete,1);
 assert.equal(diff.summary.same,1);
});
test('unsupported and incomplete backups are rejected',()=>{
 const b=browser();
 assert.throws(()=>b.X.inspectBackup({...backup({}),version:3},b.S),/повна резервна копія/);
 assert.throws(()=>b.X.inspectBackup(backup({}),b.S),/порожня/);
 assert.throws(()=>b.X.inspectBackup(backup({'fincontrol-ui-compact-v1':raw({compact:true})}),b.S),/фінансових модулів/);
});
test('invalid ledger and calendar schemas stop restore at preflight',()=>{
 const b=browser();
 assert.throws(()=>b.X.inspectBackup(backup({'fincontrol-offline-v1':raw({...ledger,entries:[entry,entry]})}),b.S),/Некоректні дані/);
 assert.throws(()=>b.X.inspectBackup(backup({'fincontrol-calendar-v1':raw({version:1,opening:0,events:[{date:'invalid',kind:'income',cents:1,repeat:'monthly'}]})}),b.S),/події/);
});
test('linked debt payments require credit register in full backup',()=>{
 const b=browser();
 const linked={...entry,id:'linked',kind:'debt_payment',creditId:'credit-test'};
 assert.throws(()=>b.X.inspectBackup(backup({'fincontrol-offline-v1':raw({...ledger,entries:[linked]})}),b.S),/кредитного реєстру/);
});
test('complete restore replaces local data and removes modules absent from file',async()=>{
 const b=browser({'fincontrol-offline-v1':raw({...ledger,entries:[]}), 'fincontrol-calendar-v1':raw({version:1,opening:0,events:[]})});
 await b.S.ready;
 const before=b.X.storageSnapshot(b.storage);
 const target=backup({'fincontrol-offline-v1':raw(ledger),'fincontrol-debts-v1':raw(debt)});
 await b.S.restore(target,{'fincontrol-offline-v1':before['fincontrol-offline-v1'],'fincontrol-calendar-v1':before['fincontrol-calendar-v1'],'fincontrol-debts-v1':null});
 assert.equal(b.S.read('fincontrol-offline-v1').entries.length,1);
 assert.equal(b.S.read('fincontrol-debts-v1').credits.length,1);
 assert.equal(b.storage.getItem('fincontrol-calendar-v1'),null);
});
test('concurrent edits are rejected without overwrite',async()=>{
 const b=browser({'fincontrol-offline-v1':raw({...ledger,entries:[]})});
 await b.S.ready;
 const expected=b.storage.getItem('fincontrol-offline-v1');
 b.storage.setItem('fincontrol-offline-v1',raw(ledger));
 await assert.rejects(b.S.restore(backup({'fincontrol-offline-v1':raw({...ledger,entries:[]})}),{'fincontrol-offline-v1':expected}),/змінилися/);
 assert.equal(b.S.read('fincontrol-offline-v1').entries.length,1);
});
test('version 2 backups exported by FCStore can be read by preflight',async()=>{
 const b=browser({'fincontrol-offline-v1':raw(ledger)});
 await b.S.ready;
 const exported=await b.S.backup();
 const checked=b.X.inspectBackup(exported,b.S);
 assert.equal(checked.info.transactions,1);
 assert.equal(checked.backup.version,2);
});

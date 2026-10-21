/* FINCONTROL — read-only backup preflight and change preview.
   No localStorage writes, network requests, or code execution. */
(function(root){
'use strict';
const FORMAT='fincontrol-full-backup', VERSION=2;
const JOURNAL='fincontrol-transaction-v2';
const labelMap=Object.freeze({
 'fincontrol-offline-v1':'Журнал операцій',
 'fincontrol-debts-v1':'Кредити',
 'fincontrol-plan-v1':'Фінансовий план',
 'fincontrol-emergency-v1':'Фінансова подушка',
 'fincontrol-home-v1':'Моє житло',
 'fincontrol-calendar-v1':'Календар',
 'fincontrol-goals-v1':'Мої цілі',
 'fincontrol-smart-rules-v1':'Розумні правила',
 'fincontrol-privat-rules-v1':'Правила Приват24',
 'fincontrol-dashboard-v2':'Налаштування дашборда',
 'fincontrol-audit-changelog-v1':'Журнал виправлень',
 'fincontrol-ui-compact-v1':'Компактний інтерфейс',
 'fincontrol-nav-groups-v1':'Групи меню'
});
const mainKeys=['fincontrol-offline-v1','fincontrol-debts-v1','fincontrol-plan-v1','fincontrol-emergency-v1','fincontrol-home-v1','fincontrol-calendar-v1','fincontrol-goals-v1','fincontrol-smart-rules-v1','fincontrol-privat-rules-v1'];
function isObject(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function storageSnapshot(storage){
 const values=Object.create(null);
 for(let i=0;i<storage.length;i++){
  const k=storage.key(i);
  if(k&&k.startsWith('fincontrol-')&&k!==JOURNAL)values[k]=storage.getItem(k);
 }
 return values;
}
function label(k){return Object.hasOwn(labelMap,k)?labelMap[k]:'Інші налаштування · '+k}
function quantity(k,v){
 if(k==='fincontrol-offline-v1')return Array.isArray(v?.entries)?v.entries.length:null;
 if(k==='fincontrol-debts-v1')return Array.isArray(v?.credits)?v.credits.length:null;
 if(k==='fincontrol-calendar-v1')return Array.isArray(v?.events)?v.events.length:null;
 if(k==='fincontrol-smart-rules-v1'||k==='fincontrol-audit-changelog-v1')return Array.isArray(v)?v.length:null;
 return null;
}
function outline(values){
 const result={keys:Object.keys(values).length,transactions:0,credits:0,events:0,invalid:[],rows:[]};
 for(const [k,raw] of Object.entries(values)){
  let v,qty=null;
  try{v=JSON.parse(raw);qty=quantity(k,v)}
  catch{result.invalid.push(k)}
  if(k==='fincontrol-offline-v1'&&qty!==null)result.transactions=qty;
  if(k==='fincontrol-debts-v1'&&qty!==null)result.credits=qty;
  if(k==='fincontrol-calendar-v1'&&qty!==null)result.events=qty;
  result.rows.push({key:k,label:label(k),count:qty});
 }
 return result;
}
function inspectBackup(data,store){
 if(!isObject(data)||data.format!==FORMAT||data.version!==VERSION||!isObject(data.data))
  throw Error('Це не повна резервна копія FINCONTROL версії 2. Старі копії журналу імпортуй через розділ «Журнал».');
 const rawData=data.data,keys=Object.keys(rawData);
 if(!keys.length||keys.length>100)throw Error('Копія порожня або містить забагато модулів.');
 if(!keys.some(k=>mainKeys.includes(k)))throw Error('У файлі немає фінансових модулів. Перевір, чи обрано потрібну резервну копію.');
 let bytes=0;
 const parsed=Object.create(null),warnings=[];
 for(const k of keys){
  if(!/^fincontrol-[a-z0-9-]{1,100}$/.test(k)||k===JOURNAL)
   throw Error('У копії є невідомий або службовий ключ: '+k);
  const raw=rawData[k];
  if(typeof raw!=='string')throw Error('Некоректні дані модуля: '+label(k));
  bytes+=raw.length;
  if(bytes>30000000)throw Error('Завелика сумарна кількість даних у копії.');
  let value;
  try{value=JSON.parse(raw)}catch{throw Error('Пошкоджений JSON модуля: '+label(k))}
  store.validate(k,value);
  if(value===null)throw Error('У копії порожній модуль: '+label(k));
  parsed[k]=value;
  if(!Object.hasOwn(labelMap,k))warnings.push('Невідомий модуль: '+k+'. Його буде перенесено як є.');
 }
 if(Object.hasOwn(parsed,'fincontrol-offline-v1')){
  const ledger=parsed['fincontrol-offline-v1'];
  const payments=ledger.entries.filter(e=>e.kind==='debt_payment'&&typeof e.creditId==='string'&&e.creditId);
  if(payments.length&&!Object.hasOwn(parsed,'fincontrol-debts-v1'))
   throw Error('Копія містить пов’язані платежі, але не містить кредитного реєстру. Відновлення зупинено.');
  if(Array.isArray(ledger.entries)){
   const seen=new Set();let duplicates=0;
   for(const e of ledger.entries){
    if(e.source==='privat24'&&typeof e.sourceKey==='string'&&e.sourceKey){
     if(seen.has(e.sourceKey))duplicates++;
     seen.add(e.sourceKey);
    }
   }
   if(duplicates)warnings.push('У виписках Приват24 є '+duplicates+' повторюваних ключів. Копія валідна, але після відновлення виконай аудит.');
  }
 }
 const debts=parsed['fincontrol-debts-v1'];
 if(debts){
  const ids=debts.credits.map(c=>c.id);
  if(new Set(ids).size!==ids.length)throw Error('Кредитний реєстр має повторювані ідентифікатори.');
 }
 const info=outline(rawData);
 return {backup:data,parsed,info,warnings,bytes};
}
function compare(current,incoming){
 const keys=[...new Set([...Object.keys(current),...Object.keys(incoming)])].sort((a,b)=>label(a).localeCompare(label(b),'uk'));
 const rows=keys.map(k=>{
  const hasCurrent=Object.hasOwn(current,k),hasNext=Object.hasOwn(incoming,k);
  const action=!hasNext?'delete':!hasCurrent?'add':current[k]===incoming[k]?'same':'replace';
  let before=null,after=null;
  try{if(hasCurrent)before=quantity(k,JSON.parse(current[k]))}catch{}
  try{if(hasNext)after=quantity(k,JSON.parse(incoming[k]))}catch{}
  return {key:k,label:label(k),action,before,after};
 });
 const summary=Object.fromEntries(['add','replace','delete','same'].map(action=>[action,rows.filter(x=>x.action===action).length]));
 return {rows,summary,changed:summary.add+summary.replace+summary.delete};
}
root.FCDataTransfer={FORMAT,VERSION,label,outline,storageSnapshot,inspectBackup,compare};
if(typeof module!=='undefined'&&module.exports)module.exports=root.FCDataTransfer;
})(globalThis);

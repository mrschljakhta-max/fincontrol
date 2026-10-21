/* Shared data boundary. Existing keys and records are retained. */
(function(root){
  'use strict';
  const K={ledger:'fincontrol-offline-v1',debts:'fincontrol-debts-v1',plan:'fincontrol-plan-v1',reserve:'fincontrol-emergency-v1',home:'fincontrol-home-v1',rules:'fincontrol-privat-rules-v1',calendar:'fincontrol-calendar-v1',goals:'fincontrol-goals-v1',smart:'fincontrol-smart-rules-v1',prefs:'fincontrol-dashboard-v2'};
  const kinds=['income','expense','debt_payment','reserve_deposit','reserve_withdrawal','internal_transfer','cash_withdrawal','refund','review'];
  const journal='fincontrol-transaction-v2', revisions=new Map();
  const integer=n=>Number.isSafeInteger(n)&&n>=0, object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
  function validate(k,v){
    if(v===null)return;
    let ok=true;
    if(k===K.ledger)ok=object(v)&&v.version===1&&integer(v.debtCents)&&Array.isArray(v.entries)&&v.entries.length<=100000&&v.entries.every(e=>object(e)&&typeof e.id==='string'&&validDate(e.date)&&kinds.includes(e.kind)&&['actual','planned'].includes(e.status)&&integer(e.cents)&&e.cents>0&&typeof e.category==='string'&&typeof e.note==='string')&&new Set(v.entries.map(e=>e.id)).size===v.entries.length;
    if(k===K.debts)ok=object(v)&&v.version===1&&Array.isArray(v.credits)&&Array.isArray(v.history)&&v.credits.every(c=>object(c)&&typeof c.id==='string'&&typeof c.name==='string'&&integer(c.balance)&&integer(c.minimum))&&v.history.every(h=>object(h)&&integer(h.amount));
    if(k===K.plan)ok=object(v)&&['income1','income2','coffee','smoking','other','reserve','cash'].every(f=>integer(v[f]));
    if(k===K.reserve)ok=object(v)&&['saved','monthly','target'].every(f=>Number.isFinite(v[f])&&v[f]>=0)&&v.target>0;
    if(k===K.home)ok=object(v)&&['priceUsd','rate','fees','renovation','reserve','saved','monthly','down','apr','years'].every(f=>Number.isFinite(v[f])&&v[f]>=0)&&v.priceUsd>0&&v.rate>0&&v.years>=1&&v.years<=40&&v.down<=100&&v.apr<=100;
    if(k===K.calendar)ok=object(v)&&v.version===1&&integer(v.opening)&&Array.isArray(v.events);
    if(k===K.smart)ok=Array.isArray(v);
    if(!ok)throw Error('Некоректні дані '+k+'. Записи не замінено; перевір розділ «Діагностика».');
  }
  function read(k,fallback=null){const raw=localStorage.getItem(k);if(raw===null)return fallback;let v;try{v=JSON.parse(raw)}catch{throw Error('Пошкоджений JSON у '+k+'. Відкрий діагностику.')}validate(k,v);return v===null?fallback:v;}
  function rawWrite(k,v){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);revisions.set(k,v);}
  function capture(){for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('fincontrol-'))revisions.set(k,localStorage.getItem(k));}Object.values(K).forEach(k=>{if(!revisions.has(k))revisions.set(k,null)});}
  function changed(){root.dispatchEvent?.(new Event('fincontrol:change'));}
  function legacySet(k,raw){
    if(!k.startsWith('fincontrol-'))return localStorage.setItem(k,raw);
    const expected=revisions.has(k)?revisions.get(k):null;
    if(localStorage.getItem(k)!==expected)throw Error('Дані змінено в іншій вкладці. Онови сторінку перед збереженням.');
    read(k);validate(k,JSON.parse(raw));rawWrite(k,raw);changed();
  }
  function legacyRemove(k){if(localStorage.getItem(k)!==(revisions.get(k)??null))throw Error('Дані змінилися в іншій вкладці. Онови сторінку.');rawWrite(k,null);changed();}
  let queue=Promise.resolve();
  function lock(fn){if(root.navigator?.locks?.request)return root.navigator.locks.request('fincontrol-write-v2',fn);const task=queue.then(fn,fn);queue=task.catch(()=>{});return task;}
  function recover(){const raw=localStorage.getItem(journal);if(!raw)return;const tx=JSON.parse(raw);if(!object(tx.before))throw Error('Некоректний журнал відновлення.');for(const [k,v] of Object.entries(tx.before)){if(!k.startsWith('fincontrol-')||k===journal||(v!==null&&typeof v!=='string'))throw Error('Некоректний ключ відновлення.');rawWrite(k,v)}localStorage.removeItem(journal);}
  capture();
  const ready=lock(()=>{recover()});ready.catch(()=>{});
  async function update(keys,fn,expected={},allowInvalid=false){
    await ready;
    return lock(async()=>{
      const before={},data={};
      for(const k of keys){if(!k.startsWith('fincontrol-')||k===journal)throw Error('Некоректне сховище');before[k]=localStorage.getItem(k);if(Object.hasOwn(expected,k)&&expected[k]!==before[k])throw Error('Дані змінилися. Онови сторінку.');if(allowInvalid){try{data[k]=JSON.parse(before[k])}catch{data[k]=null}}else data[k]=read(k);}
      const result=await fn(data);
      for(const k of keys){validate(k,data[k]);if(localStorage.getItem(k)!==before[k])throw Error('Дані щойно змінилися. Повтори дію.');}
      localStorage.setItem(journal,JSON.stringify({before}));
      try{for(const k of keys)rawWrite(k,data[k]===null?null:JSON.stringify(data[k]));localStorage.removeItem(journal);}
      catch(e){let restored=true;for(const k of keys){try{rawWrite(k,before[k])}catch{restored=false}}if(restored)localStorage.removeItem(journal);throw Error('Не вдалося зберегти дані. '+e.message)}
      changed();return result;
    });
  }
  function set(k,value,expected){return update([k],d=>{d[k]=value},expected===undefined?{}:{[k]:expected});}
  function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function backup(){await ready;return lock(()=>{const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('fincontrol-')&&k!==journal)data[k]=localStorage.getItem(k);}const full={format:'fincontrol-full-backup',version:2,createdAt:new Date().toISOString(),data};download('fincontrol-full-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(full,null,2));return full;});}
  async function restore(v){
    if(v?.format==='fincontrol-full-backup'&&v.version===2&&object(v.data)){
      const parsed={};for(const [k,raw] of Object.entries(v.data)){if(!k.startsWith('fincontrol-')||k===journal||typeof raw!=='string')throw Error('Некоректний формат копії');parsed[k]=JSON.parse(raw);validate(k,parsed[k]);}
      const keys=new Set(Object.keys(parsed));for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('fincontrol-')&&k!==journal)keys.add(k);}
      return update([...keys],d=>{for(const k of keys)d[k]=Object.hasOwn(parsed,k)?parsed[k]:null;},{},true);
    }
    validate(K.ledger,v);if(!v||v.entries.some(e=>e.creditId))throw Error('Для кредитних платежів потрібна повна копія разом із кредитним реєстром.');return update([K.ledger],d=>{if(d[K.ledger]?.entries.some(e=>e.creditId))throw Error("Поточний журнал містить кредитні платежі. Віднови повну копію.");d[K.ledger]=v});
  }
  const csvCell=x=>{let s=String(x??'');if(/^\s*[=+\-@]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  root.FCStore={K,kinds,date:validDate,validate,read,update,set,legacySet,legacyRemove,ready,backup,restore,download,csvCell,emptyLedger:()=>({version:1,debtCents:0,entries:[]}),emptyDebts:()=>({version:1,credits:[],history:[]})};
})(globalThis);

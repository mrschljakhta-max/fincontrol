/* FINCONTROL calendar: pure recurrence, plan/fact reconciliation and cash projection. */
(function(root){
'use strict';
const KINDS=new Set(['income','expense','reserve_deposit','debt_payment','refund','reserve_withdrawal','internal_transfer','cash_withdrawal','review']);
const REPEATS=['once','weekly','monthly','twice_monthly','month_end'];
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const day=s=>new Date(s+'T12:00:00');
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(day(s).getTime())&&iso(day(s))===s;
const monthStart=s=>s.slice(0,7)+'-01';
function monthEnd(s){const d=day(monthStart(s));return iso(new Date(d.getFullYear(),d.getMonth()+1,0,12))}
function shiftMonth(s,n){const d=day(monthStart(s));return iso(new Date(d.getFullYear(),d.getMonth()+n,1,12)).slice(0,7)}
function addDays(s,n){const d=day(s);d.setDate(d.getDate()+n);return iso(d)}
const today=()=>iso(new Date());
const ordinal=s=>Date.UTC(...[Number(s.slice(0,4)),Number(s.slice(5,7))-1,Number(s.slice(8))])/86400000;
const weekStart=s=>addDays(s,-((day(s).getDay()+6)%7));
const monthOccurrence=(original,ym)=>ym+'-'+pad(Math.min(Number(original.slice(8)),Number(monthEnd(ym).slice(8))));
const category=k=>['income','refund'].includes(k)?'income':k.startsWith('reserve_')?'reserve':k==='debt_payment'?'credit':k==='expense'?'expense':'other';
const signed=(kind,cents)=>['income','refund','reserve_withdrawal'].includes(kind)?cents:['expense','debt_payment','reserve_deposit'].includes(kind)?-cents:0;
const keyOf=(id,occurrence)=>id+'|'+occurrence;
function normalize(s){return{version:1,opening:0,events:[],...s,done:s?.done||{},overrides:s?.overrides||{},settled:s?.settled||{}}}
function validEvent(e){return e&&typeof e.id==='string'&&validDate(e.date)&&Number.isSafeInteger(e.cents)&&e.cents>0&&KINDS.has(e.kind)}
function occurs(e,d){
 if(!validDate(d)||d<e.date||(e.until&&d>e.until))return false;
 if(e.repeat==='weekly')return (ordinal(d)-ordinal(e.date))%7===0;
 if(e.repeat==='monthly')return monthOccurrence(e.date,d.slice(0,7))===d;
 if(e.repeat==='month_end')return monthEnd(d)===d;
 if(e.repeat==='twice_monthly')return [Number(e.date.slice(8)),e.secondDay||15].some(n=>monthOccurrence('2000-01-'+pad(n),d.slice(0,7))===d);
 return d===e.date;
}
function dates(e,start,end){
 const out=new Set();
 if(e.repeat==='weekly'){
  let d=addDays(e.date,Math.max(0,Math.floor((ordinal(start)-ordinal(e.date))/7))*7);
  for(let i=0;d<=end&&i<10000;i++,d=addDays(d,7))if(d>=start&&occurs(e,d))out.add(d);
 }else if(['monthly','twice_monthly','month_end'].includes(e.repeat)){
  let ym=(e.date>start?e.date:start).slice(0,7);
  for(let i=0;ym<=end.slice(0,7)&&i<1200;i++,ym=shiftMonth(ym,1)){
   const candidates=e.repeat==='month_end'?[monthEnd(ym)]:[monthOccurrence(e.date,ym),...(e.repeat==='twice_monthly'?[monthOccurrence('2000-01-'+pad(e.secondDay||15),ym)]:[])];
   for(const d of candidates)if(d>=start&&d<=end&&occurs(e,d))out.add(d);
  }
 }else if(e.date>=start&&e.date<=end&&occurs(e,e.date))out.add(e.date);
 return out;
}
function occurrence(state,event,original,ledger){
 if(!validEvent(event)||!occurs(event,original))return null;
 const s=normalize(state),key=keyOf(event.id,original),override=s.overrides[key]||{};
 if(override.cancelled)return null;
 const e={...event,...override},entries=(ledger?.entries||[]).filter(x=>x.status==='actual'&&x.calendarKey===key&&x.kind===e.kind);
 const paid=entries.reduce((sum,x)=>sum+x.cents,0),closed=s.settled[key];
 const settled=paid>=e.cents||(Array.isArray(closed)&&closed.length>0&&closed.every(id=>entries.some(x=>x.id===id)));
 const reminderDone=s.done[key]===true,done=settled||reminderDone;
 return{...e,key,occurrence:original,date:e.date===event.date&&!override.date?original:e.date,name:String(e.name||'Подія'),note:String(e.note||''),origin:'calendar',category:category(e.kind),repeat:REPEATS.includes(event.repeat)?event.repeat:'once',paid,remaining:Math.max(0,e.cents-paid),difference:paid-e.cents,operationIds:entries.map(x=>x.id),payments:entries,settled,reminderDone,done,actionable:true};
}
function cashDelta(e){return e.origin==='debt'||e.origin==='actual'||e.done?0:signed(e.kind,e.remaining??e.cents)}
function describeStatus(e,now){
 if(e.origin==='actual')return'Факт у журналі';
 if(e.origin==='debt')return e.date<now?'Минулий термін':'Термін платежу';
 if(e.origin==='ledger')return e.date<now?'План із минулою датою':'План із журналу';
 if(e.settled)return'Факт внесено';
 if(e.reminderDone)return'Закрито без запису';
 if(e.paid>0)return'Частково';
 return e.date<now?'Прострочено':e.date===now?'На сьогодні':'Заплановано';
}
function collect({state={},ledger=null,debts=null},start,end,options={}){
 if(!validDate(start)||!validDate(end)||start>end)throw Error('Некоректний період календаря');
 const s=normalize(state),result=[];
 for(const event of s.events){
  if(!validEvent(event))continue;
  const originals=dates(event,start,end);
  for(const [key,o] of Object.entries(s.overrides))if(key.startsWith(event.id+'|')&&o.date>=start&&o.date<=end)originals.add(key.slice(event.id.length+1));
  for(const original of originals){const e=occurrence(s,event,original,ledger);if(e&&e.date>=start&&e.date<=end)result.push(e)}
 }
 for(const e of ledger?.entries||[]){
  if(!validDate(e.date)||e.date<start||e.date>end||!Number.isSafeInteger(e.cents)||e.cents<=0||!KINDS.has(e.kind))continue;
  if(e.status!=='planned'&&!(options.actual!==false&&e.status==='actual'))continue;
  if(e.status==='actual'&&e.calendarKey&&result.some(x=>x.key===e.calendarKey&&x.date===e.date))continue;
  result.push({...e,key:'ledger|'+e.id,name:String(e.category||'Операція'),origin:e.status==='actual'?'actual':'ledger',category:category(e.kind),done:e.status==='actual',actionable:false});
 }
 for(const c of debts?.credits||[]){
  if(!Number.isSafeInteger(c.balance)||c.balance<=0||!Number.isSafeInteger(c.minimum)||c.minimum<=0||!validDate(c.due)||c.due<start||c.due>end)continue;
  // An explicitly linked calendar plan represents this due date already.
  if(result.some(e=>e.origin==='calendar'&&e.creditId===c.id&&e.date===c.due))continue;
  result.push({id:c.id,key:'debt|'+c.id,date:c.due,name:'Кредит: '+c.name,note:'Нагадування з кредитного реєстру; не списується з прогнозу.',kind:'debt_payment',cents:Math.min(c.minimum,c.balance),origin:'debt',category:'credit',done:false,actionable:false});
 }
 const priority={calendar:0,debt:1,ledger:2,actual:3};
 return result.sort((a,b)=>a.date.localeCompare(b.date)||priority[a.origin]-priority[b.origin]||a.name.localeCompare(b.name,'uk'));
}
const pending=e=>e.origin!=='actual'&&!e.done;
const nextActions=(events,now,n=7)=>events.filter(e=>pending(e)&&e.date<=addDays(now,n));
function metrics(events,now,n=30,opening=0){const rows=events.filter(e=>e.date>now&&e.date<=addDays(now,n));const income=rows.reduce((s,e)=>s+Math.max(0,cashDelta(e)),0),outgoing=rows.reduce((s,e)=>s+Math.max(0,-cashDelta(e)),0);return{income,outgoing,ending:opening+income-outgoing}}
function project(input,now=today(),end=addDays(now,30)){
 const s=normalize(input.state),known=validDate(s.openingDate)&&s.openingDate<=now,plans=collect(input,now,end,{actual:false});
 const totals={income:0,outgoing:0};
 for(const e of plans){const n=cashDelta(e);totals.income+=Math.max(0,n);totals.outgoing+=Math.max(0,-n)}
 if(!known)return{known:false,...totals,rows:[],ending:null,minimum:null,firstDeficit:null};
 const deltas=new Map(),add=(d,n)=>deltas.set(d,(deltas.get(d)||0)+n);
 for(const e of input.ledger?.entries||[])if(e.status==='actual'&&e.date>=s.openingDate&&e.date<=end)add(e.date,signed(e.kind,e.cents));
 for(const e of s.openingActual||[])if(validDate(e.date)&&e.date>=s.openingDate&&e.date<=end)add(e.date,-e.delta);
 let balance=s.opening;
 for(const [d,n] of deltas)if(d<now)balance+=n;
 const rows=[];let minimum=Infinity,firstDeficit=null;
 for(let d=now;d<=end;d=addDays(d,1)){
  const events=plans.filter(e=>e.date===d),flow=events.reduce((sum,e)=>sum+cashDelta(e),0);
  balance+=(deltas.get(d)||0)+flow;
  if(!Number.isSafeInteger(balance))throw Error('Суми перевищують допустимий діапазон.');
  rows.push({date:d,balance,flow});minimum=Math.min(minimum,balance);
  if(balance<0&&!firstDeficit)firstDeficit=d;
 }
 return{known:true,...totals,rows,ending:balance,minimum,firstDeficit};
}
const fingerprint=e=>JSON.stringify([e.key,e.date,e.name,e.kind,e.cents,e.creditId||'',e.operationIds,e.done,e.repeat,e.note]);
root.FCCalendarModel={KINDS,REPEATS,iso,day,validDate,monthStart,monthEnd,shiftMonth,addDays,today,weekStart,monthOccurrence,category,signed,keyOf,normalize,occurs,occurrence,cashDelta,describeStatus,collect,pending,nextActions,metrics,project,fingerprint};
if(typeof module!=='undefined'&&module.exports)module.exports=root.FCCalendarModel;
})(globalThis);

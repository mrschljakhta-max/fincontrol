/* FINCONTROL calendar model — pure date, recurrence and projection functions. */
(function(root){
'use strict';
const KINDS=new Set(['income','expense','reserve_deposit','debt_payment','refund','reserve_withdrawal','internal_transfer','cash_withdrawal','review']);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const day=s=>new Date(s+'T12:00:00');
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(day(s).getTime())&&iso(day(s))===s}
function monthStart(s){return s.slice(0,7)+'-01'}
function monthEnd(s){const d=day(monthStart(s));return iso(new Date(d.getFullYear(),d.getMonth()+1,0,12))}
function shiftMonth(s,n){const d=day(monthStart(s));return iso(new Date(d.getFullYear(),d.getMonth()+n,1,12)).slice(0,7)}
function addDays(s,n){const d=day(s);d.setDate(d.getDate()+n);return iso(d)}
function today(){return iso(new Date())}
function monthOccurrence(original,ym){const target=day(ym+'-01'),endDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();return ym+'-'+pad(Math.min(Number(original.slice(8)),endDay))}
function fromKind(kind){return kind==='income'||kind==='refund'||kind==='reserve_withdrawal'?'income':kind==='expense'||kind==='debt_payment'||kind==='reserve_deposit'?'expense':'neutral'}
function category(kind){if(kind==='income'||kind==='refund')return'income';if(kind==='reserve_deposit'||kind==='reserve_withdrawal')return'reserve';if(kind==='debt_payment')return'credit';if(kind==='expense')return'expense';return'other'}
function cashDelta(event){
 if(event.origin==='debt'||event.origin==='actual')return 0;
 if(event.origin==='calendar'&&event.done)return 0;
 if(event.kind==='income'||event.kind==='refund'||event.kind==='reserve_withdrawal')return event.cents;
 if(event.kind==='expense'||event.kind==='debt_payment'||event.kind==='reserve_deposit')return-event.cents;
 return 0;
}
function describeStatus(e,todayDate){
 if(e.origin==='actual')return'Факт у журналі';
 if(e.origin==='debt')return e.date<todayDate?'Минулий термін':'Термін платежу';
 if(e.origin==='ledger')return e.date<todayDate?'План із минулою датою':'План із журналу';
 if(e.done)return'Позначено виконаним';
 return e.date<todayDate?'Прострочено':e.date===todayDate?'На сьогодні':'Заплановано';
}
function collect({state={},ledger=null,debts=null},start,end,options={}){
 if(!validDate(start)||!validDate(end)||start>end)throw Error('Некоректний період календаря');
 const result=[],done=state.done&&typeof state.done==='object'&&!Array.isArray(state.done)?state.done:{},actual=options.actual!==false;
 for(const e of Array.isArray(state.events)?state.events:[]){
  if(!e||typeof e.id!=='string'||!validDate(e.date)||!Number.isSafeInteger(e.cents)||e.cents<=0||!KINDS.has(e.kind))continue;
  const emit=d=>{if(d<start||d>end)return;result.push({id:e.id,date:d,name:String(e.name||'Подія'),note:String(e.note||''),kind:e.kind,cents:e.cents,origin:'calendar',repeat:e.repeat==='monthly'?'monthly':'once',done:done[e.id+'|'+d]===true,category:category(e.kind),actionable:true})};
  if(e.repeat==='monthly'){
   let ym=e.date.slice(0,7),last=end.slice(0,7);
   if(ym<start.slice(0,7))ym=start.slice(0,7);
   for(let i=0;ym<=last&&i<600;i++,ym=shiftMonth(ym,1)){
    const when=monthOccurrence(e.date,ym);
    if(when>=e.date)emit(when);
   }
  }else emit(e.date);
 }
 for(const e of Array.isArray(ledger?.entries)?ledger.entries:[]){
  if(!e||!validDate(e.date)||e.date<start||e.date>end||!Number.isSafeInteger(e.cents)||e.cents<=0||!KINDS.has(e.kind))continue;
  if(e.status!=='planned'&&!(actual&&e.status==='actual'&&['income','refund','debt_payment','reserve_deposit','reserve_withdrawal'].includes(e.kind)))continue;
  result.push({id:String(e.id||''),date:e.date,name:String(e.category||'Операція'),note:String(e.note||''),kind:e.kind,cents:e.cents,origin:e.status==='actual'?'actual':'ledger',category:category(e.kind),done:e.status==='actual',actionable:false});
 }
 for(const c of Array.isArray(debts?.credits)?debts.credits:[]){
  if(!c||!Number.isSafeInteger(c.balance)||c.balance<=0||!Number.isSafeInteger(c.minimum)||c.minimum<=0||!validDate(c.due)||c.due<start||c.due>end)continue;
  result.push({id:String(c.id||''),date:c.due,name:'Кредит: '+String(c.name||'Платіж'),note:'Дата наступного платежу з кредитного реєстру',kind:'debt_payment',cents:c.minimum,origin:'debt',category:'credit',done:false,actionable:false});
 }
 const priority={debt:0,calendar:1,ledger:2,actual:3};
 return result.sort((a,b)=>a.date.localeCompare(b.date)||(priority[a.origin]??9)-(priority[b.origin]??9)||a.name.localeCompare(b.name,'uk'));
}
function nextActions(events,now,days=7){
 const end=addDays(now,days);
 return events.filter(e=>e.origin!=='actual'&&!(e.origin==='calendar'&&e.done)&&e.date<=end);
}
function metrics(events,now,days=30,opening=0){
 const end=addDays(now,days);
 const selected=events.filter(e=>e.date>now&&e.date<=end);
 const income=selected.reduce((s,e)=>s+Math.max(0,cashDelta(e)),0);
 const outgoing=selected.reduce((s,e)=>s+Math.max(0,-cashDelta(e)),0);
 return{income,outgoing,ending:opening+income-outgoing};
}
root.FCCalendarModel={KINDS,iso,day,validDate,monthStart,monthEnd,shiftMonth,addDays,today,monthOccurrence,category,cashDelta,describeStatus,collect,nextActions,metrics};
if(typeof module!=='undefined'&&module.exports)module.exports=root.FCCalendarModel;
})(globalThis);

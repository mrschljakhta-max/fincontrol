/* Pure calculations used by every view in the new dashboard. Amounts are cents. */
(function(root){
'use strict';
const DAY=86400000,kinds=['income','expense','debt_payment','reserve_deposit','reserve_withdrawal','internal_transfer','cash_withdrawal','refund','review'];
const labels={income:'Дохід',expense:'Витрата',debt_payment:'Погашення кредиту',reserve_deposit:'До резерву',reserve_withdrawal:'Із резерву',internal_transfer:'Власний переказ',cash_withdrawal:'Зняття готівки',refund:'Повернення',review:'На перевірці'};
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const stamp=s=>Date.parse(s+'T00:00:00Z');
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(stamp(s))&&new Date(stamp(s)).toISOString().slice(0,10)===s;
const monthStart=s=>s.slice(0,7)+'-01';
function monthEnd(s){const [y,m]=s.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)}
function shiftMonth(s,n){const [y,m]=s.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+n,1));return d.toISOString().slice(0,7)}
function clean(entries){return (Array.isArray(entries)?entries:[]).filter(e=>e&&e.status==='actual'&&validDate(e.date)&&Number.isSafeInteger(e.cents)&&e.cents>0&&kinds.includes(e.kind)).map(e=>({...e,category:String(e.category||'').trim()||'Без категорії',note:String(e.note||'')}));}
function range(mode,entries,now=iso(new Date()),from='',to=''){
 let start,end;
 if(mode==='month'){start=monthStart(now);end=monthEnd(now)}
 else if(mode==='year'){start=now.slice(0,4)+'-01-01';end=now.slice(0,4)+'-12-31'}
 else if(mode==='12m'){start=shiftMonth(now,-11)+'-01';end=monthEnd(now)}
 else if(mode==='custom'){start=from;end=to}
 else {const dates=entries.map(e=>e.date).sort();start=dates[0]||monthStart(now);end=dates.at(-1)||monthEnd(now)}
 if(!validDate(start)||!validDate(end))throw Error('Вкажи початок і кінець періоду.');
 if(start>end)throw Error('Початок періоду має бути раніше за кінець.');
 if((stamp(end)-stamp(start))/DAY>36525)throw Error('Обери період тривалістю до 100 років.');
 return {start,end,days:Math.round((stamp(end)-stamp(start))/DAY)+1};
}
function monthKeys(r){const out=[];for(let key=r.start.slice(0,7);key<=r.end.slice(0,7);key=shiftMonth(key,1))out.push(key);return out}
function filter(entries,r,selection={}){return entries.filter(e=>e.date>=r.start&&e.date<=r.end&&(!selection.kind||e.kind===selection.kind)&&(!selection.category||e.category===selection.category)&&(!selection.categories||selection.categories.includes(e.category))&&(!selection.date||e.date===selection.date)&&(!selection.bucket||(e.kind==='expense'&&e.cents>=selection.bucket[0]&&e.cents<selection.bucket[1])));}
function totals(entries){const t=Object.fromEntries(kinds.map(k=>[k,0]));for(const e of entries)t[e.kind]+=e.cents;t.count=entries.length;t.net=t.income+t.refund-t.expense-t.debt_payment;t.available=t.net-t.reserve_deposit+t.reserve_withdrawal;return t}
function metrics(entries,r){const t=totals(entries),expenses=entries.filter(e=>e.kind==='expense'),sorted=expenses.map(e=>e.cents).sort((a,b)=>a-b),active=new Set(expenses.map(e=>e.date)).size,months=monthKeys(r),monthly=months.map(month=>({month,...totals(entries.filter(e=>e.date.startsWith(month)))})),cats=new Map();for(const e of expenses)cats.set(e.category,(cats.get(e.category)||0)+e.cents);const avg=t.expense/months.length,variance=monthly.reduce((n,m)=>n+(m.expense-avg)**2,0)/months.length;
 return {...t,months:monthly,categories:[...cats].sort((a,b)=>b[1]-a[1]),expenseCount:expenses.length,incomeCount:entries.filter(e=>e.kind==='income').length,activeDays:active,mean:expenses.length?t.expense/expenses.length:null,median:sorted.length?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2:null,max:sorted.at(-1)??null,avgDay:active?t.expense/active:null,avgCalendarDay:t.expense/r.days,avgIncome:t.income/months.length,avgExpense:avg,variation:avg?Math.sqrt(variance)/avg:null,expenseRatio:t.income?t.expense/t.income:null,savingsRate:t.income?t.net/t.income:null,debtRatio:t.income?t.debt_payment/t.income:null};
}
function priorRange(r){const end=stamp(r.start)-DAY,start=end-(r.days-1)*DAY;return {start:new Date(start).toISOString().slice(0,10),end:new Date(end).toISOString().slice(0,10),days:r.days};}
function flow(entries){const t=totals(entries),m=metrics(entries,range('all',entries)),sources=[{label:'Доходи',value:t.income,kind:'income'},{label:'Повернення',value:t.refund,kind:'refund'},{label:'Із резерву',value:t.reserve_withdrawal,kind:'reserve_withdrawal'}].filter(x=>x.value),targets=m.categories.slice(0,5).map(([label,value])=>({label,value,category:label,kind:'expense'}));if(m.categories.length>5)targets.push({label:'Інші витрати',value:m.categories.slice(5).reduce((s,x)=>s+x[1],0),kind:'expense',categories:m.categories.slice(5).map(x=>x[0])});if(t.debt_payment)targets.push({label:'Кредити',value:t.debt_payment,kind:'debt_payment'});if(t.reserve_deposit)targets.push({label:'До резерву',value:t.reserve_deposit,kind:'reserve_deposit'});const incoming=sources.reduce((s,x)=>s+x.value,0),outgoing=targets.reduce((s,x)=>s+x.value,0);if(incoming>outgoing)targets.push({label:'Вільний потік',value:incoming-outgoing});if(outgoing>incoming)sources.push({label:'Непокритий потік',value:outgoing-incoming,deficit:true});return {sources,targets,total:Math.max(incoming,outgoing),excluded:t.internal_transfer+t.cash_withdrawal+t.review};}
function daily(entries,r){const m=new Map();for(const e of entries){const n=['income','refund'].includes(e.kind)?e.cents:['expense','debt_payment'].includes(e.kind)?-e.cents:0;if(n)m.set(e.date,(m.get(e.date)||0)+n)}let total=0;const points=[{date:r.start,value:0,opening:true}];for(const [date,n] of [...m].sort((a,b)=>a[0].localeCompare(b[0])))points.push({date,value:total+=n});if(points.at(-1).date!==r.end)points.push({date:r.end,value:total});return points;}
function goals(data,all){const d=data.debts,r=data.reserve,h=data.home,p=data.plan,debt=d?.credits?.reduce((n,c)=>n+c.balance,0)??null,paid=d?.history?.filter(e=>e.kind==='payment').reduce((n,e)=>n+e.amount,0)||0,reserve=r?Math.round(r.saved*100)+totals(all).reserve_deposit-totals(all).reserve_withdrawal:null,target=r?Math.round(r.target*100):null,home=h?Math.round((h.priceUsd*h.rate*(1+h.fees/100)+h.renovation)*100):null,saved=h?Math.round(h.saved*100):null,budget=p?p.income1+p.income2-p.coffee-p.smoking-p.other:null;return {debt,paid,reserve,target,home,saved,budget,configured:debt!==null&&reserve!==null&&target!==null&&home!==null&&saved!==null};}
function project(g,monthly,apr=0,horizon=120){
 if(!g.configured||!Number.isFinite(monthly)||monthly<0||!Number.isFinite(apr)||apr<0||apr>100) return null;
 let debt=g.debt,reserve=g.reserve,home=g.saved;const events=[debt<=0?0:null,reserve>=g.target?0:null,home>=g.home?0:null],points=[{month:0,debt,reserve,home,value:reserve+home-debt}],contribution=Math.round(monthly);
 for(let month=1;month<=horizon;month++){let cash=contribution;if(debt>0){debt+=Math.round(debt*apr/1200);const pay=Math.min(cash,debt);debt-=pay;cash-=pay;if(debt===0&&events[0]===null)events[0]=month;}if(debt===0&&reserve<g.target){const add=Math.min(cash,g.target-reserve);reserve+=add;cash-=add;if(reserve>=g.target&&events[1]===null)events[1]=month;}if(debt===0&&reserve>=g.target&&home<g.home){const add=Math.min(cash,g.home-home);home+=add;cash-=add;if(home>=g.home&&events[2]===null)events[2]=month;}points.push({month,debt,reserve,home,value:reserve+home-debt});}return {points,events,monthly:contribution};
}
const api={labels,kinds,iso,stamp,validDate,monthStart,monthEnd,shiftMonth,clean,range,monthKeys,filter,totals,metrics,priorRange,flow,daily,goals,project};root.FCFinance=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

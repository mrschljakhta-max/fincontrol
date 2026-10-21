/* FINCONTROL financial calendar 2.0: today's agenda, reminders and monthly plans. */
(async function(){
'use strict';
const M=FCCalendarModel,S=FCStore,K=S.K,$=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(n/100);
const dateText=d=>M.day(d).toLocaleDateString('uk-UA',{day:'numeric',month:'long',year:'numeric'});
const shortDate=d=>M.day(d).toLocaleDateString('uk-UA',{day:'numeric',month:'short'});
const countText=n=>new Intl.NumberFormat('uk-UA').format(n);
const kindLabel={income:'Зарплата / надходження',expense:'Оплата / витрата',debt_payment:'Кредитний платіж',reserve_deposit:'До фінподушки',refund:'Повернення',reserve_withdrawal:'Із фінподушки',internal_transfer:'Переказ',cash_withdrawal:'Готівка',review:'Уточнення'};
const kindIcon={income:'↓',expense:'↑',credit:'▣',reserve:'◈',other:'•'};
const templates={
 salary:{name:'Зарплата',kind:'income',repeat:'monthly'},
 bill:{name:'Комунальні послуги',kind:'expense',repeat:'monthly'},
 reserve:{name:'Поповнення фінансової подушки',kind:'reserve_deposit',repeat:'monthly'},
 credit:{name:'Платіж за кредитом',kind:'debt_payment',repeat:'monthly'}
};
let currentDate=M.today(),month=currentDate.slice(0,7),selected=currentDate,editing=null;
let state={version:1,opening:0,events:[],done:{}},loaded=false;
const safeRead=k=>{try{return S.read(k)}catch(e){showNotice('Помилка даних: '+e.message,true);return null}};
function showNotice(message,isError=false){
 const box=$('calendar-notice');box.textContent=message;box.hidden=false;box.classList.toggle('is-error',isError);
}
function clearNotice(){const box=$('calendar-notice');box.hidden=true;box.textContent='';box.classList.remove('is-error')}
function normalizeState(v){
 if(v&&v.version===1&&Number.isSafeInteger(v.opening)&&v.opening>=0&&Array.isArray(v.events)){
  return{...v,done:v.done&&typeof v.done==='object'&&!Array.isArray(v.done)?v.done:{}};
 }
 return{version:1,opening:0,events:[],done:{}};
}
function refreshState(){
 state=normalizeState(safeRead(K.calendar));
 loaded=true;
}
function write(fn){
 const next=JSON.parse(JSON.stringify(state));
 fn(next);
 S.legacySet(K.calendar,JSON.stringify(next));
 state=next;
 render();
}
function data(start,end,withActual=true){
 return M.collect({state,ledger:safeRead(K.ledger),debts:safeRead(K.debts)},start,end,{actual:withActual});
}
function eventType(e){
 return M.category(e.kind);
}
function isPending(e){return e.origin!=='actual'&&!(e.origin==='calendar'&&e.done)}
function linkFor(e){
 if(e.origin==='debt'||(e.origin==='calendar'&&e.kind==='debt_payment'))return ['debts.html','До кредитів ↗'];
 return ['ledger.html','Відкрити журнал ↗'];
}
function eventCard(e,compact=false){
 const box=document.createElement('div');
 box.className='fc-cal-item'+(e.done&&e.origin==='calendar'?' is-done':'');
 const icon=document.createElement('span');icon.className='fc-cal-item-icon is-'+eventType(e);icon.textContent=kindIcon[eventType(e)]||'•';icon.setAttribute('aria-hidden','true');
 const body=document.createElement('div');body.className='fc-cal-item-body';
 const heading=document.createElement('div');heading.className='fc-cal-item-head';
 const name=document.createElement('strong');name.textContent=e.name;
 const value=document.createElement('strong');value.className='fc-cal-item-amount is-'+eventType(e);
 const direction=['income','refund','reserve_withdrawal'].includes(e.kind)?'+':'−';
 value.textContent=(e.kind==='internal_transfer'||e.kind==='review'?'':direction)+money(e.cents);
 heading.append(name,value);
 const meta=document.createElement('div');meta.className='fc-cal-item-meta';
 const origin=document.createElement('span');
 origin.textContent=e.origin==='calendar'?'Моя подія':e.origin==='ledger'?'План із журналу':e.origin==='actual'?'Факт із журналу':'Кредитний реєстр';
 const status=document.createElement('span');status.textContent=M.describeStatus(e,currentDate);
 meta.append(origin,status);
 if(e.repeat==='monthly'){const repeat=document.createElement('span');repeat.textContent='↻ Щомісяця';meta.append(repeat)}
 body.append(heading,meta);
 if(e.note&&!compact){const note=document.createElement('p');note.className='fc-cal-item-note';note.textContent=e.note;body.append(note)}
 const actions=document.createElement('div');actions.className='fc-cal-item-actions';
 if(e.origin==='calendar'){
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent=e.done?'↶ Скасувати виконання':'✓ Виконано';
  toggle.setAttribute('aria-label',(e.done?'Скасувати виконання події ':'Позначити виконаною подію ')+e.name+' '+dateText(e.date));
  toggle.onclick=()=>{try{write(s=>{const key=e.id+'|'+e.date;if(e.done)delete s.done[key];else s.done[key]=true});showNotice(e.done?'Позначку виконання скасовано.':'Подію позначено виконаною. Фінансовий запис у журналі не створено.')}
  catch(err){showNotice(err.message,true)}};
  actions.append(toggle);
  if(!compact){
   const edit=document.createElement('button');edit.type='button';edit.textContent='Змінити';edit.onclick=()=>editEvent(e.id);actions.append(edit);
  }
  if(e.kind==='debt_payment'&&!compact){
   const link=document.createElement('a');link.href='debts.html';link.textContent='Зафіксувати платіж ↗';actions.append(link);
  }
 }else if(!compact){
  const [href,label]=linkFor(e);const a=document.createElement('a');a.href=href;a.textContent=label;actions.append(a);
 }
 if(actions.childNodes.length)body.append(actions);
 box.append(icon,body);return box;
}
function goTo(d){
 if(!M.validDate(d))return;
 selected=d;month=d.slice(0,7);render();
}
function renderMonth(){
 const first=month+'-01',last=M.monthEnd(first),all=data(first,last,true),group=new Map();
 for(const e of all){if(!group.has(e.date))group.set(e.date,[]);group.get(e.date).push(e)}
 $('month-title').textContent=M.day(first).toLocaleDateString('uk-UA',{month:'long',year:'numeric'});
 const host=$('calendar');host.replaceChildren();
 const offset=(M.day(first).getDay()+6)%7,total=Number(last.slice(8));
 for(let i=0;i<offset;i++){const blank=document.createElement('div');blank.className='fc-cal-blank';blank.setAttribute('aria-hidden','true');host.append(blank)}
 for(let i=1;i<=total;i++){
  const d=month+'-'+String(i).padStart(2,'0'),items=group.get(d)||[];
  const btn=document.createElement('button');btn.type='button';btn.className='fc-cal-day'+(d===currentDate?' is-today':'')+(d===selected?' is-selected':'');
  btn.setAttribute('aria-label',dateText(d)+(d===currentDate?', сьогодні':'')+', фінансових подій: '+items.length);
  btn.setAttribute('aria-pressed',String(d===selected));
  const head=document.createElement('span');head.className='fc-cal-day-head';
  const num=document.createElement('span');num.className='fc-cal-day-num';num.textContent=String(i);
  head.append(num);
  if(d===currentDate){const tag=document.createElement('span');tag.className='fc-cal-day-flag';tag.textContent='СЬОГОДНІ';head.append(tag)}
  const list=document.createElement('span');list.className='fc-cal-day-list';
  for(const e of items.slice(0,3)){
   const chip=document.createElement('span');chip.className='fc-cal-day-chip is-'+eventType(e)+(e.done?' is-done':'');
   chip.title=e.name+' · '+money(e.cents);
   const dot=document.createElement('span');dot.className='fc-cal-chip-dot';
   const name=document.createElement('span');name.className='fc-cal-chip-text';name.textContent=e.name;
   chip.append(dot,name);list.append(chip);
  }
  if(items.length>3){const more=document.createElement('span');more.className='fc-cal-day-more';more.textContent='+'+(items.length-3);list.append(more)}
  btn.append(head,list);btn.onclick=()=>goTo(d);host.append(btn);
 }
}
function renderSelected(){
 $('selected-title').textContent=selected===currentDate?'Сьогодні · '+shortDate(selected):dateText(selected);
 const events=data(selected,selected,true),host=$('day-events');host.replaceChildren();
 $('selected-count').textContent=countText(events.length);
 if(!events.length){
  const box=document.createElement('div');box.className='fc-cal-empty';box.textContent='На цю дату ще немає подій. Можна запланувати зарплату, оплату або переказ у резерв.';host.append(box);
 }else for(const e of events)host.append(eventCard(e));
 const note=$('day-balance');note.replaceChildren();
 if(selected===currentDate)note.textContent='Події на сьогодні — це план і факти з журналу. Заплановані суми не означають, що гроші вже надійшли чи були сплачені.';
 else if(selected<currentDate)note.textContent='Минулі дати: події зі статусом «виконано» — ручні позначки календаря, не банківські операції.';
 else{
  const current=Number.isSafeInteger(state.opening)?state.opening:0;
  const till=data(M.addDays(currentDate,1),selected,false);
  const projected=till.reduce((s,e)=>s+M.cashDelta(e),current);
  note.textContent='Орієнтовний залишок на кінець дня: '+money(projected)+' · розраховано від введеного доступного залишку.';
 }
}
function addUpcomingRow(e,host,overdue=false){
 const row=document.createElement('button');row.type='button';row.className='fc-cal-upcoming-row';
 const dt=document.createElement('span');dt.className='fc-cal-upcoming-date';dt.textContent=e.date===currentDate?'Сьогодні':shortDate(e.date);
 const content=document.createElement('span');content.className='fc-cal-upcoming-text';
 const title=document.createElement('strong');title.textContent=e.name;
 const sub=document.createElement('small');sub.textContent=(overdue?'Перевір: ':'')+(e.origin==='debt'?'Кредитний термін':e.origin==='ledger'?'План журналу':kindLabel[e.kind]||'Подія');
 content.append(title,sub);
 const amount=document.createElement('strong');amount.className='fc-cal-item-amount is-'+eventType(e);amount.textContent=money(e.cents);
 row.append(dt,content,amount);row.onclick=()=>{goTo(e.date);document.querySelector('.fc-cal-agenda')?.scrollIntoView({behavior:'smooth',block:'nearest'})};
 host.append(row);
}
function renderUpcoming(){
 const future=data(M.addDays(currentDate,1),M.addDays(currentDate,7),false).filter(isPending);
 const host=$('upcoming-events');host.replaceChildren();$('upcoming-count').textContent=countText(future.length);$('stat-week').textContent=countText(future.length);
 if(!future.length){const el=document.createElement('p');el.className='fc-cal-footnote';el.textContent='На найближчі 7 днів нових справ немає.';host.append(el)}
 else{for(const e of future.slice(0,8))addUpcomingRow(e,host);if(future.length>8){const p=document.createElement('p');p.className='fc-cal-footnote';p.textContent='І ще '+(future.length-8)+' подій. Обери відповідні дні в календарі.';host.append(p)}}
 return future.length;
}
function renderOverdue(){
 const old=data(M.addDays(currentDate,-90),M.addDays(currentDate,-1),false).filter(isPending),box=$('overdue-panel');
 $('stat-overdue').textContent=countText(old.length);
 $('stat-overdue').closest('.fc-cal-stat').classList.toggle('has-overdue',old.length>0);
 box.hidden=!old.length;$('overdue-count').textContent=countText(old.length);
 const host=$('overdue-events');host.replaceChildren();
 for(const e of old.slice(-8))addUpcomingRow(e,host,true);
 if(old.length>8){const p=document.createElement('p');p.className='fc-cal-footnote';p.textContent='Показано останні 8 з '+old.length+' нагадувань.';host.append(p)}
}
function renderMetrics(){
 const todayTasks=data(currentDate,currentDate,false).filter(isPending);
 $('stat-today').textContent=countText(todayTasks.length);
 const within=data(M.addDays(currentDate,1),M.addDays(currentDate,30),false);
 const forecast=M.metrics(within,currentDate,30,state.opening);
 $('stat-income').textContent=money(forecast.income);
 $('m-opening').textContent=money(state.opening);
 $('m-in').textContent=money(forecast.income);
 $('m-out').textContent=money(forecast.outgoing);
 $('m-end').textContent=money(forecast.ending);
 $('m-end').classList.toggle('is-danger',forecast.ending<0);
}
function renderTable(){
 const tbody=$('event-table');tbody.replaceChildren();
 for(const e of [...state.events].sort((a,b)=>a.date.localeCompare(b.date))){
  const tr=document.createElement('tr'),cols=[e.date,e.name,kindLabel[e.kind]||e.kind,money(e.cents),e.repeat==='monthly'?'Щомісяця':'Один раз'];
  for(const v of cols){const td=document.createElement('td');td.textContent=v;tr.append(td)}
  const action=document.createElement('td'),edit=document.createElement('button'),del=document.createElement('button');
  edit.type='button';edit.textContent='Змінити';edit.onclick=()=>editEvent(e.id);
  del.type='button';del.textContent='Видалити';del.onclick=()=>{
   if(!confirm('Видалити подію «'+e.name+'» разом із повтореннями?'))return;
   try{write(s=>{s.events=s.events.filter(x=>x.id!==e.id);for(const key of Object.keys(s.done))if(key.startsWith(e.id+'|'))delete s.done[key]});showNotice('Подію видалено з календаря.')}
   catch(err){showNotice(err.message,true)}
  };
  action.append(edit,document.createTextNode(' '),del);tr.append(action);tbody.append(tr);
 }
 if(!state.events.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='Ще немає власних подій. Додай зарплату, кредит або поповнення резерву вище.';tr.append(td);tbody.append(tr)}
}
function render(){
 currentDate=M.today();
 $('today-line').textContent='Сьогодні · '+M.day(currentDate).toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 $('date').value=editing?$('date').value:selected;
 renderMonth();renderSelected();renderUpcoming();renderOverdue();renderMetrics();renderTable();
}
function openForm(template){
 const details=$('add-event');details.open=true;
 editing=null;
 $('event-form').reset();
 $('date').value=selected;
 $('save-event').textContent='Зберегти подію';
 $('form-message').textContent='';
 if(template&&templates[template]){
  const t=templates[template];$('name').value=t.name;$('kind').value=t.kind;$('repeat').value=t.repeat;
 }
 details.scrollIntoView({behavior:'smooth',block:'nearest'});
 if(template)$('amount').focus({preventScroll:true});else $('name').focus({preventScroll:true});
}
function editEvent(id){
 const found=state.events.find(e=>e.id===id);if(!found)return;
 editing=id;
 const fields=$('event-form');
 fields.reset();
 $('name').value=found.name;$('date').value=found.date;$('amount').value=(found.cents/100).toFixed(2);
 $('kind').value=found.kind;$('repeat').value=found.repeat;$('note').value=found.note||'';
 $('save-event').textContent='Зберегти зміни';
 $('form-message').textContent='Редагування події. Якщо змінити дату, суму, тип або повторення — старі позначки виконання буде очищено.';
 $('add-event').open=true;
 $('add-event').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function validCents(value){
 const n=Number(value),c=Math.round(n*100);
 if(!Number.isFinite(n)||!Number.isSafeInteger(c)||c<=0||Math.abs(n*100-c)>1e-6)throw Error('Введи коректну суму у гривнях.');
 return c;
}
$('quick-add').onclick=()=>openForm();
for(const b of document.querySelectorAll('[data-template]'))b.onclick=()=>openForm(b.dataset.template);
$('cancel-add').onclick=()=>{editing=null;$('add-event').open=false;$('event-form').reset();$('form-message').textContent=''};
$('event-form').onsubmit=e=>{
 e.preventDefault();
 try{
  const values={name:$('name').value.trim(),date:$('date').value,kind:$('kind').value,cents:validCents($('amount').value),repeat:$('repeat').value,note:$('note').value.trim()};
  if(!values.name)throw Error('Укажи назву події.');
  if(!M.validDate(values.date))throw Error('Укажи коректну дату.');
  if(!['income','expense','reserve_deposit','debt_payment'].includes(values.kind))throw Error('Некоректний тип події.');
  if(!['once','monthly'].includes(values.repeat))throw Error('Некоректне повторення.');
  if(editing&&!state.events.some(x=>x.id===editing))throw Error('Подію вже видалено.');
  const old=editing?state.events.find(x=>x.id===editing):null,id=old?.id||crypto.randomUUID();
  write(s=>{
   if(old){
    const index=s.events.findIndex(x=>x.id===id);
    s.events[index]={...s.events[index],...values};
    if(['date','kind','cents','repeat'].some(k=>old[k]!==values[k])){
     for(const key of Object.keys(s.done))if(key.startsWith(id+'|'))delete s.done[key];
    }
   }else s.events.push({id,...values});
  });
  const text=editing?'Зміни збережено.':'Подію додано в календар.';
  selected=values.date;month=values.date.slice(0,7);editing=null;
  $('add-event').open=false;$('event-form').reset();render();showNotice(text);
 }catch(err){$('form-message').textContent=err.message;showNotice(err.message,true)}
};
$('prev').onclick=()=>{month=M.shiftMonth(month,-1);selected=month+'-01';render()};
$('next').onclick=()=>{month=M.shiftMonth(month,1);selected=month+'-01';render()};
function goToday(){currentDate=M.today();selected=currentDate;month=currentDate.slice(0,7);render();clearNotice()}
$('today').onclick=goToday;
$('jump-today').onclick=goToday;
$('opening').value=(state.opening/100).toFixed(2);
$('save-opening').onclick=()=>{
 try{const n=Number($('opening').value),c=Math.round(n*100);
  if(!Number.isFinite(n)||!Number.isSafeInteger(c)||c<0||Math.abs(n*100-c)>1e-6)throw Error('Укажи коректний доступний залишок.');
  write(s=>{s.opening=c});showNotice('Початкову доступну суму збережено. Це не банківський баланс.')
 }catch(err){showNotice(err.message,true)}
};
$('export').onclick=()=>{
 const columns=[['Перша дата','Назва','Тип','Сума грн','Повторення'],...state.events.map(e=>[e.date,e.name,kindLabel[e.kind]||e.kind,(e.cents/100).toFixed(2),e.repeat])];
 const csv='\ufeff'+columns.map(row=>row.map(S.csvCell).join(';')).join('\r\n');
 S.download('fincontrol-calendar-'+currentDate+'.csv',csv,'text/csv;charset=utf-8');
};
window.addEventListener('storage',e=>{
 if([K.calendar,K.ledger,K.debts].includes(e.key)){refreshState();render()}
});
function updateDay(){
 const d=M.today();
 if(d!==currentDate){
  const follow=selected===currentDate;
  currentDate=d;
  if(follow){selected=d;month=d.slice(0,7)}
  render();
 }
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateDay()});
window.addEventListener('focus',updateDay);
setInterval(updateDay,60*1000);
try{
 await S.ready;
 refreshState();
 $('opening').value=(state.opening/100).toFixed(2);
 render();
}catch(err){showNotice('Не вдалося прочитати календар: '+err.message,true)}
})();

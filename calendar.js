/* FINCONTROL calendar workspace: local plans, linked actuals and accessible daily actions. */
(async function(){
'use strict';
const M=FCCalendarModel,A=FCCalendarActions,S=FCStore,K=S.K,$=id=>document.getElementById(id);
const uid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():'cal-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',minimumFractionDigits:n%100?2:0,maximumFractionDigits:2}).format(n/100);
const compact=n=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:n%100?2:0}).format(n/100);
const shortDate=d=>M.day(d).toLocaleDateString('uk-UA',{day:'numeric',month:'short'});
const dateText=d=>M.day(d).toLocaleDateString('uk-UA',{day:'numeric',month:'long',year:'numeric'});
const monthText=d=>M.day(d).toLocaleDateString('uk-UA',{month:'long',year:'numeric'});
const repeatLabel={once:'Один раз',weekly:'Щотижня',monthly:'Щомісяця',twice_monthly:'Двічі на місяць',month_end:'Останній день місяця'};
const kindLabel={income:'Надходження',expense:'Витрата',debt_payment:'Кредит',reserve_deposit:'До фінподушки',refund:'Повернення',reserve_withdrawal:'Із фінподушки',internal_transfer:'Переказ',cash_withdrawal:'Готівка',review:'Уточнення'};
const icons={income:'↓',expense:'↑',credit:'▣',reserve:'◈',other:'↔'};
const templates={salary:{name:'Зарплата',kind:'income',repeat:'monthly'},bill:{name:'Комунальні послуги',kind:'expense',repeat:'monthly'},credit:{name:'Платіж за кредитом',kind:'debt_payment',repeat:'monthly'},reserve:{name:'Поповнення фінподушки',kind:'reserve_deposit',repeat:'monthly'}};
let now=M.today(),selected=now,anchor=now,view='month',kind='all',status='all';
let state=M.normalize(),ledger=null,debts=null,editing=null,detail=null,forecast=null;
const refs=new Map();
// Visual preference is separate from finance data and never changes calculations.
const SCENE_KEY='fincontrol-calendar-scene-v1';
const sceneToggle=$('cal-scene-toggle');
function applyScene(enabled){
 document.body.classList.toggle('cal-scene-off',!enabled);
 sceneToggle.setAttribute('aria-pressed',String(enabled));
 sceneToggle.setAttribute('aria-label',enabled?'Вимкнути атмосферне тло':'Увімкнути атмосферне тло');
 sceneToggle.textContent=enabled?'◐ Тло':'◑ Тло';
}
let sceneOn=true;
try{sceneOn=localStorage.getItem(SCENE_KEY)!=='off'}catch{}
applyScene(sceneOn);
sceneToggle.onclick=()=>{
 sceneOn=!sceneOn;applyScene(sceneOn);
 try{localStorage.setItem(SCENE_KEY,sceneOn?'on':'off')}catch{}
};
function notice(text,error=false){$('calendar-notice').textContent=text;$('calendar-notice').hidden=!text;$('calendar-notice').classList.toggle('is-error',error)}
function refresh(){state=M.normalize(S.read(K.calendar));ledger=S.read(K.ledger);debts=S.read(K.debts)}
const input=()=>({state,ledger,debts});
const collect=(a,b,actual=true)=>M.collect(input(),a,b,{actual});
const pending=M.pending;
function ref(e){refs.set(e.key,e);return esc(e.key)}
function matches(e){return(kind==='all'||e.category===kind)&&(status==='all'||status==='pending'&&pending(e)||status==='partial'&&e.origin==='calendar'&&e.paid>0&&!e.settled||status==='done'&&e.done||status==='overdue'&&pending(e)&&e.date<now)}
function range(){if(status==='overdue'&&view==='list')return[M.addDays(now,-90),M.addDays(now,-1)];if(view==='week'){const start=M.weekStart(anchor);return[start,M.addDays(start,6)]}return[M.monthStart(anchor),M.monthEnd(anchor)]}
function row(e,upcoming=false){
 const overdue=pending(e)&&e.date<now;let meta=M.describeStatus(e,now);
 if(e.origin==='calendar'&&e.paid&&!e.settled)meta+=' · лишилось '+money(e.remaining);
 if(upcoming)meta=kindLabel[e.kind]||'Операція';
 const symbol=upcoming?M.day(e.date).toLocaleDateString('uk-UA',{day:'numeric',month:'short'}):icons[e.category]||'↔';
 return `<button class="cal-event-row is-${esc(e.category)}${e.done?' is-done':''}${overdue?' is-overdue':''}" data-event="${ref(e)}" aria-label="${esc(e.name+', '+money(e.cents)+', '+M.describeStatus(e,now))}"><span class="cal-event-symbol" aria-hidden="true">${esc(symbol)}</span><span class="cal-event-text"><strong>${esc(e.name)}</strong><small>${overdue&&!upcoming?'! ':''}${esc(meta)}</small></span><strong class="cal-event-amount">${['income','refund','reserve_withdrawal'].includes(e.kind)?'+':''}${esc(money(e.origin==='calendar'&&e.settled?e.paid:e.cents))}</strong></button>`;
}
function empty(text='На цей день усе вільно',sub='Заплануй надходження, рахунок або поповнення резерву.'){return `<div class="cal-empty"><span class="cal-empty-symbol" aria-hidden="true">◇</span><strong>${esc(text)}</strong>${esc(sub)}</div>`}
function dayCell(d,items,week=false){
 const alerts=items.filter(e=>pending(e)&&e.date<now).length,today=d===now,other=d.slice(0,7)!==anchor.slice(0,7),sum=items.reduce((s,e)=>s+M.cashDelta(e),0),preview=items.slice(0,5).map(e=>e.name).join(' · ');
 const head=`<button class="cal-day-button" data-date="${d}" aria-pressed="${d===selected}" ${today?'aria-current="date"':''} aria-label="${esc(dateText(d)+(today?', сьогодні':'')+', подій: '+items.length+(alerts?', прострочених: '+alerts:''))}" title="${esc(dateText(d)+(preview?' · '+preview:' · Подій немає'))}" tabindex="${d===selected?0:-1}">${week?'<span>'+M.day(d).toLocaleDateString('uk-UA',{weekday:'short'})+'</span>':''}<span class="cal-date-number">${Number(d.slice(8))}</span>${alerts?'<span class="cal-day-alert" title="Є прострочені події">!</span>':''}</button>`;
 const chips=items.slice(0,week?7:3).map(e=>`<button class="cal-chip is-${esc(e.category)}${e.done?' is-done':''}" data-event="${ref(e)}" ${e.origin==='calendar'&&!e.done?'draggable="true"':''} title="${esc(e.name+' · '+money(e.cents)+' · '+M.describeStatus(e,now))}"><span class="cal-chip-icon" aria-hidden="true">${e.done?'✓':icons[e.category]||'•'}</span><span class="cal-chip-title">${esc(e.name)}</span><span class="cal-chip-sum">${esc(compact(e.origin==='calendar'&&e.settled?e.paid:e.cents))}</span></button>`).join('');
 const max=week?7:3,more=items.length>max?`<button class="cal-more" data-date="${d}">Ще ${items.length-max}</button>`:'';
 const mobile=`<div class="cal-mobile-dots" aria-hidden="true">${items.slice(0,4).map(e=>`<i class="is-${esc(e.category)}${e.done?' is-done':''}"></i>`).join('')}</div>${sum?'<span class="cal-mobile-total" aria-hidden="true">'+(sum>0?'+':'')+esc(compact(sum))+'</span>':''}`;
 return `<div class="cal-cell${today?' is-today':''}${d===selected?' is-selected':''}${other?' is-other':''}" data-cell-date="${d}" data-event-count="${items.length}" data-extra-count="${items.length>4?'+'+(items.length-4):''}">${head}${chips}${more}${mobile}</div>`;
}
let lastPeriodSignature='',lastDayAnimated='';
const calendarReduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
function animateSurface(node,day=false){
 if(!node||typeof node.animate!=='function'||calendarReduced?.matches)return;
 for(const previous of node.getAnimations?.()||[])previous.cancel();
 node.animate([
  {opacity:.42,transform:day?'translate3d(10px,4px,0)':'translate3d(0,14px,0) scale(.985)',filter:'blur(5px)'},
  {opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'blur(0px)'}
 ],{duration:day?310:490,easing:'cubic-bezier(.22,1,.36,1)'});
}
function renderCalendar(){
 const [start,end]=range();let title=view==='week'?(start.slice(0,7)===end.slice(0,7)?Number(start.slice(8))+'–'+shortDate(end):shortDate(start)+' – '+shortDate(end)):monthText(start);
 if(status==='overdue'&&view==='list')title='Потребують уваги';
 $('month-title').textContent=title;
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
 $('status-filter').value=status;
 const host=$('calendar-content'),events=collect(start,end).filter(matches);
 $('period-count').textContent=events.length+' подій · суми у ₴';
 if(view==='list'){
  const groups=new Map();for(const e of events){if(!groups.has(e.date))groups.set(e.date,[]);groups.get(e.date).push(e)}
  host.innerHTML=groups.size?'<div class="cal-list">'+[...groups].map(([d,list])=>`<div class="cal-list-group"><div class="cal-list-heading"><h3>${esc(dateText(d))}${d===now?' · Сьогодні':''}</h3><small>${list.length} подій</small></div>${list.map(e=>row(e)).join('')}</div>`).join('')+'</div>':empty('Подій не знайдено','Зміни фільтри, період або створи нову подію.');
 }else{
  const from=view==='week'?start:M.weekStart(start),to=view==='week'?end:M.addDays(M.weekStart(end),6),all=collect(from,to).filter(matches),days=[];
  for(let d=from;d<=to;d=M.addDays(d,1))days.push(dayCell(d,all.filter(e=>e.date===d),view==='week'));
  host.innerHTML=(view==='month'?'<div class="cal-weekdays" aria-hidden="true">'+['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d=>'<span>'+d+'</span>').join('')+'</div>':'')+`<div class="${view==='week'?'cal-week-grid':'cal-month-grid'}" role="group" aria-label="Дні календаря">${days.join('')}</div>`;
  if(!host.querySelector('.cal-day-button[tabindex="0"]'))host.querySelector('.cal-day-button')?.setAttribute('tabindex','0');
 }
 $('mobile-agenda').hidden=view==='list';
 const periodSignature=[view,start,end,kind,status].join('|');
 if(lastPeriodSignature&&periodSignature!==lastPeriodSignature)animateSurface(host);
 lastPeriodSignature=periodSignature;
}
function daySummary(events){const ins=events.reduce((s,e)=>s+Math.max(0,M.cashDelta(e)),0),outs=events.reduce((s,e)=>s+Math.max(0,-M.cashDelta(e)),0);return`<div><small>Очікується</small>↓ ${esc(money(ins))}</div><div><small>До сплати / переказу</small>↑ ${esc(money(outs))}</div>`}
function dayBalance(){if(!forecast.known)return'<span>Додай стартову суму для прогнозу</span><button class="cal-quiet" data-opening>＋</button>';if(selected<now)return'<span>Минула дата · переглядай факти в подіях</span>';const p=selected<=M.addDays(now,30)?forecast:M.project(input(),now,selected),point=p.rows.find(x=>x.date===selected);return point?`<span>За планом на кінець дня</span><strong class="${point.balance<0?'cal-danger':''}">${esc(money(point.balance))}</strong>`:'<span>Немає прогнозу на цю дату</span>'}
function renderSelected(){
 const events=collect(selected,selected).filter(matches),title=(selected===now?'Сьогодні, ':'')+shortDate(selected);
 $('selected-title').textContent=title;$('day-summary').innerHTML=daySummary(events);$('day-events').innerHTML=events.length?events.map(e=>row(e)).join(''):empty();$('day-balance').innerHTML=dayBalance();
 $('mobile-agenda').innerHTML=`<div class="cal-agenda-head"><h2>${esc(title)}</h2><button class="cal-icon" data-new-day aria-label="Додати подію на обраний день">＋</button></div><div class="cal-day-summary">${daySummary(events)}</div>${events.length?events.map(e=>row(e)).join(''):empty()}<div class="cal-balance">${dayBalance()}</div>`;
 const upcoming=collect(M.addDays(now,1),M.addDays(now,7),false).filter(pending).slice(0,4);
 $('upcoming-events').innerHTML=upcoming.length?upcoming.map(e=>row(e,true)).join(''):'<p class="cal-footnote">На наступні 7 днів нових справ немає.</p>';
 if(lastDayAnimated&&lastDayAnimated!==selected){
  animateSurface($('day-events'),true);
  animateSurface($('mobile-agenda'),true);
 }
 lastDayAnimated=selected;
}
function renderForecast(){
 $('stat-income').textContent=money(forecast.income);$('stat-outgoing').textContent=money(forecast.outgoing);
 $('forecast-empty').hidden=forecast.known;$('forecast-content').hidden=!forecast.known;$('opening-edit').textContent=forecast.known?'Оновити залишок ↗':'Вказати залишок ↗';
 if(!forecast.known)return;
 $('opening-date').textContent='· '+shortDate(state.openingDate);$('m-opening').textContent=money(state.opening);$('m-end').textContent=money(forecast.ending);$('m-min').textContent=money(forecast.minimum);
 $('m-min').classList.toggle('cal-danger',forecast.minimum<0);$('m-end').classList.toggle('cal-danger',forecast.ending<0);
 const warning=$('forecast-warning');warning.classList.toggle('is-danger',!!forecast.firstDeficit);warning.textContent=forecast.firstDeficit?'! Можливий дефіцит із '+shortDate(forecast.firstDeficit)+' · Перевір дати платежів і надходжень.':'За внесеними планами коштів вистачає до '+shortDate(M.addDays(now,30));
 const rows=forecast.rows,width=900,height=110,min=Math.min(0,...rows.map(r=>r.balance)),max=Math.max(1,...rows.map(r=>r.balance)),y=n=>12+(max-n)/(max-min)*70,x=i=>8+i/(rows.length-1)*(width-16),points=rows.map((r,i)=>x(i)+','+y(r.balance)).join(' ');
 const zero=y(0),selectedPoint=rows.findIndex(r=>r.date===selected);
 let svg=`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="group" aria-label="Прогноз доступних коштів; натисни дату для перегляду подій"><defs><linearGradient id="cal-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#AB2B41" stop-opacity=".27"/><stop offset="1" stop-color="#AB2B41" stop-opacity="0"/></linearGradient></defs><line x1="0" y1="${zero}" x2="900" y2="${zero}" stroke="#584B52" stroke-dasharray="3 4"/><polygon points="${x(0)},82 ${points} ${x(rows.length-1)},82" fill="url(#cal-area)"/><polyline points="${points}" fill="none" stroke="#CDD7DC" stroke-width="1.8" vector-effect="non-scaling-stroke"/>`;
 if(selectedPoint>=0)svg+=`<line x1="${x(selectedPoint)}" x2="${x(selectedPoint)}" y1="7" y2="85" stroke="#584B52" stroke-dasharray="3 3"/><circle cx="${x(selectedPoint)}" cy="${y(rows[selectedPoint].balance)}" r="4" style="opacity:1;fill:#FA2F4C"/>`;
 rows.forEach((r,i)=>{svg+=`<g data-forecast-date="${r.date}" tabindex="0" role="button" aria-label="${esc(shortDate(r.date)+': '+money(r.balance))}"><title>${esc(dateText(r.date)+' · '+money(r.balance))}</title><rect x="${x(i)-12}" y="0" width="24" height="88" fill="transparent"/><circle cx="${x(i)}" cy="${y(r.balance)}" r="4"/></g>`});
 [0,7,14,21,30].forEach(i=>svg+=`<text x="${x(i)}" y="105" text-anchor="${i===0?'start':i===30?'end':'middle'}">${esc(shortDate(rows[i].date))}</text>`);
 $('forecast-chart').innerHTML=svg+'</svg>';$('forecast-table').innerHTML=rows.map(r=>`<tr><td>${esc(dateText(r.date))}</td><td>${esc(money(r.balance))}</td></tr>`).join('');
}
function nextInstance(e){const list=M.collect({state:{...state,events:[e]},ledger,debts:null},now,M.addDays(now,740));return list[0]||M.occurrence(state,e,e.date,ledger)}
function renderTable(){
 $('template-count').textContent=state.events.filter(e=>!e.until||e.until>=now).length;
 $('event-table').innerHTML=state.events.map(e=>{const item=nextInstance(e);return`<tr><td>${esc(e.name)}${e.until?' · до '+esc(shortDate(e.until)):''}</td><td>${esc(money(e.cents))}</td><td>${esc(repeatLabel[e.repeat]||'Один раз')}</td><td>${esc(shortDate(e.date))}</td><td>${item?`<button class="cal-quiet" data-event="${ref(item)}">Деталі ↗</button>`:'Завершено'}</td></tr>`}).join('')||'<tr><td colspan="5">Тут з’являться твої події та повторення.</td></tr>';
}
function render(){
 now=M.today();refs.clear();forecast=M.project(input(),now);
 $('today-line').textContent=M.day(now).toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 $('stat-today').textContent=collect(now,now,false).filter(pending).length;
 const overdue=collect(M.addDays(now,-90),M.addDays(now,-1),false).filter(pending).length;$('stat-overdue').textContent=overdue;$('stat-overdue-action').classList.toggle('has-overdue',overdue>0);
 renderCalendar();renderSelected();renderForecast();renderTable();
}
function goTo(d){if(!M.validDate(d))return;selected=d;anchor=d;render()}
function payload(e){return{eventId:e.id,occurrence:e.occurrence,expected:M.fingerprint(e)}}
async function transaction(fn){await S.update([K.calendar,K.ledger,K.debts],d=>fn(d));refresh();render()}
async function run(button,fn,errorId){if(button?.disabled)return;if(button)button.disabled=true;try{await fn()}catch(e){if(errorId)$(errorId).textContent=e.message;else notice(e.message,true)}finally{if(button)button.disabled=false}}
function closeDialogs(){for(const id of ['event-drawer','form-drawer'])$(id).close()}
function showDetail(e,focusBooking=false){
 detail=e;const cal=e.origin==='calendar',statusText=M.describeStatus(e,now),actual=e.origin==='actual',date=cal&&e.date!==e.occurrence?dateText(e.date)+' · перенесено з '+shortDate(e.occurrence):dateText(e.date);
 $('event-detail').innerHTML=`<span class="cal-event-symbol is-${esc(e.category)}" aria-hidden="true">${icons[e.category]||'↔'}</span><h2 id="drawer-title">${esc(e.name)}</h2><p class="cal-muted">${esc(date)}</p><div class="cal-detail-meta"><span>${esc(kindLabel[e.kind]||'Операція')}</span><span>${esc(statusText)}</span>${cal&&e.repeat!=='once'?'<span>↻ '+esc(repeatLabel[e.repeat])+'</span>':''}</div><div class="cal-detail-totals"><div><small>${actual?'Фактична сума':'План'}</small><strong>${esc(money(e.cents))}</strong></div>${cal?'<div><small>Внесено фактично</small><strong>'+esc(money(e.paid))+'</strong></div><p>'+(e.settled?'Різниця з планом: '+(e.difference>0?'+':'')+esc(money(e.difference)):'Залишилось за планом: '+esc(money(e.remaining)))+'</p>':''}</div>${e.note?'<p class="cal-detail-note">'+esc(e.note)+'</p>':''}<div id="detail-notice" class="cal-form-message" role="status"></div>`;
 const host=$('event-detail');
 if(cal){
  if(e.operationIds.length)host.insertAdjacentHTML('beforeend','<div class="cal-payment-list"><h3>Пов’язані факти</h3>'+e.payments.map(p=>'<div class="cal-payment-row"><span>'+esc(shortDate(p.date))+'</span><strong>'+esc(money(p.cents))+'</strong><button class="cal-quiet" type="button" data-unlink-id="'+esc(p.id)+'" aria-label="Відв’язати факт від календаря">Відв’язати</button></div>').join('')+'<a class="cal-quiet" href="ledger.html">Відкрити журнал ↗</a></div>');
  host.insertAdjacentHTML('beforeend',`<div class="cal-detail-actions">${!e.settled?'<button id="record-fact" class="cal-primary">Внести факт</button>':''}<button id="edit-detail" class="cal-secondary">Змінити подію</button></div>`);
  $('edit-detail').onclick=()=>openForm(null,e);
  if(!e.settled){$('record-fact').onclick=()=>showBooking(e);}
  host.querySelectorAll('[data-unlink-id]').forEach(button=>button.onclick=ev=>run(ev.currentTarget,async()=>{
   const operationId=ev.currentTarget.dataset.unlinkId;
   if(!confirm('Відв’язати факт від цієї події? Фінансова операція, баланс кредиту й резерв залишаться без змін.'))return;
   await transaction(d=>A.unlink(d,K,{...payload(e),operationId}));
   const updated=M.occurrence(state,state.events.find(x=>x.id===e.id),e.occurrence,ledger);
   if(updated)showDetail(updated);else $('event-drawer').close();
   notice('Факт відв’язано. Фінансова операція залишилась у журналі, списання не скасовано.');
  },'detail-notice'));
  if(!e.done)host.insertAdjacentHTML('beforeend',`<form id="move-form" class="cal-form cal-move-form"><label>Перенести лише цю подію<div class="cal-two"><input id="move-date" aria-label="Нова дата події" type="date" value="${e.date}" required><button class="cal-secondary" type="submit">Перенести</button></div></label></form>`);
  if($('move-form'))$('move-form').onsubmit=ev=>{ev.preventDefault();run(ev.submitter,async()=>{await moveEvent(e,$('move-date').value);$('event-drawer').close()},'detail-notice')};
  host.insertAdjacentHTML('beforeend',`<details class="cal-detail-secondary"><summary>Інші дії</summary>${!e.paid?`<button id="close-reminder" class="cal-quiet">${e.reminderDone?'Повернути нагадування':'Закрити без запису в журналі'}</button><p class="cal-footnote">Гроші не змінюються. Подія перестає враховуватись у прогнозі.</p><button id="skip-event" class="cal-quiet cal-danger">Пропустити цю подію</button>${e.repeat!=='once'?'<button id="stop-series" class="cal-quiet cal-danger">Зупинити серію від цієї дати</button>':''}`:'<p class="cal-footnote">Подія з фактом залишається в історії. Виправлення операцій — у журналі або кредитному реєстрі.</p>'}</details>`);
  if($('close-reminder'))$('close-reminder').onclick=ev=>run(ev.currentTarget,async()=>{await transaction(d=>{const item=A.fresh(d,K,payload(e));if(item.paid)throw Error('Подія вже має фактичні платежі.');if(item.reminderDone)delete d[K.calendar].done[item.key];else d[K.calendar].done[item.key]=true});$('event-drawer').close();notice(e.reminderDone?'Нагадування повернуто.':'Нагадування закрито. Запис у журналі не створювався.')},'detail-notice');
  for(const [id,scope] of [['skip-event','one'],['stop-series','future']])if($(id))$(id).onclick=ev=>run(ev.currentTarget,async()=>{if(!confirm(scope==='future'?'Зупинити цю та наступні події серії? Попередня історія збережеться.':'Пропустити цю подію? Фактичні операції не зміняться.'))return;await transaction(d=>A.remove(d,K,{...payload(e),scope}));$('event-drawer').close();notice('План оновлено.')},'detail-notice');
 }else{
  const href=e.origin==='debt'?'debts.html':'ledger.html';host.insertAdjacentHTML('beforeend',`<p class="cal-detail-note">${e.origin==='debt'?'Термін із кредитного реєстру. Створи пов’язану подію, щоб включити платіж у прогноз і внести факт тут.':actual?'Це підтверджена операція з журналу.':e.kind==='debt_payment'?'Для оплати цього планового кредиту користуйся реєстром «Кредити».':'Цей план можна підтвердити прямо тут. Запис у журналі стане фактичним без дублювання.'}</p><div class="cal-detail-actions"><a class="cal-secondary" href="${href}">Відкрити ${e.origin==='debt'?'кредити':'журнал'} ↗</a>${e.origin==='debt'?'<button id="plan-credit" class="cal-primary">Запланувати платіж</button>':''}</div>`);
  if(e.origin==='actual'&&Number.isSafeInteger(e.plannedCents)&&M.validDate(e.plannedDate)){
   const variance=e.cents-e.plannedCents;
   host.insertAdjacentHTML('beforeend','<div class="cal-payment-list"><h3>План → Факт</h3><div class="cal-payment-row"><span>Спочатку заплановано · '+esc(shortDate(e.plannedDate))+'</span><strong>'+esc(money(e.plannedCents))+'</strong></div><div class="cal-payment-row"><span>Фактично внесено</span><strong>'+esc(money(e.cents))+'</strong></div><div class="cal-payment-row"><span>Різниця</span><strong>'+esc((variance>0?'+':'')+money(variance))+'</strong></div></div>');
  }
  if($('plan-credit'))$('plan-credit').onclick=()=>{openForm('credit');$('name').value=e.name;$('date').value=e.date;$('amount').value=(e.cents/100).toFixed(2);$('credit').value=e.id;$('repeat').value='once'};
  if(e.origin==='ledger'&&e.status==='planned'&&!['debt_payment','review'].includes(e.kind)){
   const actions=host.querySelector('.cal-detail-actions');
   actions.insertAdjacentHTML('beforeend','<button id="confirm-journal" class="cal-primary" type="button">Підтвердити як факт</button>');
   $('confirm-journal').onclick=()=>showLedgerBooking(e);
  }
 }
 if(!$('event-drawer').open){closeDialogs();$('event-drawer').showModal()}
 if(focusBooking&&!e.settled)showBooking(e);
}
function showBooking(e){
 if($('booking-form')){$('fact-amount')?.focus();return}
 const eligible=(ledger?.entries||[]).filter(x=>x.status==='actual'&&!x.calendarKey&&x.kind===e.kind&&x.date<=now&&(e.kind!=='debt_payment'||e.creditId&&x.creditId===e.creditId)).sort((a,b)=>b.date.localeCompare(a.date));
 $('record-fact').hidden=true;
 const form=document.createElement('div');form.className='cal-booking';form.innerHTML=`<h3>Внести фактичну операцію</h3><p class="cal-footnote">Якщо платіж або зарплата вже внесені до журналу (наприклад, імпортовані з Приват24), обери їх нижче — новий запис не створиться.</p><form id="booking-form" class="cal-form"><label>Джерело факту<select id="fact-source"><option value="new">Створити нову операцію</option><option value="existing" ${eligible.length?'':'disabled'}>Прив’язати з журналу (${eligible.length})</option></select></label><label id="existing-field" hidden>Операція<select id="fact-existing"><option value="">Обери операцію</option>${eligible.map(x=>`<option value="${esc(x.id)}">${esc(shortDate(x.date)+' · '+x.category+' · '+money(x.cents))}</option>`).join('')}</select></label><div id="new-fact-fields"><div class="cal-two"><label>Фактична дата<input id="fact-date" type="date" value="${e.date>now?now:e.date}" max="${now}" required></label><label>Факт, грн<input id="fact-amount" type="number" step=".01" min=".01" required value="${(e.remaining/100).toFixed(2)}" inputmode="decimal"></label></div><p class="cal-footnote">${e.kind==='debt_payment'?'Журнал і залишок прив’язаного кредиту оновляться разом.':'Операція з’явиться в журналі як факт.'}</p></div><label class="cal-check"><input id="fact-finalize" type="checkbox" checked><span>Завершити подію цією сумою.<br>Зніми позначку для часткової оплати.</span></label><p id="booking-message" class="cal-form-message" role="status"></p><div class="cal-form-actions"><button id="cancel-booking" class="cal-secondary" type="button">Скасувати</button><button id="save-fact" class="cal-primary" type="submit">Зберегти факт</button></div></form>`;
 $('event-detail').querySelector('.cal-detail-actions').after(form);
 $('fact-source').onchange=()=>{const existing=$('fact-source').value==='existing';$('new-fact-fields').hidden=existing;$('existing-field').hidden=!existing;$('fact-date').disabled=existing;$('fact-amount').disabled=existing;$('fact-existing').required=existing};
 $('fact-amount').oninput=()=>{$('fact-finalize').checked=parseMoney($('fact-amount').value,false,false)>=e.remaining};
 $('fact-existing').onchange=()=>{const item=eligible.find(x=>x.id===$('fact-existing').value);if(item)$('fact-finalize').checked=item.cents>=e.remaining};
 $('cancel-booking').onclick=()=>{form.remove();$('record-fact').hidden=false;$('record-fact').focus()};
 const operationId=uid(),historyId=uid();
 $('booking-form').onsubmit=ev=>{ev.preventDefault();run(ev.submitter,async()=>{
  const existingId=$('fact-source').value==='existing'?$('fact-existing').value:null;
  if($('fact-source').value==='existing'&&!existingId)throw Error('Обери операцію з журналу.');
  const p={...payload(e),existingId,date:$('fact-date').value,cents:existingId?0:parseMoney($('fact-amount').value),finalize:$('fact-finalize').checked,operationId,historyId,today:now};
  await transaction(d=>A.book(d,K,p));const current=M.occurrence(state,state.events.find(x=>x.id===e.id),e.occurrence,ledger);showDetail(current);notice(existingId?'Операцію прив’язано. Додатковий фінансовий запис не створювався.':'Факт збережено. Календар і журнал оновлено.');
 },'booking-message')};
 $('fact-amount').focus();form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'nearest'});
}

function showLedgerBooking(e){
 if($('confirm-journal-form')){$('journal-fact-amount')?.focus();return}
 const source=ledger?.entries.find(item=>item.id===e.id&&item.status==='planned');
 if(!source){$('detail-notice').textContent='План змінено або вже підтверджено. Онови календар.';return}
 const expected=JSON.stringify([source.id,source.date,source.kind,source.cents,source.category,source.note,source.status,source.calendarKey||'']);
 const button=$('confirm-journal'),form=document.createElement('form');
 button.hidden=true;form.id='confirm-journal-form';form.className='cal-form cal-booking';
 form.innerHTML='<h3>План → Факт</h3><p class="cal-footnote">Це змінить статус <strong>цього самого</strong> запису журналу з «План» на «Факт», не створюючи додаткової транзакції. Перевір, чи сума вже не внесена окремо через імпорт.</p><div class="cal-two"><label>Дата факту<input id="journal-fact-date" type="date" max="'+now+'" value="'+(e.date>now?now:e.date)+'" required></label><label>Фактична сума, грн<input id="journal-fact-amount" type="number" step=".01" min=".01" inputmode="decimal" value="'+(e.cents/100).toFixed(2)+'" required></label></div><p class="cal-footnote">Якщо сума або дата змінилася, початковий план залишиться в метаданих операції для звірки.</p><p id="journal-booking-message" class="cal-form-message" role="status"></p><div class="cal-form-actions"><button id="cancel-journal-booking" type="button" class="cal-secondary">Скасувати</button><button type="submit" class="cal-primary">Підтвердити факт</button></div>';
 $('event-detail').querySelector('.cal-detail-actions').after(form);
 $('cancel-journal-booking').onclick=()=>{form.remove();button.hidden=false;button.focus()};
 form.onsubmit=ev=>{ev.preventDefault();run(ev.submitter,async()=>{
  const p={entryId:e.id,expected,date:$('journal-fact-date').value,cents:parseMoney($('journal-fact-amount').value),today:now};
  await S.update([K.ledger,K.reserve],d=>A.confirmPlanned(d,K,p));
  refresh();render();$('event-drawer').close();
  notice('План підтверджено. Замість другого запису операція в журналі стала фактичною.');
 },'journal-booking-message')};
 $('journal-fact-amount').focus();
}
function parseMoney(value,zero=false,throws=true){const n=Number(value),c=Math.round(n*100);if(value===''||!Number.isFinite(n)||!Number.isSafeInteger(c)||(zero?c<0:c<=0)||Math.abs(n*100-c)>1e-6){if(throws)throw Error('Введи коректну суму у гривнях, до двох знаків після коми.');return 0}return c}
function populateCredits(id=''){$('credit').innerHTML='<option value="">Не прив’язано</option>'+(debts?.credits||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.name+' · залишок '+money(c.balance))}</option>`).join('');$('credit').value=id}
function formVisibility(){const recurring=editing&&editing.repeat!=='once';$('credit-field').hidden=$('kind').value!=='debt_payment';$('scope-field').hidden=!recurring;$('repeat').disabled=!!editing&&(!recurring||$('edit-scope').value==='one');$('second-day-field').hidden=$('repeat').value!=='twice_monthly';$('second-day').disabled=$('repeat').disabled}
function openForm(template,e=null){
 editing=e;closeDialogs();$('event-form').reset();$('form-message').textContent='';$('form-title').textContent=e?'Змінити подію':'Нова подія';$('date').value=e?.date||selected;
 const values=e||templates[template]||{};for(const field of ['name','kind','repeat','note'])if(values[field]!==undefined)$(field).value=values[field];if(e){$('amount').value=(e.cents/100).toFixed(2);$('second-day').value=state.events.find(x=>x.id===e.id)?.secondDay||25}
 populateCredits(e?.creditId);formVisibility();$('form-drawer').showModal();(template?$('amount'):$('name')).focus();
}
$('kind').onchange=formVisibility;$('repeat').onchange=formVisibility;$('edit-scope').onchange=formVisibility;
$('event-form').onsubmit=ev=>{ev.preventDefault();run(ev.submitter,async()=>{
 const values={name:$('name').value.trim(),date:$('date').value,cents:parseMoney($('amount').value),kind:$('kind').value,repeat:$('repeat').value,note:$('note').value.trim(),creditId:$('kind').value==='debt_payment'?$('credit').value:undefined};
 if(values.repeat==='twice_monthly')values.secondDay=Number($('second-day').value);
 const p={...(editing?payload(editing):{}),values,scope:$('edit-scope').value,newId:uid()};
 await transaction(d=>A.edit(d,K,p));$('form-drawer').close();editing=null;goTo(values.repeat==='month_end'?M.monthEnd(values.date):values.date);notice('Подію збережено.');
 },'form-message')};
async function moveEvent(e,date){if(!M.validDate(date))throw Error('Вкажи коректну дату.');if(date===e.date)return;await transaction(d=>{const item=A.fresh(d,K,payload(e));if(item.done)throw Error('Завершену подію не можна переносити.');d[K.calendar].overrides[item.key]={...(d[K.calendar].overrides[item.key]||{}),date}});goTo(date);notice('Подію перенесено на '+dateText(date)+'. Прогноз перераховано.')}
function openOpening(){$('opening').value=state.openingDate||state.opening>0?(state.opening/100).toFixed(2):'';$('opening-message').textContent='';$('opening-dialog').showModal();$('opening').focus()}
$('opening-form').onsubmit=ev=>{ev.preventDefault();run(ev.submitter,async()=>{const cents=parseMoney($('opening').value,true);await transaction(d=>{d[K.calendar]=M.normalize(d[K.calendar]);d[K.calendar].opening=cents;d[K.calendar].openingDate=now;d[K.calendar].openingActual=(d[K.ledger]?.entries||[]).filter(e=>e.status==='actual'&&e.date>=now&&e.date<=now).map(e=>({id:e.id,date:e.date,delta:M.signed(e.kind,e.cents)}))});$('opening-dialog').close();notice('Залишок на сьогодні збережено. Прогноз оновлено.')},'opening-message')};
function shiftPeriod(n){if(view==='week'){anchor=M.addDays(anchor,n*7);selected=anchor}else{anchor=M.shiftMonth(anchor,n)+'-01';selected=anchor}render()}
$('prev').onclick=()=>shiftPeriod(-1);$('next').onclick=()=>shiftPeriod(1);$('today').onclick=()=>goTo(now);
$('quick-add').onclick=()=>openForm();$('day-add').onclick=()=>openForm();$('opening-edit').onclick=openOpening;$('opening-start').onclick=openOpening;
$('stat-today-action').onclick=()=>{kind='all';status='pending';goTo(now)};
$('stat-overdue-action').onclick=()=>{kind='all';status='overdue';view='list';anchor=now;render()};
$('status-filter').onchange=()=>{status=$('status-filter').value;if(status==='overdue')view='list';render()};
$('export').onclick=()=>{const [from,to]=range(),cols=[['Дата','Подія','Тип','План грн','Факт грн','Залишок грн','Статус'],...collect(from,to).filter(matches).map(e=>[e.date,e.name,kindLabel[e.kind],e.origin==='actual'?'':(e.cents/100).toFixed(2),e.origin==='actual'?(e.cents/100).toFixed(2):e.origin==='calendar'?(e.paid/100).toFixed(2):'',e.origin==='calendar'?(e.remaining/100).toFixed(2):'',M.describeStatus(e,now)])];S.download('fincontrol-calendar-'+from+'.csv','\ufeff'+cols.map(r=>r.map(S.csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8')};
document.addEventListener('click',ev=>{
 const b=ev.target.closest('button,[data-forecast-date]');if(!b)return;
 if(b.dataset.event){const e=refs.get(b.dataset.event);if(e){selected=e.date;anchor=e.date;render();showDetail(e)}}
 if(b.dataset.date)goTo(b.dataset.date);
 if(b.dataset.view){view=b.dataset.view;anchor=selected;render()}
 if(b.dataset.kind){kind=b.dataset.kind;render()}
 if(b.dataset.template)openForm(b.dataset.template);
 if(b.hasAttribute('data-new-day'))openForm();
 if(b.hasAttribute('data-opening'))openOpening();
 if(b.dataset.forecastDate)goTo(b.dataset.forecastDate);
});
$('calendar-content').addEventListener('keydown',ev=>{const b=ev.target.closest('.cal-day-button');if(!b)return;const shifts={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(shifts[ev.key]){ev.preventDefault();const next=M.addDays(b.dataset.date,shifts[ev.key]);goTo(next);document.querySelector('.cal-day-button[data-date="'+next+'"]')?.focus()}});
$('forecast-chart').addEventListener('keydown',ev=>{const p=ev.target.closest('[data-forecast-date]');if(p&&['Enter',' '].includes(ev.key)){ev.preventDefault();goTo(p.dataset.forecastDate)}});
let dragged=null;
$('calendar-content').addEventListener('dragstart',ev=>{const chip=ev.target.closest('[draggable=true]');if(!chip)return;dragged=refs.get(chip.dataset.event);ev.dataTransfer.setData('text/plain',dragged.key);ev.dataTransfer.effectAllowed='move'});
$('calendar-content').addEventListener('dragover',ev=>{if(!dragged)return;const cell=ev.target.closest('[data-cell-date]');if(cell){ev.preventDefault();cell.classList.add('is-drop');ev.dataTransfer.dropEffect='move'}});
$('calendar-content').addEventListener('dragleave',ev=>ev.target.closest('[data-cell-date]')?.classList.remove('is-drop'));
$('calendar-content').addEventListener('drop',ev=>{const cell=ev.target.closest('[data-cell-date]');if(!dragged||!cell)return;ev.preventDefault();const e=dragged;dragged=null;cell.classList.remove('is-drop');run(null,()=>moveEvent(e,cell.dataset.cellDate))});
$('calendar-content').addEventListener('dragend',()=>{dragged=null;document.querySelectorAll('.is-drop').forEach(e=>e.classList.remove('is-drop'))});
let touch=null;$('calendar-content').addEventListener('touchstart',e=>{if(matchMedia('(max-width:700px)').matches&&e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
$('calendar-content').addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.7&&view!=='list')shiftPeriod(dx<0?1:-1)},{passive:true});
for(const handle of document.querySelectorAll('.cal-sheet-handle')){let y=null;handle.addEventListener('pointerdown',e=>{y=e.clientY;handle.setPointerCapture(e.pointerId)});handle.addEventListener('pointerup',e=>{if(y!==null&&e.clientY-y>60)handle.closest('dialog').close();y=null})}
function externalRefresh(){try{refresh();render();if($('event-drawer').open)$('detail-notice').textContent='Дані оновлено. Для нової дії перевір подію; застарілий запис не буде збережено.'}catch(e){notice(e.message,true)}}
window.addEventListener('storage',e=>{if([K.calendar,K.ledger,K.debts].includes(e.key)||e.key===null)externalRefresh()});
function updateDay(){const d=M.today();if(d!==now){const follow=selected===now;now=d;if(follow)selected=anchor=d;externalRefresh()}}
window.addEventListener('focus',updateDay);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateDay()});setInterval(updateDay,60000);
try{await S.ready;refresh();render()}catch(e){notice('Не вдалося відкрити календар: '+e.message,true)}
})();

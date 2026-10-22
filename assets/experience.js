/* FINCONTROL Motion 1.0
   Visualization only: reads FCStore, never writes financial records.
   Animated paths are interpolated while scrolling; graceful no-JS and reduced-motion fallbacks. */
(async function(){
 'use strict';
 const S=globalThis.FCStore,M=globalThis.FCFinance,C=globalThis.FCCalendarModel;
 const $=id=>document.getElementById(id);
 const stageElements=[...document.querySelectorAll('.ex-scene')],reveal=[...document.querySelectorAll('.ex-reveal')];
 const fmt=new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0});
 const compact=new Intl.NumberFormat('uk-UA',{notation:'compact',maximumFractionDigits:1});
 const number=new Intl.NumberFormat('uk-UA');
 let privacyOn=false;
 const privacyKey='fincontrol-experience-private-v1';
 try{privacyOn=localStorage.getItem(privacyKey)==='on'}catch{}
 const privacyButton=$('ex-privacy-toggle');
 function applyPrivacy(){
  document.body.classList.toggle('ex-private-on',privacyOn);
  privacyButton.setAttribute('aria-pressed',String(privacyOn));
  privacyButton.setAttribute('aria-label',privacyOn?'Показати фінансові суми':'Приховати фінансові суми');
  // Preserve the inline Tabler SVG when toggling privacy. TextContent would
  // remove the icon node and break future keyboard/visual state updates.
  privacyButton.querySelector('use')?.setAttribute?.('href',
   'assets/icons/tabler-sprite.svg#ti-'+(privacyOn?'eye':'eye-off'));
 }
 privacyButton.addEventListener('click',()=>{
  privacyOn=!privacyOn;applyPrivacy();
  try{localStorage.setItem(privacyKey,privacyOn?'on':'off')}catch{}
  refreshData();
 });
 applyPrivacy();
 const percent=x=>Math.max(0,Math.min(100,Number.isFinite(x)?x:0));
 const cash=cents=>privacyOn&&Number.isFinite(cents)?'••••':Number.isFinite(cents)?fmt.format(cents/100):'—';
 const amount=uah=>privacyOn&&Number.isFinite(uah)?'••••':Number.isFinite(uah)?fmt.format(uah):'—';
 const stamp=d=>C.day(d).toLocaleDateString('uk-UA',{day:'numeric',month:'short'});
 const captionMonth=d=>C.day(d).toLocaleDateString('uk-UA',{month:'long',year:'numeric'});
 const signed={income:1,refund:1,expense:-1,debt_payment:-1,reserve_deposit:-1};
 let selectedDay=C.today(),calendarAnchor=C.monthStart(C.today()),lastError='',previousRenderDay='',motionEnabled=true,resizeObserver=null;
 const motionKey='fincontrol-experience-motion-v1';
 const motionButton=$('ex-motion-toggle');
 // Premium render replaces the vector phone ONLY when its local image is loaded.
 // Missing asset: old SVG device remains fully functional.
 const premiumImage=$('ex-premium-phone-image');
 if(premiumImage){
  const onPremiumReady=()=>document.body.classList.add('ex-premium-ready');
  const onPremiumError=()=>document.body.classList.remove('ex-premium-ready');
  premiumImage.addEventListener('load',onPremiumReady);
  premiumImage.addEventListener('error',onPremiumError);
  if(premiumImage.complete && premiumImage.naturalWidth>0)onPremiumReady();
 }
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 // The photo is a progressive enhancement: fallback vector stays in place
 // until the real user-supplied file is present at its precise GitHub path.
 const photoAsset='assets/images/fincontrol-core-rock.webp?v=1';
 if($('ex-rock-photo') && typeof Image!=='undefined'){
  const preview=new Image();
  preview.onload=()=>{
   document.body.classList.add('ex-photoreal-core');
   requestVisualUpdate();
  };
  preview.onerror=()=>document.body.classList.remove('ex-photoreal-core');
  preview.src=photoAsset;
 }

 try{motionEnabled=localStorage.getItem(motionKey)!=='off'}catch{}
 if(reducedMotion?.matches)motionEnabled=false;
 function setMotion(on,persist=true){
  motionEnabled=!!on&&!reducedMotion?.matches;
  document.body.classList.toggle('ex-motion-off',!motionEnabled);
  motionButton.setAttribute('aria-pressed',String(motionEnabled));
  motionButton.setAttribute('aria-label',motionEnabled?'Вимкнути рух':'Увімкнути рух');
  motionButton.querySelector('span:last-child').textContent=motionEnabled?'Рух':'Без руху';
  motionButton.querySelector('.ex-motion-glyph use')?.setAttribute?.('href',
   'assets/icons/tabler-sprite.svg#ti-'+(motionEnabled?'player-pause':'player-play'));
  if(persist)try{localStorage.setItem(motionKey,motionEnabled?'on':'off')}catch{}
  if(!motionEnabled)reveal.forEach(el=>el.classList.add('is-visible'));
  else if('IntersectionObserver' in window)observeReveals();
  // Keep the true 3D renderer in sync with the existing accessible motion toggle.
  window.FCCrystal3D?.setMotion(motionEnabled);
  requestVisualUpdate();
 }
 motionButton.addEventListener('click',()=>setMotion(!motionEnabled));
 document.body.classList.toggle('ex-motion-off',!motionEnabled);
 motionButton.setAttribute('aria-pressed',String(motionEnabled));
 if(!motionEnabled)motionButton.querySelector('span:last-child').textContent='Без руху';
 motionButton.querySelector('.ex-motion-glyph use')?.setAttribute?.('href',
  'assets/icons/tabler-sprite.svg#ti-'+(motionEnabled?'player-pause':'player-play'));
 const read=k=>{try{return S.read(k)}catch(e){lastError=e.message;return null}};
 const el=(tag,cls='',str)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(str!==undefined)x.textContent=String(str);return x};
 const set=(id,v)=>{$(id).textContent=v};
 const monthTotals=(entries,month)=>entries.filter(e=>e.date.slice(0,7)===month&&e.status==='actual').reduce((s,e)=>{
  if(!Number.isSafeInteger(e.cents)||e.cents<=0)return s;
  if(['income','refund'].includes(e.kind))s.inc+=e.cents;
  if(['expense','debt_payment'].includes(e.kind))s.out+=e.cents;
  if(e.kind==='reserve_deposit')s.reserve+=e.cents;
  s.count++;
  return s;
 },{inc:0,out:0,reserve:0,count:0});
 function renderOverview(ledger,today){
  const note=$('ex-overview-note');
  if(!ledger||!Array.isArray(ledger.entries)){
   ['ex-operations-count','ex-month-income','ex-month-expenses','ex-month-reserve','ex-donut-value'].forEach(id=>set(id,'—'));
   $('ex-overview-donut').style.setProperty('--ex-donut-angle','0%');
   note.textContent=lastError?'Дані не прочитано: '+lastError:'У цьому браузері журнал ще не налаштовано. Для внесення операцій відкрий робочий кабінет.';
   return;
  }
  const totals=monthTotals(ledger.entries,today.slice(0,7));
  set('ex-operations-count',number.format(totals.count));
  set('ex-month-income',cash(totals.inc));
  set('ex-month-expenses',cash(totals.out));
  set('ex-month-reserve',cash(totals.reserve));
  const ratio=totals.inc>0?Math.round(100*totals.out/totals.inc):null;
  set('ex-donut-value',ratio===null?'—':privacyOn?'••':ratio+'%');
  $('ex-overview-donut').style.setProperty('--ex-donut-angle',(privacyOn?0:percent(ratio))+'%');
  note.textContent=ratio===null?'Без надходжень у цьому місяці відсоток витрат не розраховується.':'Витрати й кредитні платежі — як частка надходжень. Резерв показано окремо, власні перекази не включено.';
 }
 function renderCalendar(calendar,ledger,debts,today){
  const first=C.monthStart(calendarAnchor),end=C.monthEnd(first),displayStart=C.weekStart(first);
  const distance=Math.round((Date.UTC(Number(end.slice(0,4)),Number(end.slice(5,7))-1,Number(end.slice(8)))-Date.UTC(Number(displayStart.slice(0,4)),Number(displayStart.slice(5,7))-1,Number(displayStart.slice(8))))/86400000)+1;
  const last=C.addDays(displayStart,Math.ceil(distance/7)*7-1);
  const events=C.collect({state:C.normalize(calendar||{}),ledger,debts},displayStart,last);
  const byDay=new Map();
  for(const event of events){const a=byDay.get(event.date)||[];a.push(event);byDay.set(event.date,a)}
  const month=first.slice(0,7);
  set('ex-calendar-month',captionMonth(first));
  const container=$('ex-calendar-grid');container.replaceChildren();
  const days=Math.ceil(distance/7)*7;
  for(let i=0;i<days;i++){
   const date=C.addDays(displayStart,i),list=byDay.get(date)||[],button=el('button','ex-calendar-day');
   button.type='button';
   button.dataset.date=date;
   button.dataset.other=String(date.slice(0,7)!==month);
   button.setAttribute('aria-pressed',String(date===selectedDay));
   if(date===today)button.setAttribute('aria-current','date');
   const label=date===today?' · сьогодні':'';
   button.setAttribute('aria-label',stamp(date)+label+' · подій '+list.length);
   button.title=stamp(date)+(list.length?' · '+list.slice(0,4).map(e=>e.name).join(', '):'');
   button.style.setProperty('--day-delay',Math.min(440,i*15)+'ms');
   const digit=el('span','',String(Number(date.slice(8))));
   const dots=el('span','ex-calendar-dots');dots.setAttribute('aria-hidden','true');
   for(const event of list.slice(0,4)){
    const mark=el('i');mark.dataset.type=event.category||C.category(event.kind);dots.append(mark);
   }
   button.append(digit,dots);
   button.addEventListener('click',()=>{selectedDay=date;highlightCalendarDay();renderDay(byDay.get(date)||[],date,today)});
   container.append(button);
  }
  if(!C.validDate(selectedDay)||selectedDay<displayStart||selectedDay>last)selectedDay=first;
  highlightCalendarDay();
  renderDay(byDay.get(selectedDay)||[],selectedDay,today);
 }
 function changeCalendarMonth(delta){
  const base=C.shiftMonth(calendarAnchor,delta);
  calendarAnchor=C.monthStart(base);
  selectedDay=calendarAnchor;
  refreshData(); // Read-only rerender; never writes ledger or calendar.
 }
 $('ex-calendar-prev')?.addEventListener('click',()=>changeCalendarMonth(-1));
 $('ex-calendar-next')?.addEventListener('click',()=>changeCalendarMonth(1));
 $('ex-calendar-today')?.addEventListener('click',()=>{
  selectedDay=C.today();
  calendarAnchor=C.monthStart(selectedDay);
  refreshData();
 });
 function highlightCalendarDay(){
  document.querySelectorAll('.ex-calendar-day').forEach(button=>{
   button.setAttribute('aria-pressed',String(button.dataset.date===selectedDay));
  });
 }
 function renderDay(items,date,today){
  set('ex-day-label',(date===today?'Сьогодні · ':'')+stamp(date));
  const host=$('ex-day-events');host.replaceChildren();
  if(!items.length){host.append(el('p','ex-empty','На цей день немає запланованих або фактичних подій.'));return}
  for(const event of items.slice(0,4)){
   const row=el('div','ex-day-event');row.dataset.type=event.category||'other';
   const line=el('i');line.setAttribute('aria-hidden','true');
   const body=el('div');body.append(el('strong','',event.name||'Подія'));
   const isFact=event.origin==='actual'||event.settled===true;
   const description=(isFact?'Факт · ':event.done?'Закрито · ':'План · ')+cash(event.origin==='calendar'&&event.settled?event.paid:event.cents);
   body.append(el('small','',description));row.append(line,body);host.append(row);
  }
  if(items.length>4)host.append(el('p','ex-empty','Ще '+(items.length-4)+' подій — у повному календарі.'));
 }
 function renderCredits(debts){
  const host=$('ex-credit-list');host.replaceChildren();
  if(!debts||!Array.isArray(debts.credits)){
   set('ex-credit-count','Не налаштовано');set('ex-debt-total','—');
   host.append(el('p','ex-empty','У цьому браузері ще немає кредитного реєстру.'));return
  }
  const active=debts.credits.filter(c=>Number.isSafeInteger(c.balance)&&c.balance>0).sort((a,b)=>b.balance-a.balance);
  const total=active.reduce((s,c)=>s+c.balance,0);
  set('ex-credit-count',active.length+' активних');set('ex-debt-total',cash(total));
  if(!active.length){host.append(el('p','ex-empty','Непогашених кредитів немає.'));return}
  for(const credit of active.slice(0,4)){
   const row=el('div','ex-credit-row');
   const symbol=el('span','ex-credit-icon');symbol.setAttribute('aria-hidden','true');
   symbol.innerHTML='<svg class="ex-ti" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="assets/icons/tabler-sprite.svg#ti-credit-card"></use></svg>';
   const info=el('div');info.append(el('strong','',credit.name||'Кредит'));
   const due=C.validDate(credit.due)?'Платіж · '+stamp(credit.due):'Термін не задано';
   info.append(el('small','',due));
   row.append(symbol,info,el('span','ex-credit-value',cash(credit.balance)));host.append(row);
  }
  if(active.length>4)host.append(el('p','ex-empty','Ще '+(active.length-4)+' кредитів — у реєстрі.'));
 }
 function renderReserve(reserve,ledger){
  if(!reserve||!Number.isFinite(reserve.saved)||!Number.isFinite(reserve.target)||reserve.target<=0){
   ['ex-reserve-amount','ex-reserve-left','ex-reserve-percent'].forEach(id=>set(id,'—'));
   set('ex-reserve-target','Резерв ще не налаштовано');$('ex-reserve-progress').dataset.target='0%';
   return;
  }
  const net=Array.isArray(ledger?.entries)?ledger.entries.filter(e=>e.status==='actual').reduce((s,e)=>s+(e.kind==='reserve_deposit'?e.cents:e.kind==='reserve_withdrawal'?-e.cents:0),0)/100:0;
  const saved=reserve.saved+net,target=reserve.target;
  const progress=percent(100*saved/target);
  set('ex-reserve-amount',amount(saved));set('ex-reserve-target','із '+amount(target));
  set('ex-reserve-percent',privacyOn?'••':Math.round(progress)+'%');
  set('ex-reserve-left',amount(Math.max(0,target-saved)));
  $('ex-reserve-progress').dataset.target=(privacyOn?0:progress).toFixed(1)+'%';
 }
 function renderHome(home){
  if(!home||!Number.isFinite(home.priceUsd)||!Number.isFinite(home.rate)||home.priceUsd<=0||home.rate<=0){
   ['ex-house-saved','ex-house-percent'].forEach(id=>set(id,'—'));
   set('ex-house-target','Житлову ціль ще не налаштовано');$('ex-house-progress').dataset.target='0%';
   $('ex-house-stage')?.style?.setProperty?.('--ex-house-charge','0%');
   return;
  }
  // Same acquisition formula as the existing housing module: UAH estimate.
  const target=home.priceUsd*home.rate*(1+Number(home.fees||0)/100)+Number(home.renovation||0);
  const saved=Number(home.saved||0);
  const progress=percent(100*saved/target);
  set('ex-house-saved',amount(saved));set('ex-house-target','із '+amount(target));
  set('ex-house-percent',privacyOn?'••':Math.round(progress)+'%');
  $('ex-house-progress').dataset.target=(privacyOn?0:progress).toFixed(1)+'%';
  // Decorative ring uses the same *displayed* progress, never a separate
  // financial source; privacy mode also hides this visual percentage.
  $('ex-house-stage')?.style?.setProperty?.('--ex-house-charge',(privacyOn?0:progress).toFixed(1)+'%');
 }
 function renderAnalytics(ledger,today){
  const container=$('ex-chart');container.replaceChildren();
  if(!ledger||!Array.isArray(ledger.entries)){
   container.append(el('p','ex-empty','Аналітика з’явиться після внесення операцій.'));
   set('ex-analytics-note','У цьому браузері журнал відсутній. Демонстраційні суми не використовуються.');
   return;
  }
  const months=Array.from({length:6},(_,index)=>{
   const ym=C.shiftMonth(today,-5+index);
   return {ym,...monthTotals(ledger.entries,ym)};
  });
  const max=Math.max(1,...months.flatMap(v=>[v.inc,v.out]));
  for(const [idx,m] of months.entries()){
   const group=el('div','ex-chart-group'+(!m.inc&&!m.out?' is-empty':'')+(idx===5?' is-current':''));
   const bars=el('div','ex-chart-bars');
   for(const [type,val] of [['in',m.inc],['out',m.out]]){
    const bar=el('span','ex-chart-bar'+(type==='out'?' is-out':''));
    bar.style.setProperty('--bar-h',privacyOn?'5%':val?Math.max(3,val/max*100)+'%':'0%');
    bar.style.setProperty('--bar-delay',idx*70+'ms');
    bar.setAttribute('title',privacyOn?'Суми приховано':(type==='in'?'Надходження':'Витрати')+' · '+cash(val));
    bars.append(bar);
   }
   group.append(bars,el('span','ex-chart-month',C.day(m.ym+'-01').toLocaleDateString('uk-UA',{month:'short'})));
   container.append(group);
  }
  const count=months.reduce((s,v)=>s+v.count,0);
  set('ex-analytics-note','Фактичних операцій за шість місяців: '+number.format(count)+'. Власні перекази не впливають на ці два ряди.');
 }
 function refreshData(){
  lastError='';
  const today=C.today(),ledger=read(S.K.ledger),debts=read(S.K.debts),calendar=read(S.K.calendar),reserve=read(S.K.reserve),home=read(S.K.home);
  if(previousRenderDay!==today){selectedDay=today;calendarAnchor=C.monthStart(today);}
  previousRenderDay=today;
  set('ex-overview-period',captionMonth(today+'').replace(/^./,c=>c.toUpperCase()));
  renderOverview(ledger,today);
  renderCalendar(calendar,ledger,debts,today);
  renderCredits(debts);renderReserve(reserve,ledger);renderHome(home);renderAnalytics(ledger,today);
  applyProgress();
 }
 /* Single shared vector outline smoothly interpolates across all scenes.
    Sample count and angular order stay fixed — no sudden geometry swaps. */
 const countPoints=64,N=stageElements.length,shapePath=$('ex-morph-outline'),innerPath=$('ex-morph-inner'),morphShell=$('ex-morph-shell');
 /* Fixed clockwise point sampling keeps the rock silhouette continuous through every
    stage. 0: raw core -> 1-4: faceted stone -> 5-6: narrowing slab -> 7: phone. */
 const signpow=(n,p)=>Math.sign(n)*Math.pow(Math.abs(n),p);
 function shape(stage,t){
  const a=t*Math.PI*2,co=Math.cos(a),si=Math.sin(a),r=84;
  if(stage===0){const jagged=r+8*Math.sin(7*a+.4)+4*Math.cos(11*a);return[co*jagged,si*jagged]}
  if(stage===1){const jagged=r+7*Math.sin(7*a+.48)+3*Math.cos(9*a);return[co*jagged,si*jagged]}
  if(stage===2){const jagged=r+4*Math.sin(6*a+.6);return[co*jagged,si*jagged]}
  if(stage===3)return[signpow(co,.8)*86,signpow(si,.8)*88];
  if(stage===4)return[signpow(co,.62)*82,signpow(si,.62)*95];
  if(stage===5)return[signpow(co,.48)*75,signpow(si,.48)*101];
  if(stage===6)return[signpow(co,.23)*65,signpow(si,.23)*104];
  return[signpow(co,.12)*64,signpow(si,.12)*108];
 }
 const smoothstep=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
 function drawMorph(stageFloat){
  const floor=Math.max(0,Math.min(N-1,Math.floor(stageFloat)));
  const ceil=Math.min(N-1,floor+1),alpha=smoothstep(stageFloat-floor),outline=[],inside=[];
  for(let i=0;i<countPoints;i++){
   const t=i/countPoints,p=shape(floor,t),q=shape(ceil,t);
   const x=p[0]*(1-alpha)+q[0]*alpha,y=p[1]*(1-alpha)+q[1]*alpha;
   outline.push((i?'L':'M')+(140+x).toFixed(2)+' '+(140+y).toFixed(2));
   inside.push((i?'L':'M')+(140+x*.74).toFixed(2)+' '+(140+y*.74).toFixed(2));
  }
  shapePath.setAttribute('d',outline.join('')+'Z');innerPath.setAttribute('d',inside.join('')+'Z');
 }
 let stageCenters=[],raf=0,activeIndex=-1,observed=false,observer=null;
 function measure(){
  stageCenters=stageElements.map(el=>el.getBoundingClientRect().top+window.scrollY+Math.min(window.innerHeight*.40,el.offsetHeight*.40));
  requestVisualUpdate();
 }
 function animationProgress(){
  const focal=window.scrollY+window.innerHeight*.43;
  let stage=0;
  for(let i=0;i<stageCenters.length-1;i++){
   if(focal>=stageCenters[i]&&focal<stageCenters[i+1]){
    stage=i+(focal-stageCenters[i])/Math.max(1,stageCenters[i+1]-stageCenters[i]);
    return stage;
   }
  }
  return focal>=stageCenters[stageCenters.length-1]?N-1:stage;
 }
 function visualUpdate(){
  raf=0;
  const max=document.documentElement.scrollHeight-window.innerHeight;
  $('ex-scroll-fill').style.width=(max>0?percent(window.scrollY/max*100):0)+'%';
  const at=animationProgress();
  window.FCCrystal3D?.setStage(at);
  // Scroll position sets shape and phone opacity even with Motion off:
  // reduced-motion means no idle loops, not hiding the final phone.
  drawMorph(at);
  const intoPhone=smoothstep((at-5.3)/1.7);
  morphShell.style.setProperty('--ex-stone-visible',(1-intoPhone).toFixed(3));
  morphShell.style.setProperty('--ex-phone-visible',intoPhone.toFixed(3));
  // The premium handset assembles out of the crystal at the end of the scroll:
  // glide into place, right itself, and smoothly attain its full physical size.
  morphShell.style.setProperty('--ex-phone-scale',(.72+.28*intoPhone).toFixed(3));
  morphShell.style.setProperty('--ex-phone-rise',(22*(1-intoPhone)).toFixed(1)+'px');
  morphShell.style.setProperty('--ex-phone-tilt',(-14*(1-intoPhone)).toFixed(1)+'deg');
  if(motionEnabled){
   // CSS independently handles idle rotation, lights and particles.
   const photoRatio=1-smoothstep((at-3.2)/2.2);
   morphShell.style.setProperty('--ex-photo-visible',photoRatio.toFixed(3));
   morphShell.style.setProperty('--ex-orbit-visible',(1-intoPhone*.63).toFixed(3));
   morphShell.style.setProperty('--ex-orb-scale',(1-at*.025).toFixed(3));
   morphShell.style.setProperty('--ex-orb-x',(Math.sin(at*.78)*16).toFixed(1)+'px');
   morphShell.style.setProperty('--ex-orb-y',(Math.sin(at*1.2)*23).toFixed(1)+'px');
   morphShell.style.setProperty('--ex-orb-rotate',(at*31).toFixed(1)+'deg');
   // Full-size cinematic core in hero, unobtrusive near finance glass panels,
   // and a strong appearance again for the completed smartphone in the finale.
   const presence=at<.65?.98:at<1.55?.98-.77*smoothstep((at-.65)/.9):at<5.75?.21:.21+.68*smoothstep((at-5.75)/1.25);
   // The architectural render is the hero of the Housing chapter. Fade the
   // roaming crystal behind it, then bring it back ahead of the phone finale.
   const housingFocus=smoothstep((at-4.25)/.6)*(1-smoothstep((at-5.55)/.44));
   morphShell.style.setProperty('--ex-orb-opacity',(presence*(1-.92*housingFocus)).toFixed(2));
  }
  const index=Math.max(0,Math.min(N-1,Math.round(at)));
  if(index!==activeIndex){
   activeIndex=index;
   const id=stageElements[index]?.id;
   document.querySelectorAll('[data-chapter-nav]').forEach(link=>{
    if(link.dataset.chapterNav===id)link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
   });
  }
 }
 function requestVisualUpdate(){if(!raf)raf=requestAnimationFrame(visualUpdate)}
 function observeReveals(){
  if(observer)observer.disconnect();
  if(!motionEnabled){reveal.forEach(el=>el.classList.add('is-visible'));return}
  if(!('IntersectionObserver' in window)){reveal.forEach(el=>el.classList.add('is-visible'));return}
  observer=new IntersectionObserver(entries=>{
   for(const item of entries)if(item.isIntersecting){
    item.target.classList.add('is-visible');
    for(const bar of item.target.querySelectorAll('.ex-progress-track span[data-target]'))
     bar.style.width=bar.dataset.target;
    observer.unobserve(item.target);
   }
  },{threshold:.10,rootMargin:'0px 0px 35px 0px'});
  for(const node of reveal)if(!node.classList.contains('is-visible'))observer.observe(node);
  observed=true;
 }
 function applyProgress(){
  for(const bar of document.querySelectorAll('.ex-progress-track span[data-target]')){
   if(!motionEnabled||bar.closest('.ex-reveal')?.classList.contains('is-visible'))bar.style.width=bar.dataset.target;
   else bar.style.width='0%';
  }
 }
 function initializeMotion(){
  if('IntersectionObserver' in window && motionEnabled){observeReveals();document.body.classList.add('ex-ready')}
  else reveal.forEach(el=>el.classList.add('is-visible'));
  measure();drawMorph(0);
  window.addEventListener('scroll',requestVisualUpdate,{passive:true});
  window.addEventListener('resize',measure,{passive:true});
  window.addEventListener('hashchange',requestVisualUpdate);
  if('ResizeObserver' in window){resizeObserver=new ResizeObserver(measure);resizeObserver.observe(document.querySelector('main'))}
 }
 reducedMotion?.addEventListener?.('change',e=>{if(e.matches)setMotion(false,false)});
 try{
  await S.ready;
  refreshData();
 }catch(e){
  lastError=e.message;
  set('ex-overview-note','Не вдалося відкрити локальні дані: '+e.message);
  refreshData();
 }
 initializeMotion();
 setMotion(motionEnabled,false);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(C.today()!==previousRenderDay)refreshData();measure()}});
 window.addEventListener('storage',e=>{if(e.key?.startsWith('fincontrol-'))refreshData()});
 window.addEventListener('fincontrol:change',refreshData);
})();

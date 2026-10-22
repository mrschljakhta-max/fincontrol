/* FINCONTROL Motion 3.0
   Transitions and a read-only HTML mini-screen alongside the original 3D phone.
   No financial record or preference is written by this module. */
(()=>{
 'use strict';
 const shell=document.getElementById('ex-morph-shell');
 const links=[...document.querySelectorAll('#intro .ex-orbit-tag')];
 const page=document.body;
 const scenes=[...document.querySelectorAll('.ex-scene')];
 const dots=[...document.querySelectorAll('[data-ex-chapter]')];
 const names=['income','reserve','goals'];
 const setFocus=key=>{if(!shell)return;if(key)shell.dataset.orbitFocus=key;else delete shell.dataset.orbitFocus};
 for(const [i,link] of links.entries()){
  link.addEventListener('pointerenter',()=>setFocus(names[i]));
  link.addEventListener('pointerleave',()=>{if(!link.matches(':focus-visible'))setFocus(null)});
  link.addEventListener('focus',()=>setFocus(names[i]));
  link.addEventListener('blur',()=>setFocus(null));
 }
 // Deterministic rendering from the existing scroll engine, no second rAF loop.
 let previous=-1;
 const ease=v=>{const x=Math.max(0,Math.min(1,v));return x*x*(3-2*x)};
 const setStage=(raw,motion=true)=>{
  if(!scenes.length)return;
  const at=Math.max(0,Math.min(scenes.length-1,Number.isFinite(raw)?raw:0));
  const nearest=Math.round(at);
  if(nearest!==previous){
   previous=nearest;
   const active=scenes[nearest]?.id||'intro';
   page.dataset.exCinematicScene=active;
   for(const dot of dots){
    if(dot.dataset.exChapter===active)dot.setAttribute('aria-current','location');
    else dot.removeAttribute('aria-current');
   }
  }
  for(let i=0;i<scenes.length;i++){
   const distance=Math.abs(at-i);
   const soft=ease(1-Math.min(1,distance/1.3));
   // At each chapter boundary the previous glow recedes as the new one grows.
   const strength=motion?(0.16+0.56*soft):0.12;
   scenes[i].style.setProperty('--ex-cine-opacity',strength.toFixed(3));
  }
  if(shell) shell.style.setProperty('--ex-cine-energy',(motion?(0.35+0.65*ease(at%1)):0.35).toFixed(3));
 };
 window.FCExperienceCinematic={setStage};
 const configs={
  income:{label:'НАДХОДЖЕННЯ',source:'ex-month-income',caption:'Фактичні надходження цього місяця',href:'analytics.html#income'},
  reserve:{label:'РЕЗЕРВ',source:'ex-reserve-amount',caption:'Поточні накопичення фінансової подушки',href:'reserve.html'},
  home:{label:'ЖИТЛО',source:'ex-house-saved',caption:'Накопичено на житлову ціль',href:'home.html'},
  debt:{label:'КРЕДИТИ',source:'ex-debt-total',caption:'Непогашений залишок кредитів',href:'debts.html'}
 };
 const $=id=>document.getElementById(id);
 const tabs=[...document.querySelectorAll('[data-ex-live]')];
 const preview=$('ex-live-value'),title=$('ex-live-title'),caption=$('ex-live-caption'),action=$('ex-live-action');
 let active='income';
 const renderPreview=()=>{
  if(!preview||!title||!caption||!action)return;
  const config=configs[active];
  const isPrivate=page.classList.contains('ex-private-on');
  const original=$(config.source)?.textContent?.trim()||'—';
  title.textContent=config.label;
  preview.textContent=isPrivate&&original!=='—'?'••••':original;
  caption.textContent=config.caption;
  action.href=config.href;
  tabs.forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.exLive===active)));
 };
 for(const tab of tabs)tab.addEventListener('click',()=>{
  if(!(tab.dataset.exLive in configs))return;
  active=tab.dataset.exLive;
  renderPreview();
 });
 // Only observe sanitized visible labels produced by experience.js.
 if(typeof MutationObserver==='function'){
  const observer=new MutationObserver(renderPreview);
  for(const config of Object.values(configs)){
   const original=$(config.source);
   if(original)observer.observe(original,{childList:true,characterData:true,subtree:true});
  }
 }
 $('ex-privacy-toggle')?.addEventListener('click',renderPreview);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)setFocus(null);else renderPreview()});
 window.addEventListener('pageshow',renderPreview);
 renderPreview();
})();

/* FINCONTROL Design System 2.0 — responsive progressive navigation.
 * Only manipulates navigation and mirrors existing privacy/motion controls.
 * Financial data and scroll-to-phone morph remain owned by experience.js.
 */
(()=>{
 'use strict';
 const toggle=document.getElementById('ex-mobile-menu-toggle');
 const nav=document.getElementById('ex-mobile-nav');
 const mobileMotion=document.getElementById('ex-mobile-motion');
 const mobilePrivacy=document.getElementById('ex-mobile-privacy');
 const originalMotion=document.getElementById('ex-motion-toggle');
 const originalPrivacy=document.getElementById('ex-privacy-toggle');
 if(!toggle||!nav)return;
 function syncTools(){
  if(mobileMotion&&originalMotion){
   const enabled=originalMotion.getAttribute('aria-pressed')==='true';
   mobileMotion.setAttribute('aria-pressed',String(enabled));
   mobileMotion.textContent=enabled?'◉ Анімація ввімкнена':'◎ Без анімації';
  }
  if(mobilePrivacy&&originalPrivacy){
   const hidden=originalPrivacy.getAttribute('aria-pressed')==='true';
   mobilePrivacy.setAttribute('aria-pressed',String(hidden));
   mobilePrivacy.textContent=hidden?'◉ Показати суми':'◌ Приховати суми';
  }
 }
 function setOpen(open,focusToggle=false){
  const next=Boolean(open);
  nav.hidden=!next;
  toggle.setAttribute('aria-expanded',String(next));
  toggle.setAttribute('aria-label',next?'Закрити меню панорами':'Відкрити меню панорами');
  document.body.classList.toggle('ex-mobile-nav-open',next);
  if(next)syncTools();
  if(!next&&focusToggle)toggle.focus();
 }
 toggle.addEventListener('click',()=>setOpen(nav.hidden));
 nav.addEventListener('click',event=>{
  // Anchors navigate normally; the section pointer closes its own popover.
  const link=event.target?.closest?.('a[href^="#"]');
  if(link)setOpen(false);
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!nav.hidden)setOpen(false,true);
 });
 document.addEventListener('click',event=>{
  if(!nav.hidden&&!nav.contains(event.target)&&!toggle.contains(event.target))
   setOpen(false);
 });
 window.addEventListener('resize',()=>{
  if(window.innerWidth>1090&&!nav.hidden)setOpen(false);
 },{passive:true});
 window.addEventListener('hashchange',()=>setOpen(false));
 mobileMotion?.addEventListener('click',()=>{
  originalMotion?.click();
  syncTools();
 });
 mobilePrivacy?.addEventListener('click',()=>{
  originalPrivacy?.click();
  syncTools();
 });
 originalMotion?.addEventListener('click',syncTools);
 originalPrivacy?.addEventListener('click',syncTools);
 syncTools();
})();

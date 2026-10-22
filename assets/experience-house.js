/* FINCONTROL / animated floating villa (progressive 2.5D experience).
 * An actual transparent house image + independent emission layer. Not a true GLB.
 * Keeps the financial values strictly read-only in experience.js.
 */
(()=>{
 'use strict';
 const section=document.getElementById('housing');
 const visual=document.getElementById('ex-house-stage');
 const image=document.getElementById('ex-house-art');
 const tilt=document.getElementById('ex-house-tilt');
 const emission=document.getElementById('ex-house-emission');
 if(!section||!visual||!image)return;

 let inView=false,loaded=false,requested=false,tx=0,ty=0,frame=0;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const motionOff=()=>document.body.classList.contains('ex-motion-off')||Boolean(reduced?.matches);
 function revealIfReady(){
  if(!loaded)return;
  section.classList.add('ex-house-image-ready');
  if(inView||motionOff())section.classList.add('ex-house-revealed');
 }
 function ready(){
  loaded=image.naturalWidth>0;
  if(loaded)revealIfReady();
 }
 function failed(){
  loaded=false;
  section.classList.remove('ex-house-image-ready');
  section.classList.remove('ex-house-revealed');
  // Keep the architecture blueprint visible when the photographic asset is unavailable.
 }
 image.addEventListener('load',ready);
 image.addEventListener('error',failed);
 if(image.complete){if(image.naturalWidth>0)ready();else failed()}
 // This lighting texture is optional; a missing file cannot hide the house.
 if(emission){
  emission.addEventListener('error',()=>{emission.style.display='none'});
 }
 function updatePresence(isVisible){
  inView=isVisible;
  section.classList.toggle('ex-house-in-view',isVisible);
  if(isVisible)revealIfReady();
  else resetTilt();
 }
 if(typeof IntersectionObserver==='function'){
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(entry.target===visual){
     updatePresence(entry.isIntersecting);
    }
   }
  },{root:null,threshold:.12,rootMargin:'80px 0px 80px 0px'});
  observer.observe(visual);
 }else updatePresence(true);

 function flushTilt(){
  frame=0;
  if(!tilt)return;
  tilt.style.setProperty('--ex-house-tilt-y',(tx*5.1).toFixed(2)+'deg');
  tilt.style.setProperty('--ex-house-tilt-x',(-ty*3.2).toFixed(2)+'deg');
 }
 function resetTilt(){
  tx=0;ty=0;
  if(frame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);
  frame=0;
  if(tilt){
   tilt.style.setProperty('--ex-house-tilt-y','0deg');
   tilt.style.setProperty('--ex-house-tilt-x','0deg');
  }
 }
 function pointerMove(event){
  if(!inView||motionOff()||!tilt||
     window.matchMedia?.('(hover: none)')?.matches)return;
  if(typeof event.clientX!=='number'||typeof event.clientY!=='number')return;
  const rect=visual.getBoundingClientRect();
  if(!rect?.width||!rect?.height)return;
  tx=Math.max(-1,Math.min(1,2*(event.clientX-rect.left)/rect.width-1));
  ty=Math.max(-1,Math.min(1,2*(event.clientY-rect.top)/rect.height-1));
  if(frame)return;
  if(typeof requestAnimationFrame==='function'){
   frame=requestAnimationFrame(flushTilt);
  }else flushTilt();
 }
 visual.addEventListener('pointermove',pointerMove,{passive:true});
 visual.addEventListener('pointerleave',resetTilt);
 visual.addEventListener('pointercancel',resetTilt);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)resetTilt();
 });
 const motion=document.getElementById('ex-motion-toggle');
 motion?.addEventListener('click',()=>{
  if(motionOff()){resetTilt();revealIfReady()}
 });
 reduced?.addEventListener?.('change',()=>{
  if(motionOff()){resetTilt();revealIfReady()}
 });
})();

/* FINCONTROL cinematic housing chapter.
 * Pure presentation. Uses the actual WebP supplied in this project and
 * starts blueprint -> photograph only once the housing panel enters view.
 * Financial amount/progress logic stays in experience.js.
 */
(()=>{
 'use strict';
 const section=document.getElementById('housing');
 const visual=document.getElementById('ex-house-stage');
 const image=document.getElementById('ex-house-art');
 if(!section||!visual||!image)return;
 let inView=false;
 let loaded=false;
 function revealIfReady(){
  if(!loaded)return;
  section.classList.add('ex-house-image-ready');
  if(inView||document.body.classList.contains('ex-motion-off')||
     window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
   section.classList.add('ex-house-revealed');
  }
 }
 function reveal(){
  inView=true;
  revealIfReady();
 }
 function ready(){
  loaded=image.naturalWidth>0;
  if(loaded)revealIfReady();
 }
 function failed(){
  loaded=false;
  section.classList.remove('ex-house-image-ready');
  section.classList.remove('ex-house-revealed');
  // Wireframe becomes a permanent graceful fallback, no broken image icon.
 }
 image.addEventListener('load',ready);
 image.addEventListener('error',failed);
 if(image.complete){if(image.naturalWidth>0)ready();else failed()}
 if(typeof IntersectionObserver==='function'){
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(entry.target===visual && entry.isIntersecting){
     reveal();observer.disconnect();break;
    }
   }
  },{root:null,threshold:.22,rootMargin:'0px 0px -3% 0px'});
  observer.observe(visual);
 }else{
  // Static browsers: use the photograph when it becomes available.
  reveal();
 }
 const motion=document.getElementById('ex-motion-toggle');
 motion?.addEventListener('click',()=>{if(document.body.classList.contains('ex-motion-off'))reveal()});
})();

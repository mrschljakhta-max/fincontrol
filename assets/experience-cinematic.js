/* FINCONTROL Motion — interaction bridge for the existing WebGL rock.
 * Decorative only; never reads or modifies financial storage. */
(()=>{
 'use strict';
 const shell=document.getElementById('ex-morph-shell');
 const links=document.querySelectorAll('#intro .ex-orbit-tag');
 if(!shell||!links.length)return;
 const keys=['income','reserve','goals'];
 const keyFor=link=>keys[[...links].indexOf(link)]||null;
 const setFocus=key=>{
  if(key)shell.dataset.orbitFocus=key;
  else delete shell.dataset.orbitFocus;
 };
 for(const link of links){
  link.addEventListener('pointerenter',()=>setFocus(keyFor(link)));
  link.addEventListener('pointerleave',()=>{if(!link.matches(':focus-visible'))setFocus(null)});
  link.addEventListener('focus',()=>setFocus(keyFor(link)));
  link.addEventListener('blur',()=>setFocus(null));
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)setFocus(null)});
})();

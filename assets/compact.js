/* FINCONTROL Compact UI — independent presentation preferences, no ledger mutations. */
(function(){
'use strict';
const KEY='fincontrol-ui-compact-v1';
const defaults={compact:true,filtersOpen:false,collapsed:['months','story'],lastView:'overview'};
const validViews=new Set(['overview','analysis','goals','operations']);
const validWidgets=new Set(['money','dynamics','categories','route','months','story']);
let saved={};
try{const data=JSON.parse(localStorage.getItem(KEY));if(data&&typeof data==='object'&&!Array.isArray(data))saved=data}catch{}
let state={
 compact:typeof saved.compact==='boolean'?saved.compact:true,
 filtersOpen:typeof saved.filtersOpen==='boolean'?saved.filtersOpen:false,
 collapsed:Array.isArray(saved.collapsed)?saved.collapsed.filter(k=>validWidgets.has(k)):[...defaults.collapsed],
 lastView:validViews.has(saved.lastView)?saved.lastView:defaults.lastView
};
const $=id=>document.getElementById(id);
const panels=[...document.querySelectorAll('#overview-grid [data-widget]')];
if(!location.hash&&state.lastView!=='overview')history.replaceState(null,'','#'+state.lastView);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{/* Storage may be disabled. UI still works for this visit. */}}
function apply(){
 document.body.classList.toggle('fc-density-compact',state.compact);
 document.body.classList.toggle('fc-filters-open',state.filtersOpen);
 const filters=$('fc-filters-toggle');
 if(filters){filters.setAttribute('aria-expanded',String(state.filtersOpen));filters.textContent=state.filtersOpen?'Фільтри ▴':'Фільтри ▾'}
 const density=$('fc-density-toggle');if(density)density.checked=state.compact;
 for(const panel of panels){
  const key=panel.dataset.widget;
  const collapsed=state.collapsed.includes(key);
  panel.classList.toggle('fc-is-collapsed',collapsed);
  const control=panel.querySelector('.fc-collapse-widget');
  if(control){
   control.setAttribute('aria-expanded',String(!collapsed));
   control.setAttribute('aria-label',(collapsed?'Розгорнути: ':'Згорнути: ')+(panel.querySelector('h2')?.textContent?.trim()||key));
   control.textContent=collapsed?'Розгорнути ▾':'Згорнути ▴';
  }
 }
}
for(const panel of panels){
 const key=panel.dataset.widget,heading=panel.querySelector('.fc-panel-heading');
 if(!heading||!validWidgets.has(key))continue;
 const control=document.createElement('button');
 control.type='button';
 control.className='fc-collapse-widget';
 control.title='Розгорнути або згорнути блок';
 control.addEventListener('click',()=>{
  const next=new Set(state.collapsed);
  if(next.has(key))next.delete(key);else next.add(key);
  state.collapsed=[...next];
  persist();apply();
 });
 heading.append(control);
}
$('fc-filters-toggle')?.addEventListener('click',()=>{state.filtersOpen=!state.filtersOpen;persist();apply()});
$('fc-density-toggle')?.addEventListener('change',e=>{state.compact=e.target.checked;persist();apply()});
$('layout-reset')?.addEventListener('click',()=>{state={...defaults,collapsed:[...defaults.collapsed]};persist();apply()});
window.addEventListener('fincontrol:viewchange',e=>{
 const v=e.detail?.view;
 if(validViews.has(v)&&state.lastView!==v){state.lastView=v;persist()}
});
window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{const next=JSON.parse(e.newValue);if(next&&typeof next==='object'){
 state.compact=typeof next.compact==='boolean'?next.compact:defaults.compact;
 state.filtersOpen=typeof next.filtersOpen==='boolean'?next.filtersOpen:defaults.filtersOpen;
 state.collapsed=Array.isArray(next.collapsed)?next.collapsed.filter(k=>validWidgets.has(k)):[...defaults.collapsed];
 apply();
}}catch{}});
apply();
})();

/* FINCONTROL cinematic interactions regression: source-only, no financial writes. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('experience.html'),css=read('assets/experience-cinematic-next.css');
const script=read('assets/experience.js'),rock=read('assets/experience-cinematic.js');
function section(from,to){
 const a=script.indexOf(from),b=script.indexOf(to,a);
 assert.ok(a>=0&&b>a,from+' extraction');
 return script.slice(a,b);
}
function node(){
 const events=new Map(),attrs=new Map(),children=[];
 const n={dataset:{},style:{setProperty(k,v){this[k]=v}},children,events,attrs,
  classList:{add(){}},append(...x){children.push(...x)},
  replaceChildren(...x){children.splice(0,children.length,...x)},
  setAttribute(k,v){attrs.set(k,String(v))},
  getAttribute:k=>attrs.get(k),
  removeAttribute:k=>attrs.delete(k),
  addEventListener:(k,f)=>events.set(k,f)};
 return n;
}
test('same eight scenes, local assets and real final navigation remain available',()=>{
 for(const id of ['intro','overview','calendar','credits','reserve','housing','analytics','finish'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const href of ['analytics.html#overview','calendar.html','reserve.html','goals.html'])
  assert.ok(html.includes('href="'+href+'"'),href);
 for(const id of ['ex-house-3d','ex-house-art','ex-morph-shell','ex-premium-phone-image'])
  assert.ok(html.includes('id="'+id+'"'));
 for(const file of ['assets/experience-cinematic-next.css','assets/experience-cinematic.js'])
  assert.ok(fs.existsSync(path.join(root,file)));
 assert.match(html,/assets\/experience\.js\?v=12/);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});
test('interactive week orbit draws seven buttons and updates selection without storage',()=>{
 const model=require('../assets/calendar-model.js');
 const host=node();
 const selected='2026-10-22';
 const setDate=[];
 const make=(tag,cls,txt)=>{const n=node();n.textContent=txt;n.className=cls;return n};
 const env={C:model,$:()=>host,el:make,stamp:d=>d,
  highlightCalendarDay:()=>{},renderDay:(_e,date)=>setDate.push(date)};
 vm.createContext(env);
 vm.runInContext('var selectedDay="'+selected+'";'+section(' function renderCalendarOrbit(byDay,today){',' function changeCalendarMonth(delta){')+'renderCalendarOrbit(new Map(),"'+selected+'");',env);
 assert.equal(host.children.length,7);
 const current=host.children.find(b=>b.dataset.date===selected);
 assert.equal(current.getAttribute('aria-pressed'),'true');
 const friday=host.children.find(b=>b.dataset.date==='2026-10-23');
 assert.ok(friday);
 friday.events.get('click')();
 assert.equal(env.selectedDay,'2026-10-23');
 assert.deepEqual(setDate,['2026-10-23']);
});
test('analytics supports 3 / 6 / 12 months and no private amount disclosure',()=>{
 assert.match(html,/id="ex-analytics-insight"/);
 for(const range of [3,6,12])assert.ok(html.includes('data-ex-chart-range="'+range+'"'));
 assert.match(script,/chartRange=next/);
 assert.match(script,/privacyOn\?'5%'/);
 assert.match(script,/privacyOn\?name\+' · '\+monthLabel\+' · суму приховано'/);
 assert.match(css,/\.ex-page #analytics \.ex-chart-ranges button\[aria-pressed="true"\]/);
 assert.match(css,/overflow-x:auto/);
});
test('housing energy illumination stays derived from original live progress, respects privacy',()=>{
 const segment=section(' function renderHome(home){',' function renderAnalytics(ledger,today){');
 assert.match(segment,/home\.priceUsd\*home\.rate\*\(1\+Number\(home\.fees\|\|0\)\/100\)\+Number\(home\.renovation\|\|0\)/);
 assert.match(segment,/privacyOn\?0:progress>=75\?3:progress>=40\?2:progress>0\?1:0/);
 assert.match(segment,/data-goal-phase/);
 assert.match(css,/data-goal-phase="3"/);
});
test('rock responds to pointer and keyboard with no financial-store access',()=>{
 const shell={dataset:{}},links=Array.from({length:3},()=>({
  events:new Map(),addEventListener(k,f){this.events.set(k,f)},matches:()=>false
 }));
 const doc={hidden:false,getElementById:()=>shell,querySelectorAll:()=>links,addEventListener(){}};
 vm.runInNewContext(rock,{document:doc},{timeout:2000});
 links[1].events.get('pointerenter')();
 assert.equal(shell.dataset.orbitFocus,'reserve');
 links[1].events.get('pointerleave')();
 assert.equal(shell.dataset.orbitFocus,undefined);
 links[2].events.get('focus')();
 assert.equal(shell.dataset.orbitFocus,'goals');
 links[2].events.get('blur')();
 assert.equal(shell.dataset.orbitFocus,undefined);
 assert.doesNotMatch(rock,/FCStore|localStorage/);
});
test('mobile, no-motion and fallback keep navigation accessible',()=>{
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/@media\(max-width:1090px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/ex-motion-off/);
 assert.match(html,/aria-label="Застосунки FINCONTROL"/);
 assert.match(html,/aria-label="Вибір дня тижня"/);
});

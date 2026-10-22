/* Run: node --test tests/experience-smoke.test.cjs
   Smoke-tests the immersive UI with synthetic data only; no real browser storage. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const page=read('experience.html');
const script=read('assets/experience.js');
// Browser UMD script loads under a separate VM because package.json is ESM.
const calendarContext={};
vm.runInNewContext(read('assets/calendar-model.js'),calendarContext);
const model=calendarContext.FCCalendarModel;
class Node {
 constructor(tag='div',top=0){
  this.tag=tag;this.children=[];this.dataset={top:String(top)};
  this.attributes=new Map();this.events={};this.classes=new Set();this.className='';
  this.style={values:{},setProperty:(key,v)=>{this.style.values[key]=v}};
  this.classList={add:key=>this.classes.add(key),remove:key=>this.classes.delete(key),contains:key=>this.classes.has(key),toggle:(key,on)=>{if(on===undefined)on=!this.classes.has(key);if(on)this.classes.add(key);else this.classes.delete(key);return on}};
  this.textContent='';this.title='';this.offsetHeight=900;
 }
 setAttribute(k,v){this.attributes.set(k,String(v))}
 getAttribute(k){return this.attributes.get(k)}
 removeAttribute(k){this.attributes.delete(k)}
 addEventListener(k,cb){this.events[k]=cb}
 dispatch(k){this.events[k]?.({type:k})}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children.length=0;this.append(...nodes)}
 querySelector(){return{textContent:''}}
 querySelectorAll(){return[]}
 getBoundingClientRect(){return{top:Number(this.dataset.top),bottom:Number(this.dataset.top)+900,height:900}}
}
function fixture(){
 const nodes=new Map(),frames=[],storage=new Map(),today=model.today();
 const el=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id)};
 const ids=['intro','overview','calendar','credits','reserve','housing','analytics','finish'];
 const scenes=ids.map((id,i)=>{const x=new Node('section',i*900);x.id=id;return x});
 const links=['overview','calendar','credits','reserve','housing','analytics'].map(id=>{const a=new Node('a');a.dataset.chapterNav=id;return a});
 const reveals=[new Node(),new Node(),new Node()];
 const doc={
  body:new Node('body'),documentElement:{scrollHeight:9000},getElementById:el,
  createElement:tag=>new Node(tag),addEventListener(){},
  querySelector:()=>new Node('main'),
  querySelectorAll:s=>s==='.ex-scene'?scenes:s==='.ex-reveal'?reveals:s==='[data-chapter-nav]'?links:[]
 };
 let mutationCount=0;
 const storeData={ledger:{version:1,debtCents:0,entries:[
  {id:'income',date:today,kind:'income',status:'actual',cents:820000,category:'Зарплата',note:''},
  {id:'bill',date:today,kind:'expense',status:'actual',cents:250000,category:'Рахунок',note:''}
 ]},debts:{version:1,credits:[{id:'credit',name:'Тестовий кредит',balance:340000,minimum:12000,due:today}],history:[]},
  reserve:{saved:5000,target:10000,monthly:800},home:{priceUsd:100000,rate:42,fees:3,renovation:100000,saved:400000},
  calendar:{version:1,events:[{id:'salary',name:'Зарплата',date:today,repeat:'monthly',kind:'income',cents:820000}],opening:0}};
 const store={
  K:{ledger:'ledger',calendar:'calendar',debts:'debts',reserve:'reserve',home:'home'},ready:Promise.resolve(),
  read:key=>storeData[key]??null,update:()=>{mutationCount++;throw Error('financial write is not allowed')}
 };
 const listeners={};
 const w={innerHeight:900,scrollY:0,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(event,callback)=>{listeners[event]=callback}};
 const ctx={document:doc,window:w,FCStore:store,FCCalendarModel:model,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},requestAnimationFrame:fn=>{frames.push(fn);return frames.length}};
 vm.createContext(ctx);
 const start=async()=>{
  vm.runInContext(script,ctx,{timeout:2500});
  await new Promise(setImmediate);
  for(const fn of frames.splice(0,10))fn();
 };
 const scrollTo=y=>{
  w.scrollY=y;
  listeners.scroll?.();
  for(const fn of frames.splice(0,10))fn();
 };
 return{nodes,el,frames,storage,storeData,start,scrollTo,mutationCount:()=>mutationCount,body:doc.body};
}
test('all long-scroll chapters and module links are available',()=>{
 for(const id of ['intro','overview','calendar','credits','reserve','housing','analytics','finish'])
  assert.match(page,new RegExp('id="'+id+'"'));
 for(const href of ['analytics.html','calendar.html','debts.html','reserve.html','home.html','data-center.html'])
  assert.ok(page.includes('href="'+href+'"')||page.includes('href="'+href+'#analysis"'),href);
});
test('render a live month and journal totals without modifying finance data',async()=>{
 const f=fixture();await f.start();
 assert.ok([35,42].includes(f.el('ex-calendar-grid').children.length));
 assert.match(f.el('ex-month-income').textContent,/8\s?200/);
 assert.match(f.el('ex-month-expenses').textContent,/2\s?500/);
 assert.match(f.el('ex-debt-total').textContent,/3\s?400/);
 assert.equal(f.mutationCount(),0);
});
test('empty local storage never invents income, credit or home totals',async()=>{
 const f=fixture();for(const key of Object.keys(f.storeData))delete f.storeData[key];
 await f.start();
 assert.equal(f.el('ex-month-income').textContent,'—');
 assert.equal(f.el('ex-debt-total').textContent,'—');
 assert.equal(f.el('ex-house-saved').textContent,'—');
 assert.ok([35,42].includes(f.el('ex-calendar-grid').children.length));
});
test('privacy view hides amounts without writing financial records',async()=>{
 const f=fixture();await f.start();
 f.el('ex-privacy-toggle').dispatch('click');
 assert.equal(f.el('ex-month-income').textContent,'••••');
 assert.equal(f.el('ex-debt-total').textContent,'••••');
 assert.equal(f.storage.get('fincontrol-experience-private-v1'),'on');
 assert.equal(f.mutationCount(),0);
});
test('scroll engine builds a smoothly interpolable vector outline',async()=>{
 const f=fixture();await f.start();
 const outline=f.el('ex-morph-outline').getAttribute('d');
 assert.ok(outline&&outline.startsWith('M')&&outline.endsWith('Z'));
 assert.ok(outline.length>300);
 assert.equal(f.mutationCount(),0);
});
test('markup has a separate motion toggle and honors reduced-motion support',()=>{
 assert.ok(page.includes('id="ex-motion-toggle"'));
 assert.ok(script.includes('prefers-reduced-motion'));
 assert.ok(script.includes('drawMorph(at)'));
 const css=read('assets/experience.css');
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes('url("experience-world.svg?v=1")'));
});

test('stone glows, turns and orbits continuously with zero scrolling',()=>{
 const styles=read('assets/experience-core.css');
 assert.match(page,/id="ex-rock-idle"/);
 assert.match(page,/id="ex-orbit-back"/);
 assert.match(page,/id="ex-device"/);
 assert.match(styles,/ex-rock-breathe 14s ease-in-out infinite/);
 assert.match(styles,/ex-orbit-clockwise 29s linear infinite/);
 assert.match(styles,/ex-heartbeat 4\.8s/);
 assert.match(styles,/ex-crack-blink 6\.5s/);
 // Idle effects are CSS keyframes, not dependent on onscroll/requestAnimationFrame.
 assert.match(styles,/@keyframes ex-rock-breathe/);
 assert.match(styles,/@keyframes ex-aura-breathe/);
});
test('scrolling to the end completes the stone to phone crossfade',async()=>{
 const f=fixture();
 await f.start();
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-visible'],'0.000');
 f.scrollTo(9000);
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-visible'],'1.000');
 assert.equal(f.el('ex-morph-shell').style.values['--ex-stone-visible'],'0.000');
 assert.equal(f.mutationCount(),0);
});
test('the motion toggle pauses all animations and never mutates finance records',async()=>{
 const f=fixture();
 await f.start();
 f.el('ex-motion-toggle').dispatch('click');
 assert.ok(f.body.classList.contains('ex-motion-off'));
 assert.equal(f.el('ex-motion-toggle').getAttribute('aria-pressed'),'false');
 assert.equal(f.storage.get('fincontrol-experience-motion-v1'),'off');
 assert.equal(f.mutationCount(),0);
 const styles=read('assets/experience-core.css');
 assert.match(styles,/\.ex-motion-off \.ex-morph-shell \.ex-rock-idle/);
 assert.match(styles,/animation:none!important/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
});

test('desktop scene backgrounds are full bleed, content remains centered and mobile images retain cover',()=>{
 const styles=read('assets/experience-scenes.css');
 assert.match(styles,/width:100vw;/);
 assert.match(styles,/left:50%;/);
 assert.match(styles,/translateX\(-50%\)/);
 assert.match(styles,/background-size:cover,cover,cover/);
 for(const pageId of ['intro','overview','calendar','credits','reserve','housing','analytics','finish'])
   assert.ok(styles.includes('.ex-page #'+pageId+'{--ex-scene-image:'),pageId);
 for(const mobile of ['hero','overview','calendar','credits','reserve','housing','analytics','final'])
   assert.ok(styles.includes(mobile+'-mobile.webp'),mobile);
});
test('detailed crystal activates only after image load; SVG fallback, phone and motion remain',()=>{
 const styles=read('assets/experience-photo-core.css');
 assert.match(page,/id="ex-rock-photo"/);
 assert.match(page,/assets\/images\/fincontrol-core-rock.webp/);
 assert.match(page,/assets\/experience-photo-core.css/);
 assert.match(styles,/z-index:2/);
 assert.match(styles,/ex-photoreal-core/);
 assert.match(script,/preview\.onload/);
 assert.match(script,/preview\.onerror/);
 assert.match(script,/--ex-photo-visible/);
 assert.match(page,/id="ex-morph-outline"/);
 assert.match(page,/id="ex-device"/);
});

test('approved premium smartphone photo is included in the static website and loaded over SVG',()=>{
 const image=read('assets/experience-premium-phone.css');
 const file=fs.readFileSync(path.join(__dirname,'..','assets/images/fincontrol-phone-premium.webp'));
 assert.ok(file.length>40000);
 assert.equal(file.toString('ascii',0,4),'RIFF');
 assert.equal(file.toString('ascii',8,12),'WEBP');
 assert.match(page,/id="ex-premium-phone-image"/);
 assert.match(page,/assets\/images\/fincontrol-phone-premium.webp/);
 assert.match(page,/assets\/experience-premium-phone.css/);
 assert.match(image,/ex-premium-ready \.ex-device/);
 assert.match(script,/premiumImage\.addEventListener\('load'/);
});
test('premium handset starts invisible and emerges with full scale at the end of the scroll',async()=>{
 const f=fixture();await f.start();
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-visible'],'0.000');
 f.el('ex-premium-phone-image').dispatch('load');
 assert.ok(f.body.classList.contains('ex-premium-ready'));
 f.scrollTo(9000);
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-visible'],'1.000');
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-scale'],'1.000');
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-rise'],'0.0px');
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-tilt'],'0.0deg');
 assert.equal(f.mutationCount(),0);
});
test('no-motion setting still displays final premium phone rather than hiding it',async()=>{
 const f=fixture();await f.start();
 f.el('ex-motion-toggle').dispatch('click');
 f.scrollTo(9000);
 assert.ok(f.body.classList.contains('ex-motion-off'));
 assert.equal(f.el('ex-morph-shell').style.values['--ex-phone-visible'],'1.000');
 assert.equal(f.mutationCount(),0);
});

test('panorama calendar navigates next/previous months without changing source data',async()=>{
 const f=fixture();await f.start();
 const initial=f.el('ex-calendar-month').textContent;
 f.el('ex-calendar-next').dispatch('click');
 const next=f.el('ex-calendar-month').textContent;
 assert.ok(next!==initial);
 assert.ok([35,42].includes(f.el('ex-calendar-grid').children.length));
 f.el('ex-privacy-toggle').dispatch('click');
 assert.equal(f.el('ex-calendar-month').textContent,next);
 f.el('ex-calendar-prev').dispatch('click');
 assert.equal(f.el('ex-calendar-month').textContent,initial);
 f.el('ex-calendar-next').dispatch('click');
 f.el('ex-calendar-today').dispatch('click');
 assert.equal(f.el('ex-calendar-month').textContent,initial);
 assert.equal(f.mutationCount(),0);
});

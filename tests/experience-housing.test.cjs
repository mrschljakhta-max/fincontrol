/* FINCONTROL transparent animated villa — local assets and interactions.
   Run: node --test tests/experience-housing.test.cjs
   Uses synthetic UI records only and does not write to financial storage. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('experience.html');
const css=read('assets/experience-house-floating.css');
const script=read('assets/experience-house.js');
const oldCss=read('assets/experience-house.css');
const model=read('assets/experience.js');

function fixture(){
 const classes=new Set(),listeners=new Map(),frames=[],styles={};
 let observer;
 const section={classList:{
  add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),
  toggle:(k,on)=>on?classes.add(k):classes.delete(k)
 }};
 const imageListeners={};
 const img={complete:false,naturalWidth:0,addEventListener:(k,fn)=>{imageListeners[k]=fn}};
 const emission={style:{display:''},addEventListener:(k,fn)=>listeners.set('emission:'+k,fn)};
 const tilt={style:{setProperty:(k,v)=>{styles[k]=v}}};
 const visual={
  addEventListener:(k,fn)=>listeners.set('visual:'+k,fn),
  getBoundingClientRect:()=>({left:100,top:100,width:400,height:300})
 };
 const bodyClasses=new Set();
 const body={classList:{contains:k=>bodyClasses.has(k)}};
 const motion={addEventListener:(k,fn)=>listeners.set('motion:'+k,fn)};
 const document={body,hidden:false,getElementById:id=>({
  housing:section,'ex-house-stage':visual,'ex-house-art':img,
  'ex-house-tilt':tilt,'ex-house-emission':emission,
  'ex-motion-toggle':motion
 })[id],addEventListener:(k,fn)=>listeners.set('document:'+k,fn)};
 const window={matchMedia:(query)=>({matches:false,addEventListener(){}})};
 class MockObserver{
  constructor(fn){this.fn=fn;observer=this}
  observe(el){assert.equal(el,visual)}
 }
 const ctx={document,window,IntersectionObserver:MockObserver,
  requestAnimationFrame:fn=>{frames.push(fn);return frames.length},
  cancelAnimationFrame:()=>{}};
 vm.runInNewContext(script,ctx,{timeout:3000});
 return{
  section,classes,bodyClasses,visual,styles,emission,window,document,img,imageListeners,
  observer:()=>observer,frames,
  show(){observer.fn([{target:visual,isIntersecting:true}])},
  hide(){observer.fn([{target:visual,isIntersecting:false}])},
  event:(name,payload={})=>listeners.get(name)?.(payload),
  flush(){while(frames.length)frames.shift()()}
 };
}
test('the final stage uses a truly transparent WEBP cutout and local emission overlay',()=>{
 for(const file of ['fincontrol-house-floating.webp','fincontrol-house-emission.webp']){
  const data=fs.readFileSync(path.join(root,'assets/images',file));
  assert.ok(data.length>40000);
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.toString('ascii',8,12),'WEBP');
 }
 assert.match(html,/id="ex-house-art"/);
 assert.match(html,/src="assets\/images\/fincontrol-house-floating.webp\?v=1"/);
 assert.match(html,/src="assets\/images\/fincontrol-house-emission.webp\?v=1"/);
 assert.match(html,/width="1280" height="960"/);
 assert.match(html,/assets\/experience-house-floating.css\?v=1/);
 assert.match(html,/assets\/experience-house.js\?v=2/);
 assert.doesNotMatch(html,/src="assets\/images\/fincontrol-housing-scene.webp/);
});
test('financial values stay separate and derived from actual FINCONTROL data',()=>{
 for(const id of ['ex-house-stage','ex-house-saved','ex-house-target','ex-house-percent','ex-house-progress'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/class="ex-house-stats"/);
 assert.match(html,/class="ex-house-wireframe"/);
 assert.match(html,/href="home.html"/);
 assert.match(model,/function renderHome\(home\)/);
 assert.match(model,/--ex-house-charge/);
 assert.match(model,/privacyOn\?0:progress/);
 assert.doesNotMatch(script,/FCStore|\.update\(/);
});
test('image appears on entry, continues moving and pauses invisible animation layers',()=>{
 const f=fixture();
 f.img.naturalWidth=1280;
 f.imageListeners.load();
 assert.equal(f.classes.has('ex-house-image-ready'),true);
 assert.equal(f.classes.has('ex-house-revealed'),false);
 f.show();
 assert.equal(f.classes.has('ex-house-in-view'),true);
 assert.equal(f.classes.has('ex-house-revealed'),true);
 f.hide();
 assert.equal(f.classes.has('ex-house-in-view'),false);
 assert.match(css,/animation-play-state:paused!important/);
 assert.match(css,/@keyframes ex-house-hover-breath/);
 assert.match(css,/@keyframes ex-house-windows-live/);
 assert.match(css,/@keyframes ex-house-light-sweep/);
});
test('pointer movement changes live house perspective and leave restores neutral pose',()=>{
 const f=fixture();
 f.img.naturalWidth=1280;f.imageListeners.load();f.show();
 f.event('visual:pointermove',{clientX:410,clientY:182});
 f.flush();
 assert.match(f.styles['--ex-house-tilt-y'],/deg/);
 assert.notEqual(f.styles['--ex-house-tilt-y'],'0deg');
 assert.match(f.styles['--ex-house-tilt-x'],/deg/);
 f.event('visual:pointerleave');
 assert.equal(f.styles['--ex-house-tilt-y'],'0deg');
 assert.equal(f.styles['--ex-house-tilt-x'],'0deg');
});
test('motion off, reduced motion and optional light failure preserve the building',()=>{
 const f=fixture();
 f.img.naturalWidth=1280;f.imageListeners.load();f.show();
 f.bodyClasses.add('ex-motion-off');
 f.event('visual:pointermove',{clientX:400,clientY:200});
 assert.equal(f.frames.length,0);
 f.event('motion:click');
 assert.equal(f.classes.has('ex-house-revealed'),true);
 f.event('emission:error');
 assert.equal(f.emission.style.display,'none');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.ex-page\.ex-motion-off #housing/);
 assert.match(css,/\.ex-page #housing\.ex-house-image-ready\.ex-house-revealed \.ex-house-art/);
 assert.match(oldCss,/ex-house-wireframe/);
 const balance=(css.match(/\{/g)||[]).length-(css.match(/\}/g)||[]).length;
 assert.equal(balance,0);
});
test('failed image load keeps the wireframe fallback and no broken photo',()=>{
 const f=fixture();
 f.imageListeners.error();
 assert.equal(f.classes.has('ex-house-image-ready'),false);
 assert.equal(f.classes.has('ex-house-revealed'),false);
 f.show();
 assert.equal(f.classes.has('ex-house-revealed'),false);
});

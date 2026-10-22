/* FINCONTROL premium housing scene regression tests. Run with node --test. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('experience.html');
const css=read('assets/experience-house.css');
const script=read('assets/experience-house.js');
const model=read('assets/experience.js');
test('photoreal scene is a committed local WebP and is referenced in housing card',()=>{
 const file=path.join(root,'assets/images/fincontrol-housing-scene.webp');
 const buffer=fs.readFileSync(file);
 assert.ok(buffer.length>100000);
 assert.equal(buffer.toString('ascii',0,4),'RIFF');
 assert.equal(buffer.toString('ascii',8,12),'WEBP');
 assert.match(html,/id="ex-house-art"/);
 assert.match(html,/src="assets\/images\/fincontrol-housing-scene.webp\?v=1"/);
 assert.match(html,/width="1672" height="941"/);
 assert.match(html,/assets\/experience-house.css/);
 assert.match(html,/assets\/experience-house.js/);
});
test('housing image keeps real values, progress bar, backup wireframe and link',()=>{
 assert.match(html,/id="ex-house-stage"/);
 assert.match(html,/class="ex-house-wireframe"/);
 for(const id of ['ex-house-saved','ex-house-target','ex-house-percent','ex-house-progress']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/class="ex-card-link" href="home.html"/);
 assert.doesNotMatch(html,/class="ex-house-symbol"/);
 assert.match(model,/function renderHome\(home\)/);
 assert.match(model,/--ex-house-charge/);
 assert.match(model,/privacyOn\?0:progress/);
 assert.doesNotMatch(script,/FCStore|\.update\(/);
});
test('image is shown only after load and entering viewport; failure preserves wireframe',()=>{
 const sectionClasses=new Set();
 const section={classList:{
  add:k=>sectionClasses.add(k),
  remove:k=>sectionClasses.delete(k),
  contains:k=>sectionClasses.has(k)
 }};
 const imageListeners={};
 const img={complete:false,naturalWidth:0,addEventListener:(k,fn)=>imageListeners[k]=fn};
 const visual={};
 let targetObserver;
 class MockObserver{
  constructor(fn){this.fn=fn;this.disconnected=false;targetObserver=this}
  observe(target){assert.equal(target,visual)}
  disconnect(){this.disconnected=true}
 }
 const document={
  body:{classList:{contains:()=>false}},
  getElementById:id=>({
   housing:section,'ex-house-stage':visual,'ex-house-art':img,
   'ex-motion-toggle':{addEventListener(){}}
  })[id]
 };
 const window={matchMedia:()=>({matches:false})};
 vm.runInNewContext(script,{document,window,IntersectionObserver:MockObserver},{timeout:3000});
 img.naturalWidth=1672;
 imageListeners.load();
 assert.equal(sectionClasses.has('ex-house-image-ready'),true);
 assert.equal(sectionClasses.has('ex-house-revealed'),false);
 targetObserver.fn([{target:visual,isIntersecting:true}]);
 assert.equal(sectionClasses.has('ex-house-revealed'),true);
 assert.equal(targetObserver.disconnected,true);
 imageListeners.error();
 assert.equal(sectionClasses.has('ex-house-image-ready'),false);
 assert.equal(sectionClasses.has('ex-house-revealed'),false);
});
test('motion controls, responsive layout, privacy and reduced-motion support remain',()=>{
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:680px/);
 assert.match(css,/\.ex-page\.ex-motion-off/);
 assert.match(css,/ex-house-image-ready\.ex-house-revealed/);
 assert.match(model,/housingFocus/);
 assert.match(model,/--ex-orb-opacity/);
 const opens=(css.match(/\{/g)||[]).length,closes=(css.match(/\}/g)||[]).length;
 assert.equal(opens,closes);
});

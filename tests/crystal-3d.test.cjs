/* Run: node --test tests/crystal-3d.test.cjs
   Lightweight WebGL-interface tests with synthetic scene and GPU mocks only.
   Finance records and real browser storage are never touched. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=pathInRepo=>fs.readFileSync(path.join(__dirname,'..',pathInRepo),'utf8');
const source=read('assets/crystal-3d.js');
const experience=read('experience.html');
const css=read('assets/crystal-3d.css');
const controller=read('assets/experience.js');
function harness(hasWebGL=true){
 const events=new Map(),pending=new Map(),uniforms=[],states=new Set(),stats={draws:0,vertices:0};
 let frameID=0;
 const gl={
  FLOAT:1,TRIANGLES:2,ARRAY_BUFFER:3,STATIC_DRAW:4,COLOR_BUFFER_BIT:5,
  DEPTH_BUFFER_BIT:6,DEPTH_TEST:7,LEQUAL:8,CULL_FACE:9,NO_ERROR:0,
  VERTEX_SHADER:10,FRAGMENT_SHADER:11,COMPILE_STATUS:12,LINK_STATUS:13,
  createShader(){return {}},shaderSource(){},compileShader(){},
  getShaderParameter(){return true},getShaderInfoLog(){return ''},deleteShader(){},
  createProgram(){return {}},attachShader(){},linkProgram(){},
  getProgramParameter(){return true},getProgramInfoLog(){return ''},
  deleteProgram(){},useProgram(){},createBuffer(){return {}},bindBuffer(){},
  bufferData(){},getAttribLocation(){return 0},enableVertexAttribArray(){},
  vertexAttribPointer(){},enable(){},depthFunc(){},disable(){},clearColor(){},
  viewport(){},clear(){},getUniformLocation(_program,key){return key},
  uniform1f(name,value){uniforms.push({name,value})},getError(){return 0},
  drawArrays(_shape,_start,count){stats.draws++;stats.vertices=count},deleteBuffer(){}
 };
 const canvas={
  style:{},width:0,height:0,
  getContext(name){return hasWebGL&&name==='webgl'?gl:null},
  getBoundingClientRect(){return{width:440,height:440}},
  addEventListener(key,callback){events.set('canvas:'+key,callback)}
 };
 const body={style:{},classList:{
  add(value){states.add(value)},remove(value){states.delete(value)},
  contains(value){return states.has(value)}
 }};
 const doc={
  body,hidden:false,
  getElementById(id){return id==='ex-crystal-3d'?canvas:id==='ex-morph-shell'?{}:null},
  addEventListener(key,callback){events.set('document:'+key,callback)}
 };
 const win={
  innerWidth:1440,devicePixelRatio:1.3,
  matchMedia(){return{matches:false,addEventListener(){}}},
  addEventListener(key,callback){events.set('window:'+key,callback)}
 };
 const ctx={window:win,document:doc,
  requestAnimationFrame(fn){const id=++frameID;pending.set(id,fn);return id},
  cancelAnimationFrame(id){pending.delete(id)},
  console:{warn(){}},Math,Number,Float32Array,Uint8Array};
 vm.createContext(ctx);
 vm.runInContext(source,ctx,{timeout:5000});
 return {
  api:win.FCCrystal3D,canvas,body,doc,states,stats,uniforms,pending,
  nextFrame(ms){const tasks=[...pending.values()];pending.clear();for(const fn of tasks)fn(ms)},
  fire(key){events.get(key)?.({preventDefault(){}})}
 };
}
test('progressive enhancement: HTML loads renderer, SVG orbit and smartphone remain',()=>{
 assert.match(experience,/id="ex-crystal-3d"/);
 assert.match(experience,/src="assets\/crystal-3d.js\?v=1"/);
 assert.match(experience,/href="assets\/crystal-3d.css\?v=1"/);
 assert.match(experience,/id="ex-rock-idle"/);
 assert.match(experience,/id="ex-device"/);
 assert.match(controller,/FCCrystal3D\?\.setStage\(at\)/);
 assert.match(controller,/FCCrystal3D\?\.setMotion\(motionEnabled\)/);
});
test('real 3D mesh renders, then advances continuously without scrolling',()=>{
 const h=harness();
 assert.equal(h.states.has('ex-webgl-ready'),true);
 assert.ok(h.stats.draws>=1);
 assert.ok(h.stats.vertices>10000);
 const start=h.stats.draws;
 h.nextFrame(1000);h.nextFrame(1066);
 assert.ok(h.stats.draws>start);
 assert.ok(h.uniforms.some(v=>v.name==='uTime'&&v.value>0));
});
test('crystal stays animated throughout the page and stops after phone transition',()=>{
 const h=harness();
 h.api.setStage(3);
 assert.ok(h.pending.size>0);
 const before=h.stats.draws;
 h.nextFrame(1200);
 assert.ok(h.stats.draws>before);
 h.api.setStage(7);
 assert.equal(h.pending.size,0);
 h.api.setStage(0);
 assert.ok(h.pending.size>0);
});
test('motion toggle freezes current orientation and all orbit effects',()=>{
 const h=harness();h.nextFrame(1000);
 h.body.classList.add('ex-motion-off');
 h.api.setMotion(false);
 const now=h.stats.draws;
 h.nextFrame(1900);
 assert.equal(h.stats.draws,now);
 assert.ok(h.uniforms.some(v=>v.name==='uTime'&&v.value===1));
 assert.match(css,/\.ex-page\.ex-webgl-ready #ex-rock-idle\s*\{\s*visibility:hidden/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('unsupported or lost WebGL returns cleanly to detailed image/vector fallback',()=>{
 const h=harness(false);
 assert.equal(h.states.has('ex-webgl-ready'),false);
 assert.equal(h.pending.size,0);
 const live=harness();
 live.fire('canvas:webglcontextlost');
 assert.equal(live.states.has('ex-webgl-ready'),false);
 assert.equal(live.pending.size,0);
});

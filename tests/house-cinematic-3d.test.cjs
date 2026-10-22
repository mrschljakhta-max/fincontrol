/* FINCONTROL cinematic 3D housing regression.
 * Run locally: node --test tests/house-cinematic-3d.test.cjs
 */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const geometryJS=read('assets/house-cinematic-geometry.js');
const rendererJS=read('assets/house-cinematic-3d.js');
const html=read('experience.html');
const css=read('assets/house-cinematic-3d.css');
function buildGeometry(){
 const w={};vm.runInNewContext(geometryJS,{window:w,Math,Float32Array});return w.FCHouseGeometry.build();
}
function rig(hasGL=true,reduced=false){
 const callbacks=new Map(),frames=new Map(),states=new Set();
 const stats={draws:0,count:0};
 let counter=0;
 const classList={add(...args){for(const a of args)states.add(a)},
  remove(...args){for(const a of args)states.delete(a)},
  contains:a=>states.has(a),toggle:(a,v)=>v?states.add(a):states.delete(a)};
 const stage={style:{getPropertyValue:()=> '47.6%'},
  getBoundingClientRect(){return{left:0,top:0,width:650,height:400}},
  addEventListener:(n,f)=>callbacks.set('stage:'+n,f),setPointerCapture(){}};
 const section={classList};
 const shaderStub={
  NO_ERROR:0,COMPILE_STATUS:1,LINK_STATUS:2,STATIC_DRAW:3,ARRAY_BUFFER:4,FLOAT:5,TRIANGLES:6,
  DEPTH_TEST:7,LEQUAL:8,CULL_FACE:9,BLEND:10,SRC_ALPHA:11,ONE_MINUS_SRC_ALPHA:12,
  ONE:13,COLOR_BUFFER_BIT:14,DEPTH_BUFFER_BIT:15,VERTEX_SHADER:16,FRAGMENT_SHADER:17,
  createShader:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,
  createProgram:()=>({}),createBuffer:()=>({}),getAttribLocation:()=>0,
  getUniformLocation:(_p,n)=>n,shaderSource(){},compileShader(){},
  attachShader(){},linkProgram(){},deleteShader(){},deleteProgram(){},
  useProgram(){},bindBuffer(){},bufferData(){},enableVertexAttribArray(){},
  vertexAttribPointer(){},drawArrays(_mode,_start,count){stats.draws++;stats.count=count},
  enable(){},disable(){},depthFunc(){},clearColor(){},viewport(){},
  uniform1f(){},clear(){},depthMask(){},blendFunc(){},getError:()=>0
 };
 const canvas={width:0,height:0,style:{},
  getContext:()=>hasGL?shaderStub:null,
  getBoundingClientRect:()=>({width:650,height:400}),
  addEventListener:(n,f)=>callbacks.set('canvas:'+n,f)};
 const doc={hidden:false,body:{classList:{contains:()=>false}},
  getElementById:n=>({'housing':section,'ex-house-stage':stage,'ex-house-3d':canvas,
    'ex-motion-toggle':{addEventListener:(n,f)=>callbacks.set('motion:'+n,f)}}[n]),
  addEventListener:(n,f)=>callbacks.set('doc:'+n,f)};
 const w={innerWidth:1400,devicePixelRatio:1,matchMedia:()=>({matches:reduced,addEventListener(){}}),
  addEventListener:(n,f)=>callbacks.set('window:'+n,f)};
 const geom={};vm.runInNewContext(geometryJS,{window:geom,Math,Float32Array});
 w.FCHouseGeometry=geom.FCHouseGeometry;
 let observer=null;
 const IntersectionObserver=function(fn){observer=fn;this.observe=()=>{}};
 const MutationObserver=function(){this.observe=()=>{}};
 const requestAnimationFrame=f=>{const id=++counter;frames.set(id,f);return id};
 const cancelAnimationFrame=id=>frames.delete(id);
 const ctx={window:w,document:doc,Math,Float32Array,IntersectionObserver,MutationObserver,
  requestAnimationFrame,cancelAnimationFrame,console:{warn(){}}};
 vm.runInNewContext(rendererJS,ctx,{timeout:5000});
 return{states,stats,frames,stage,doc,canvas,
  show(v){observer?.([{target:stage,isIntersecting:v}])},
  frame(t){const tasks=[...frames.values()];frames.clear();for(const fn of tasks)fn(t)},
  trigger(name,event={}){callbacks.get(name)?.(event)}
 };
}
test('renders an actual 3D mesh with glass, neon and independently shaded faces',()=>{
 const a=buildGeometry();
 assert.ok(a.solid instanceof Float32Array);
 assert.ok(a.solid.length>10000);
 assert.ok(a.glass.length>0);
 assert.ok(a.lights.length>0);
 for(const part of [a.solid,a.glass,a.lights]){
  assert.equal(part.length%30,0);
  for(const value of part)assert.ok(Number.isFinite(value));
 }
});
test('cinematic model is local with safe fallback and live financial values',()=>{
 assert.match(html,/id="ex-house-3d"/);
 assert.match(html,/src="assets\/house-cinematic-geometry.js\?v=1"/);
 assert.match(html,/src="assets\/house-cinematic-3d.js\?v=1"/);
 assert.match(html,/href="assets\/house-cinematic-3d.css\?v=1"/);
 assert.match(html,/id="ex-house-art"/);
 for(const id of ['ex-house-saved','ex-house-target','ex-house-progress','ex-house-percent'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.doesNotMatch(rendererJS,/FCStore|\.update\(/);
 assert.match(rendererJS,/--ex-house-charge/);
});
test('renderer keeps rotating with scroll idle, stops outside the section',()=>{
 const h=rig();
 assert.equal(h.states.has('ex-house-3d-ready'),true);
 const first=h.stats.draws;
 h.show(true);
 h.frame(1000);h.frame(1050);
 assert.ok(h.stats.draws>first);
 assert.equal(h.states.has('ex-house-3d-revealed'),true);
 h.show(false);
 assert.equal(h.frames.size,0);
});
test('drag rotates true model and WebGL context loss restores picture fallback',()=>{
 const h=rig();h.show(true);
 h.trigger('stage:pointerdown',{button:0,pointerId:1,clientX:80,pointerType:'mouse'});
 assert.equal(h.states.has('ex-house-3d-dragging'),true);
 h.trigger('stage:pointermove',{pointerId:1,clientX:180,pointerType:'mouse'});
 h.trigger('stage:pointerup',{pointerId:1});
 assert.equal(h.states.has('ex-house-3d-dragging'),false);
 h.trigger('canvas:webglcontextlost',{preventDefault(){}});
 assert.equal(h.states.has('ex-house-3d-ready'),false);
});
test('unsupported WebGL and reduced motion are safe and non-animated',()=>{
 const noGL=rig(false);
 assert.equal(noGL.states.has('ex-house-3d-ready'),false);
 const reduced=rig(true);
 assert.equal(reduced.states.has('ex-house-3d-ready'),true);
 reduced.show(true);
 assert.equal(reduced.frames.size,0);
});
test('responsive 3D overlay and keyboard navigation are implemented',()=>{
 assert.match(rendererJS,/e.key==='ArrowLeft'/);
 assert.match(rendererJS,/e.key==='ArrowRight'/);
 assert.match(rendererJS,/e.key==='Home'/);
 assert.match(html,/aria-describedby="ex-house-3d-help"/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.ex-house-float\{[\s\S]*?visibility:hidden/);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

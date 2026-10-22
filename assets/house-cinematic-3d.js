
/* FINCONTROL Premium Cinematic House 3D.
 * A genuine floating building with real rotating faces, material shading,
 * glowing windows, glass, input-based orbit and an image fallback.
 * Private finance data remains outside the renderer.
 */
(()=>{
'use strict';
const section=document.getElementById('housing');
const stage=document.getElementById('ex-house-stage');
const canvas=document.getElementById('ex-house-3d');
if(!section||!stage||!canvas||!window.FCHouseGeometry)return;
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const motionOff=()=>document.body.classList.contains('ex-motion-off')||!!reduced?.matches;
const VS="\nattribute vec3 aPosition,aNormal,aColor;\nattribute float aMaterial;\nuniform float uYaw,uPitch,uLift,uAspect;\nvarying vec3 vNormal,vColor,vPos;\nvarying float vMaterial;\nvoid main(){\n float c=cos(uYaw),s=sin(uYaw);\n vec3 p=vec3(c*aPosition.x+s*aPosition.z,aPosition.y,-s*aPosition.x+c*aPosition.z);\n vec3 n=vec3(c*aNormal.x+s*aNormal.z,aNormal.y,-s*aNormal.x+c*aNormal.z);\n float cp=cos(uPitch),sp=sin(uPitch);\n vec3 v=vec3(p.x,cp*p.y-sp*p.z,sp*p.y+cp*p.z);\n vNormal=normalize(vec3(n.x,cp*n.y-sp*n.z,sp*n.y+cp*n.z));\n v.y+=uLift;\n float k=7.9/max(5.5,11.4-v.z);\n float ratio=max(.78,uAspect/1.54);\n gl_Position=vec4(v.x*k/(4.18*ratio),(v.y+.12)*k/2.75,-v.z*.068,1.);\n vPos=aPosition;vColor=aColor;vMaterial=aMaterial;\n}\n";
const FS="\nprecision mediump float;\nuniform float uTime,uCharge;\nvarying vec3 vNormal,vColor,vPos;\nvarying float vMaterial;\nfloat hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\nvoid main(){\n vec3 n=normalize(vNormal);\n vec3 key=normalize(vec3(-.65,.9,1.2));\n float diff=max(dot(n,key),0.);\n float rim=pow(1.-abs(n.z),2.);\n float spec=pow(max(dot(reflect(-key,n),vec3(0.,0.,1.)),0.),19.);\n float grain=hash(floor(vPos*31.));\n vec3 color=vColor;float alpha=1.;\n if(vMaterial<.5){\n  color*=.30+.65*diff+.11*grain;\n  color+=vec3(.12,.04,.07)*rim*.15;\n }else if(vMaterial<1.5){\n  color=mix(color,vec3(.35,.48,.54),rim*.30);\n  color+=vec3(.19,.24,.27)*spec*.43;\n  alpha=.66;\n }else if(vMaterial<2.5){\n  color*=.74+.23*uCharge+.07*sin(uTime*1.36+vPos.x);\n }else if(vMaterial<3.5){\n  color*=.90+.10*sin(uTime*.65+vPos.z);\n }else if(vMaterial<4.5){\n  color*=.50+.44*diff+.10*grain;\n }else{\n  color*=.42+.57*diff+.17*spec;\n }\n gl_FragColor=vec4(color,alpha);\n}\n";
let gl=null,program=null,ready=false,lost=false,visible=false;
let raf=0,lastTick=0,elapsed=0,width=0,height=0;
let modelYaw=-.36,dragYaw=0,currentPointerX=0,currentPointerY=0,wantX=0,wantY=0;
let dragging=false,dragId=null,lastPointerX=0,model=null;
const buffers=[];
function compile(type,src){
 const shader=gl.createShader(type);
 gl.shaderSource(shader,src);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
  const error=gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);throw Error('3D villa shader: '+error);
 }
 return shader;
}
function createProgram(){
 const v=compile(gl.VERTEX_SHADER,VS);
 const f=compile(gl.FRAGMENT_SHADER,FS);
 const p=gl.createProgram();
 gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
 gl.deleteShader(v);gl.deleteShader(f);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
  const error=gl.getProgramInfoLog(p);
  gl.deleteProgram(p);throw Error('3D villa program: '+error);
 }
 return p;
}
let attr={},uni={};
function upload(array){
 const buffer=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);
 buffers.push(buffer);
 return{buffer,count:array.length/10};
}
function resize(){
 if(!gl)return;
 const rect=canvas.getBoundingClientRect();
 const dpr=Math.min(window.devicePixelRatio||1,window.innerWidth<720?1.25:1.7);
 const w=Math.max(2,Math.round(rect.width*dpr));
 const h=Math.max(2,Math.round(rect.height*dpr));
 if(w!==width||h!==height){
  width=w;height=h;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);
 }
}
function useMesh(mesh){
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
 const inputs=[['p',3,0],['n',3,3],['c',3,6],['m',1,9]];
 for(const [key,count,start]of inputs){
  if(attr[key]>=0)gl.vertexAttribPointer(attr[key],count,gl.FLOAT,false,40,start*4);
 }
 gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}
function draw(){
 if(!gl||!model||lost)return;
 resize();
 const on=!motionOff();
 const yaw=modelYaw+dragYaw+(on?Math.sin(elapsed*.19)*.18:0)+currentPointerX*.15;
 const pitch=-.20+(on?Math.sin(elapsed*.13)*.045:0)+currentPointerY*.085;
 const lift=on?Math.sin(elapsed*.57)*.085:0;
 const value=parseFloat(stage.style.getPropertyValue('--ex-house-charge'))||0;
 const charge=Math.max(0,Math.min(1,value/100));
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(program);
 for(const [name,v]of Object.entries({
   uYaw:yaw,uPitch:pitch,uLift:lift,uAspect:width/height,uTime:elapsed,uCharge:charge
 }))gl.uniform1f(uni[name],v);
 gl.disable(gl.BLEND);gl.depthMask(true);useMesh(model.solid);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.depthMask(false);useMesh(model.glass);
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE);useMesh(model.lights);
 gl.depthMask(true);gl.disable(gl.BLEND);
}
function init(){
 try{
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,
    premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl)return false;
  program=createProgram();gl.useProgram(program);
  for(const [key,name] of Object.entries({p:'aPosition',n:'aNormal',c:'aColor',m:'aMaterial'})){
   attr[key]=gl.getAttribLocation(program,name);
   if(attr[key]>=0)gl.enableVertexAttribArray(attr[key]);
  }
  for(const name of ['uYaw','uPitch','uLift','uAspect','uTime','uCharge'])
   uni[name]=gl.getUniformLocation(program,name);
  const geo=window.FCHouseGeometry.build();
  model={solid:upload(geo.solid),glass:upload(geo.glass),lights:upload(geo.lights)};
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  gl.clearColor(0,0,0,0);
  resize();draw();
  if(gl.getError()!==gl.NO_ERROR)throw Error('3D villa first GPU draw failed');
  lost=false;ready=true;
  section.classList.add('ex-house-3d-ready');
  if(visible)section.classList.add('ex-house-3d-revealed');
  return true;
 }catch(e){
  ready=false;section.classList.remove('ex-house-3d-ready','ex-house-3d-revealed');
  canvas.style.display='none';
  console.warn('FINCONTROL House 3D: retaining image fallback',e);
  return false;
 }
}
const canAnimate=()=>ready&&!lost&&visible&&!document.hidden&&!motionOff();
function stop(){
 if(raf)cancelAnimationFrame(raf);
 raf=0;
}
function frame(time){
 raf=0;
 if(!canAnimate())return;
 const interval=window.innerWidth<720?40:24;
 if(time-lastTick>=interval){
  elapsed+=Math.max(0,Math.min(.06,(time-lastTick)/1000||0));
  lastTick=time;
  currentPointerX+=(wantX-currentPointerX)*.075;
  currentPointerY+=(wantY-currentPointerY)*.075;
  draw();
 }
 raf=requestAnimationFrame(frame);
}
function sync(){
 if(canAnimate()){
  if(!raf){lastTick=0;raf=requestAnimationFrame(frame)}
 }else{
  stop();
  if(ready&&!lost)draw();
 }
}
function show(yes){
 visible=Boolean(yes);
 section.classList.toggle('ex-house-3d-in-view',visible);
 if(visible&&ready)section.classList.add('ex-house-3d-revealed');
 sync();
}
if(typeof IntersectionObserver==='function'){
 const observer=new IntersectionObserver(entries=>{
  for(const e of entries)if(e.target===stage)show(e.isIntersecting);
 },{threshold:.12,rootMargin:'80px 0px 80px 0px'});
 observer.observe(stage);
}else show(true);

stage.addEventListener('pointerdown',e=>{
 if(!ready||motionOff()||e.button>0)return;
 dragging=true;dragId=e.pointerId;lastPointerX=e.clientX;
 section.classList.add('ex-house-3d-dragging');
 if(e.pointerType==='mouse')stage.setPointerCapture?.(e.pointerId);
});
stage.addEventListener('pointermove',e=>{
 if(!ready||motionOff()||!visible)return;
 if(dragging&&e.pointerId===dragId){
  dragYaw+=Math.max(-.18,Math.min(.18,(e.clientX-lastPointerX)*.011));
  lastPointerX=e.clientX;
  sync();return;
 }
 if(e.pointerType==='touch')return;
 const rect=stage.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 wantX=Math.max(-1,Math.min(1,(e.clientX-rect.left)/rect.width*2-1));
 wantY=Math.max(-1,Math.min(1,(e.clientY-rect.top)/rect.height*2-1));
},{passive:true});
function pointerEnd(){
 dragging=false;dragId=null;section.classList.remove('ex-house-3d-dragging');
}
stage.addEventListener('pointerup',pointerEnd);
stage.addEventListener('pointercancel',pointerEnd);
stage.addEventListener('pointerleave',()=>{
 if(!dragging){wantX=0;wantY=0}
});
stage.addEventListener('keydown',e=>{
 if(!ready||motionOff())return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
  dragYaw+=(e.key==='ArrowLeft'?-1:1)*Math.PI/12;
  e.preventDefault();draw();sync();
 }else if(e.key==='Home'){
  dragYaw=0;e.preventDefault();draw();sync();
 }
});
canvas.addEventListener('webglcontextlost',e=>{
 e.preventDefault();lost=true;ready=false;stop();
 section.classList.remove('ex-house-3d-ready','ex-house-3d-revealed');
});
canvas.addEventListener('webglcontextrestored',()=>{
 lost=false;ready=false;model=null;buffers.length=0;
 canvas.style.display='block';
 init();sync();
});
window.addEventListener('resize',()=>{if(ready){resize();sync()}},{passive:true});
document.addEventListener('visibilitychange',sync);
document.getElementById('ex-motion-toggle')?.addEventListener('click',
 ()=>requestAnimationFrame(sync));
reduced?.addEventListener?.('change',sync);
if(typeof MutationObserver==='function'){
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
}
init();sync();
})();

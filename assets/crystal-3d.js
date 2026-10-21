/* FINCONTROL Crystal Engine v1.0
   Real, independently rotating 3-D fractured obsidian core.
   Pure WebGL 1 — no third-party libs, no finance data, no external requests.
   SVG/image rock remains a fallback whenever WebGL is not supported.
*/
(()=>{
 'use strict';
 const canvas=document.getElementById('ex-crystal-3d');
 const shell=document.getElementById('ex-morph-shell');
 if(!canvas||!shell)return;
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let gl,program,buffer,indices=0,lastTime=0,active=true,frameId=0,paused=false,
     width=0,height=0,scrollStage=0,renderTime=0,rendered=false,contextLost=false;
 const root=document.body;
 const fract=x=>x-Math.floor(x);
 let seed=41821;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const mix=(a,b,t)=>a+(b-a)*t;
 const len=v=>Math.hypot(...v);
 const norm=v=>{const d=len(v)||1;return v.map(x=>x/d)};
 const sub=(a,b)=>a.map((x,i)=>x-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const attribs=8;
 const vSource=`
 attribute vec3 aPosition;
 attribute vec3 aNormal;
 attribute float aTint;
 attribute float aChunk;
 uniform float uTime;
 uniform float uStage;
 uniform float uAspect;
 varying vec3 vNormal;
 varying vec3 vSurface;
 varying float vTint;
 varying float vChunk;
 varying float vView;
 mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,-s,0.,s,c);}
 mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,s,0.,1.,0.,-s,0.,c);}
 mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,-s,0.,s,c,0.,0.,0.,1.);}
 void main(){
  float drift=sin(uTime*.43+aChunk*3.97)*.028;
  vec3 p=aPosition+normalize(aPosition+vec3(.001))*drift;
  float rot=uTime*.21+uStage*.30;
  mat3 rotation=rz(sin(uTime*.19)*.12+uStage*.042)
               *rx(-.17+sin(uTime*.27)*.23)
               *ry(rot);
  p=rotation*p;
  vNormal=normalize(rotation*aNormal);
  vSurface=aPosition;
  vTint=aTint;
  vChunk=aChunk;
  vView=p.z;
  float perspective=2.45/(4.35-p.z);
  gl_Position=vec4(p.x*perspective/uAspect,p.y*perspective,-p.z*.19,1.);
 }
 `;
 const fSource=`
 precision highp float;
 uniform float uTime;
 varying vec3 vNormal;
 varying vec3 vSurface;
 varying float vTint;
 varying float vChunk;
 varying float vView;
 float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float noise(vec3 x){
  vec3 i=floor(x),f=fract(x);
  f=f*f*(3.-2.*f);
  float a=hash(i+vec3(0.,0.,0.)),b=hash(i+vec3(1.,0.,0.));
  float c=hash(i+vec3(0.,1.,0.)),d=hash(i+vec3(1.,1.,0.));
  float e=hash(i+vec3(0.,0.,1.)),g=hash(i+vec3(1.,0.,1.));
  float h=hash(i+vec3(0.,1.,1.)),j=hash(i+vec3(1.,1.,1.));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),
             mix(mix(e,g,f.x),mix(h,j,f.x),f.y),f.z);
 }
 float strata(vec3 p){
  float n=noise(p*8.)*.55+noise(p*17.)*.3+noise(p*41.)*.15;
  return n;
 }
 void main(){
  vec3 n=normalize(vNormal);
  vec3 key=normalize(vec3(-.65,.81,1.0));
  vec3 rimLight=normalize(vec3(.94,-.23,.54));
  vec3 viewDir=vec3(0.,0.,1.);
  float diff=max(dot(n,key),0.);
  float fill=max(dot(n,rimLight),0.);
  float rim=pow(1.-max(dot(n,viewDir),0.),2.9);
  float sparkle=pow(max(dot(reflect(-key,n),viewDir),0.),22.);
  float grain=strata(vSurface+vChunk*.31);
  float spec=pow(max(dot(reflect(-rimLight,n),viewDir),0.),9.);
  float plane=sin(vSurface.x*18.5+vSurface.y*11.1+noise(vSurface*6.)*8.4);
  float other=sin(vSurface.z*16.3-vSurface.y*17.2+noise(vSurface*4.)*6.3);
  float fissure=pow(1.-smoothstep(.0,.14,min(abs(plane),abs(other))),3.);
  fissure*=smoothstep(.25,.72,noise(vSurface*5.4+vChunk));
  float ignite=(.35+.65*pow(.5+.5*sin(uTime*1.22+vChunk*.97+grain*4.),2.0));
  float lava=fissure*ignite;
  vec3 metal=mix(vec3(.029,.034,.052),vec3(.27,.25,.30),grain*.72+vTint*.37);
  float shade=.15+diff*.85+fill*.26;
  vec3 color=metal*shade;
  color+=vec3(.23,.18,.22)*(spec*.34+sparkle*.35);
  color+=vec3(.31,.08,.13)*rim*.32;
  color+=vec3(.99,.035,.082)*lava*(1.1+grain*.45);
  color+=vec3(.21,.018,.045)*pow(noise(vSurface*4.1),2.)*.24;
  color*=.95+min(vView,1.0)*.05;
  gl_FragColor=vec4(color,1.0);
 }
 `;
 function compile(type,src){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,src);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
   const err=gl.getShaderInfoLog(shader);
   gl.deleteShader(shader);
   throw Error('Crystal shader: '+err);
  }
  return shader;
 }
 function makeProgram(){
  const vert=compile(gl.VERTEX_SHADER,vSource),frag=compile(gl.FRAGMENT_SHADER,fSource);
  const obj=gl.createProgram();
  gl.attachShader(obj,vert);gl.attachShader(obj,frag);
  gl.linkProgram(obj);
  gl.deleteShader(vert);gl.deleteShader(frag);
  if(!gl.getProgramParameter(obj,gl.LINK_STATUS)){
   const err=gl.getProgramInfoLog(obj);
   gl.deleteProgram(obj);
   throw Error('Crystal WebGL: '+err);
  }
  return obj;
 }
 // A faceted octahedron, subdivided into hundreds of independent tiny rock
 // faces. Face normals are flat so rotation exposes genuinely different facets.
 function sphereFaces(depth){
  const result=[];
  const pts=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const faces=[[2,4,0],[2,1,4],[2,5,1],[2,0,5],[3,0,4],[3,4,1],[3,1,5],[3,5,0]];
  function subdivide(a,b,c,d){
   if(!d){result.push([a,b,c]);return}
   const ab=norm(a.map((x,i)=>(x+b[i])*.5));
   const bc=norm(b.map((x,i)=>(x+c[i])*.5));
   const ca=norm(c.map((x,i)=>(x+a[i])*.5));
   subdivide(a,ab,ca,d-1);subdivide(ab,b,bc,d-1);
   subdivide(ca,bc,c,d-1);subdivide(ab,bc,ca,d-1);
  }
  for(const [a,b,c]of faces)subdivide(pts[a],pts[b],pts[c],depth);
  return result;
 }
 // A rotation for uniquely oriented chunks without allocating matrices per
 // vertex. The sixteen fragments wrap a transparent energy cavity.
 const spin=(p,rx,ry,rz)=>{
  const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),
        e=Math.cos(rz),f=Math.sin(rz);
  const x=p[0],y=p[1],z=p[2];
  const yy=y*a-z*b,zz=y*b+z*a;
  const xx=x*c+zz*d,zzz=-x*d+zz*c;
  return [xx*e-yy*f,xx*f+yy*e,zzz];
 };
 function createGeometry(){
  const cells=sphereFaces(3);
  const chunks=19,values=[],golden=Math.PI*(3-Math.sqrt(5));
  for(let k=0;k<chunks;k++){
   // Receding fragments have variable size and leave visible voids for the
   // inner crimson light — no flat photography rotates with the geometry.
   const y=1-2*(k+.5)/chunks,r=Math.sqrt(1-y*y),
         theta=k*golden,dir=norm([Math.cos(theta)*r,y,Math.sin(theta)*r]),
         center=dir.map(v=>v*(.40+rnd()*.17));
   const size=.42+rnd()*.26;
   const stretch=[size*(.63+rnd()*.4),size*(.64+rnd()*.42),size*(.43+rnd()*.36)];
   const angles=[rnd()*6.28,rnd()*6.28,rnd()*6.28];
   const shadeSeed=rnd()*8;
   // Tessellated rock: bumpy vertices and hard face normals.
   const rocky=p=>{
    const bump=1
      +.12*Math.sin(p[0]*11.4+shadeSeed*2)*Math.cos(p[2]*9.7)
      +.055*Math.sin(p[1]*24.1+p[2]*17.7+shadeSeed)
      +.035*Math.cos(p[0]*43.3+p[1]*37.1);
    const q=p.map((v,j)=>v*stretch[j]*bump);
    const spun=spin(q,...angles);
    return spun.map((v,j)=>v+center[j]);
   };
   for(const [a,b,c] of cells){
    let v0=rocky(a),v1=rocky(b),v2=rocky(c);
    let n=norm(cross(sub(v1,v0),sub(v2,v0)));
    // Prevent winding inconsistencies from misbehaving on old drivers.
    if(n.some(x=>!Number.isFinite(x)))n=[0,0,1];
    const tint=Math.min(1,.17+rnd()*.92);
    for(const p of [v0,v1,v2])
     values.push(p[0],p[1],p[2],n[0],n[1],n[2],tint,k*.11);
   }
  }
  return new Float32Array(values);
 }
 function init(){
  try{
   gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power'});
   if(!gl)return;
   program=makeProgram();
   gl.useProgram(program);
   const geometry=createGeometry();
   indices=geometry.length/attribs;
   buffer=gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,geometry,gl.STATIC_DRAW);
   const stride=attribs*4;
   for(const [name,count,start] of [['aPosition',3,0],['aNormal',3,3],['aTint',1,6],['aChunk',1,7]]){
    const p=gl.getAttribLocation(program,name);
    if(p<0)continue;
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p,count,gl.FLOAT,false,stride,start*4);
   }
   gl.enable(gl.DEPTH_TEST);
   gl.depthFunc(gl.LEQUAL);
   gl.disable(gl.CULL_FACE);
   gl.clearColor(0,0,0,0);
   resize();
   draw(0);
   if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL drawing error');
   rendered=true;
   root.classList.add('ex-webgl-ready');
   return true;
  }catch(err){
   root.classList.remove('ex-webgl-ready');
   canvas.style.display='none';
   console.warn('FINCONTROL crystal: using picture fallback',err);
   return false;
  }
 }
 function resize(){
  if(!gl)return;
  const rect=canvas.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.15:1.6);
  const w=Math.max(2,Math.round(rect.width*dpr));
  const h=Math.max(2,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){
   canvas.width=w;canvas.height=h;width=w;height=h;
   gl.viewport(0,0,w,h);
  }
 }
 function draw(ms){
  if(!gl||contextLost)return;
  resize();
  renderTime=ms;
  const clock=ms/1000;
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniform1f(gl.getUniformLocation(program,'uTime'),clock);
  gl.uniform1f(gl.getUniformLocation(program,'uStage'),scrollStage);
  gl.uniform1f(gl.getUniformLocation(program,'uAspect'),width/height);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.drawArrays(gl.TRIANGLES,0,indices);
 }
 function isMotionOn(){return !root.classList.contains('ex-motion-off')&&!reduce?.matches}
 function isRelevant(){
  // The stone keeps turning while present across all scenes, including long
  // pauses without scrolling; only stop when its phone transformation finishes.
  return scrollStage<6.85&&root.style.display!=='none';
 }
 function animate(now){
  frameId=0;
  if(!active||document.hidden||contextLost||!isMotionOn()||!isRelevant())return;
  // Reduce GPU cost when the stone is a small ambient detail, not a focal point.
  const throttle=scrollStage>1.7?(window.innerWidth<700?67:48):(window.innerWidth<700?33:16.6);
  if(now-lastTime>=throttle){draw(now);lastTime=now}
  frameId=requestAnimationFrame(animate);
 }
 function start(){
  if(frameId||!rendered||document.hidden||!isMotionOn()||!isRelevant())return;
  lastTime=0;frameId=requestAnimationFrame(animate);
 }
 function stop(){if(frameId)cancelAnimationFrame(frameId);frameId=0}
 const API={
  setStage(value){
   scrollStage=Number.isFinite(value)?Math.max(0,value):0;
   if(!isRelevant()){stop();return}
   if(!isMotionOn())draw(renderTime);
   else start();
  },
  setMotion(yes){paused=!yes;if(!yes){stop();draw(renderTime)}else start()},
  destroy(){active=false;stop();if(gl){gl.deleteBuffer(buffer);gl.deleteProgram(program)}root.classList.remove('ex-webgl-ready')}
 };
 window.FCCrystal3D=API;
 canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();contextLost=true;stop();root.classList.remove('ex-webgl-ready');
 });
 canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;init();start()});
 window.addEventListener('resize',()=>{if(gl){resize();if(!isMotionOn())draw(0)}} ,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start()});
 reduce?.addEventListener?.('change',()=>{if(!isMotionOn())stop();else start()});
 if(init())start();
})();

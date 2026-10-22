/* FINCONTROL House 3D — geometric architectural asset, 2026.
 * Real 3D vertices: rooms, panoramic glass, double roof, facade, plinth,
 * handrails, neon trim, garage, entry steps, and faceted trees.
 * No remote models, Blender runtime, financial data, or external libraries.
 */
(()=>{
 'use strict';
 const solid=[],glass=[],light=[];
 const MAT={stone:0,glass:1,red:2,warm:3,vegetation:4,metal:5};
 const C={
  graphite:[.105,.118,.147],slate:[.17,.18,.21],basalt:[.10,.105,.14],
  dark:[.035,.048,.067],stone:[.29,.29,.33],edge:[.41,.40,.44],
  glass:[.075,.14,.18],glassLight:[.14,.23,.28],wood:[.24,.15,.10],
  warm:[1,.54,.26],warmDim:[.72,.30,.14],red:[1,.065,.16],
  redDim:[.44,.035,.09],leaf:[.13,.18,.13],burgundy:[.33,.07,.12]
 };
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const normal=a=>{let n=Math.hypot(...a)||1;return a.map(v=>v/n)};
 function quad(out,a,b,c,d,color,mat=MAT.stone,n){
  const v=n||normal(cross(sub(b,a),sub(c,a)));
  for(const p of [a,b,c,a,c,d])out.push(...p,...v,...color,mat);
 }
 function box(x,y,z,w,h,d,color,mat=MAT.stone,out=solid){
  const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,k=z-d/2,f=z+d/2;
  quad(out,[l,t,f],[r,t,f],[r,b,f],[l,b,f],color,mat,[0,0,1]);
  quad(out,[r,t,k],[l,t,k],[l,b,k],[r,b,k],color,mat,[0,0,-1]);
  quad(out,[l,t,k],[l,t,f],[l,b,f],[l,b,k],color,mat,[-1,0,0]);
  quad(out,[r,t,f],[r,t,k],[r,b,k],[r,b,f],color,mat,[1,0,0]);
  quad(out,[l,t,k],[r,t,k],[r,t,f],[l,t,f],color,mat,[0,1,0]);
  quad(out,[l,b,f],[r,b,f],[r,b,k],[l,b,k],color,mat,[0,-1,0]);
 }
 function pane(x,y,z,w,h,shade=C.glass){
  quad(glass,[x-w/2,y+h/2,z],[x+w/2,y+h/2,z],
       [x+w/2,y-h/2,z],[x-w/2,y-h/2,z],shade,MAT.glass,[0,0,1]);
 }
 function sidePane(x,y,z,depth,h){
  quad(glass,[x,y+h/2,z-depth/2],[x,y+h/2,z+depth/2],
       [x,y-h/2,z+depth/2],[x,y-h/2,z-depth/2],
       C.glassLight,MAT.glass,[1,0,0]);
 }
 const ledX=(x,y,z,w,shade=C.red)=>box(x,y,z,w,.028,.033,shade,MAT.red,light);
 const ledY=(x,y,z,h,shade=C.red)=>box(x,y,z,.027,h,.033,shade,MAT.red,light);
 const ledZ=(x,y,z,depth,shade=C.red)=>box(x,y,z,.029,.028,depth,shade,MAT.red,light);
 function octa(x,y,z,rx,ry,rz,color){
  const t=[x,y+ry,z],b=[x,y-ry,z],
        a=[x+rx,y,z],c=[x-rx,y,z],front=[x,y,z+rz],back=[x,y,z-rz];
  for(const [p,q,s] of [[t,a,front],[t,front,c],[t,c,back],[t,back,a],
                        [b,front,a],[b,c,front],[b,back,c],[b,a,back]]){
   const n=normal(cross(sub(q,p),sub(s,p)));
   for(const vertex of [p,q,s])solid.push(...vertex,...n,...color,MAT.vegetation);
  }
 }
 function tree(x,z,scale){
  box(x,-.99*scale,z,.075*scale,.83*scale,.075*scale,C.wood,MAT.metal);
  octa(x,-.40*scale,z,.36*scale,.49*scale,.33*scale,C.leaf);
  octa(x-.18*scale,-.47*scale,z+.1*scale,.22*scale,.27*scale,.22*scale,C.burgundy);
 }
 function build(){
  // Suspended dark volcanic platform, beveled edge and illuminated base.
  box(0,-1.69,0,7.74,.30,4.25,C.basalt);
  box(0,-1.49,0,7.52,.12,4.05,C.edge,MAT.metal);
  box(0,-1.39,0,7.44,.08,4,C.dark);
  ledX(0,-1.54,2.14,7.67);ledX(0,-1.64,-2.13,7.6,C.redDim);
  ledZ(3.85,-1.54,0,4.20,C.redDim);ledZ(-3.85,-1.54,0,4.20,C.redDim);

  // Two cantilevered architectural volumes and taller entry tower.
  box(-.78,-.54,-.3,5.23,1.71,2.60,C.graphite);
  box(-.9,-.54,-1.59,5.47,1.68,.13,C.slate);
  box(-3.43,-.51,-.36,.13,1.66,2.46,C.stone);
  box(-.92,.37,-.01,5.87,.19,3.25,C.stone,MAT.metal);
  box(-.96,1.11,-.36,5.25,1.39,2.41,C.graphite);
  box(-.96,1.86,-.15,6.19,.24,3.20,C.graphite,MAT.metal);
  box(-.97,1.75,-.08,6.08,.08,3.08,C.dark);
  ledX(-.96,1.82,1.47,6.04);ledZ(-4.04,1.82,-.15,3.04,C.redDim);
  ledX(-.93,.34,1.62,5.80,C.redDim);
  box(2.47,.13,-.33,1.68,3.63,2.82,C.slate);
  box(2.49,2.02,-.34,1.81,.19,2.98,C.graphite,MAT.metal);
  ledY(3.33,.12,1.10,3.46);ledZ(3.34,2.04,-.33,2.84,C.redDim);
  ledX(2.49,2.02,1.18,1.73,C.redDim);

  // Interior light sources behind real transparent glazed front panels.
  box(-.43,-.56,.98,2.86,1.40,.09,C.warmDim,MAT.warm);
  pane(-.44,-.55,1.115,2.84,1.35);
  for(const x of [-1.88,-.95,-.02,.91])
   box(x,-.54,1.16,.052,1.45,.076,C.edge,MAT.metal);
  box(-.44,.17,1.16,2.86,.052,.078,C.edge,MAT.metal);
  box(-.44,-1.25,1.16,2.86,.055,.079,C.edge,MAT.metal);
  box(-.44,-.63,.70,2.2,.04,.51,C.wood,MAT.metal);
  box(-.25,.10,.75,2.48,.03,.08,C.warm,MAT.warm,light);
  box(-.75,-.88,.67,.49,.07,.35,C.dark);
  box(.31,-.88,.67,.49,.07,.35,C.dark);
  // Upstairs double glazing, rails and a warm interior.
  box(-1.15,1.09,1.01,3.5,1.11,.08,C.warmDim,MAT.warm);
  pane(-1.19,1.1,1.13,3.45,1.09,C.glassLight);
  for(const x of [-2.90,-1.91,-.92,.08,.50])
   box(x,1.12,1.16,.05,1.17,.07,C.edge,MAT.metal);
  box(-1.20,1.71,1.16,3.54,.07,.07,C.edge,MAT.metal);
  box(-1.20,.57,1.16,3.54,.065,.07,C.edge,MAT.metal);
  ledX(-1.22,1.55,1.06,2.56,C.warm);
  pane(-1.18,.71,1.71,4.18,.58);
  box(-1.18,1.01,1.75,4.2,.034,.045,C.edge,MAT.metal);
  box(-1.18,.42,1.75,4.2,.030,.042,C.edge,MAT.metal);
  for(const x of [-3.27,-1.76,-.26,.89])
   box(x,.72,1.76,.040,.61,.045,C.edge,MAT.metal);
  sidePane(-3.22,.71,.86,1.64,.57);
  // Real garage shutter, recessed entry, vertical wood fins and stairs.
  box(-2.72,-.70,1.18,1.08,1.02,.08,C.dark,MAT.metal);
  for(let y=-1.14;y<-.24;y+=.15)
   box(-2.72,y,1.23,1.06,.013,.03,C.slate,MAT.metal);
  ledX(-2.72,-.19,1.27,1.13);
  box(1.72,-.54,1.20,.71,1.48,.11,C.dark);
  box(1.73,-.54,1.28,.46,1.26,.035,C.wood,MAT.metal);
  ledY(1.40,-.48,1.29,1.43,C.warm);
  for(let j=0;j<10;j++)
   box(1.99+j*.114,.12,1.11,.033,3.22,.088,j%3===0?C.wood:C.dark,MAT.metal);
  for(let j=0;j<3;j++){
   box(1.83,-1.41-j*.052,1.75+j*.17,1.54+j*.22,.09,.25,C.stone,MAT.metal);
   ledX(1.83,-1.35-j*.052,1.87+j*.17,1.49+j*.22,C.redDim);
  }
  for(const x of [-3.3,-2.0,-.7,.5,1.5])
   box(x,.27,1.43,.077,.032,.07,C.warm,MAT.warm,light);
  // Stylized geometric foliage remains readable as the model turns.
  for(const x of [-3.35,3.20]){
   box(x,-1.27,1.72,.65,.18,.56,C.basalt);
   box(x,-1.16,1.72,.60,.06,.51,C.dark);
  }
  tree(-3.43,1.56,.79);tree(3.19,1.61,.80);
  for(const x of [-2.0,-1.58,2.92]){
   box(x,-1.25,1.72,.36,.12,.32,C.basalt);
   octa(x,-1.07,1.72,.21,.26,.21,C.leaf);
  }
  ledX(0,-1.35,1.93,7.03,C.redDim);
  return{solid:new Float32Array(solid),glass:new Float32Array(glass),lights:new Float32Array(light)};
 }
 window.FCHouseGeometry={build,MAT};
})();

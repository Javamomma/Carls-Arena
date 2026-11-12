// The opt-in 3D fighters. tools/build.py writes this to its own file so the default page never downloads it.
// World units are stage pixels: x is stage x, y is height above FLOOR, z points at the viewer.
(()=>{'use strict';
const T=THREE,TAU=Math.PI*2;
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const gauss=(x,c,s)=>{const d=(x-c)/s;return Math.exp(-d*d)};
const angDiff=(a,b)=>{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d};
// Layered sines, so hair and torn hems are irregular but come out the same on every build.
const wob=x=>Math.sin(x*3.1)*.5+Math.sin(x*7.3+1.7)*.3+Math.sin(x*13.7+.6)*.2;

// Colours live in three's linear working space, so tone mapping and sRGB output treat them correctly.
const _rgb={};
function rgb(hex){if(!_rgb[hex]){const c=new T.Color(hex);_rgb[hex]=[c.r,c.g,c.b]}return _rgb[hex]}
const mixc=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const mulc=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const tone=(hex,k)=>rgb(shade(hex,k));

// Rig joint to Mixamo bone. The rig's r side leads toward the opponent, which is a left-lead stance on a model that
// faces the camera, so r maps to Left. Rig angles all turn about the screen axis (z) from a limb hanging straight
// down, shoulders and hips absolute, elbows and knees relative to their parent. To drive a Mixamo model, pose its
// T-pose arms down to that hanging rest once, then each frame set a bone's world rotation to Rz(angle) times its
// rest, with the signs posePlanar uses below, converting to local through the parent.
const MIXAMO={hips:'mixamorig:Hips',spine:'mixamorig:Spine',neck:'mixamorig:Neck',head:'mixamorig:Head',
  rArm:'mixamorig:LeftArm',rFore:'mixamorig:LeftForeArm',rHand:'mixamorig:LeftHand',
  lArm:'mixamorig:RightArm',lFore:'mixamorig:RightForeArm',lHand:'mixamorig:RightHand',
  rThigh:'mixamorig:LeftUpLeg',rShin:'mixamorig:LeftLeg',rFoot:'mixamorig:LeftFoot',
  lThigh:'mixamorig:RightUpLeg',lShin:'mixamorig:RightLeg',lFoot:'mixamorig:RightFoot'};

const BONES=['hips','pelvis','spine','neck','head','eyes','brows','mouth',
  'rArm','rFore','rHand','rProp','lArm','lFore','lHand','rThigh','rShin','rFoot','lThigh','lShin','lFoot'];
const BI={};BONES.forEach((n,i)=>BI[n]=i);
const one=n=>[[BI[n],1]];
const blend=(a,b,t)=>t<=0?one(a):t>=1?one(b):[[BI[a],1-t],[BI[b],t]];

// Smooth interpolation through a sparse table, so a limb reads as one shape rather than a stack of cones.
function curve(prof,t,col){
  let i=0;while(i<prof.length-2&&prof[i+1][0]<=t)i++;
  const a=prof[Math.max(0,i-1)],b=prof[i],c=prof[i+1],d=prof[Math.min(prof.length-1,i+2)];
  const h=c[0]-b[0]||1,l=clamp((t-b[0])/h,0,1);
  const m1=(c[col]-a[col])/((c[0]-a[0])||1)*h,m2=(d[col]-b[col])/((d[0]-b[0])||1)*h,l2=l*l,l3=l2*l;
  return(2*l3-3*l2+1)*b[col]+(l3-2*l2+l)*m1+(-2*l3+3*l2)*c[col]+(l3-l2)*m2}

// Collects every part of a figure into one vertex-coloured skinned mesh, so a fighter costs one draw call.
const makeBuilder=()=>({p:[],n:[],c:[],si:[],sw:[],ix:[],
  // fn(u,v,o) fills o.x, o.y, o.z, o.c and o.w for u and v in 0..1; normals are smooth over the grid and face outward.
  grid(nu,nv,closed,fn){
    const base=this.p.length/3,cols=closed?nu:nu+1,count=cols*(nv+1),o={x:0,y:0,z:0,c:null,w:null};
    const P=new Float32Array(count*3);
    let k=0,cx=0,cy=0,cz=0;
    for(let j=0;j<=nv;j++)for(let i=0;i<cols;i++){
      fn(i/nu,j/nv,o);
      P[k*3]=o.x;P[k*3+1]=o.y;P[k*3+2]=o.z;cx+=o.x;cy+=o.y;cz+=o.z;k++;
      this.p.push(o.x,o.y,o.z);this.c.push(o.c[0],o.c[1],o.c[2]);
      for(let w=0;w<4;w++){const e=o.w[w];this.si.push(e?e[0]:0);this.sw.push(e?e[1]:0)}}
    cx/=count;cy/=count;cz/=count;
    const tris=[],N=new Float32Array(count*3);
    let out=0;
    const face=(a,b,c)=>{
      const ax=P[a*3],ay=P[a*3+1],az=P[a*3+2];
      const ux=P[b*3]-ax,uy=P[b*3+1]-ay,uz=P[b*3+2]-az,vx=P[c*3]-ax,vy=P[c*3+1]-ay,vz=P[c*3+2]-az;
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      if(nx===0&&ny===0&&nz===0)return;
      tris.push(a,b,c);
      for(const q of[a,b,c]){N[q*3]+=nx;N[q*3+1]+=ny;N[q*3+2]+=nz}
      out+=nx*(ax-cx)+ny*(ay-cy)+nz*(az-cz)};
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
      const i2=closed?(i+1)%cols:i+1,a=j*cols+i,b=j*cols+i2,c=(j+1)*cols+i,d=(j+1)*cols+i2;
      face(a,b,d);face(a,d,c)}
    const s=out<0?-1:1;
    for(let i=0;i<tris.length;i+=3){
      const a=tris[i]+base,b=tris[i+1]+base,c=tris[i+2]+base;
      if(s>0)this.ix.push(a,b,c);else this.ix.push(a,c,b)}
    for(let i=0;i<count;i++){
      const nx=N[i*3],ny=N[i*3+1],nz=N[i*3+2],l=Math.hypot(nx,ny,nz)||1;
      this.n.push(s*nx/l,s*ny/l,s*nz/l)}},
  // A loft along -y from (cx,y0,cz) to (cx,y1,cz) with rounded ends. prof is [[t,r,rz],...]; only the taper is
  // authored, the radii come from the look's proportions.
  tube(o){
    const prof=o.prof,nu=o.nu||12,nv=o.nv||24,capA=o.capA===undefined?1:o.capA,capB=o.capB===undefined?1:o.capB,caps=3;
    const rows=nv+caps*2,yaw=o.yaw||0,cy=Math.cos(yaw),sy=Math.sin(yaw);
    this.grid(nu,rows,true,(u,v,q)=>{
      const row=Math.round(v*rows);
      let t,m=1,dy=0;
      if(row<caps){t=0;const a=(row/caps)*Math.PI/2;m=Math.sin(a)||.001;dy=Math.cos(a)*capA}
      else if(row>caps+nv){t=1;const a=((rows-row)/caps)*Math.PI/2;m=Math.sin(a)||.001;dy=-Math.cos(a)*capB}
      else t=(row-caps)/nv;
      const th=u*TAU,r=curve(prof,t,1),rz=prof[0][2]===undefined?r:curve(prof,t,2),d=o.bump?o.bump(t,th):0;
      const lx=Math.cos(th)*r*(1+d)*m,lz=Math.sin(th)*rz*(1+d)*m;
      q.x=o.cx+(o.dx?o.dx(t):0)+lx*cy+lz*sy;
      q.z=o.cz+(o.dz?o.dz(t):0)-lx*sy+lz*cy;
      q.y=lerp(o.y0,o.y1,t)+dy*r;
      q.c=o.color(t,th,d);q.w=o.weight(t,th)})},
  // An ellipsoid: joints, hands, eyes, noses. tilt turns it about z, then spin about y.
  blob(o){
    const nu=o.nu||8,nv=o.nv||6,tilt=o.tilt||0,spin=o.spin||0;
    const ct=Math.cos(tilt),st=Math.sin(tilt),cs=Math.cos(spin),ss=Math.sin(spin);
    this.grid(nu,nv,true,(u,v,q)=>{
      const th=u*TAU,ph=v*Math.PI,d=o.bump?o.bump(th,ph):0;
      const x=Math.sin(ph)*Math.cos(th)*o.rx*(1+d),y=Math.cos(ph)*o.ry*(1+d),z=Math.sin(ph)*Math.sin(th)*o.rz*(1+d);
      const x1=x*ct-y*st,y1=x*st+y*ct,x2=x1*cs+z*ss,z2=-x1*ss+z*cs;
      q.x=o.x+x2;q.y=o.y+y1;q.z=o.z+z2;
      q.c=typeof o.c==='function'?o.c(th,ph,d):o.c;q.w=o.w})},
  // A tapering curved tube through control points: horns, pointed ears, tusks, weapons.
  sweep(pts,rad,nu,nv,c,w){
    const at=t=>{const f=t*(pts.length-1),i=Math.min(pts.length-2,Math.floor(f)),l=f-i,
        a=pts[Math.max(0,i-1)],b=pts[i],d=pts[i+1],e=pts[Math.min(pts.length-1,i+2)];
      const cr=k=>{const m1=(d[k]-a[k])/2,m2=(e[k]-b[k])/2,l2=l*l,l3=l2*l;
        return(2*l3-3*l2+1)*b[k]+(l3-2*l2+l)*m1+(-2*l3+3*l2)*d[k]+(l3-l2)*m2};
      return[cr(0),cr(1),cr(2)]};
    this.grid(nu,nv,true,(u,v,q)=>{
      const p=at(v),p2=at(Math.min(1,v+.02)),p0=at(Math.max(0,v-.02));
      let tx=p2[0]-p0[0],ty=p2[1]-p0[1],tz=p2[2]-p0[2];const tl=Math.hypot(tx,ty,tz)||1;tx/=tl;ty/=tl;tz/=tl;
      // Any axis that isn't parallel to the tangent gives a stable ring around it.
      const ax=Math.abs(ty)<.9?0:1,ay=Math.abs(ty)<.9?1:0;
      let bx=ay*tz,by=-ax*tz,bz=ax*ty-ay*tx;const bl=Math.hypot(bx,by,bz)||1;bx/=bl;by/=bl;bz/=bl;
      const cx=ty*bz-tz*by,cy=tz*bx-tx*bz,cz=tx*by-ty*bx,r=typeof rad==='function'?rad(v):rad,th=u*TAU;
      q.x=p[0]+(bx*Math.cos(th)+cx*Math.sin(th))*r;
      q.y=p[1]+(by*Math.cos(th)+cy*Math.sin(th))*r;
      q.z=p[2]+(bz*Math.cos(th)+cz*Math.sin(th))*r;
      q.c=typeof c==='function'?c(v,th):c;q.w=typeof w==='function'?w(v):w})},
  // A small flat print lying on a surface; outline(k) gives its edge in tangent coordinates.
  decal(at,nrm,up,size,c,w,outline,n){
    const sideX=nrm[1]*up[2]-nrm[2]*up[1],sideY=nrm[2]*up[0]-nrm[0]*up[2],sideZ=nrm[0]*up[1]-nrm[1]*up[0];
    this.grid(n,1,true,(u,v,q)=>{
      const o=outline(u*TAU),s=v*size;
      q.x=at[0]+sideX*o[0]*s+up[0]*o[1]*s;q.y=at[1]+sideY*o[0]*s+up[1]*o[1]*s;q.z=at[2]+sideZ*o[0]*s+up[2]*o[1]*s;
      q.c=c;q.w=w})},
  finish(){
    // Warm light on already warm paint goes to clay, so the palette is eased toward grey before the lights multiply it.
    for(let i=0;i<this.c.length;i+=3){const l=(this.c[i]+this.c[i+1]+this.c[i+2])/3;for(let k=0;k<3;k++)this.c[i+k]=lerp(this.c[i+k],l,.2)}
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(new Float32Array(this.p),3));
    g.setAttribute('normal',new T.BufferAttribute(new Float32Array(this.n),3));
    g.setAttribute('color',new T.BufferAttribute(new Float32Array(this.c),3));
    g.setAttribute('skinIndex',new T.BufferAttribute(new Uint16Array(this.si),4));
    g.setAttribute('skinWeight',new T.BufferAttribute(new Float32Array(this.sw),4));
    g.setIndex(new T.BufferAttribute(new Uint16Array(this.ix),1));
    return g}});
const heart=k=>{const s=Math.sin(k);return[s*s*s,(13*Math.cos(k)-5*Math.cos(2*k)-2*Math.cos(3*k)-Math.cos(4*k))/16]};

// Everything a look's 2D numbers imply in 3D. The rig only gives each shoulder's x, so the true shoulder width sets
// how far the chest is turned from the viewer, and the far shoulder and hip get the depth that turn implies.
function proportions(look){
  const big=look.rig==='big',limb=look.limb,muscle=big?1.25:clamp((look.shoulderW/look.torsoLen-.35)/.56,.25,1),bulk=big?1.72:lerp(1.02,1.34,muscle);
  const L=Math.max(look.shoulderW/Math.cos(D(16)),look.torsoLen*.6),yaw=-Math.acos(clamp(look.shoulderW/L,0,1)),hipYaw=yaw*.72;
  const hipTrue=look.hipW/Math.cos(hipYaw),waistTrue=BodyStyle.waistW(look)/Math.cos((yaw+hipYaw)/2);
  const armW=limb*(big?1.06:.88)*bulk,foreW=limb*(big?.86:.70)*bulk,thighW=limb*(big?1.34:1.08)*bulk,shinW=limb*(big?1.04:.86)*bulk;
  return{big,limb,L,yaw,hipYaw,hipTrue,waistTrue,armW,foreW,thighW,shinW,
    zShoulder:L/2*Math.sin(yaw),zHip:hipTrue/2*Math.sin(hipYaw),
    hipY:look.legLen,neckY:look.legLen+look.torsoLen,headY:look.legLen+look.torsoLen+look.headR*1.6,
    muscle,headYaw:D(50)}}

const _geo={};
function geometryFor(look){return _geo[look.id]||(_geo[look.id]=buildGeometry(look))}

function buildGeometry(look){
  const B=makeBuilder(),s=proportions(look),body=look.body,cl=body.cloth,limb=s.limb,tl=look.torsoLen,r=look.headR;
  const skin=rgb(look.skin),skinLo=tone(look.skin,body.skinShade[0]),skinHi=tone(look.skin,body.skinShade[1]);
  // The 2D cloth colours are painted with their own highlights; lit in 3D they'd go black, so dark ones start lighter.
  const lift=hex=>{const c=rgb(hex),l=(c[0]+c[1]+c[2])/3;return l<.1?mulc(c,1+(.1-l)*26):c};
  const prim=lift(cl.primary),primLo=mulc(prim,.55),primHi=mulc(prim,1.3);
  const sec=lift(cl.secondary),secLo=mulc(sec,.6);
  const dark=rgb(body.outline),boneWhite=skin,boneLo=skinLo;
  const props=look.props||[],hasProp=p=>props.includes(p);
  const isBone=cl.torso==='bone',isRobe=cl.torso==='robe',isShirt=cl.torso==='shirt',isVest=cl.torso==='vest';
  const FRONT=Math.PI/2;

  // ---- torso: chest-local a is across the shoulders, b is front to back, then the whole section turns by yaw ----
  const hA=s.hipTrue/2+limb*.1,cA=s.L/2-s.armW*.1,wA=Math.max(s.waistTrue/2,cA*(.52+.2*Math.min(1,s.muscle))),drop=limb*.95/tl;
  const torsoProf=[[-drop,hA*.42,hA*.34],[-drop*.55,hA*.9,hA*.6],[0,hA*1.03,hA*.72],[.2,lerp(hA,wA,.65),lerp(hA,wA,.6)*.68],
    [.4,wA,wA*.62],[.58,lerp(wA,cA,.48),lerp(wA,cA,.48)*.66],[.78,cA*.97,cA*.58],[.92,cA*.9,cA*.45],[1,cA*.6,cA*.32],[1.12,r*.52,r*.44]];
  const sMin=-drop,sMax=1.12;
  const yawAt=x=>lerp(s.hipYaw,s.yaw,sstep(.05,.7,x));
  const sculpt=(th,x)=>{
    const m=(isVest||cl.torso==='bare')?s.muscle:isShirt||isRobe?.18:0,f=angDiff(th,FRONT),side=Math.abs(f);
    let d=0;
    d+=m*.11*(gauss(f,-.52,.44)+gauss(f,.52,.44))*gauss(x,.76,.1);       // pectorals
    d-=m*.05*gauss(f,0,.07)*sstep(.3,.5,x)*(1-sstep(.86,.94,x));         // the line down the sternum and abs
    d-=m*.05*(gauss(f,-.52,.5)+gauss(f,.52,.5))*gauss(x,.63,.022);       // under the pectorals
    for(const k of[.36,.45,.54])d-=m*.022*gauss(f,0,.42)*gauss(x,k,.014); // abdominal bands
    d+=m*.07*(gauss(side,1.45,.5))*gauss(x,.68,.14);                     // lats
    d-=.03*gauss(side,Math.PI,.14)*sstep(.2,.4,x);                       // spine groove
    if(cl.legs==='shorts'||cl.legs==='pants'||cl.legs==='robe')d+=.04*gauss(x,0,.14);
    return d};
  const torsoPoint=(th,x,extra,d)=>{
    const ax=curve(torsoProf,x,1)+(extra||0),bx=curve(torsoProf,x,2)+(extra||0),g=yawAt(x);
    const push=bx*(.1*gauss(x,.78,.22)-.07*gauss(x,0,.2)),k=1+(d||0);
    const a=ax*Math.cos(th)*k,b=bx*Math.sin(th)*k+push;
    return[a*Math.cos(g)+b*Math.sin(g),s.hipY+x*tl,-a*Math.sin(g)+b*Math.cos(g)]};
  const torsoNormal=(th,x)=>{const g=yawAt(x),a=Math.cos(th),b=Math.sin(th);return[a*Math.cos(g)+b*Math.sin(g),0,-a*Math.sin(g)+b*Math.cos(g)]};
  const torsoWeight=x=>x<.1?one('pelvis'):x>.5?one('spine'):blend('pelvis','spine',sstep(.1,.5,x));
  const bandTop=limb*.5/tl,bandLow=bandTop-limb*.32/tl;
  const hipCloth=cl.legs==='shorts'?sec:cl.legs==='pants'||cl.legs==='robe'?prim:null;
  const beltY=.33,beltH=limb*.3/tl;

  if(!isBone){
    B.grid(36,38,true,(u,v,q)=>{
      const th=u*TAU,x=lerp(sMin,sMax,v),d=sculpt(th,x),f=angDiff(th,FRONT),p=torsoPoint(th,x,0,d);
      q.x=p[0];q.y=p[1];q.z=p[2];q.w=torsoWeight(x);
      let c;
      if(isRobe){c=mixc(primLo,prim,clamp(1+Math.sin(th*9+x*3)*.55,0,1));
        if(Math.abs(x-.3)<limb*.3/tl)c=sec;
        if(x>.88&&Math.abs(f)<(x-.88)*5)c=mulc(skin,.6)}
      else if(isShirt){c=mixc(primLo,prim,clamp(.65+Math.min(0,d)*6+Math.max(0,Math.cos(f))*.35,0,1));
        if(Math.abs(x-beltY)<beltH)c=Math.abs(f)<.2?mulc(sec,1.5):sec;
        c=mixc(c,skin,sstep(-.05,.05,(x-.84)*3.6-Math.abs(f)))}
      else{const ao=clamp(1+Math.min(0,d)*15,0,1);
        c=mixc(skinLo,skin,ao*(.82+.18*sstep(.2,.7,x)));
        if(d>0)c=mixc(c,skinHi,Math.min(.55,d*6))}
      if(hipCloth&&x<bandTop){c=x>bandLow?mulc(hipCloth,.38):mixc(mulc(hipCloth,.72),hipCloth,clamp(.5+Math.cos(f)*.5,0,1));
        if(hasProp('rags')&&cl.legs==='pants')c=mulc(c,.9)}
      q.c=c})}

  // ---- a torn open vest, the 2D rig's panels as a real shell over the chest ----
  if(isVest){
    const open=x=>lerp(.86,.66,sstep(.4,.85,x))-.2*sstep(.85,.97,x);
    B.grid(30,12,false,(u,v,q)=>{
      const hem=.27+.05*wob(u*9)+.03*Math.sin(u*40),x=lerp(hem,.975,v),op=open(x)+.035*wob(x*12);
      const th=FRONT+op+u*(TAU-op*2),p=torsoPoint(th,x,limb*.1+.9,sculpt(th,x)*.6);
      q.x=p[0];q.y=p[1];q.z=p[2];q.w=one('spine');
      const edge=Math.min(u,1-u)*(TAU-op*2),fold=.5+.5*Math.sin(u*17+x*7);
      q.c=edge<.1||v<.05?primHi:mixc(mulc(prim,.8),prim,fold)})
    // A ragged collar riding the shoulder line, which is what makes it read as a vest and not a painted patch.
    B.grid(26,5,false,(u,v,q)=>{
      const th=FRONT+.72+u*(TAU-1.44),x=lerp(.88,1.02,v),tuft=.5+.5*Math.sin(u*62),p=torsoPoint(th,x,limb*.22+tuft*limb*.17*Math.sin(v*Math.PI));
      q.x=p[0];q.y=p[1];q.z=p[2];q.w=one('spine');q.c=mixc(primLo,mulc(prim,1.25),tuft)})}

  // ---- skeleton: ribs, a spine and a pelvis with the stage showing through ----
  if(isBone){
    const rw=limb*.17,boneC=(v,th)=>mixc(boneLo,boneWhite,.6+.4*Math.sin(th));
    for(let k=0;k<6;k++){
      const x=.5+k*.085,gap=.42,pts=[];
      for(let i=0;i<=10;i++){const th=FRONT+gap+(i/10)*(TAU-gap*2),p=torsoPoint(th,x-.02*Math.sin(i/10*Math.PI),-limb*.15);pts.push(p)}
      B.sweep(pts,rw,6,20,boneC,one('spine'))}
    B.sweep([torsoPoint(FRONT,.48,-limb*.25),torsoPoint(FRONT,.72,-limb*.2),torsoPoint(FRONT,.94,-limb*.25)],rw*1.2,6,10,boneC,one('spine'));
    B.sweep([[0,s.hipY-limb*.1,0],[0,s.hipY+tl*.35,-limb*.12],[0,s.hipY+tl*.7,-limb*.2],[0,s.neckY+r*.25,0]],t=>rw*(1.5+.6*Math.sin(t*44)),8,40,boneC,
      t=>t<.3?one('pelvis'):t<.92?one('spine'):one('neck'));
    B.blob({x:0,y:s.hipY-limb*.18,z:0,rx:hA*.82,ry:limb*.62,rz:hA*.5,spin:s.hipYaw,nu:14,nv:10,
      c:(th,ph)=>mixc(boneLo,boneWhite,.45+.55*Math.abs(Math.cos(ph))),w:one('pelvis')})
    B.sweep([torsoPoint(.1,.95,-limb*.1),torsoPoint(FRONT,1,-limb*.3),torsoPoint(Math.PI-.1,.95,-limb*.1)],rw*1.2,6,14,boneC,one('spine'))}

  // ---- hip garments that aren't part of the trunk surface ----
  if(cl.legs==='shorts'&&hasProp('boxers')){
    const pink=rgb('#ff9fd0');
    for(const[th,x]of[[FRONT-.72,-.03],[FRONT+.72,-.03],[FRONT,.02],[FRONT-.3,-.1],[FRONT+.34,-.09],[FRONT-1.2,.02],[FRONT+1.2,.02]]){
      const n=torsoNormal(th,x),p=torsoPoint(th,x,.7,sculpt(th,x));
      B.decal(p,n,[0,1,0],limb*.21,pink,one('pelvis'),heart,14)}}
  if(cl.legs==='shorts'&&hasProp('rags')){
    // The goblin's loincloth: a rope belt and two torn flaps hanging off it.
    B.grid(26,3,true,(u,v,q)=>{
      const th=u*TAU,x=bandTop+(v-.5)*limb*.32/tl,p=torsoPoint(th,x,limb*.08+Math.sin(v*Math.PI)*limb*.1);
      q.x=p[0];q.y=p[1];q.z=p[2];q.w=one('pelvis');q.c=mulc(sec,.55+.3*Math.sin(u*90))});
    for(const[sign,w0]of[[1,1],[-1,.86]]){
      const n=torsoNormal(sign>0?FRONT:FRONT+Math.PI,0),depth=hA*.72;
      B.tube({cx:n[0]*depth,cz:n[2]*depth,y0:s.hipY+limb*.38,y1:s.hipY-limb*2.75,yaw:s.hipYaw,nu:14,nv:12,capA:.2,capB:.2,
        prof:[[0,hA*.62*w0,limb*.09],[.5,hA*.56*w0,limb*.11],[1,hA*.7*w0,limb*.07]],
        bump:(t,th)=>t*.2*wob(th*2.2+sign),
        color:(t,th)=>mixc(prim,mulc(sec,.85),.5+.5*Math.sin(th*6+t*8)),
        weight:t=>t<.45?one('pelvis'):[[BI.pelvis,.6],[BI.rThigh,.2],[BI.lThigh,.2]]})}}
  if(isRobe){
    // The skirt takes a share of both thighs so a kick lifts its hem instead of punching through it.
    B.tube({cx:0,cz:0,y0:s.hipY+limb*.3,y1:s.hipY-look.legLen*.62,yaw:s.hipYaw,nu:26,nv:12,capA:.1,capB:.1,
      prof:[[0,hA*1.04,hA*.76],[.4,hA*1.32,hA*.98],[1,hA*1.72,hA*1.34]],
      bump:(t,th)=>t*.08*Math.sin(th*7),
      color:(t,th)=>{const c=mixc(primLo,prim,.5+.5*Math.sin(th*7));return t>.93?sec:c},
      weight:t=>{const k=sstep(.1,1,t)*.34;return[[BI.pelvis,1-k*2],[BI.rThigh,k],[BI.lThigh,k]]}});}

  // ---- neck ----
  const neckR=r*(s.big?.68:lerp(.38,.58,s.muscle));
  if(!isBone)B.tube({cx:0,cz:0,y0:s.headY-r*.45,y1:s.neckY-tl*.06,nu:14,nv:8,capA:.4,capB:.2,
    prof:[[0,neckR*.92],[.5,neckR],[1,neckR*1.3]],
    color:t=>mixc(skinLo,skin,.45+.4*t),
    weight:t=>{const y=lerp(s.headY-r*.45,s.neckY-tl*.06,t);return y<s.neckY?one('spine'):one('neck')}});

  // ---- arms: the r side is rig lead, far from the viewer; the l side is the rear arm, nearest ----
  const armColor=(part,fallback)=>{
    const k=Rig.clothFor(look,part);
    return k==='sleeve'||k==='robe'||k==='ragged'?prim:fallback};
  const buildArm=side=>{
    const sgn=side==='r'?1:-1,x=sgn*look.shoulderW/2,y=s.neckY-4,z=-sgn*s.zShoulder,len=look.armLen,A=side+'Arm',F=side+'Fore',H=side+'Hand';
    const ra=s.armW/2,rf=s.foreW/2,robe=Rig.clothFor(look,'upperArm')==='robe';
    const wrapped=Rig.clothFor(look,'foreArm')==='wrap',fw=torsoNormal(FRONT,.8);
    const prof=isBone?[[0,ra*.74],[.05,ra*.5],[.42,ra*.4],[.5,ra*.62],[.58,rf*.42],[.94,rf*.42],[1,rf*.56]]
      :robe?[[0,ra*1.12],[.1,ra*1.22],[.5,ra*1.2],[.8,ra*1.42],[1,ra*1.6]]
      :s.big?[[0,ra*1.04],[.1,ra*1.12],[.3,ra*1.02],[.46,ra*.86],[.56,rf*1.06],[.7,rf*1.04],[1,rf*.78]]
      :[[0,ra*1.1],[.09,ra*1.3],[.2,ra*1.04],[.3,ra*1.12],[.43,ra*.88],[.5,rf*1.04],[.6,rf*1.2],[.78,rf*.98],[1,rf*.76]];
    const c1=armColor('upperArm',skin),c2=armColor('foreArm',skin),wrapA=rgb('#e8e0cc'),wrapB=rgb('#b9ae96');
    B.tube({cx:x,cz:z,y0:y,y1:y-len,nu:10,nv:wrapped?22:14,capA:.9,capB:.3,prof,
      bump:isBone?null:(t,th)=>{const f=Math.cos(th-Math.atan2(fw[2],fw[0]));return.1*Math.min(1,s.muscle)*f*(gauss(t,.25,.11)+.6*gauss(t,.64,.12))},
      color:(t,th,d)=>{
        if(isBone)return mixc(boneLo,boneWhite,.55+.45*Math.sin(th));
        let c=t<.5?c1:c2;
        if(wrapped&&t>.72)c=(t*40%2)<1?wrapA:wrapB;
        if(c===skin){c=mixc(skinLo,skin,clamp(.82+d*4,0,1));if(d>0)c=mixc(c,skinHi,Math.min(.5,d*3))}
        else if(c===prim)c=mixc(primLo,prim,.55+.45*Math.sin(th*3+t*5));
        if(t>.46&&t<.5&&c1===prim&&c2!==prim)c=primLo;
        return c},
      weight:t=>blend(A,F,sstep(.43,.57,t))});
    // The ball at the elbow keeps the outside of a hard bend round where the skin blend alone would pinch it.
    if(!robe)B.blob({x,y:y-len/2,z,rx:rf*(isBone?.5:.98),ry:rf*(isBone?.5:.98),rz:rf*(isBone?.5:.98),c:c1===prim?c1:isBone?boneWhite:mixc(skinLo,skin,.85),w:one(F)});
    // Hand: a loose fist, sized the way the 2D rig sizes it.
    const hr=limb*(s.big?.86:.62)*(isBone?.7:1),hy=y-len-hr*.72,handC=wrapped?wrapA:isBone?boneWhite:skin;
    B.blob({x,y:hy,z,rx:hr*.92,ry:hr*1.08,rz:hr*.82,nu:12,nv:10,w:one(H),
      bump:(th,ph)=>.07*Math.max(0,Math.cos(th-.4))*Math.sin(ph*6)*Math.sin(ph),
      c:(th,ph)=>wrapped?(ph*5.2%2<1?wrapA:wrapB):mixc(isBone?boneLo:skinLo,handC,.55+.45*Math.cos(ph-.9))});
    B.blob({x:x+hr*.46,y:hy-hr*.1,z:z+hr*.5,rx:hr*.3,ry:hr*.46,rz:hr*.26,c:wrapped?wrapB:handC,w:one(H)})};
  buildArm('l');buildArm('r');

  // ---- legs ----
  const bootC=rgb('#3a2a1c'),soleC=rgb('#1a120b');
  const bareFoot=!!look.bareFeet,boneLeg=cl.legs==='bone';
  const buildLeg=side=>{
    const sgn=side==='r'?1:-1,x=sgn*look.hipW/2,z=-sgn*s.zHip,len=look.legLen,Th=side+'Thigh',Sh=side+'Shin',Ft=side+'Foot';
    const rt=s.thighW/2,rs=s.shinW/2,shorts=cl.legs==='shorts'&&hasProp('boxers');
    const hem=limb*1.72/len,robeLeg=cl.legs==='robe';
    const prof=boneLeg?[[0,rt*.62],[.05,rt*.42],[.44,rt*.36],[.5,rt*.6],[.56,rs*.42],[.94,rs*.42],[1,rs*.55]]
      :[[0,rt*1.04],[.14,rt*1.12],[.34,rt*.98],[.47,rt*.8],[.52,rs*.98],[.66,rs*1.14],[.85,rs*.8],[1,rs*.68]];
    const worn=robeLeg||cl.legs==='pants';
    B.tube({cx:x,cz:z,y0:s.hipY,y1:s.hipY-len,nu:12,nv:18,capA:.9,capB:.25,prof,
      bump:(t,th)=>{
        if(boneLeg)return 0;
        let d=.05*s.muscle*Math.cos(th)*gauss(t,.22,.14);
        if(shorts&&t<hem)d+=.07;
        return d},
      color:(t,th,d)=>{
        if(boneLeg)return mixc(boneLo,boneWhite,.55+.45*Math.sin(th));
        if(shorts&&t<hem)return t>hem-.022?secLo:mixc(mulc(sec,.8),sec,.5+.5*Math.sin(th*2+t*9));
        if(worn){if(!bareFoot&&t>.88)return mixc(bootC,mulc(bootC,1.25),.5+.5*Math.sin(t*90));
          return mixc(primLo,prim,.6+.4*Math.sin(th*3+t*11))}
        if(!bareFoot&&t>.84)return t>.86&&t<.875?mulc(bootC,.6):bootC;
        return mixc(skinLo,skin,clamp(.86+Math.cos(th)*.1+d,0,1))},
      weight:t=>blend(Th,Sh,sstep(.43,.57,t))});
    B.blob({x,y:s.hipY-len/2,z,rx:rs*(boneLeg?.55:.96),ry:rs*(boneLeg?.55:.98),rz:rs*(boneLeg?.55:.96),
      c:boneLeg?boneWhite:worn?primLo:skin,w:one(Sh)});
    if(shorts)for(const[th,t]of[[.3,.08],[1.6,.14],[-.8,.14],[.9,.22],[-.2,.24],[2.4,.1],[3.5,.2]]){
      const cth=Math.cos(th),sth=Math.sin(th),rr=(curve(prof,t,1))*1.07+.55,y=lerp(s.hipY,s.hipY-len,t);
      B.decal([x+cth*rr,y,z+sth*rr],[cth,0,sth],[0,1,0],limb*.2,rgb('#ff9fd0'),one(Th),heart,12)}
    // Foot: flat soled and level, ankle at the rig's foot joint, which is where the 2D rig plants it too.
    const fl=limb*(s.big?2.5:1.8),fh=limb*.86,fw=limb*(s.big?.92:.66),sole=-limb*.55;
    const hTop=[[0,.3],[.14,.74],[.34,1],[.58,.62],[.82,.36],[1,.2]],wid=[[0,.1],[.1,.62],[.4,.76],[.74,1],[.94,.78],[1,.1]];
    B.grid(12,12,true,(u,v,q)=>{
      const t=v,top=curve(hTop,t,1)*fh+sole,mid=(top+sole)/2,ry=(top-sole)/2,rz=Math.max(.01,curve(wid,t,1)*fw),th=u*TAU;
      q.x=x+lerp(-.34,.74,t)*fl;q.y=mid+Math.sin(th)*ry;q.z=z+Math.cos(th)*rz;q.w=one(Ft);
      const low=Math.sin(th)<-.45;
      if(boneLeg)q.c=mixc(boneLo,boneWhite,.7);
      else if(bareFoot){const toe=t>.8&&Math.sin(Math.cos(th)*11)>.45;q.c=toe?skinLo:mixc(skinLo,skin,low?.4:.95)}
      else q.c=low?soleC:mixc(bootC,mulc(bootC,1.5),clamp(Math.sin(th),0,1))})};
  buildLeg('l');buildLeg('r');

  // ---- head: built facing +z in its own frame, then turned toward the opponent ----
  const big=s.big,psi=s.headYaw,cp=Math.cos(psi),sp=Math.sin(psi),headY=s.headY;
  const fr=(hx,hy,hz)=>[hx*cp+hz*sp,headY+hy,-hx*sp+hz*cp];
  const face=body.face,goblin=face.eyes==='goblin',skull=face.eyes==='skull';
  const jawK=big?.05:skull?.15:goblin?.27:lerp(.3,.1,s.muscle),browK=(big?.12:goblin?.08:lerp(.04,.09,s.muscle))*(face.brow?1:0);
  const stubble=look.hair&&s.muscle>.7?rgb(look.hair):null;
  const headLocal=(th,ph,grow)=>{
    const c=Math.cos(ph),sn=Math.sin(ph),low=sstep(.05,.92,-c),fr0=Math.max(0,Math.cos(th)),ath=Math.abs(angDiff(th,0));
    let hx=sn*Math.sin(th)*.9,hy=c*1.03,hz=sn*Math.cos(th)*.98;
    hx*=1-jawK*low;
    hz*=1-.16*low*(1-fr0);
    hz+=(goblin?.2:.09)*low*fr0*fr0;
    let k=1+browK*gauss(c,.3,.17)*gauss(th>Math.PI?th-TAU:th,0,.95);
    k-=.055*gauss(c,.13,.12)*gauss(ath,.44,.22);
    k+=.03*gauss(c,-.12,.2)*gauss(ath,.78,.34);
    k+=(grow||0);
    return[hx*k*r,hy*k*r,hz*k*r]};
  const onHead=(th,c,out)=>{const p=headLocal(th,Math.acos(clamp(c,-1,1)),out||0);return fr(p[0],p[1],p[2])};
  const headC=(th,ph)=>{
    const c=Math.cos(ph),ath=Math.abs(angDiff(th,0));
    let k=.9+.1*c;
    k-=.3*gauss(c,.13,.11)*gauss(ath,.44,.2);        // sockets
    k-=.34*sstep(.72,1,-c);                          // under the jaw
    const col=mixc(skinLo,skin,clamp(k,0,1));
    return stubble?mixc(col,stubble,.3*sstep(.3,.62,-c)*sstep(.5,1,Math.cos(ath*.5))):col};
  B.grid(26,20,true,(u,v,q)=>{
    const th=u*TAU,ph=lerp(.02,Math.PI-.02,v),p=headLocal(th,ph),w=fr(p[0],p[1],p[2]);
    q.x=w[0];q.y=w[1];q.z=w[2];q.w=one('head');q.c=headC(th,ph)});
  const eyeK=skull?1:big?.86:1,eyeTh=.45,eyeC=.13;
  const eyesFn=(side)=>{
    const th=side*eyeTh,sp2=psi+th,p=onHead(th,eyeC,.0);
    if(skull){
      B.blob({x:p[0],y:p[1],z:p[2],rx:r*.25,ry:r*.24,rz:r*.09,spin:sp2,c:rgb('#100a08'),w:one('head')});
      const q=onHead(th,eyeC,.05);
      B.blob({x:q[0],y:q[1],z:q[2],rx:r*.08,ry:r*.09,rz:r*.05,spin:sp2,c:mulc(rgb(face.iris),2.4),w:one('eyes')});
      return}
    const wh=goblin?mixc(rgb(face.iris),rgb('#ffffff'),.12):rgb('#e9e3d8');
    B.blob({x:p[0],y:p[1],z:p[2],rx:r*.165*eyeK,ry:r*.1*eyeK,rz:r*.07,spin:sp2,c:wh,w:one('eyes')});
    // The iris sits a little toward the opponent, so both eyes look at the fight rather than at the camera.
    const look2=onHead(th+.12,eyeC,.052);
    B.blob({x:look2[0],y:look2[1],z:look2[2],rx:r*(goblin?.035:.078)*eyeK,ry:r*.09*eyeK,rz:r*.035,spin:sp2,
      c:goblin?rgb('#141006'):rgb(face.iris),w:one('eyes')});
    if(!goblin){const pu=onHead(th+.12,eyeC,.07);
      B.blob({x:pu[0],y:pu[1],z:pu[2],rx:r*.04,ry:r*.046,rz:r*.02,nu:8,nv:6,spin:sp2,c:rgb('#090706'),w:one('eyes')})}
    // The lid stays put while the eye squashes under it, so a closed eye reads as a closed eye.
    const lid=onHead(th,eyeC+.085,.03);
    B.blob({x:lid[0],y:lid[1],z:lid[2],rx:r*.19*eyeK,ry:r*.058,rz:r*.08,spin:sp2,c:mixc(skinLo,skin,.5),w:one('head')});
    const lash=onHead(th,eyeC,.02);
    B.blob({x:lash[0],y:lash[1],z:lash[2],rx:r*.165*eyeK,ry:r*.016,rz:r*.05,nu:8,nv:6,spin:sp2,c:mixc(skinLo,dark,.6),w:one('head')});
    if(face.brow){
      const br=onHead(th,eyeC+.195,.05);
      B.blob({x:br[0],y:br[1],z:br[2],rx:r*.235,ry:r*(big?.08:lerp(.045,.072,s.muscle)),rz:r*.06,spin:sp2,tilt:side*D(15),nu:10,nv:6,
        c:look.hair?rgb(look.hair):mulc(skinLo,.55),w:one('brows')})}};
  eyesFn(1);eyesFn(-1);
  // Nose, mouth and ears, each tuned by the look's face block.
  {
    const np=onHead(0,-.06,.0);
    if(skull){B.blob({x:np[0],y:np[1],z:np[2],rx:r*.09,ry:r*.14,rz:r*.05,spin:psi,c:rgb('#100a08'),w:one('head')})}
    else if(goblin)B.sweep([onHead(0,.02,-.02),onHead(0,-.04,.2),onHead(0,-.14,.42)],t=>r*lerp(.13,.035,t),8,8,mixc(skinLo,skin,.9),one('head'));
    else B.blob({x:np[0],y:np[1],z:np[2],rx:r*(big?.14:lerp(.08,.115,s.muscle)),ry:r*.17,rz:r*(big?.18:lerp(.13,.17,s.muscle)),spin:psi,c:mixc(skinLo,skin,.86),w:one('head')});
    const mo=onHead(0,-.5,.0);
    if(face.mouth!=='none')B.blob({x:mo[0],y:mo[1],z:mo[2],rx:r*(big?.36:.25),ry:r*.05,rz:r*.05,spin:psi,nu:10,nv:6,c:rgb('#2a100c'),w:one('mouth')});
    else B.blob({x:mo[0],y:mo[1],z:mo[2],rx:r*.3,ry:r*.1,rz:r*.05,spin:psi,nu:12,nv:6,
      c:(th)=>Math.sin(th*14)>0?rgb('#d8d0c0'):rgb('#1a140e'),w:one('head')});
    if(face.mouth==='fangs'){
      for(const sd of[-1,1]){
        if(big)B.sweep([onHead(sd*.3,-.62,.02),onHead(sd*.33,-.42,.14),onHead(sd*.36,-.16,.2)],t=>r*lerp(.08,.012,t),8,8,rgb('#efe6cf'),one('head'));
        else B.sweep([onHead(sd*.22,-.54,.03),onHead(sd*.22,-.42,.09)],t=>r*lerp(.055,.01,t),6,5,rgb('#f2ecd6'),one('head'))}}
    if(face.ears==='human')for(const sd of[-1,1]){
      const e=fr(sd*r*.86,r*.02,-r*.04);
      B.blob({x:e[0],y:e[1],z:e[2],rx:r*.075,ry:r*.21,rz:r*.13,spin:psi,c:mixc(skinLo,skin,.74),w:one('head')})}
    if(face.ears==='pointed')for(const sd of[-1,1]){
      const L=look.earLen*(goblin?.95:1),a=[sd*r*.74,r*.1,-r*.05];
      const P=(x,y,z)=>fr(a[0]+sd*x*L,a[1]+y*L,a[2]+z*L);
      B.sweep([P(0,0,0),P(.42,.14,-.1),P(.8,.32,-.16),P(1.08,.56,-.22)],t=>r*lerp(.2,.012,t*t),10,14,
        (t,th)=>mixc(skinLo,mixc(skin,rgb('#b97a6a'),.25),.5+.5*Math.sin(th)),one('head'))}
    if(face.horns==='small')for(const sd of[-1,1]){
      const a=headLocal(sd*1.1,.45,0),P=(x,y)=>fr(a[0]+sd*x,a[1]+y,a[2]);
      B.sweep([P(0,-r*.05),P(r*.08,r*.24),P(r*.1,r*.46)],t=>r*lerp(.13,.015,t),8,8,rgb('#d9cfb6'),one('head'))}
  }
  // ---- hair ----
  const hairC=look.hair?rgb(look.hair):dark,hairHi=look.hair?tone(look.hair,.2):dark;
  if(face.hair==='crop'||face.hair==='long'){
    const edge=th=>{const a=Math.abs(angDiff(th,0));return lerp(.74,face.hair==='crop'?1.56:2.02,sstep(.5,2,a))+.08*wob(th*2.6)};
    B.grid(30,9,true,(u,v,q)=>{
      const th=u*TAU,ph=lerp(edge(th),.03,v),tuft=(.5+.5*Math.sin(th*17+v*7))*(.5+.5*Math.sin(th*7-v*11));
      const p=headLocal(th,ph,.05+(face.hair==='crop'?.085*tuft*(1-v*.4):.03*tuft)),w=fr(p[0],p[1],p[2]);
      q.x=w[0];q.y=w[1];q.z=w[2];q.w=one('head');q.c=mixc(hairC,hairHi,tuft)})}
  if(face.hair==='long'){
    const b=fr(0,r*.3,-r*.62);
    B.tube({cx:b[0],cz:b[2],y0:headY+r*.6,y1:s.neckY-tl*.32,yaw:psi,nu:16,nv:16,capA:.4,capB:.3,
      prof:[[0,r*.82,r*.42],[.3,r*.78,r*.34],[.7,r*.62,r*.26],[1,r*.3,r*.14]],
      bump:(t,th)=>.05*Math.sin(th*9+t*5),
      color:(t,th)=>mixc(hairC,hairHi,.5+.5*Math.sin(th*11+t*3)),
      weight:t=>{const y=lerp(headY+r*.6,s.neckY-tl*.32,t);return y>s.neckY+r?one('head'):y>s.neckY?blend('neck','head',(y-s.neckY)/r):one('spine')}})}
  if(isRobe){
    // The hood belongs to the robe, as in 2D: a cowl around the back of the head that leaves the face open.
    B.grid(26,16,false,(u,v,q)=>{
      const gap=1.0,th=gap+u*(TAU-gap*2),ph=lerp(.03,2.65,v),p=headLocal(th,ph,.17+.05*Math.sin(th*5+v*3));
      p[1]+=r*.14*(1-v);
      const w=fr(p[0],p[1],p[2]);q.x=w[0];q.y=w[1];q.z=w[2];q.w=one('head');
      const edge=Math.min(u,1-u);q.c=edge<.05?sec:mixc(primLo,prim,.5+.5*Math.sin(th*4+v*6))});
    B.blob({x:0,y:s.neckY+r*.05,z:0,rx:s.L*.42,ry:r*.5,rz:s.L*.34,spin:s.yaw,nu:18,nv:10,
      c:(th,ph)=>mixc(primLo,prim,.5+.5*Math.sin(th*6)),w:one('spine')})}

  // ---- held props and horns ----
  const hand=side=>{const sgn=side==='r'?1:-1;return[sgn*look.shoulderW/2,s.neckY-4-look.armLen,-sgn*s.zShoulder]};
  const h=hand('r'),P=(dx,dy,dz)=>[h[0]+dx,h[1]+dy,h[2]+(dz||0)];
  // A flat blade along a direction in the rig plane, thin in depth, as the 2D dagger is.
  const blade=(ox,oy,dx,dy,len,w,c,bone)=>{
    const nl=Math.hypot(dx,dy),ux=dx/nl,uy=dy/nl,px=-uy,py=ux;
    B.grid(10,8,true,(u,v,q)=>{
      const th=u*TAU,wd=w*(v<.1?v*10:1-Math.pow((v-.1)/.9,2.2)),t=limb*.09*(1-v*.8);
      const a=Math.cos(th)*wd,z=Math.sin(th)*t,along=v*len;
      q.x=h[0]+ox+ux*along+px*a;q.y=h[1]+oy+uy*along+py*a;q.z=h[2]+z;
      q.c=typeof c==='function'?c(v,th):c;q.w=one(bone)})};
  if(hasProp('dagger')){
    const len=look.armLen*.46,dy=.32;
    blade(3,1,1,dy,len,4.2,(v,th)=>mixc(rgb('#b8bcc4'),rgb('#ffffff'),.5+.5*Math.cos(th)),'rProp');
    B.sweep([P(-3,-1),P(1,.3),P(4,1.3)],2.4,6,5,rgb('#3a2f22'),one('rProp'));
    B.blob({x:h[0]+3.5,y:h[1]+1.2,z:h[2],rx:1.6,ry:6.4,rz:1.8,tilt:Math.atan(dy),c:tone(look.secondary,0),w:one('rProp')})}
  if(hasProp('club')){
    B.sweep([P(-2,-6),P(4,10),P(12,30)],t=>lerp(3.6,6.4,t),10,10,(t,th)=>mixc(tone(look.secondary,-.35),rgb(look.secondary),.5+.5*Math.sin(th*3+t*9)),one('rProp'));
    for(let i=0;i<3;i++)B.blob({x:h[0]+4+i*4,y:h[1]+10+i*10,z:h[2]+(i%2?5:-5),rx:2.2,ry:2.2,rz:2.2,nu:6,nv:5,c:rgb('#2a2118'),w:one('rProp')})}
  if(hasProp('spikedclub')){
    const len=look.armLen*.6,tx=len*.3,ty=len,wAt=t=>t<.22?3.4:4+11*Math.min(1,(t-.22)/.55);
    const nl=Math.hypot(tx,ty),ux=tx/nl,uy=ty/nl;
    B.sweep([P(-ux*10,-uy*10),P(tx*.33,ty*.33),P(tx*.66,ty*.66),P(tx,ty)],wAt,12,14,(t,th)=>mixc(tone(look.secondary,-.38),tone(look.secondary,.18),.5+.5*Math.sin(th*3+t*5)),one('rProp'));
    for(let i=0;i<4;i++)for(const a of[0,2.1,4.2]){
      const t=.44+i*.15,cx=tx*t,cy=ty*t,w0=wAt(t),nx=-uy*Math.cos(a),ny=ux*Math.cos(a),nz=Math.sin(a);
      B.sweep([P(cx+nx*w0*.8,cy+ny*w0*.8,nz*w0*.8),P(cx+nx*(w0+10),cy+ny*(w0+10),nz*(w0+10))],q=>lerp(3,.2,q),6,4,rgb('#d6cfbd'),one('rProp'))}}
  if(hasProp('horns'))for(const sd of[-1,1]){
    const P2=(x,y,z)=>fr(sd*x*r,y*r,z*r);
    B.sweep([P2(.55,.62,.0),P2(1.0,1.05,-.12),P2(1.25,1.6,-.28),P2(1.02,2.1,-.42)],t=>r*lerp(.27,.03,t),10,14,
      (t,th)=>mixc(rgb('#8a7f68'),rgb('#ece3d2'),.2+t*.8),one('head'))}
  if(hasProp('scars'))for(const[f,x,len,tilt]of[[-.4,.8,.4,.6],[.34,.66,.46,-.5],[.05,.5,.3,.3]]){
    const th=FRONT+f,p=torsoPoint(th,x,.5,sculpt(th,x));
    B.blob({x:p[0],y:p[1],z:p[2],rx:limb*len*1.3,ry:limb*.09,rz:limb*.05,spin:s.yaw-f,tilt,nu:8,nv:5,c:skinHi,w:one('spine')})}

  const geo=B.finish();
  geo.userData.tris=B.ix.length/3;
  return geo}

// ---- figures: one bone hierarchy and skinned mesh per fighter, sharing geometry per look ----
function makeFigure(lookId){
  const look=LOOKS[lookId],s=proportions(look),r=look.headR,bones={};
  for(const n of BONES)bones[n]=new T.Bone();
  const add=(parent,child,x,y,z)=>{bones[parent].add(bones[child]);bones[child].position.set(x,y,z)};
  bones.hips.position.set(0,s.hipY,0);
  add('hips','pelvis',0,0,0);add('hips','spine',0,0,0);
  add('spine','neck',0,look.torsoLen,0);add('neck','head',0,r*1.6,0);
  const ey=r*.13*1.06,mo=-r*.5*1.06;
  add('head','eyes',0,ey,0);add('head','brows',0,ey+r*.22,0);add('head','mouth',0,mo,0);
  for(const side of['r','l']){
    const sg=side==='r'?1:-1;
    add('spine',side+'Arm',sg*look.shoulderW/2,look.torsoLen-4,-sg*s.zShoulder);
    add(side+'Arm',side+'Fore',0,-look.armLen/2,0);
    add(side+'Fore',side+'Hand',0,-look.armLen/2,0);
    add('hips',side+'Thigh',sg*look.hipW/2,0,-sg*s.zHip);
    add(side+'Thigh',side+'Shin',0,-look.legLen/2,0);
    add(side+'Shin',side+'Foot',0,-look.legLen/2,0)}
  add('rHand','rProp',0,0,0);
  // Roll is about the body's own long axis, so it has to apply before the lean.
  bones.spine.rotation.order='ZYX';bones.pelvis.rotation.order='ZYX';
  const root=new T.Group();root.add(bones.hips);
  root.updateMatrixWorld(true);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:0});
  // A view-dependent cool edge is what holds a dark figure off a dark stage at phone size, for almost no shader cost.
  material.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
     float edgeRim=pow(1.0-saturate(dot(normalize(vViewPosition),normal)),3.2);
     totalEmissiveRadiance+=vec3(.15,.23,.44)*edgeRim*diffuseColor.a;`)};
  const mesh=new T.SkinnedMesh(geometryFor(look),material);
  mesh.frustumCulled=false;
  root.add(mesh);
  mesh.bind(new T.Skeleton(BONES.map(n=>bones[n])));
  const shadow=new T.Mesh(Render3D._shadowGeo,Render3D._shadowMat);
  shadow.renderOrder=-1;shadow.frustumCulled=false;
  return{lookId,look,root,bones,mesh,material,shadow,s}}

// Every rotation is about z because the rig is planar: the same numbers Rig.solve folds into 2D joints.
// One correction on top: the rig's falls leave the hips at crouch height with the arms hanging, which a flat drawing
// hides and a solid body would show as a floating torso and hands through the floor. Past a 38 degree lean the figure
// settles: hips onto the floor, chest rolled up, arms along the body, legs out away from the head.
const PRONE_ROLL=D(62);
// Two equal leg bones reaching a point `down` below and `tx` along from the hip, with the knee on the given side.
let _hA=0,_kA=0;
function reach(tx,down,U,knee){
  const d=Math.min(Math.hypot(tx,down),U*1.998),o=knee*Math.acos(d/(2*U));
  _hA=Math.atan2(tx,down)+o;_kA=-2*o}
function posePlanar(fig,ang,off){
  const look=fig.look,b=fig.bones,a=k=>ang[k]||0,tA=a('torso')+(look.hunch||0);
  const w=sstep(D(38),D(80),Math.abs(tA)),away=tA<0?1:-1,limb=look.limb,U=look.legLen/2;
  const rigHipUp=look.legLen-(off.y||0),hipUp=lerp(rigHipUp,fig.s.L*.3,w);
  b.hips.position.set(off.x||0,hipUp,0);
  // Flat on the floor is as far as a fall goes, however far the rig's pose leans.
  const lean=lerp(tA,clamp(tA,-D(86),D(86)),w);
  b.pelvis.rotation.z=-lean*lerp(.35,1,w);
  b.pelvis.rotation.y=away*PRONE_ROLL*w*.8;
  b.spine.rotation.z=-lean;
  b.spine.rotation.y=away*PRONE_ROLL*w;
  b.neck.rotation.z=-a('head');
  const rS=a('rShoulder'),lS=a('lShoulder'),rE=a('rElbow'),lE=a('lElbow');
  // Rig shoulders are absolute, so the lean the arm inherits from the spine comes back off, except when prone.
  b.rArm.rotation.z=rS+lean*(1-w);b.rFore.rotation.z=rE;
  b.lArm.rotation.z=lS+lean*(1-w);b.lFore.rotation.z=lE;
  // The 2D rig draws held props at a fixed angle whatever the arm does.
  b.rProp.rotation.z=-(rS+rE);
  for(const side of['r','l']){
    let hA=a(side+'Hip'),kA=a(side+'Knee');
    if(w>0){
      // A foot out past the hips on the floor, knee up.
      reach(away*U*(side==='r'?1.72:1.5),hipUp,U,away);
      hA=lerp(hA,_hA,w);kA=lerp(kA,_kA,w)}
    // A foot the rig would sink through the floor (a brute's heavy drops the hips 85px) bends the knee instead.
    if(hipUp-U*(Math.cos(hA)+Math.cos(hA+kA))<0){
      reach(U*(Math.sin(hA)+Math.sin(hA+kA)),hipUp,U,1);
      hA=_hA;kA=_kA}
    const tot=hA+kA;
    b[side+'Thigh'].rotation.z=hA;b[side+'Shin'].rotation.z=kA;
    // Feet stay flat on the floor as in 2D and only tip with the shin once they've left it, in a kick.
    const lift=clamp((hipUp-U*(Math.cos(hA)+Math.cos(tot)))/(limb*1.6),0,1);
    b[side+'Foot'].rotation.z=-tot*(1-lift*.8)+w*away*D(80)}}

// Open eyes, brow height and mouth by the 2D rig's own face states.
const FACE={idle:[1,0,.8],attack:[.82,-1,1.2],block:[.75,-.7,.8],hit:[.34,1,2.4],ko:[.07,.2,1.6],win:[1,.7,2]};
function poseFace(fig,poseKey){
  const f=FACE[BodyStyle.faceState(poseKey)]||FACE.idle,b=fig.bones,r=fig.look.headR;
  if(!b.eyes)return;
  b.eyes.scale.y=f[0];
  b.brows.position.y=r*.13*1.06+r*.22+f[1]*r*.055;
  b.mouth.scale.y=f[2]}

const _c=new T.Color(),_v=new T.Vector3();
function lightFigure(fig,F){
  const lit=Stage.lightAt(F.x);
  _c.setStyle(lit.tint);
  const mx=Math.max(_c.r,_c.g,_c.b)||1,gain=.84+.36*lit.k,mix=.26;
  let k=gain;
  if(F.state==='KO')k*=.84;
  const flash=F.state==='HITSTUN'&&F.f<3;
  if(flash)k*=1.9;
  fig.material.color.setRGB(lerp(1,_c.r/mx,mix)*k,lerp(1,_c.g/mx,mix)*k,lerp(1,_c.b/mx,mix)*k);
  fig.material.emissive.setRGB(flash?.24:0,flash?.21:0,flash?.18:0)}

// A soft pool under whatever is close to the floor, so a prone fighter's shadow spreads with them.
function placeShadow(fig,F,scale){
  const b=fig.bones,lim=fig.look.limb*scale,sole=-fig.look.limb*.55*scale;
  let lo=Infinity,hi=-Infinity,minH=Infinity;
  for(const n of['lFoot','rFoot','hips','neck','head','lHand','rHand']){
    const e=b[n].matrixWorld.elements,h=e[13];
    if(n==='lFoot'||n==='rFoot'||h<fig.s.hipY*.72*scale){if(e[12]<lo)lo=e[12];if(e[12]>hi)hi=e[12];if(h<minH)minH=h}}
  const w=hi-lo+lim*3.6,lift=clamp(minH/(lim*7),0,1);
  fig.shadow.position.set((lo+hi)/2,sole,fig.root.position.z);
  fig.shadow.scale.set(w*(1+lift*.2),1,lim*(5.2+Math.min(3,w/(lim*14))));
  fig.shadow.visible=true}

function updateFigure(fig,F,side){
  const look=fig.look,scale=F.def.scale||1,face=F.face||1;
  const{key,t01}=Rig.poseFor(F),{ang,off}=samplePose(look.rig==='big'?POSES_BIG:POSES,key,t01);
  (fig.pose||posePlanar)(fig,ang,off);poseFace(fig,key);
  // p2 sits a hair behind p1, so bodies that overlap in a clinch don't flicker through each other.
  fig.root.position.set(F.x,0,side===0?3:-3);
  fig.root.scale.set(face*scale,scale,scale);
  fig.root.updateMatrixWorld(true);
  lightFigure(fig,F);placeShadow(fig,F,scale)}

// The lens is sheared rather than aimed, so the plane the rig lives in maps onto the screen exactly as Camera.apply
// maps it in 2D, while anything with depth still shows its sides from this raised three-quarter viewpoint.
const CAM={dist:760,side:-70,height:255,near:60,far:1500};
function placeCamera(camera,cam){
  const D_=CAM.dist,cx=cam.x+CAM.side,cy=CAM.height,zoom=cam.zoom,n=CAM.near;
  camera.position.set(cx,cy,D_);camera.updateMatrixWorld();
  const rl=n*W/(D_*zoom),tb=n*H/(D_*zoom);
  const bx=(2*zoom/W)*(cam.x-cx)-2*FX.shake.x/W;
  const by=-(2*zoom/H)*cy-1+2*Camera.anchorY/H+2*FX.shake.y/H;
  const sx=bx*rl,sy=by*tb;
  camera.projectionMatrix.makePerspective((sx-rl)/2,(sx+rl)/2,(sy+tb)/2,(sy-tb)/2,n,CAM.far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()}

const Render3D={
  canvas:null,top:null,topCanvas:null,renderer:null,scene:null,camera:null,MIXAMO,
  // lookId to a function returning a figure, which is how a loaded glTF skinned model plugs in later. It returns what
  // makeFigure does, with `bones` keyed by rig joint through MIXAMO and a `pose(fig,ang,off)` that applies the angles.
  models:{},
  slots:[{lookId:null,fig:null,cache:{}},{lookId:null,fig:null,cache:{}}],
  supports(lookId){return !!this.models[lookId]||!!(LOOKS[lookId]&&LOOKS[lookId].rig!=='quad')},
  // A fresh figure for this look, or null when the look stays in 2D.
  figureFor(lookId){
    if(this.models[lookId])return this.models[lookId](lookId);
    return this.supports(lookId)?makeFigure(lookId):null},
  init(cv,gl){
    this.canvas=cv;
    const style=(c,bg)=>{Object.assign(c.style,{position:'absolute',pointerEvents:'none',background:'transparent',imageRendering:bg})};
    style(cv,'auto');
    this.topCanvas=document.createElement('canvas');this.topCanvas.width=W;this.topCanvas.height=H;
    style(this.topCanvas,'pixelated');
    this.top=this.topCanvas.getContext('2d');
    // Directly after the game canvas, which keeps both under the buttons and screens that come later in the page.
    canvas.after(cv,this.topCanvas);
    const r=this.renderer=new T.WebGLRenderer({canvas:cv,context:gl,antialias:true,alpha:true});
    r.setClearColor(0,0);
    r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1;
    r.outputColorSpace=T.SRGBColorSpace;
    this.scene=new T.Scene();
    this.camera=new T.PerspectiveCamera();
    // Warm key from the torches, a cool rim from behind, an orange kick from the wall torches behind the fight, and just enough fill to keep shadow sides readable.
    const key=new T.DirectionalLight('#ffdcbc',3.5);key.position.set(240,380,430);
    const rim=new T.DirectionalLight('#8ab8ff',4.2);rim.position.set(-320,260,-380);
    const kick=new T.DirectionalLight('#ff9a58',2.4);kick.position.set(380,150,-300);
    const fill=new T.HemisphereLight('#7f8eb8','#33241a',.72);
    this.scene.add(key,rim,kick,fill);
    const sh=document.createElement('canvas');sh.width=sh.height=64;
    const c=sh.getContext('2d'),g=c.createRadialGradient(32,32,4,32,32,32);
    g.addColorStop(0,'rgba(0,0,0,.72)');g.addColorStop(.55,'rgba(0,0,0,.36)');g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(0,0,64,64);
    this._shadowGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
    this._shadowMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(sh),transparent:true,depthWrite:false,toneMapped:false});
    cv.addEventListener('webglcontextlost',()=>{Gate3D.lost=true;this.show(false)});
    cv.addEventListener('webglcontextrestored',()=>{Gate3D.lost=false;Gate3D.sync()});
    this.fit()},
  show(on){const d=on?'block':'none';this.canvas.style.display=d;this.topCanvas.style.display=d;if(on)this.fit()},
  // Follows G.fit: same box as the game canvas, with the WebGL buffer at the phone's own resolution, capped so a 3x screen doesn't pay 9x the pixels.
  fit(){
    const a=canvas.getBoundingClientRect(),w=canvas.parentElement.getBoundingClientRect();
    if(!a.width)return;
    for(const c of[this.canvas,this.topCanvas])Object.assign(c.style,{left:(a.left-w.left)+'px',top:(a.top-w.top)+'px',width:a.width+'px',height:a.height+'px'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.setSize(a.width,a.height,false)},
  frame(f,cam){
    const fighters=f?[f.p1,f.p2]:[null,null];
    fighters.forEach((F,i)=>{
      const s=this.slots[i],id=F?lookFor(F.def).id:null,want=id&&this.supports(id)?id:null;
      if(s.lookId!==want){
        if(s.fig){this.scene.remove(s.fig.root,s.fig.shadow)}
        s.fig=want?(s.cache[want]||(s.cache[want]=this.figureFor(want))):null;
        s.lookId=want;
        if(s.fig)this.scene.add(s.fig.root,s.fig.shadow)}
      if(s.fig)updateFigure(s.fig,F,i)});
    placeCamera(this.camera,cam);
    this.renderer.render(this.scene,this.camera)},
  // World to canvas pixels through the live 3D camera, y in the 2D rig's convention.
  project(x,y){_v.set(x,FLOOR-y,0).project(this.camera);return{sx:(_v.x+1)/2*W,sy:(1-_v.y)/2*H}},
  // Bone positions for a look and pose in Rig.solve's own coordinates (feet origin, y down), so tests compare against the 2D rig.
  solveProbe(lookId,poseKey,t01,face){
    const fig=this._probe&&this._probe.lookId===lookId?this._probe:(this._probe=makeFigure(lookId)),look=fig.look;
    const{ang,off}=samplePose(look.rig==='big'?POSES_BIG:POSES,poseKey,t01);
    posePlanar(fig,ang,off);
    fig.root.position.set(0,0,0);fig.root.scale.set(face,1,1);fig.root.updateMatrixWorld(true);
    const at=n=>{const e=fig.bones[n].matrixWorld.elements;return{x:e[12],y:-e[13]}},b={};
    for(const[j,n]of Object.entries({hip:'hips',neck:'neck',head:'head',lShoulder:'lArm',rShoulder:'rArm',lElbow:'lFore',rElbow:'rFore',
      lHand:'lHand',rHand:'rHand',lHip:'lThigh',rHip:'rThigh',lKnee:'lShin',rKnee:'rShin',lFoot:'lFoot',rFoot:'rFoot'}))b[j]=at(n);
    return b}};
window.Render3D=Render3D;
})();

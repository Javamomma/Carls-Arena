// Stylized vector-rig renderer. Pure presentation: reads Fight/Fighter state, never writes it.
// Forward-kinematics bone rig driven by keyframed joint-angle poses; per-character "looks" supply
// palette + proportions + props so the same pose data reads as Carl, Katia, a goblin, or a hobgoblin.
const D=deg=>deg*Math.PI/180;
function shade(hex,amt){ // amt<0 darkens, amt>0 lightens, both toward 0/255
  const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const adj=v=>Math.max(0,Math.min(255,Math.round(amt<0?v*(1+amt):v+(255-v)*amt)));
  return'#'+[adj(r),adj(g),adj(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}

// ---- pose table: POSES[key] = [{t:0..1, ang:{...}, off:{x,y}}, ...], tweened linearly by t01 ----
const POSES={};
function samplePose(poseKey,t01){
  const kf=POSES[poseKey];t01=clamp(t01,0,1);
  let i=0;while(i<kf.length-2&&kf[i+1].t<=t01)i++;
  const a=kf[i],b=kf[Math.min(i+1,kf.length-1)],span=(b.t-a.t)||1,lt=clamp((t01-a.t)/span,0,1);
  const ang={},keys=new Set([...Object.keys(a.ang||{}),...Object.keys(b.ang||{})]);
  for(const k of keys)ang[k]=(((a.ang||{})[k]||0))+((((b.ang||{})[k]||0))-(((a.ang||{})[k]||0)))*lt;
  const off={x:(((a.off||{}).x||0))+((((b.off||{}).x||0))-(((a.off||{}).x||0)))*lt,
             y:(((a.off||{}).y||0))+((((b.off||{}).y||0))-(((a.off||{}).y||0)))*lt};
  return{ang,off}}

// idle: subtle breathing sway; legs stay put (angle 0) so feet never drift off the floor line.
POSES.idle=[
  {t:0,ang:{torso:D(2), lShoulder:D(10),rShoulder:D(-8), lElbow:D(20),rElbow:D(16)},off:{x:0,y:0}},
  {t:1,ang:{torso:D(-2),lShoulder:D(6), rShoulder:D(-12),lElbow:D(24),rElbow:D(12)},off:{x:0,y:0}}];
POSES.walk=[
  {t:0, ang:{torso:D(3), lHip:D(-20),rHip:D(20), lKnee:D(20),rKnee:D(-10), lShoulder:D(14),rShoulder:D(-14)},off:{x:0,y:0}},
  {t:.5,ang:{torso:D(-3),lHip:D(20), rHip:D(-20),lKnee:D(-10),rKnee:D(20), lShoulder:D(-14),rShoulder:D(14)},off:{x:0,y:0}},
  {t:1, ang:{torso:D(3), lHip:D(-20),rHip:D(20), lKnee:D(20),rKnee:D(-10), lShoulder:D(14),rShoulder:D(-14)},off:{x:0,y:0}}];
POSES.dash=[
  {t:0,ang:{torso:D(-14),lHip:D(-10),rHip:D(20),lKnee:D(20),rKnee:D(-10),lShoulder:D(20),rShoulder:D(-20)},off:{x:0,y:-4}},
  {t:1,ang:{torso:D(-18),lHip:D(-18),rHip:D(28),lKnee:D(26),rKnee:D(-6), lShoulder:D(26),rShoulder:D(-26)},off:{x:-10,y:-2}}];
function jab(side,o={}){
  const S=side+'Shoulder',E=side+'Elbow';
  const startSh=o.startSh!==undefined?o.startSh:-15,startEl=o.startEl!==undefined?o.startEl:25;
  const peakSh=o.peakSh!==undefined?o.peakSh:85,peakEl=o.peakEl!==undefined?o.peakEl:5,peakOffX=o.peakOffX!==undefined?o.peakOffX:10;
  const torsoPeak=o.torsoPeak!==undefined?o.torsoPeak:10;
  const guard=side==='r'?{lShoulder:D(10),lElbow:D(20)}:{rShoulder:D(-10),rElbow:D(20)};
  return[
    {t:0, ang:Object.assign({torso:D(4)},{[S]:D(startSh),[E]:D(startEl)},guard),off:{x:0,y:0}},
    {t:.4,ang:Object.assign({torso:D(torsoPeak)},{[S]:D(peakSh),[E]:D(peakEl)},guard),off:{x:peakOffX,y:0}},
    {t:1, ang:Object.assign({torso:D(4)},{[S]:D(startSh+5),[E]:D(startEl)},guard),off:{x:0,y:0}}]}
POSES.light1=jab('r',{});
POSES.light2=jab('l',{peakSh:90,peakOffX:12});
POSES.light3=jab('r',{peakSh:95,peakOffX:14,torsoPeak:14});
POSES.light4=jab('l',{peakSh:100,peakOffX:16,torsoPeak:16});
POSES.light5=jab('r',{peakSh:118,peakEl:-10,peakOffX:26,torsoPeak:22,startEl:30});
POSES.medium=[
  {t:0, ang:{torso:D(-6),rShoulder:D(-10),rElbow:D(15),lShoulder:D(10),lElbow:D(15),rHip:D(-8),lHip:D(8)},off:{x:-4,y:0}},
  {t:.5,ang:{torso:D(18),rShoulder:D(92), rElbow:D(0), lShoulder:D(-18),lElbow:D(10),rHip:D(10),lHip:D(-10)},off:{x:16,y:0}},
  {t:1, ang:{torso:D(8), rShoulder:D(40), rElbow:D(15),lShoulder:D(0),  lElbow:D(15)},off:{x:4,y:0}}];
POSES.heavyCharge=[
  {t:0,ang:{torso:D(-8), rShoulder:D(-70), rElbow:D(70), lShoulder:D(10),lElbow:D(20),rHip:D(-6),lHip:D(6)},off:{x:-4,y:0}},
  {t:1,ang:{torso:D(-18),rShoulder:D(-118),rElbow:D(118),lShoulder:D(6), lElbow:D(16),rHip:D(-10),lHip:D(10)},off:{x:-8,y:0}}];
POSES.heavy=[
  {t:0, ang:{torso:D(-16),rShoulder:D(-118),rElbow:D(118)},off:{x:-6,y:0}},
  {t:.5,ang:{torso:D(16), rShoulder:D(90),  rElbow:D(8)},  off:{x:16,y:0}},
  {t:1, ang:{torso:D(6),  rShoulder:D(55),  rElbow:D(28)}, off:{x:6,y:0}}];
POSES.block=[
  {t:0,ang:{torso:D(4),lShoulder:D(70),rShoulder:D(80),lElbow:D(60),rElbow:D(55),lHip:D(6),rHip:D(-6)},off:{x:2,y:2}},
  {t:1,ang:{torso:D(4),lShoulder:D(75),rShoulder:D(85),lElbow:D(62),rElbow:D(58),lHip:D(6),rHip:D(-6)},off:{x:2,y:2}}];
POSES.blockstun=[
  {t:0,ang:{torso:D(-10),lShoulder:D(70),rShoulder:D(80),lElbow:D(60),rElbow:D(55)},off:{x:-5,y:0}},
  {t:1,ang:{torso:D(4),  lShoulder:D(70),rShoulder:D(80),lElbow:D(60),rElbow:D(55)},off:{x:0,y:0}}];
POSES.hit=[
  {t:0,ang:{torso:D(-24),head:D(-22),lShoulder:D(30),rShoulder:D(-42),lElbow:D(30),rElbow:D(10),lHip:D(-6),rHip:D(6)},off:{x:-10,y:0}},
  {t:1,ang:{torso:D(-6), head:D(-4), lShoulder:D(15),rShoulder:D(-15),lElbow:D(20),rElbow:D(15)},off:{x:-3,y:0}}];
// Torso rotates flat to the ground while the legs stay tucked with a modest, matched bend (both hips
// the same sign, well short of the torso's rotation) so they read as collapsed-under, not overlapping
// the torso/head at full reach.
POSES.knockdown=[
  {t:0,ang:{torso:D(-68),head:D(8),lShoulder:D(15),rShoulder:D(-10),lElbow:D(10),rElbow:D(10),lHip:D(-30),rHip:D(-35),lKnee:D(45),rKnee:D(50)},off:{x:-10,y:22}},
  {t:1,ang:{torso:D(-92),head:D(2),lShoulder:D(8), rShoulder:D(-6), lElbow:D(6), rElbow:D(6), lHip:D(-40),rHip:D(-46),lKnee:D(55),rKnee:D(60)},off:{x:-14,y:26}}];
POSES.getup=[
  {t:0,ang:{torso:D(-45),lHip:D(-35),rHip:D(-40),lKnee:D(35),rKnee:D(40)},off:{x:-8,y:18}},
  {t:1,ang:{torso:D(0),  lHip:D(0),  rHip:D(0),  lKnee:D(0), rKnee:D(0)}, off:{x:0,y:0}}];
POSES.stunned=[
  {t:0,ang:{torso:D(6), head:D(14), lShoulder:D(8),rShoulder:D(-6), lElbow:D(30),rElbow:D(25)},off:{x:0,y:0}},
  {t:1,ang:{torso:D(-6),head:D(-10),lShoulder:D(4),rShoulder:D(-10),lElbow:D(34),rElbow:D(28)},off:{x:0,y:0}}];
function flurry(...kfs){return kfs}
POSES.s1=flurry(
  {t:0,  ang:{torso:D(-4),rShoulder:D(-20),rElbow:D(30),lShoulder:D(20),lElbow:D(20)},off:{x:-4,y:0}},
  {t:.3, ang:{torso:D(10),rShoulder:D(90), rElbow:D(5)},off:{x:10,y:0}},
  {t:.6, ang:{torso:D(6), lShoulder:D(-90),lElbow:D(5)},off:{x:14,y:0}},
  {t:1,  ang:{torso:D(22),rShoulder:D(112),rElbow:D(-10),lShoulder:D(-20),lElbow:D(20)},off:{x:26,y:0}});
POSES.s2=flurry(
  {t:0,  ang:{torso:D(-6),rShoulder:D(-24),rElbow:D(32),lShoulder:D(24),lElbow:D(22)},off:{x:-6,y:0}},
  {t:.25,ang:{torso:D(12),rShoulder:D(94), rElbow:D(4)},off:{x:12,y:0}},
  {t:.5, ang:{torso:D(4), lShoulder:D(-96),lElbow:D(4)},off:{x:18,y:0}},
  {t:.75,ang:{torso:D(16),rShoulder:D(104),rElbow:D(-4)},off:{x:24,y:0}},
  {t:1,  ang:{torso:D(28),lShoulder:D(-110),lElbow:D(-12),rShoulder:D(20),rElbow:D(20)},off:{x:34,y:0}});
POSES.s3=flurry(
  {t:0,  ang:{torso:D(-10),rShoulder:D(-30),rElbow:D(36),lShoulder:D(28),lElbow:D(24)},off:{x:-8,y:0}},
  {t:.2, ang:{torso:D(14), rShoulder:D(98), rElbow:D(2)}, off:{x:16,y:0}},
  {t:.45,ang:{torso:D(2),  lShoulder:D(-100),lElbow:D(2)},off:{x:24,y:0}},
  {t:.7, ang:{torso:D(20), rShoulder:D(108),rElbow:D(-8)},off:{x:32,y:0}},
  {t:1,  ang:{torso:D(34), rShoulder:D(126),rElbow:D(-20),lShoulder:D(-30),lElbow:D(-10),lHip:D(20),rHip:D(-20)},off:{x:46,y:0}});
POSES.win=[
  {t:0,ang:{torso:D(-6),lShoulder:D(-150),rShoulder:D(150),lElbow:D(10),rElbow:D(-10)},off:{x:0,y:-4}},
  {t:1,ang:{torso:D(-2),lShoulder:D(-160),rShoulder:D(160),lElbow:D(6), rElbow:D(-6)}, off:{x:0,y:-6}}];
POSES.ko=[
  {t:0,ang:{torso:D(-72),head:D(10),lHip:D(-32),rHip:D(-38),lKnee:D(48),rKnee:D(52),lShoulder:D(20),rShoulder:D(-30)},off:{x:-10,y:22}},
  {t:1,ang:{torso:D(-92),head:D(6), lHip:D(-42),rHip:D(-48),lKnee:D(58),rKnee:D(62),lShoulder:D(10),rShoulder:D(-20)},off:{x:-14,y:26}}];

// ---- looks: palette + proportions + props, per character id ----
const LOOKS={
  carl:{skin:'#d9a066',hair:'#241610',primary:'#3a3226',secondary:'#c0392b',
    limb:12,legLen:46,armLen:46,torsoLen:40,headR:13,shoulderW:24,hipW:16,earLen:0,
    props:['boxers','vest','bandages']},
  katia:{skin:'#c98a5e',hair:'#171310',primary:'#232f2b',secondary:'#48594f',
    limb:8,legLen:48,armLen:44,torsoLen:38,headR:10,shoulderW:18,hipW:13,earLen:0,
    props:['gear']},
  goblin:{skin:'#5f8a3f',hair:null,primary:'#4a3b28',secondary:'#7a6248',
    limb:8,legLen:34,armLen:34,torsoLen:28,headR:9,shoulderW:14,hipW:10,earLen:11,
    props:['rags','dagger']},
  hobgoblin:{skin:'#5c6b52',hair:null,primary:'#3d3428',secondary:'#6b5c46',
    limb:16,legLen:50,armLen:52,torsoLen:46,headR:15,shoulderW:30,hipW:20,earLen:8,
    props:['rags','club']},
  // Placeholder human-rig look for the Phase 1 caster opponent; her bespoke non-humanoid rig is Phase 3.
  donut:{skin:'#f2cfe0',hair:'#ffe7f5',primary:'#e8a0d8',secondary:'#b565a0',
    limb:9,legLen:44,armLen:42,torsoLen:36,headR:11,shoulderW:19,hipW:14,earLen:0,
    props:['gear']}};

// ---- forward kinematics ----
const Rig={
  bones:['hip','torso','neck','head','lShoulder','lElbow','lHand','rShoulder','rElbow','rHand','lHip','lKnee','lFoot','rHip','rKnee','rFoot'],
  poseFor(f){
    const st=f.state;
    if(st==='IDLE')return{key:'idle',t01:(f.f%60)/60};
    if(st==='DASH')return{key:'dash',t01:clamp(f.f/DASH_BACK.frames,0,1)};
    if(st==='BLOCK')return{key:'block',t01:clamp(f.f/10,0,1)};
    if(st==='BLOCKSTUN')return{key:'blockstun',t01:clamp(f.f/(f.stun||1),0,1)};
    if(st==='HITSTUN')return{key:'hit',t01:clamp(f.f/(f.stun||1),0,1)};
    if(st==='STUNNED')return{key:'stunned',t01:clamp(f.f/(f.stun||1),0,1)};
    if(st==='KNOCKDOWN')return f.f<30?{key:'knockdown',t01:clamp(f.f/30,0,1)}:{key:'getup',t01:clamp((f.f-30)/(KNOCKDOWN.frames-30),0,1)};
    if(st==='CHARGE')return{key:'heavyCharge',t01:clamp(f.f/((f.move&&f.move.charge)||1),0,1)};
    if(st==='ATTACK'&&f.move)return{key:f.moveName,t01:clamp(f.f/(f.move.startup+f.activeSpan()+f.move.recovery),0,1)};
    if(st==='WIN')return{key:'win',t01:clamp(f.f/30,0,1)};
    if(st==='KO')return{key:'ko',t01:clamp(f.f/20,0,1)};
    return{key:'idle',t01:0}},
  solve(look,poseKey,t01,face){
    const{ang,off}=samplePose(poseKey,t01),a=k=>ang[k]||0;
    const legU=look.legLen*.5,legL=look.legLen*.5,armU=look.armLen*.5,armL=look.armLen*.5;
    const hip={x:(off.x||0)*face,y:-look.legLen+(off.y||0)};
    const torsoA=a('torso');
    const torso={x:hip.x+face*Math.sin(torsoA)*look.torsoLen*.6,y:hip.y-Math.cos(torsoA)*look.torsoLen*.6};
    const neck={x:hip.x+face*Math.sin(torsoA)*look.torsoLen,y:hip.y-Math.cos(torsoA)*look.torsoLen};
    const headA=torsoA+a('head'),headNeckLen=look.headR*1.6;
    const head={x:neck.x+face*Math.sin(headA)*headNeckLen,y:neck.y-Math.cos(headA)*headNeckLen};
    const rShoulder={x:neck.x+face*look.shoulderW/2,y:neck.y+4},lShoulder={x:neck.x-face*look.shoulderW/2,y:neck.y+4};
    const rHip={x:hip.x+face*look.hipW/2,y:hip.y},lHip={x:hip.x-face*look.hipW/2,y:hip.y};
    const armFK=(sh,shA,elA)=>{const ex=sh.x+face*Math.sin(shA)*armU,ey=sh.y+Math.cos(shA)*armU;
      const tot=shA+elA;return{elbow:{x:ex,y:ey},hand:{x:ex+face*Math.sin(tot)*armL,y:ey+Math.cos(tot)*armL}}};
    const legFK=(hp,hA,kA)=>{const kx=hp.x+face*Math.sin(hA)*legU,ky=hp.y+Math.cos(hA)*legU;
      const tot=hA+kA;return{knee:{x:kx,y:ky},foot:{x:kx+face*Math.sin(tot)*legL,y:ky+Math.cos(tot)*legL}}};
    const rArm=armFK(rShoulder,a('rShoulder'),a('rElbow')),lArm=armFK(lShoulder,a('lShoulder'),a('lElbow'));
    const rLeg=legFK(rHip,a('rHip'),a('rKnee')),lLeg=legFK(lHip,a('lHip'),a('lKnee'));
    return{hip,torso,neck,head,
      rShoulder,rElbow:rArm.elbow,rHand:rArm.hand,lShoulder,lElbow:lArm.elbow,lHand:lArm.hand,
      rHip,rKnee:rLeg.knee,rFoot:rLeg.foot,lHip,lKnee:lLeg.knee,lFoot:lLeg.foot}},
  draw(c,F,cam,frame){
    const look=F.def.look,scale=F.def.scale||1,face=F.face;
    const{key,t01}=this.poseFor(F),j=this.solve(look,key,t01,face);
    const skinDark=shade(look.skin,-.35);
    c.save();c.translate(F.x,FLOOR);c.scale(scale,scale);
    const limb=(p,q,w)=>{c.lineCap='round';
      c.lineWidth=w+3;c.strokeStyle=skinDark;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
      c.lineWidth=w;c.strokeStyle=look.skin;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke()};
    // back limbs first (behind the torso), then torso/head, then front limbs, then props on top.
    limb(j.lHip,j.lKnee,look.limb);limb(j.lKnee,j.lFoot,look.limb);
    limb(j.lShoulder,j.lElbow,look.limb*.85);limb(j.lElbow,j.lHand,look.limb*.75);
    c.beginPath();c.moveTo(j.lHip.x,j.lHip.y);c.lineTo(j.lShoulder.x,j.lShoulder.y);
    c.lineTo(j.rShoulder.x,j.rShoulder.y);c.lineTo(j.rHip.x,j.rHip.y);c.closePath();
    c.fillStyle=look.skin;c.fill();c.lineWidth=2;c.strokeStyle=skinDark;c.stroke();
    c.fillStyle=look.skin;c.beginPath();c.arc(j.head.x,j.head.y,look.headR,0,Math.PI*2);c.fill();
    c.lineWidth=1.5;c.strokeStyle=skinDark;c.stroke();
    if(look.hair){c.fillStyle=look.hair;c.beginPath();
      c.arc(j.head.x,j.head.y-look.headR*.3,look.headR*1.05,Math.PI*1.05,Math.PI*1.95);c.fill()}
    if(look.earLen){c.fillStyle=look.skin;
      c.beginPath();c.moveTo(j.head.x-look.headR*.8,j.head.y-2);
      c.lineTo(j.head.x-look.headR*.8-look.earLen,j.head.y-look.earLen*.6);
      c.lineTo(j.head.x-look.headR*.5,j.head.y+4);c.closePath();c.fill();
      c.beginPath();c.moveTo(j.head.x+look.headR*.8,j.head.y-2);
      c.lineTo(j.head.x+look.headR*.8+look.earLen,j.head.y-look.earLen*.6);
      c.lineTo(j.head.x+look.headR*.5,j.head.y+4);c.closePath();c.fill()}
    c.fillStyle='#141414';c.beginPath();c.arc(j.head.x+face*look.headR*.35,j.head.y-1,1.6,0,Math.PI*2);c.fill();
    limb(j.rHip,j.rKnee,look.limb);limb(j.rKnee,j.rFoot,look.limb);
    limb(j.rShoulder,j.rElbow,look.limb*.85);limb(j.rElbow,j.rHand,look.limb*.75);
    for(const p of look.props||[]){
      if(p==='vest'||p==='rags'){
        c.fillStyle=look.primary;
        c.beginPath();c.moveTo(j.lShoulder.x,j.lShoulder.y-2);c.lineTo(j.lShoulder.x-6*face,j.lShoulder.y+8);
        c.lineTo(j.lHip.x-3*face,j.lHip.y+4);c.lineTo((j.lHip.x+j.hip.x)/2-3*face,j.lHip.y+2);
        c.lineTo(j.lShoulder.x+9*face,j.lShoulder.y+3);c.closePath();c.fill();
        c.beginPath();c.moveTo(j.rShoulder.x,j.rShoulder.y-2);c.lineTo(j.rShoulder.x+6*face,j.rShoulder.y+8);
        c.lineTo(j.rHip.x+3*face,j.rHip.y+4);c.lineTo((j.rHip.x+j.hip.x)/2+3*face,j.rHip.y+2);
        c.lineTo(j.rShoulder.x-9*face,j.rShoulder.y+3);c.closePath();c.fill();
        c.strokeStyle=shade(look.primary,-.4);c.lineWidth=1.5;c.stroke()}
      if(p==='boxers'){
        const hw=look.hipW/2+7;c.fillStyle=look.secondary;
        c.fillRect(j.hip.x-hw,j.hip.y-3,hw*2,15);
        c.fillStyle='#ff9fd0';
        for(const dx of[-hw*.45,0,hw*.45]){const hx=j.hip.x+dx,hy=j.hip.y+6,s=2.6;
          c.beginPath();c.moveTo(hx,hy+s*.3);
          c.bezierCurveTo(hx-s,hy-s*.6,hx-s*1.6,hy+s*.4,hx,hy+s*1.4);
          c.bezierCurveTo(hx+s*1.6,hy+s*.4,hx+s,hy-s*.6,hx,hy+s*.3);c.fill()}}
      if(p==='bandages'){c.strokeStyle='#e8ded0';c.lineWidth=3;
        for(const hand of[j.lHand,j.rHand]){c.beginPath();c.arc(hand.x,hand.y,5,0,Math.PI*2);c.stroke()}}
      if(p==='gear'){ // full-coverage practical outfit: torso fill + sleeve/pant overlays on the limbs
        c.fillStyle=look.primary;
        c.beginPath();c.moveTo(j.lHip.x,j.lHip.y);c.lineTo(j.lShoulder.x,j.lShoulder.y);
        c.lineTo(j.rShoulder.x,j.rShoulder.y);c.lineTo(j.rHip.x,j.rHip.y);c.closePath();c.fill();
        c.strokeStyle=shade(look.primary,-.4);c.lineWidth=2;c.stroke();
        const sleeve=(a,b,w)=>{c.lineCap='round';c.strokeStyle=look.primary;c.lineWidth=w;
          c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()};
        sleeve(j.lShoulder,j.lElbow,look.limb*.8);sleeve(j.rShoulder,j.rElbow,look.limb*.8);
        sleeve(j.lHip,j.lKnee,look.limb*.95);sleeve(j.rHip,j.rKnee,look.limb*.95);
        sleeve(j.lKnee,j.lFoot,look.limb*.85);sleeve(j.rKnee,j.rFoot,look.limb*.85);
        c.strokeStyle=look.secondary;c.lineWidth=3;
        c.beginPath();c.moveTo(j.lHip.x,j.lHip.y-4);c.lineTo(j.rHip.x,j.rHip.y-4);c.stroke()}
      if(p==='dagger'){const h=j.rHand;
        c.strokeStyle='#b8b8b8';c.lineWidth=3;c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.x+face*14,h.y-6);c.stroke();
        c.strokeStyle=look.secondary;c.lineWidth=4;c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.x-face*4,h.y+3);c.stroke()}
      if(p==='club'){const h=j.rHand;
        c.strokeStyle=look.secondary;c.lineWidth=10;c.lineCap='round';
        c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.x+face*10,h.y-30);c.stroke();
        c.fillStyle='#3a2f22';for(let i=0;i<3;i++){c.beginPath();
          c.arc(h.x+face*(6+i*2),h.y-8-i*8,3,0,Math.PI*2);c.fill()}}}
    c.restore()}};
for(const id in DEFS)if(LOOKS[id])DEFS[id].look=LOOKS[id];

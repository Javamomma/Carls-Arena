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
// Sorts each pose's keyframes once and caches the union of angle-key names on the array (as ._angKeys)
// so the per-frame sample doesn't allocate a Set/spread every call. Run once, after all POSES[...]
// assignments below, before any Rig.solve() call.
function preparePoses(){
  for(const k in POSES){
    const kf=POSES[k].slice().sort((x,y)=>x.t-y.t);
    const seen={};for(const f of kf)for(const kk in(f.ang||{}))seen[kk]=1;
    kf._angKeys=Object.keys(seen);POSES[k]=kf}}
function samplePose(poseKey,t01){
  const kf=POSES[poseKey];t01=clamp(t01,0,1);
  let i=0;while(i<kf.length-2&&kf[i+1].t<=t01)i++;
  const a=kf[i],b=kf[Math.min(i+1,kf.length-1)],span=(b.t-a.t)||1,lt=clamp((t01-a.t)/span,0,1);
  const aAng=a.ang||{},bAng=b.ang||{},ang={};
  for(const k of kf._angKeys){const av=aAng[k]||0,bv=bAng[k]||0;ang[k]=av+(bv-av)*lt}
  const aOff=a.off||{},bOff=b.off||{};
  const off={x:(aOff.x||0)+((bOff.x||0)-(aOff.x||0))*lt,y:(aOff.y||0)+((bOff.y||0)-(aOff.y||0))*lt};
  return{ang,off}}

// idle: a braced fighting stance (wide bent-knee base, lead/right shoulder forward and raised)
// instead of standing at attention, with a subtle breathing sway between the two keyframes. Hip and
// knee angles are opposite-signed and close in magnitude per leg (e.g. lHip -12/lKnee 10) so the
// lower leg's *total* angle from vertical stays small — the stance widens without the foot
// wandering off the floor line (still verified by the 'feet at y≈0' rig test).
POSES.idle=[
  {t:0,ang:{torso:D(6), lShoulder:D(6), rShoulder:D(10),lElbow:D(52),rElbow:D(95),
            lHip:D(-12),rHip:D(12),lKnee:D(10),rKnee:D(-6)},off:{x:0,y:0}},
  {t:1,ang:{torso:D(2), lShoulder:D(2), rShoulder:D(14),lElbow:D(56),rElbow:D(90),
            lHip:D(-14),rHip:D(14),lKnee:D(12),rKnee:D(-8)},off:{x:0,y:0}}];
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
  const peakSh=o.peakSh!==undefined?o.peakSh:80,peakEl=o.peakEl!==undefined?o.peakEl:5,peakOffX=o.peakOffX!==undefined?o.peakOffX:6;
  const torsoPeak=o.torsoPeak!==undefined?o.torsoPeak:6;
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
// Medium: a deep forward lunge, not just an arm reach — front leg bends under the driving weight,
// rear leg kicks out straight behind, torso commits hard forward. Silhouette (wide low stance, big
// torso lean) reads nothing like light1's near-upright jab or heavy's vertical wind-up-then-smash.
POSES.medium=[
  {t:0, ang:{torso:D(-10),rShoulder:D(-10),rElbow:D(15),lShoulder:D(10),lElbow:D(15),rHip:D(-14),lHip:D(10),rKnee:D(20),lKnee:D(-6)},off:{x:-6,y:0}},
  {t:.5,ang:{torso:D(34), rShoulder:D(95), rElbow:D(-4),lShoulder:D(-14),lElbow:D(10),rHip:D(34), lHip:D(-46),rKnee:D(-40),lKnee:D(6)},off:{x:30,y:6}},
  {t:1, ang:{torso:D(12), rShoulder:D(40), rElbow:D(15),lShoulder:D(0),  lElbow:D(15),rHip:D(10), lHip:D(-10)},off:{x:8,y:0}}];
// Heavy wind-up: fist raised straight above the head, weight shifted back (matches poseFor's
// CHARGE->heavyCharge mapping, so this is what's held while the player charges the swing).
// Fix round 2: peak rShoulder pulled in from 172 to 134 (was swinging the arm almost straight up,
// which at the rescaled rig height plus the S3 cinematic punch-in zoom put the raised hand above the
// visible canvas — see the 'tallest pose stays under the HUD at max zoom' test). Still a clear
// overhead wind-up, just short of vertical.
POSES.heavyCharge=[
  {t:0,ang:{torso:D(-14),rShoulder:D(94),rElbow:D(-8),lShoulder:D(10),lElbow:D(20),rHip:D(-6),lHip:D(6)},off:{x:-4,y:2}},
  {t:1,ang:{torso:D(-20),rShoulder:D(108),rElbow:D(-4),lShoulder:D(6), lElbow:D(16),rHip:D(-10),lHip:D(10)},off:{x:-8,y:4}}];
// Heavy release: from overhead down through a forward-and-down smash, driving into a crouch on
// impact (front knee bends, hip drops) — a vertical arc, unlike medium's horizontal lunge.
POSES.heavy=[
  {t:0, ang:{torso:D(-18),rShoulder:D(175),rElbow:D(-4),rHip:D(-8), lHip:D(8)},off:{x:-8,y:4}},
  {t:.5,ang:{torso:D(26), rShoulder:D(48), rElbow:D(18),rHip:D(22), lHip:D(-8),rKnee:D(-14)},off:{x:16,y:9}},
  {t:1, ang:{torso:D(10), rShoulder:D(75), rElbow:D(30),rHip:D(8),  lHip:D(-4)},off:{x:6,y:2}}];
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
preparePoses();

// ---- looks: palette + proportions + props, per character id ----
// Scaled up from Phase 2's original proportions (legLen most of all — the old legLen:limb ratio was
// close to 1:1, reading as stubby blobs rather than legs) so a standing Carl is ~190 world px tall
// at zoom 1 and fills the rendition's share of frame height once paired with Camera's lower anchor
// (see 65_stage.js). Every look grew, not just Carl, keeping each character's relative proportions
// (thin trickster/caster vs. bulky brawler/tank) the same as before.
const LOOKS={
  // Muscular build: shoulders wide relative to limb thickness (~2.2x), waist pinched in well below
  // both shoulder and hip width for a V-taper, thick rounded limbs.
  // Note: G.debugPose (used for every docs/shots/p2-<pose>.png except p2-goblin/p2-card) never
  // calls G.tick(), so G.cam.zoom sits at its initial 1.0 for those shots — proportions below target
  // ~55-65% of frame height at zoom 1.0 exactly, not at the fight camera's usual ~1.1-1.35.
  carl:{skin:'#d9a066',hair:'#241610',primary:'#3a3226',secondary:'#c0392b',
    limb:20,legLen:114,armLen:101,torsoLen:91,headR:25,shoulderW:83,hipW:53,waistW:40,earLen:0,bareFeet:true,
    props:['boxers','vest','bandages']},
  katia:{skin:'#c98a5e',hair:'#171310',primary:'#232f2b',secondary:'#48594f',
    limb:12,legLen:117,armLen:91,torsoLen:78,headR:20,shoulderW:38,hipW:28,earLen:0,
    props:['gear']},
  goblin:{skin:'#5f8a3f',hair:null,primary:'#4a3b28',secondary:'#7a6248',
    limb:13,legLen:82,armLen:72,torsoLen:58,headR:18,shoulderW:33,hipW:21,earLen:29,
    props:['rags','dagger']},
  // Fix round 2: trimmed back from the round-1 numbers, which combined with def.scale=1.2 (a
  // second, canvas-level multiplier on top of these) made the hobgoblin's overhead reach the worst
  // case in the whole roster by a wide margin at max zoom — see EDGE_PAD and the HUD-safety test.
  hobgoblin:{skin:'#5c6b52',hair:null,primary:'#3d3428',secondary:'#6b5c46',
    limb:23,legLen:106,armLen:99,torsoLen:86,headR:25,shoulderW:65,hipW:40,earLen:18,
    props:['rags','club']},
  // PLACEHOLDER (Task 3.5 gives Donut her own RigQuad cat rig): human-rig look for the Phase 1
  // caster opponent, now with rig:'human' set explicitly to mark it as the stand-in it is — her
  // def (DEFS.donut) already carries rig:'quad', but Rig.solve dispatches on look.rig, not def.rig,
  // so this is what actually renders her today.
  donut:{skin:'#f2cfe0',hair:'#ffe7f5',primary:'#e8a0d8',secondary:'#b565a0',
    limb:14,legLen:107,armLen:88,torsoLen:74,headR:23,shoulderW:39,hipW:29,earLen:0,rig:'human',
    props:['gear']},
  // PLACEHOLDER (Task 3.4 gives Mongo his own RigBig brute rig): a scaled-down copy of the
  // hobgoblin's proportions (def.scale is already 1.25 — full hobgoblin proportions on top of that
  // push the tallest pose's topmost joint above the HUD at max zoom, see the "tallest pose stays
  // under the HUD" test) with Mongo's own palette and rig:'human' set explicitly.
  mongo:{skin:'#7a6a52',hair:null,primary:'#3a2f1f',secondary:'#8a6d3b',
    limb:20,legLen:90,armLen:84,torsoLen:73,headR:21,shoulderW:55,hipW:34,earLen:0,rig:'human',
    props:['club']},
  // PLACEHOLDER (Task 3.4/3.5): a copy of Katia's lean proportions with a bone-white palette and
  // rig:'human' set explicitly.
  skeleton:{skin:'#d8d0c0',hair:null,primary:'#2a2a2a',secondary:'#555555',
    limb:12,legLen:117,armLen:91,torsoLen:78,headR:20,shoulderW:38,hipW:28,earLen:0,rig:'human',
    props:['rags','dagger']},
  // PLACEHOLDER (Task 3.4/3.5): a copy of Donut's proportions with a mystic-purple palette and
  // rig:'human' set explicitly.
  shaman:{skin:'#8a6aa8',hair:'#2a1a3a',primary:'#4a2f6a',secondary:'#8a4fae',
    limb:14,legLen:107,armLen:88,torsoLen:74,headR:23,shoulderW:39,hipW:29,earLen:0,rig:'human',
    props:['gear']},
  // PLACEHOLDER (Task 3.5 gives Grub his own RigQuad rig): a copy of the goblin's small proportions
  // with a grub-green palette and rig:'human' set explicitly.
  grub:{skin:'#8a9a4f',hair:null,primary:'#5a6a30',secondary:'#3a4a20',
    limb:13,legLen:82,armLen:72,torsoLen:58,headR:18,shoulderW:33,hipW:21,earLen:0,rig:'human',
    props:[]},
  // PLACEHOLDER (Task 3.4 gives Grull his own RigBig rig): a scaled-down copy of the hobgoblin's
  // proportions (def.scale is 1.3, the biggest in the roster — see the mongo comment above for why
  // this can't just reuse the hobgoblin's own numbers) with a boss-red palette and rig:'human' set
  // explicitly.
  grull:{skin:'#5c2f2f',hair:null,primary:'#2f1a1a',secondary:'#8a3a3a',
    limb:18,legLen:85,armLen:79,torsoLen:69,headR:20,shoulderW:52,hipW:32,earLen:0,rig:'human',
    props:['club']},
  // PLACEHOLDER (Task 3.5 gives Mother Rat her own RigQuad rig): the same scaled-down proportions
  // as Grull (also def.scale:1.3) with a rat-fur palette (and rat ears) and rig:'human' set
  // explicitly.
  mother_rat:{skin:'#4a3040',hair:'#2a1a24',primary:'#3a2030',secondary:'#6a4058',
    limb:18,legLen:85,armLen:79,torsoLen:69,headR:20,shoulderW:52,hipW:32,earLen:22,rig:'human',
    props:[]}};

// Resolves a def's look, falling back to LOOKS.carl (once, with a console.warn) for a Phase-3-added
// def that ships without one, instead of every reader (Rig.draw, Render.overlayY/shadow) crashing on
// an unguarded F.def.look dereference. Shared across 68_rig.js/70_render.js via plain global scope.
let _warnedNoLook=false;
function lookFor(def){
  if(def.look)return def.look;
  if(!_warnedNoLook){_warnedNoLook=true;
    console.warn('Rig: def "'+(def.id||'?')+'" has no .look; falling back to LOOKS.carl')}
  return LOOKS.carl}

// ---- forward kinematics ----
const Rig={
  bones:['hip','torso','neck','head','lShoulder','lElbow','lHand','rShoulder','rElbow','rHand','lHip','lKnee','lFoot','rHip','rKnee','rFoot'],
  poseFor(f){
    const st=f.state;
    // A fighter has no dedicated locomotion state; the only x movement while IDLE comes from
    // Fight.separate()'s overlap push, read here off Fighter.dx (last tick's raw x delta) so it
    // still reads as a walk cycle instead of the idle sway while it's happening.
    if(st==='IDLE')return Math.abs(f.dx)>0.3?{key:'walk',t01:(f.f%24)/24}:{key:'idle',t01:(f.f%60)/60};
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
    const waist={x:hip.x+face*Math.sin(torsoA)*look.torsoLen*.42,y:hip.y-Math.cos(torsoA)*look.torsoLen*.42};
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
    return{hip,torso,waist,neck,head,
      rShoulder,rElbow:rArm.elbow,rHand:rArm.hand,lShoulder,lElbow:lArm.elbow,lHand:lArm.hand,
      rHip,rKnee:rLeg.knee,rFoot:rLeg.foot,lHip,lKnee:lLeg.knee,lFoot:lLeg.foot}},
  draw(c,F,cam,frame){
    const look=lookFor(F.def),scale=F.def.scale||1,face=F.face;
    const{key,t01}=this.poseFor(F),j=this.solve(look,key,t01,face);
    const skinDark=shade(look.skin,-.35);
    c.save();c.translate(F.x,FLOOR);c.scale(scale,scale);
    const limb=(p,q,w)=>{c.lineCap='round';
      c.lineWidth=w+3;c.strokeStyle=skinDark;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
      c.lineWidth=w;c.strokeStyle=look.skin;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke()};
    // A small rounded rect at each ankle joint so legs end in feet instead of a bare round line cap:
    // bare skin-toned for a barefoot look (Carl), a dark boot otherwise. Nudged slightly forward of
    // the ankle (in the facing direction) for a heel-planted, toe-forward read.
    const foot=(p)=>{const w=look.limb*1.05,h=look.limb*.62,fx=p.x+face*w*.3,fy=p.y+h*.22;
      const bare=!!look.bareFeet;c.fillStyle=bare?look.skin:'#241a12';c.strokeStyle=bare?skinDark:'#120c08';
      c.lineWidth=1.3;c.beginPath();
      if(c.roundRect)c.roundRect(fx-w/2,fy-h/2,w,h,Math.min(w,h)*.45);else c.rect(fx-w/2,fy-h/2,w,h);
      c.fill();c.stroke()};
    // back limbs first (behind the torso), then torso/head, then front limbs, then props on top.
    // Thighs/upper arms noticeably thicker than shins/forearms, per limb.
    limb(j.lHip,j.lKnee,look.limb);limb(j.lKnee,j.lFoot,look.limb*.82);foot(j.lFoot);
    limb(j.lShoulder,j.lElbow,look.limb*.85);limb(j.lElbow,j.lHand,look.limb*.68);
    // Torso as a waist-tapered hexagon (hip -> waist -> shoulder, mirrored) for a real V-taper build,
    // plus a chest highlight and ab-line shading for definition. Shading uses whatever the base torso
    // fill color is, so it also enhances a bare-chested look like Carl's open vest.
    const waistW=look.waistW!==undefined?look.waistW:(look.hipW+look.shoulderW)/2*.8;
    const lWaist={x:j.waist.x-face*waistW/2,y:j.waist.y},rWaist={x:j.waist.x+face*waistW/2,y:j.waist.y};
    c.beginPath();c.moveTo(j.lHip.x,j.lHip.y);c.lineTo(lWaist.x,lWaist.y);c.lineTo(j.lShoulder.x,j.lShoulder.y);
    c.lineTo(j.rShoulder.x,j.rShoulder.y);c.lineTo(rWaist.x,rWaist.y);c.lineTo(j.rHip.x,j.rHip.y);c.closePath();
    c.fillStyle=look.skin;c.fill();c.lineWidth=2;c.strokeStyle=skinDark;c.stroke();
    c.fillStyle=shade(look.skin,.2);c.beginPath();
    c.ellipse((j.lShoulder.x+j.rShoulder.x)/2,(j.lShoulder.y+j.rShoulder.y)/2+look.torsoLen*.14,
      look.shoulderW*.3,look.torsoLen*.15,0,0,Math.PI*2);c.fill();
    c.strokeStyle=shade(look.skin,-.3);c.lineWidth=1.5;
    c.beginPath();c.moveTo(j.waist.x-2,j.waist.y-2);c.lineTo(j.torso.x-2,j.torso.y+2);c.stroke();
    c.beginPath();c.moveTo(j.waist.x+2,j.waist.y-2);c.lineTo(j.torso.x+2,j.torso.y+2);c.stroke();
    c.fillStyle=look.skin;c.beginPath();c.arc(j.head.x,j.head.y,look.headR,0,Math.PI*2);c.fill();
    c.lineWidth=1.5;c.strokeStyle=skinDark;c.stroke();
    if(look.hair){c.fillStyle=look.hair;c.beginPath();
      c.arc(j.head.x,j.head.y-look.headR*.3,look.headR*1.05,Math.PI*1.05,Math.PI*1.95);c.fill()}
    if(look.earLen){ // long pointed triangles angled up-back, outlined so they read against the head fill
      const el=look.earLen;c.fillStyle=look.skin;c.strokeStyle=skinDark;c.lineWidth=1.5;
      c.beginPath();c.moveTo(j.head.x-look.headR*.7,j.head.y-look.headR*.15);
      c.lineTo(j.head.x-look.headR*.9-el*.9,j.head.y-el*.85);
      c.lineTo(j.head.x-look.headR*.3,j.head.y+look.headR*.3);c.closePath();c.fill();c.stroke();
      c.beginPath();c.moveTo(j.head.x+look.headR*.7,j.head.y-look.headR*.15);
      c.lineTo(j.head.x+look.headR*.9+el*.9,j.head.y-el*.85);
      c.lineTo(j.head.x+look.headR*.3,j.head.y+look.headR*.3);c.closePath();c.fill();c.stroke()}
    c.fillStyle='#141414';c.beginPath();c.arc(j.head.x+face*look.headR*.35,j.head.y-1,1.6,0,Math.PI*2);c.fill();
    limb(j.rHip,j.rKnee,look.limb);limb(j.rKnee,j.rFoot,look.limb*.82);foot(j.rFoot);
    limb(j.rShoulder,j.rElbow,look.limb*.85);limb(j.rElbow,j.rHand,look.limb*.68);
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
      if(p==='dagger'){ // a filled blade (not a thin stroke) with a crossguard and grip, ~45% of arm length
        const h=j.rHand,len=look.armLen*.46,ux=face,uy=-.32,n=Math.hypot(ux,uy),dx=ux/n,dy=uy/n,px=-dy,py=dx;
        const tipX=h.x+dx*len,tipY=h.y+dy*len,baseX=h.x+dx*3,baseY=h.y+dy*3,w=4.2;
        c.fillStyle='#e4e4e4';
        c.beginPath();c.moveTo(baseX+px*w,baseY+py*w);c.lineTo(tipX,tipY);c.lineTo(baseX-px*w,baseY-py*w);c.closePath();c.fill();
        c.strokeStyle='#5a5a5a';c.lineWidth=1.3;c.stroke();
        c.strokeStyle='#fbfbfb';c.lineWidth=1.2;
        c.beginPath();c.moveTo(baseX+dx*2,baseY+dy*2);c.lineTo(tipX-dx*2,tipY-dy*2);c.stroke();
        c.strokeStyle=look.secondary;c.lineWidth=3.6;
        c.beginPath();c.moveTo(baseX+px*6,baseY+py*6);c.lineTo(baseX-px*6,baseY-py*6);c.stroke();
        c.strokeStyle='#3a2f22';c.lineWidth=4;c.lineCap='round';
        c.beginPath();c.moveTo(h.x,h.y);c.lineTo(baseX,baseY);c.stroke()}
      if(p==='club'){const h=j.rHand;
        c.strokeStyle=look.secondary;c.lineWidth=10;c.lineCap='round';
        c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.x+face*10,h.y-30);c.stroke();
        c.fillStyle='#3a2f22';for(let i=0;i<3;i++){c.beginPath();
          c.arc(h.x+face*(6+i*2),h.y-8-i*8,3,0,Math.PI*2);c.fill()}}}
    c.restore()},
  // HUD portrait: a small front-facing head-and-shoulders bust built straight from the look's
  // palette/proportions (not a crop of the side-view fight rig, which has no front-facing pose).
  // Cached on the look object itself, so it's built once per character regardless of how many
  // fighters (or hp-scaled encounter clones sharing the same look) use it.
  portrait(look){
    if(look._portrait)return look._portrait;
    const S=56,cnv=document.createElement('canvas');cnv.width=S;cnv.height=S;
    const c=cnv.getContext('2d'),skinDark=shade(look.skin,-.35);
    const cx=S/2,headR=Math.min(16,look.headR*1.3),headY=S*0.42,shW=Math.min(S*0.92,look.shoulderW*1.7),shY=S*0.64;
    if(look.earLen){ // drawn behind the head so the head fill covers each ear's base
      const el=look.earLen*.6;c.fillStyle=look.skin;c.strokeStyle=skinDark;c.lineWidth=1.2;
      c.beginPath();c.moveTo(cx-headR*.7,headY-headR*.1);c.lineTo(cx-headR*.9-el*.7,headY-el*.6);c.lineTo(cx-headR*.2,headY+headR*.3);c.closePath();c.fill();c.stroke();
      c.beginPath();c.moveTo(cx+headR*.7,headY-headR*.1);c.lineTo(cx+headR*.9+el*.7,headY-el*.6);c.lineTo(cx+headR*.2,headY+headR*.3);c.closePath();c.fill();c.stroke()}
    c.fillStyle=look.primary;
    c.beginPath();c.moveTo(cx-shW/2,S+4);c.lineTo(cx-shW*.32,shY);c.lineTo(cx+shW*.32,shY);c.lineTo(cx+shW/2,S+4);c.closePath();c.fill();
    c.strokeStyle=shade(look.primary,-.4);c.lineWidth=1.5;c.stroke();
    c.fillStyle=look.skin;c.beginPath();c.arc(cx,headY,headR,0,Math.PI*2);c.fill();
    c.lineWidth=1.5;c.strokeStyle=skinDark;c.stroke();
    if(look.hair){c.fillStyle=look.hair;c.beginPath();c.arc(cx,headY-headR*.3,headR*1.05,Math.PI*1.05,Math.PI*1.95);c.fill()}
    c.fillStyle='#141414';
    c.beginPath();c.arc(cx-headR*.35,headY-1,1.4,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(cx+headR*.35,headY-1,1.4,0,Math.PI*2);c.fill();
    look._portrait=cnv;return cnv}};
for(const id in DEFS)if(LOOKS[id])DEFS[id].look=LOOKS[id];

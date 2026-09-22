// Stylized vector-rig renderer. Pure presentation: reads Fight/Fighter state, never writes it.
// Forward-kinematics bone rig driven by keyframed joint-angle poses; per-character "looks" supply
// palette + proportions + props so the same pose data reads as Carl, Katia, a goblin, or a hobgoblin.
const D=deg=>deg*Math.PI/180;
function shade(hex,amt){ // amt<0 darkens, amt>0 lightens, both toward 0/255
  const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const adj=v=>Math.max(0,Math.min(255,Math.round(amt<0?v*(1+amt):v+(255-v)*amt)));
  return'#'+[adj(r),adj(g),adj(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}

// ---- pose table: POSES[key] = [{t:0..1, ang:{...}, off:{x,y}}, ...], tweened linearly by t01 ----
// Shared by both rig kinds: POSES for the human bone set (Rig.solve's 'human' branch), POSES_QUAD
// for the quadruped bone set (the 'quad' branch, see below). preparePoses/samplePose take the table
// as a parameter so the same prep/sample code serves both without duplication.
const POSES={};
const POSES_QUAD={};
// Sorts each pose's keyframes once and caches the union of angle-key names on the array (as ._angKeys)
// so the per-frame sample doesn't allocate a Set/spread every call. Run once per table, after all of
// that table's assignments below, before any Rig.solve() call against it.
function preparePoses(table){
  for(const k in table){
    const kf=table[k].slice().sort((x,y)=>x.t-y.t);
    const seen={};for(const f of kf)for(const kk in(f.ang||{}))seen[kk]=1;
    kf._angKeys=Object.keys(seen);table[k]=kf}}
function samplePose(table,poseKey,t01){
  const kf=table[poseKey];t01=clamp(t01,0,1);
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
// Fix round 2 (controller review, Task 3.5 fix round 2): t:0's rShoulder pulled in from 175 to 128,
// the same move heavyCharge's own comment above already describes (172->108) — 'heavy' itself was
// just never checked against the old HUD test (which only sampled 'heavyCharge'/'s3'), so this near-
// vertical raise went untrimmed until the "every pose of every look" test (90_tests.js) started
// walking it too and found Carl's own hand above HUD_LINE at his ordinary (non-cinematic) zoom cap —
// see that test's pinning check.
// Task 3.6 heavy-pose check: the "pin ordinary-pair caps" commit (caab728) trimmed t:0's rShoulder
// further still, to 96 — past the point this comment's own "128, still a clear overhead wind-up"
// claim covered, and without updating this comment. At 96, docs/shots/p2-heavy.png read as a level
// forward reach nearly identical to light3's own peak shoulder angle (95, see POSES.light3), not an
// overhead wind-up at all. Raised to 118 as an interim fix — the largest value that kept 'carl/
// hobgoblin/katia/donut/goblin pairings pin the zoom cap at exactly 1.12/1.28' green under the OLD
// per-fight worst-case cap (90_tests.js) — but the final review found even that read as barely
// distinct from light3 (11px higher, same forward-lean silhouette): the real problem was structural,
// not artistic — a fixed per-fight cap taxes the WHOLE fight by whatever pose is tallest anywhere in
// it, so one tall pose (even one nobody's looking at when heavy actually swings) permanently rations
// every other pose's headroom too.
// Fix-wave item 4 fixes the structural problem (G's zoom cap is now computed per-frame off the pose
// actually on screen — Rig.topAt/G.topNow — not a fight-wide worst case), which frees this pose to go
// back to its original, real-overhead value: rShoulder 175 at t:0, a genuine near-vertical cock
// clearly distinct from every other pose's reach. The per-frame cap means heavy's own tall wind-up
// only ever costs the frames heavy itself is on screen, not every frame of every fight it can occur
// in — see the 'every pose stays under the HUD at its own per-frame cap' test, the pinned test (still
// checks the per-fight UPPER BOUND, now correctly unaffected by any single pose), and
// docs/shots/p2-heavy.png.
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
preparePoses(POSES);

// ---- quadruped pose table: same 22 keys, different bone set (hip/spine/chest/neck/head/tail1/tail2
// plus four two-segment legs fl/fr/bl/br). Body chain (hip->spine->chest->neck->head) runs mostly
// horizontal — spine/chest angles pitch the back, neck/head angles lean the head up off the front of
// it — instead of the human rig's vertical hip->waist->torso->neck chain. Leg angles (flU/flL etc.)
// use the same "0 = hangs straight down from the attach point" convention as the human rig's
// shoulder/elbow and hip/knee so a leg with opposite-signed upper/lower angles still plants near the
// floor line, the same trick the human idle pose's comment calls out for keeping feet at y≈0.
const QUAD_BONES=['hip','spine','chest','neck','head','tail1','tail2',
  'fl1','fl2','fr1','fr2','bl1','bl2','br1','br2'];
// tail1/tail2 raised well past horizontal (40deg+) so the tail reads as a distinct raised curl behind
// the body instead of a fifth "leg" laid flat alongside the real four — see drawQuad's tailTint note;
// donut/mother_rat (no tailTint) draw it in their own body color, so silhouette (angle), not color,
// is what has to separate it from the legs.
POSES_QUAD.idle=[
  {t:0,ang:{spine:D(1),chest:D(1),neck:D(34),head:D(-4),tail1:D(42),tail2:D(-24),
            flU:D(-4),flL:D(5),frU:D(3),frL:D(-3),blU:D(-6),blL:D(7),brU:D(5),brL:D(-5)},off:{x:0,y:0}},
  {t:1,ang:{spine:D(2),chest:D(1),neck:D(37),head:D(-2),tail1:D(50),tail2:D(-32),
            flU:D(-2),flL:D(3),frU:D(4),frL:D(-4),blU:D(-4),blL:D(5),brU:D(6),brL:D(-6)},off:{x:0,y:0}}];
// No dedicated locomotion state (Phase 3 ruling #1, same as the human rig): Rig.poseFor drives this
// from Fighter.dx like it does 'walk' for humans. A simple diagonal trot — front-left/back-right
// paired against front-right/back-left — reads clearly as a four-legged gait at this rig's scale.
POSES_QUAD.walk=[
  {t:0, ang:{spine:D(2),chest:D(3),neck:D(32),tail1:D(10),tail2:D(-6),
             flU:D(-22),flL:D(20),frU:D(20),frL:D(-16),blU:D(20),blL:D(-16),brU:D(-22),brL:D(20)},off:{x:0,y:0}},
  {t:.5,ang:{spine:D(4),chest:D(3),neck:D(34),tail1:D(14),tail2:D(-10),
             flU:D(20),flL:D(-16),frU:D(-22),frL:D(20),blU:D(-22),blL:D(20),brU:D(20),brL:D(-16)},off:{x:0,y:0}},
  {t:1, ang:{spine:D(2),chest:D(3),neck:D(32),tail1:D(10),tail2:D(-6),
             flU:D(-22),flL:D(20),frU:D(20),frL:D(-16),blU:D(20),blL:D(-16),brU:D(-22),brL:D(20)},off:{x:0,y:0}}];
POSES_QUAD.dash=[
  {t:0,ang:{spine:D(-6),chest:D(-4),neck:D(28),tail1:D(4),tail2:D(-2),
            flU:D(24),flL:D(-14),frU:D(30),frL:D(-18),blU:D(-30),blL:D(24),brU:D(-24),brL:D(20)},off:{x:0,y:-4}},
  {t:1,ang:{spine:D(-10),chest:D(-8),neck:D(24),tail1:D(2),tail2:D(0),
            flU:D(32),flL:D(-18),frU:D(38),frL:D(-22),blU:D(-38),blL:D(30),brU:D(-30),brL:D(26)},off:{x:-14,y:-3}}];
// Front-paw swipe: the quad equivalent of the human jab() helper. side is 'fl' or 'fr' (which front
// leg leads); the opposite front leg stays a light guard bend so the swipe reads against a grounded
// tripod, not a rig floating on one leg.
function pawSwipe(side,o={}){
  const other=side==='fl'?'fr':'fl',U=side+'U',L=side+'L',oU=other+'U',oL=other+'L';
  const startU=o.startU!==undefined?o.startU:-8, startL=o.startL!==undefined?o.startL:12;
  const peakU=o.peakU!==undefined?o.peakU:72, peakL=o.peakL!==undefined?o.peakL:-8, peakOffX=o.peakOffX!==undefined?o.peakOffX:10;
  const spinePeak=o.spinePeak!==undefined?o.spinePeak:6;
  const guard={[oU]:D(4),[oL]:D(6)};
  return[
    {t:0, ang:Object.assign({spine:D(3),chest:D(4),neck:D(34),tail1:D(38),tail2:D(-22)},{[U]:D(startU)},{[L]:D(startL)},guard),off:{x:0,y:0}},
    {t:.4,ang:Object.assign({spine:D(spinePeak),chest:D(spinePeak+2),neck:D(30),tail1:D(30),tail2:D(-14)},{[U]:D(peakU)},{[L]:D(peakL)},guard),off:{x:peakOffX,y:0}},
    {t:1, ang:Object.assign({spine:D(3),chest:D(4),neck:D(34),tail1:D(38),tail2:D(-22)},{[U]:D(startU+4)},{[L]:D(startL)},guard),off:{x:0,y:0}}]}
POSES_QUAD.light1=pawSwipe('fl',{});
POSES_QUAD.light2=pawSwipe('fr',{peakU:80,peakOffX:14});
POSES_QUAD.light3=pawSwipe('fl',{peakU:86,peakOffX:17,spinePeak:9});
POSES_QUAD.light4=pawSwipe('fr',{peakU:92,peakOffX:20,spinePeak:11});
POSES_QUAD.light5=pawSwipe('fl',{peakU:104,peakL:-20,peakOffX:28,spinePeak:16,startL:18});
// Medium: a full pounce — hips coil low then drive the whole body forward through the air, front
// paws reaching to land the hit, tail streaming back for a counterweight. Silhouette (deep spine
// dip -> long airborne reach) reads nothing like light1's small paw flick or heavy's rear-up-and-slam.
POSES_QUAD.medium=[
  {t:0, ang:{spine:D(-14),chest:D(-10),neck:D(30),tail1:D(-6),tail2:D(4),
             flU:D(-10),flL:D(14),frU:D(-8),frL:D(12),blU:D(30),blL:D(-26),brU:D(28),brL:D(-24)},off:{x:-8,y:6}},
  {t:.5,ang:{spine:D(20),chest:D(24),neck:D(44),tail1:D(20),tail2:D(-16),
             flU:D(46),flL:D(-30),frU:D(50),frL:D(-34),blU:D(-30),blL:D(18),brU:D(-34),brL:D(20)},off:{x:34,y:-10}},
  {t:1, ang:{spine:D(6),chest:D(4),neck:D(32),tail1:D(6),tail2:D(-2),
             flU:D(6),flL:D(4),frU:D(4),frL:D(6),blU:D(6),blL:D(-4),brU:D(4),brL:D(-2)},off:{x:14,y:0}}];
// Heavy wind-up: the rear-up half — weight shifts back onto the haunches, front paws start lifting
// off the ground (matches poseFor's CHARGE->heavyCharge mapping, held while the player charges).
// Fix round 1: the original 20/26/20 -> 30/38/14 spine/chest/neck angles reared up hard enough that
// the head cleared screen y=104 for the human/donut/grub scale but not for mother_rat's boss
// scale (1.3) — see the "tallest pose stays under the HUD at max zoom" test, which caught it at
// mother_rat/heavyCharge/t0. solveQuad's body chain accumulates pitch (chestA=spineA+a('chest'),
// neckA=chestA+a('neck')), so cutting these to roughly half still reads as a clear rear-up while
// keeping every look's head under the HUD at the S3 cinematic's 1.28 zoom.
POSES_QUAD.heavyCharge=[
  {t:0,ang:{spine:D(6),chest:D(10),neck:D(6),tail1:D(-10),tail2:D(8),
            flU:D(-30),flL:D(24),frU:D(-26),frL:D(22),blU:D(14),blL:D(-10),brU:D(16),brL:D(-12)},off:{x:-6,y:4}},
  {t:1,ang:{spine:D(14),chest:D(20),neck:D(10),tail1:D(-16),tail2:D(12),
            flU:D(-44),flL:D(32),frU:D(-40),frL:D(30),blU:D(20),blL:D(-14),brU:D(22),brL:D(-16)},off:{x:-10,y:8}}];
// Heavy release: from the reared-up wind-up down through a two-pawed slam — front paws drive down
// and forward into the floor, hindquarters follow through, a vertical-then-forward arc unlike
// medium's horizontal pounce.
POSES_QUAD.heavy=[
  {t:0, ang:{spine:D(18),chest:D(26),neck:D(12),tail1:D(-18),tail2:D(14),
             flU:D(-48),flL:D(34),frU:D(-44),frL:D(32),blU:D(22),blL:D(-16),brU:D(24),brL:D(-18)},off:{x:-10,y:8}},
  {t:.5,ang:{spine:D(-18),chest:D(-22),neck:D(40),tail1:D(10),tail2:D(-10),
             flU:D(36),flL:D(-26),frU:D(32),frL:D(-22),blU:D(-14),blL:D(10),brU:D(-10),brL:D(6)},off:{x:22,y:10}},
  {t:1, ang:{spine:D(2),chest:D(2),neck:D(32),tail1:D(4),tail2:D(-2),
             flU:D(8),flL:D(-4),frU:D(6),frL:D(-2),blU:D(0),blL:D(2),brU:D(2),brL:D(0)},off:{x:10,y:2}}];
POSES_QUAD.block=[
  {t:0,ang:{spine:D(-6),chest:D(-8),neck:D(10),head:D(-18),tail1:D(2),tail2:D(0),
            flU:D(-24),flL:D(30),frU:D(-22),frL:D(28),blU:D(24),blL:D(-26),brU:D(22),brL:D(-24)},off:{x:2,y:14}},
  {t:1,ang:{spine:D(-8),chest:D(-10),neck:D(8),head:D(-22),tail1:D(0),tail2:D(2),
            flU:D(-26),flL:D(32),frU:D(-24),frL:D(30),blU:D(26),blL:D(-28),brU:D(24),brL:D(-26)},off:{x:2,y:16}}];
POSES_QUAD.blockstun=[
  {t:0,ang:{spine:D(-16),chest:D(-14),neck:D(4),head:D(-24),tail1:D(-4),tail2:D(4)},off:{x:-6,y:14}},
  {t:1,ang:{spine:D(-6), chest:D(-8), neck:D(10),head:D(-18),tail1:D(2), tail2:D(0)},off:{x:2,y:14}}];
POSES_QUAD.hit=[
  {t:0,ang:{spine:D(-24),chest:D(-20),neck:D(-4),head:D(-30),tail1:D(-14),tail2:D(10),
            flU:D(-14),flL:D(18),frU:D(-10),frL:D(14)},off:{x:-12,y:6}},
  {t:1,ang:{spine:D(-4), chest:D(-2), neck:D(26),head:D(-8), tail1:D(6),  tail2:D(-4),
            flU:D(0),  flL:D(4),  frU:D(2), frL:D(2)},off:{x:-3,y:0}}];
// Body rolls onto its side: the spine/chest chain pitches sharply below the hip line (positive
// spine/chest angle drops it, per the chain formula) while all four legs go limp and splay, tail
// flat. Reads as a collapse from the side, matching how the human knockdown pose also just pitches
// the torso rather than modeling a literal 3D roll.
POSES_QUAD.knockdown=[
  {t:0,ang:{spine:D(46),chest:D(38),neck:D(-10),head:D(6),tail1:D(-30),tail2:D(20),
            flU:D(60),flL:D(-10),frU:D(54),frL:D(-6),blU:D(-56),blL:D(8),brU:D(-50),brL:D(4)},off:{x:-8,y:34}},
  {t:1,ang:{spine:D(54),chest:D(44),neck:D(-14),head:D(2),tail1:D(-36),tail2:D(24),
            flU:D(66),flL:D(-14),frU:D(60),frL:D(-10),blU:D(-62),blL:D(12),brU:D(-56),brL:D(8)},off:{x:-12,y:38}}];
POSES_QUAD.getup=[
  {t:0,ang:{spine:D(50),chest:D(40),neck:D(-12),tail1:D(-32),tail2:D(22),
            flU:D(62),flL:D(-12),frU:D(56),frL:D(-8),blU:D(-58),blL:D(10),brU:D(-52),brL:D(6)},off:{x:-10,y:36}},
  {t:1,ang:{spine:D(3), chest:D(4), neck:D(34),tail1:D(12), tail2:D(-8),
            flU:D(-6), flL:D(9),  frU:D(5),  frL:D(-6), blU:D(-8), blL:D(11),brU:D(7), brL:D(-8)},off:{x:0,y:0}}];
POSES_QUAD.stunned=[
  {t:0,ang:{spine:D(6), chest:D(8), neck:D(24),head:D(16), tail1:D(6), tail2:D(-4)},off:{x:0,y:0}},
  {t:1,ang:{spine:D(-2),chest:D(0), neck:D(40),head:D(-14),tail1:D(16),tail2:D(-12)},off:{x:0,y:0}}];
POSES_QUAD.s1=flurry(
  {t:0,  ang:{spine:D(2), chest:D(2), neck:D(32),flU:D(-10),flL:D(14),frU:D(6), frL:D(-4)},off:{x:-4,y:0}},
  {t:.3, ang:{spine:D(10),chest:D(12),neck:D(28),flU:D(76), flL:D(-8),frU:D(4), frL:D(6)}, off:{x:10,y:0}},
  {t:.6, ang:{spine:D(6), chest:D(8), neck:D(30),flU:D(6),  flL:D(4), frU:D(80),frL:D(-10)},off:{x:16,y:0}},
  {t:1,  ang:{spine:D(18),chest:D(20),neck:D(26),flU:D(96), flL:D(-16),frU:D(-8),frL:D(10)},off:{x:28,y:0}});
POSES_QUAD.s2=flurry(
  {t:0,  ang:{spine:D(2), chest:D(2), neck:D(32),flU:D(-12),flL:D(16),frU:D(8), frL:D(-6)},off:{x:-6,y:0}},
  {t:.25,ang:{spine:D(11),chest:D(13),neck:D(28),flU:D(80), flL:D(-10),frU:D(4),frL:D(6)}, off:{x:12,y:0}},
  {t:.5, ang:{spine:D(6), chest:D(8), neck:D(30),flU:D(6),  flL:D(4), frU:D(84),frL:D(-12)},off:{x:18,y:0}},
  {t:.75,ang:{spine:D(14),chest:D(16),neck:D(28),flU:D(90), flL:D(-14),frU:D(0),frL:D(8)},  off:{x:24,y:0}},
  {t:1,  ang:{spine:D(26),chest:D(28),neck:D(24),flU:D(-8), flL:D(6), frU:D(100),frL:D(-18)},off:{x:36,y:0}});
POSES_QUAD.s3=flurry(
  {t:0,  ang:{spine:D(4), chest:D(4), neck:D(32),flU:D(-14),flL:D(18),frU:D(10),frL:D(-8)},off:{x:-8,y:0}},
  {t:.2, ang:{spine:D(14),chest:D(16),neck:D(28),flU:D(82), flL:D(-10),frU:D(4),frL:D(6)},off:{x:16,y:0}},
  {t:.45,ang:{spine:D(6), chest:D(8), neck:D(30),flU:D(6),  flL:D(4), frU:D(88),frL:D(-14)},off:{x:26,y:0}},
  {t:.7, ang:{spine:D(18),chest:D(20),neck:D(28),flU:D(96), flL:D(-18),frU:D(-4),frL:D(8)},off:{x:36,y:0}},
  {t:1,  ang:{spine:D(10),chest:D(15),neck:D(6),tail1:D(20),tail2:D(-16),
              flU:D(-40),flL:D(30),frU:D(-36),frL:D(28),blU:D(20),blL:D(-14),brU:D(22),brL:D(-16)},off:{x:48,y:-4}});
// Win: a satisfied sit — haunches down, front paws planted, tail curled contentedly around.
POSES_QUAD.win=[
  {t:0,ang:{spine:D(24),chest:D(20),neck:D(30),head:D(4), tail1:D(30),tail2:D(-40),
            flU:D(-4),flL:D(6),frU:D(4),frL:D(-2),blU:D(50),blL:D(-40),brU:D(46),brL:D(-38)},off:{x:0,y:16}},
  {t:1,ang:{spine:D(26),chest:D(22),neck:D(34),head:D(-2),tail1:D(40),tail2:D(-54),
            flU:D(-2),flL:D(4),frU:D(2),frL:D(0), blU:D(52),blL:D(-42),brU:D(48),brL:D(-40)},off:{x:0,y:18}}];
POSES_QUAD.ko=[
  {t:0,ang:{spine:D(58),chest:D(48),neck:D(-16),head:D(8),tail1:D(-38),tail2:D(26),
            flU:D(70),flL:D(-16),frU:D(64),frL:D(-12),blU:D(-66),blL:D(14),brU:D(-60),brL:D(10)},off:{x:-10,y:40}},
  {t:1,ang:{spine:D(64),chest:D(52),neck:D(-20),head:D(4),tail1:D(-42),tail2:D(30),
            flU:D(76),flL:D(-20),frU:D(70),frL:D(-16),blU:D(-70),blL:D(18),brU:D(-64),brL:D(14)},off:{x:-14,y:44}}];
preparePoses(POSES_QUAD);

// ---- big-brute pose table: same 22 keys and the SAME bone names as the human POSES table (torso,
// head, lShoulder/rShoulder, lElbow/rElbow, lHip/rHip, lKnee/rKnee) — Task 3.5's frozen interface has
// 'big' reuse the human skeleton, not a new bone set, so jab()/flurry() (already generic over those
// field names) are reused as-is below. What makes 'big' its own rig kind is proportions (Rig.solveBig's
// look.hunch, added to every torso angle here, plus LOOKS.mongo/grull's own numbers) and its own pose
// data — every key here is authored heavier/wider than its POSES counterpart, not copied.
// Every key here is now walked by TWO gates, not one: Rig.extent (68_rig.js) samples every keyframe
// (and its neighbors' midpoint) of every key for both the per-fight camera zoom cap (top; see
// G.startFight, 80_game.js) and the EDGE_PAD reach check (90_tests.js) — not just heavyCharge/s3, and
// not via a fixed formula. That's a Task 3.5 fix-round-1 change (a controller review caught heavyCharge/
// s3 being the wrong poses to assume were tallest — see LOOKS.grull's comment) with a direct
// consequence for how poses are authored: a "low crouch" now has to come from off.y (translating the
// whole rig down, which costs nothing in reach) rather than a big torso rotation, because torsoLen*
// sin(angle) is a reach cost as much as a height one, and Mongo/Grull's necessarily-long torsoLen (for
// the 1.25x-height floor) made that cost severe — see heavyCharge/s3's own comments below for the
// specific redesign, and LOOKS.mongo's Fix round 3 for why the look's own armLen/shoulderW also had to
// shrink on top of that.
const POSES_BIG={};
POSES_BIG.idle=[
  {t:0,ang:{torso:D(4), lShoulder:D(8), rShoulder:D(12),lElbow:D(60),rElbow:D(70),
            lHip:D(-10),rHip:D(10),lKnee:D(8),rKnee:D(-8)},off:{x:0,y:0}},
  {t:1,ang:{torso:D(1), lShoulder:D(4), rShoulder:D(16),lElbow:D(64),rElbow:D(64),
            lHip:D(-12),rHip:D(12),lKnee:D(10),rKnee:D(-10)},off:{x:0,y:0}}];
POSES_BIG.walk=[ // a heavy plod, not a human trot: bigger hip/knee swing, slower-reading torso roll
  {t:0, ang:{torso:D(5), lHip:D(-24),rHip:D(24), lKnee:D(22),rKnee:D(-12), lShoulder:D(16),rShoulder:D(-16)},off:{x:0,y:0}},
  {t:.5,ang:{torso:D(-5),lHip:D(24), rHip:D(-24),lKnee:D(-12),rKnee:D(22), lShoulder:D(-16),rShoulder:D(16)},off:{x:0,y:0}},
  {t:1, ang:{torso:D(5), lHip:D(-24),rHip:D(24), lKnee:D(22),rKnee:D(-12), lShoulder:D(16),rShoulder:D(-16)},off:{x:0,y:0}}];
POSES_BIG.dash=[
  {t:0,ang:{torso:D(-4), lHip:D(-14),rHip:D(24),lKnee:D(24),rKnee:D(-12),lShoulder:D(24),rShoulder:D(-24)},off:{x:0,y:6}},
  {t:1,ang:{torso:D(-8), lHip:D(-22),rHip:D(32),lKnee:D(30),rKnee:D(-8), lShoulder:D(30),rShoulder:D(-30)},off:{x:-10,y:8}}];
// Lights read as hooks, not jabs: jab() is reused (it's generic over the same bone-name fields) but
// with a wide elbow bend held through the swing and a much bigger torsoPeak than POSES.light* ever
// uses, so the silhouette sweeps around instead of extending straight out.
// Fix round 1 (controller review): torsoPeak was originally 16-28deg here (roughly matching the human
// rig's own light1-5 torsoPeak range), but for a look with a torso this long (needed for the height
// floor — see LOOKS.mongo's Fix round 1 comment), the SAME torso-lean angle sweeps the far shoulder/
// hand sideways by torsoLen*sin(angle) — a much bigger absolute distance than it does on a short human
// torso. Rig.extent's reach (90_tests.js/68_rig.js), which now walks the actual FK peak instead of a
// static formula, caught light4/light5's hand reaching ~240-300 world units at Mongo's scale — a light
// jab should not out-reach his own s3. Trimmed to roughly a third of the original swing so the torso
// still visibly rotates into a hook without the long lever arm blowing the reach budget.
POSES_BIG.light1=jab('r',{startSh:-10,startEl:36,peakSh:66,peakEl:22,peakOffX:12,torsoPeak:6});
POSES_BIG.light2=jab('l',{startSh:-10,startEl:36,peakSh:72,peakEl:22,peakOffX:14,torsoPeak:7});
POSES_BIG.light3=jab('r',{startSh:-10,startEl:38,peakSh:78,peakEl:20,peakOffX:16,torsoPeak:8});
POSES_BIG.light4=jab('l',{startSh:-10,startEl:38,peakSh:84,peakEl:20,peakOffX:18,torsoPeak:9});
POSES_BIG.light5=jab('r',{startSh:-12,startEl:42,peakSh:94,peakEl:12,peakOffX:24,torsoPeak:10});
// Medium: a driving shoulder charge — big forward off.x, guard held tight (not a reaching arm like
// the human lunge), torso rolling hard into the hit.
// Fix round 1 (controller review): t:.5's torso trimmed 46->34 — Rig.extent's reach now walks every
// pose (not a fixed formula), and torsoLen*sin(46deg) alone was already most of the trimmed reach
// budget (see LOOKS.mongo's Fix round 3) before the arm added anything.
POSES_BIG.medium=[
  {t:0, ang:{torso:D(8), rShoulder:D(6), rElbow:D(50),lShoulder:D(10),lElbow:D(50),rHip:D(-10),lHip:D(10),rKnee:D(18),lKnee:D(-8)},off:{x:-8,y:0}},
  {t:.5,ang:{torso:D(34),rShoulder:D(24),rElbow:D(40),lShoulder:D(20),lElbow:D(40),rHip:D(30), lHip:D(-40),rKnee:D(-30),lKnee:D(10)},off:{x:38,y:4}},
  {t:1, ang:{torso:D(20),rShoulder:D(14),rElbow:D(46),lShoulder:D(14),lElbow:D(46),rHip:D(12), lHip:D(-14)},off:{x:14,y:0}}];
// Heavy charge: the gather. Fix round 1 (controller review): originally a deep torso-rotation crouch
// (64-76deg pose angle, past 60deg once stacked with look.hunch) to keep the pose's TOP low for the
// old fixed heavyCharge/s3-only HUD test — but rotating a torso this long by that much is exactly what
// also blew the reach budget (torsoLen*sin(angle) is a reach cost, not just a height one), and once
// Rig.extent started walking every pose for BOTH top and reach, that crouch strategy stopped paying
// for itself. Now a much shallower torso lean (22-26deg) carries the "coiled, gathering" read almost
// entirely via a big off.y (translating the whole rig down, which costs nothing in reach) instead —
// still reads as a low, weighted-down gather, without the reach penalty of the old design.
POSES_BIG.heavyCharge=[
  {t:0,ang:{torso:D(22),head:D(-8), lShoulder:D(26),rShoulder:D(26),lElbow:D(55),rElbow:D(55),lHip:D(10),rHip:D(-10),lKnee:D(22),rKnee:D(-22)},off:{x:-4,y:60}},
  {t:1,ang:{torso:D(26),head:D(-10),lShoulder:D(34),rShoulder:D(34),lElbow:D(62),rElbow:D(62),lHip:D(16),rHip:D(-16),lKnee:D(28),rKnee:D(-28)},off:{x:-8,y:85}}];
// Heavy release: coiled crouch -> both fists thrown overhead (torso arches back, shoulders to 150deg)
// -> smashed down through impact into a forward-driving crouch. The genuine "two-hand overhead smash".
// Fix round 1 (controller review): t:0 continues straight from heavyCharge's own end state (torso
// ~26deg + a big off.y, not the original 58deg lean) for the same reach-budget reason — see
// heavyCharge's own comment.
POSES_BIG.heavy=[
  {t:0,  ang:{torso:D(26), lShoulder:D(20), rShoulder:D(20), lElbow:D(50),rElbow:D(50),lHip:D(14), rHip:D(-14)},off:{x:-6,y:85}},
  {t:.45,ang:{torso:D(-28),lShoulder:D(150),rShoulder:D(150),lElbow:D(-8),rElbow:D(-8),lHip:D(-22),rHip:D(22),lKnee:D(-10),rKnee:D(10)},off:{x:6,y:60}},
  {t:1,  ang:{torso:D(18), lShoulder:D(60), rShoulder:D(60), lElbow:D(28),rElbow:D(28),lHip:D(14), rHip:D(-12)},off:{x:22,y:12}}];
POSES_BIG.block=[ // a forearm wall: both arms raised and crossed in front, wide stance underneath
  {t:0,ang:{torso:D(6),lShoulder:D(62),rShoulder:D(72),lElbow:D(66),rElbow:D(62),lHip:D(8),rHip:D(-8)},off:{x:2,y:2}},
  {t:1,ang:{torso:D(6),lShoulder:D(68),rShoulder:D(78),lElbow:D(70),rElbow:D(66),lHip:D(8),rHip:D(-8)},off:{x:2,y:2}}];
POSES_BIG.blockstun=[
  {t:0,ang:{torso:D(-10),lShoulder:D(62),rShoulder:D(72),lElbow:D(66),rElbow:D(62)},off:{x:-6,y:0}},
  {t:1,ang:{torso:D(6),  lShoulder:D(62),rShoulder:D(72),lElbow:D(66),rElbow:D(62)},off:{x:0,y:0}}];
POSES_BIG.hit=[
  {t:0,ang:{torso:D(-20),head:D(-18),lShoulder:D(24),rShoulder:D(-36),lElbow:D(30),rElbow:D(14),lHip:D(-6),rHip:D(6)},off:{x:-12,y:0}},
  {t:1,ang:{torso:D(-4), head:D(-2), lShoulder:D(12),rShoulder:D(-14),lElbow:D(20),rElbow:D(18)},off:{x:-3,y:0}}];
POSES_BIG.knockdown=[
  {t:0,ang:{torso:D(-96), head:D(6),lShoulder:D(14),rShoulder:D(-10),lElbow:D(12),rElbow:D(12),lHip:D(-26),rHip:D(-30),lKnee:D(40),rKnee:D(44)},off:{x:-10,y:24}},
  {t:1,ang:{torso:D(-116),head:D(2),lShoulder:D(8), rShoulder:D(-6), lElbow:D(8), rElbow:D(8), lHip:D(-34),rHip:D(-40),lKnee:D(48),rKnee:D(54)},off:{x:-14,y:28}}];
POSES_BIG.getup=[
  {t:0,ang:{torso:D(-58),lHip:D(-30),rHip:D(-34),lKnee:D(30),rKnee:D(34)},off:{x:-8,y:20}},
  {t:1,ang:{torso:D(0),  lHip:D(0),  rHip:D(0),  lKnee:D(0), rKnee:D(0)}, off:{x:0,y:0}}];
POSES_BIG.stunned=[
  {t:0,ang:{torso:D(4), head:D(12), lShoulder:D(6),rShoulder:D(-4), lElbow:D(32),rElbow:D(28)},off:{x:0,y:0}},
  {t:1,ang:{torso:D(-8),head:D(-8), lShoulder:D(2),rShoulder:D(-8), lElbow:D(36),rElbow:D(32)},off:{x:0,y:0}}];
// s1/s2: overhand forearm smashes (upright, unlike s3). Fix round 1 (controller review): peak
// shoulder swing trimmed (96-114deg -> 76-92deg) and peak torso trimmed (18-34deg -> 12-22deg) — with
// Rig.extent now walking every pose for reach, a peak this close to a full horizontal arm extension
// (shoulder near 90deg = arm pointing straight out) combined with even a moderate torso lean already
// used most of the trimmed reach budget (see LOOKS.mongo's Fix round 3); still swings well past the
// human rig's own s1/s2 peaks, just short of the previous near-maximum reach.
POSES_BIG.s1=flurry(
  {t:0,  ang:{torso:D(2), rShoulder:D(-16),rElbow:D(34),lShoulder:D(18),lElbow:D(24)},off:{x:-4,y:0}},
  {t:.3, ang:{torso:D(14),rShoulder:D(76), rElbow:D(2)},off:{x:12,y:0}},
  {t:.6, ang:{torso:D(8), lShoulder:D(-76),lElbow:D(2)},off:{x:18,y:0}},
  {t:1,  ang:{torso:D(22),rShoulder:D(88), rElbow:D(-8),lShoulder:D(-18),lElbow:D(20)},off:{x:30,y:0}});
POSES_BIG.s2=flurry(
  {t:0,  ang:{torso:D(2), rShoulder:D(-18),rElbow:D(36),lShoulder:D(20),lElbow:D(26)},off:{x:-6,y:0}},
  {t:.25,ang:{torso:D(15),rShoulder:D(80), rElbow:D(2)},off:{x:14,y:0}},
  {t:.5, ang:{torso:D(6), lShoulder:D(-80),lElbow:D(2)},off:{x:20,y:0}},
  {t:.75,ang:{torso:D(16),rShoulder:D(86), rElbow:D(-6)},off:{x:26,y:0}},
  {t:1,  ang:{torso:D(24),lShoulder:D(-92),lElbow:D(-12),rShoulder:D(22),rElbow:D(22)},off:{x:38,y:0}});
// s3: the ground-pound flurry. Fix round 1 (controller review): originally a deep torso-rotation
// crouch (58-74deg) for the same reason — and with the same fix — as heavyCharge above: a shallower
// torso lean (18-26deg) plus a big off.y carries the "bent-over, pounding down" read at a fraction of
// the reach cost. shoulder peaks also trimmed (92-112deg -> 68-80deg) for the same reason as s1/s2.
POSES_BIG.s3=flurry(
  {t:0,  ang:{torso:D(18),rShoulder:D(-14),rElbow:D(40),lShoulder:D(24),lElbow:D(30)},off:{x:-8,y:70}},
  {t:.2, ang:{torso:D(22),rShoulder:D(68), rElbow:D(4)},off:{x:14,y:80}},
  {t:.45,ang:{torso:D(16),lShoulder:D(-68),lElbow:D(4)},off:{x:22,y:65}},
  {t:.7, ang:{torso:D(22),rShoulder:D(74), rElbow:D(-4)},off:{x:30,y:80}},
  {t:1,  ang:{torso:D(26),rShoulder:D(80), rElbow:D(-14),lShoulder:D(-28),lElbow:D(-8),lHip:D(16),rHip:D(-16)},off:{x:42,y:85}});
// Fix round 1 (controller review): a fully vertical arm raise (was -140/-150 shoulder deg, matching
// the human rig's own win pose) plus a held weapon (Grull's spikedclub prop, which extends further
// past whichever hand holds it — see propExtra) pushed the club tip to the single tallest point across
// either character's whole pose set, forcing the fight's cineZoomCap just under the 0.85 floor. Capped
// the raise well short of vertical so a still-clearly-triumphant "arms up" read doesn't carry a raised
// club any higher than the rest of the roster's tallest poses. Fix round 2 (same review pass): once
// the club was no longer the tallest point, Mongo's own head at this near-full-height standing pose
// took over as the tallest point across his whole pose set — a slight forward lean + a small positive
// off.y (a satisfied, grounded stance, not a ramrod-straight one) trims a few more units off the top
// of an otherwise-natural standing pose, just enough to clear the 0.85 floor for a Mongo/Grull pairing.
POSES_BIG.win=[
  {t:0,ang:{torso:D(4),lShoulder:D(-108),rShoulder:D(100),lElbow:D(18),rElbow:D(-14)},off:{x:0,y:16}},
  {t:1,ang:{torso:D(8),lShoulder:D(-112),rShoulder:D(106),lElbow:D(14), rElbow:D(-10)},off:{x:0,y:20}}];
POSES_BIG.ko=[
  {t:0,ang:{torso:D(-100),head:D(10),lHip:D(-28),rHip:D(-32),lKnee:D(42),rKnee:D(46),lShoulder:D(18),rShoulder:D(-28)},off:{x:-10,y:24}},
  {t:1,ang:{torso:D(-118),head:D(6), lHip:D(-36),rHip:D(-42),lKnee:D(50),rKnee:D(54),lShoulder:D(10),rShoulder:D(-18)},off:{x:-14,y:28}}];
preparePoses(POSES_BIG);

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
  // Princess Donut: a real cat (Task 3.4's RigQuad quadruped bone set — see Rig.solve's 'quad'
  // branch below). Cream/white fur, a long expressive tail (tailLen well beyond the body-length
  // proportions grub/mother_rat use), pink inner ears, blue eyes, and a small gold tiara prop drawn
  // in drawQuad. ~0.75 of Carl's shoulder height (114+91=205) at the body's tallest standing point
  // (head crown) once neck/head are factored in, but long — bodyLen is the biggest single number in
  // her look, well past her hipH, matching "long" over "tall".
  // legLen intentionally equals hipH (front and back paws both sized to reach exactly the hip/chest
  // height): the idle pose keeps spine/chest pitch tiny for exactly this reason — solveQuad's body
  // chain accumulates pitch angle segment over segment (spineA, then chestA=spineA+a('chest')), so
  // even a few degrees of "breathing" tilt lifts the chest (and therefore the front-paw attach point)
  // measurably above the hip line, unlike the human rig's independent per-limb angles.
  // Fix round 1 (art review): bodyLen trimmed ~15% (170->144) and legW bumped (15->18) so the body
  // capsule drawQuad now draws (width = bodyLen*.42, a filled rounded shape, not a thin stroke) reads
  // as "long and low", not a snake — see drawQuad's body-drawing comment for the shape itself.
  donut:{rig:'quad',species:'cat',skin:'#f7ecdc',earInner:'#f6b8d6',eye:'#3f7fd6',accent:'#f4c542',
    hipH:65,legLen:65,bodyLen:144,neckLen:46,headR:26,tailLen:120,
    frontW:20,backW:24,legW:18,
    props:['tiara','whiskers']},
  // Mongo: Task 3.5's RigBig brute rig (see Rig.solve's 'big' branch below and Rig.solveBig).
  // Grey-green skin, bald with a heavy brow (drawn unconditionally in drawBig, not a props entry),
  // bare barrel chest with a couple of scars, dark trousers instead of a shirt. hunch is the per-look
  // spine-offset constant solveBig adds to every torso angle (see POSES_BIG's table comment) — kept
  // small (4deg) here; height comes from torsoLen itself, not from leaning the torso hard over.
  // Proportions: shoulderW (112) ~1.35x Carl's 83; armLen (97) > legLen (95) for "arms longer than
  // legs" — both capped fairly close together by EDGE_PAD's reach budget (shoulderW/2+armLen+limb at
  // mongo's 1.25 scale), which is also why legLen can't itself carry most of the height the way it
  // does for Carl. torsoLen (172) is what makes up the difference, plus a big, thick headR (27,
  // bigger than Carl's 25 even at Mongo's larger shoulderW, so the head still visually anchors the
  // torso) and thick limbs (22, vs Carl's 20). waistW is a genuine taper (not flat "barrel") to two
  // visually distinct volumes — see drawBig's two-hexagon pelvis/chest split.
  // Fix round 1 (art review): the first two passes (hunch 10-12deg, torsoLen 180-230, headR 21-25,
  // waistW near shoulderW for a flat "barrel") rendered as a featureless diagonal slab — a torso this
  // long combined with ANY nonzero lean angle sweeps its far end sideways by torsoLen*sin(angle), so a
  // 10-12deg permanent "hunch" over a 180-230 unit torso produced a dramatic lean no amount of width/
  // color tuning fixed, and a small headR/flat waist gave the eye nothing to break the mass up against.
  // Cut the permanent lean to 4deg, added a real waist taper, and sized the head/limbs up.
  // Fix round 2: round 1's torsoLen (180, ratio 1.29x Carl's idle height) stood so tall that even at
  // the camera's widest (zoom 1.0, debugPose's default) Mongo's head crowded the FIGHTER title — no
  // test catches this (only heavyCharge/s3 at the 1.28 cinematic zoom are graded), but it read badly
  // in the p3-mongo-idle.png review shot. Trimmed torsoLen to the smallest value that still clears
  // 1.25x with a safety margin.
  // Fix round 3 (controller review): with Rig.extent walking the real FK peak across every pose
  // (90_tests.js/68_rig.js), shoulderW/2+armLen alone (56+97=153) was already 87% of EDGE_PAD's
  // scale-adjusted budget (220/1.25=176) — leaving essentially no room for ANY pose's own torso lean
  // or shoulder swing on top of just standing still, so light5, s1-s3, and medium all failed once
  // walked pose-by-pose. armLen/shoulderW/limb trimmed further (down to a standing 56+74+15=... no:
  // 84/2+74+15=131, a real ~45-unit margin) at the direct cost of "arms longer than legs" — legLen is
  // now the bigger number (150 vs armLen 74), the opposite of the original spec, because legLen is
  // the one dimension that adds height without ANY reach cost (legs barely leave the vertical near
  // idle/attack poses) while torsoLen/shoulderW/armLen all cost reach directly. torsoLen also cut
  // (172->120) for the same reason — every POSES_BIG key's torso angle now gets walked by Rig.extent
  // too, not just heavyCharge/s3, so a long torso's sin(angle) reach penalty had to shrink across the
  // board, not just in the two poses it used to matter for. See POSES_BIG's per-key comments for how
  // heavyCharge/s3/medium/s1/s2 were retuned to fit the new, much tighter reach budget.
  mongo:{rig:'big',skin:'#7a8a6a',hair:null,primary:'#2a2a24',secondary:'#4a3a28',
    limb:15,legLen:147,armLen:74,torsoLen:120,headR:26,shoulderW:84,hipW:52,waistW:59,hunch:D(4),
    props:['trousers','scars']},
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
  // Grub: Task 3.4's RigQuad bone set reused for a segmented larva — same four-legged FK, drawn with
  // stubby leg nubs (legW/legLen both small relative to bodyLen) and a distinct dark head capsule
  // (headFill, separate from the pale body skin) instead of a cat/rat face. No ears.
  // Fix round 1: the first pass sized every field down together (hipH:16/bodyLen:100/headR:18) to
  // read "low to the ground", but since idle's front-paw-at-floor invariant forces legLen==hipH, a
  // small hipH shrinks the whole creature, not just its leg clearance — it rendered as a near-
  // invisible speck next to a full-size goblin. Kept hipH/legLen short (stubby legs, low-slung body)
  // but bumped bodyLen back up so the body itself stays a visible size on screen.
  // Fix round 2: solveQuad positions the head headR*1.6 past the neck point (same convention the
  // human rig uses for headNeckLen) — round 1 paired a big headR:28 (headR*1.6=44.8) with a tiny
  // neckLen:14, so the head landed nearly 3x further from the neck joint than the neck segment
  // itself, reading as a disconnected blob floating apart from the body. donut/mother_rat keep
  // neckLen and headR*1.6 close to 1:1 (46 vs 41.6, 42 vs 41.6); grub matches that ratio at a
  // smaller absolute size instead (headR:16 -> headR*1.6=25.6, neckLen:20) so the head capsule sits
  // snug against the body the way "a dark head capsule" implies.
  // Fix round 1 (art review): bodyLen trimmed ~15% (140->119) for the same filled-capsule-body
  // reason as donut above; legW trimmed slightly (16->14) so the now-plumper body still contrasts
  // against genuinely "stubby nub" legs rather than the legs bulking up to match it.
  grub:{rig:'quad',species:'grub',skin:'#c7d19a',headFill:'#33401d',segDark:'#5a6a30',
    hipH:40,legLen:40,bodyLen:119,neckLen:15,headR:17,tailLen:36,
    frontW:13,backW:13,legW:14,
    props:['segments']},
  // Grull (boss): Task 3.5's RigBig brute rig, same bone set and Fix-round-1 reasoning as Mongo (see
  // LOOKS.mongo's comment — a long torso can't carry a big permanent lean without reading as a
  // diagonal slab, and margin above the 1.25x height floor should be minimized to keep idle framing
  // reasonable) but darker olive skin, horns (the 'horns' prop) instead of hair, and a spiked club in
  // the right hand ('spikedclub'). A slightly bigger hunch than Mongo's (6 vs 4deg) reads as a touch
  // more stooped/feral for the boss without reintroducing the lean problem.
  // Fix round 1 (controller review, follow-up): the original "reduce scale until HUD-tested poses
  // pass" reasoning here was itself the bug — heavyCharge/s3 (a deep crouch by design) are Grull's
  // *shortest* poses, not his tallest, so tuning scale against only those two let a real --sim
  // screenshot catch his idle/stunned head+horns crossing HUD_LINE at 1.3, at 1.1, and still (barely)
  // at .94. The actual fix is no longer a scale number at all: G.startFight now computes a per-fight
  // camera zoom cap from Rig.extent's true worst case across every pose and prop (see 80_game.js,
  // 65_stage.js's Camera.update), so the camera itself is what stays out of Grull's way, at whatever
  // scale he's set to. His scale stays at .94 (40_movedata.js's BOSSES.grull) — kept, not re-tuned.
  // Fix round 2 (same review pass, reach): same armLen/shoulderW/torsoLen trim as Mongo (see that
  // comment) and for the same reason — Rig.extent's reach now walks every pose, and standing
  // shoulderW/2+armLen alone was most of the scale-adjusted EDGE_PAD budget before any pose even
  // moved. Grull's own budget (220/.94=234) is looser than Mongo's (220/1.25=176), so he keeps a
  // slightly longer torso/taller stance than Mongo while using the same trimmed shoulderW/armLen/limb.
  grull:{rig:'big',skin:'#4a5c34',hair:null,primary:'#2a2420',secondary:'#5c3a22',
    limb:15,legLen:135,armLen:76,torsoLen:140,headR:24,shoulderW:84,hipW:52,waistW:59,hunch:D(6),
    props:['trousers','horns','spikedclub']},
  // Mother Rat (boss): Task 3.4's RigQuad bone set at boss scale (def.scale:1.3, applied on top of
  // these already-large numbers). Grey-brown fur, a long pink tail, big rounded ears, and yellow
  // teeth drawn in drawQuad.
  // Fix round 1 (art review): bodyLen trimmed ~15% (170->144), legW bumped (18->20) for "bulkier
  // chest/haunches" on top of the filled-capsule body drawQuad now draws for every quad look.
  mother_rat:{rig:'quad',species:'rat',skin:'#6b5a4a',earInner:'#d98fa0',tailTint:'#d98fa0',
    teeth:'#e8d24a',eye:'#1a1a1a',
    hipH:65,legLen:65,bodyLen:144,neckLen:42,headR:26,tailLen:170,
    frontW:22,backW:26,legW:20,
    props:['teeth']}};

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
  bonesQuad:QUAD_BONES,
  // A prop draws geometry beyond any joint solve() returns (a dagger's blade tip, a horn's curl, a
  // club's head) — Rig.extent (below) needs those extremes too, or a look wearing one could still
  // clip the HUD even though every *joint* is accounted for. Duplicates just the tip/extent math from
  // each prop's drawing code in draw()/drawBig()/drawQuad() (not full rendering — extent only cares
  // about the furthest point(s) a prop's stroke/fill reaches), keyed by the same prop id string
  // look.props uses. face is passed through rather than assumed 1 so a caller iterating both facings
  // could in principle use this directly, though Rig.extent itself only ever samples face=1 (the FK
  // is symmetric under a face flip, so the magnitude — what extent cares about — doesn't change).
  propExtra(propId,look,j,face){
    if(propId==='dagger'){ // human rig: blade tip off j.rHand, same direction math as draw()'s dagger
      const h=j.rHand,len=look.armLen*.46,n=Math.hypot(face,-.32),dx=face/n,dy=-.32/n;
      return[{x:h.x+dx*len,y:h.y+dy*len}]}
    // human rig: Hobgoblin's club (draw()'s shaft, kept in sync — see its Fix-wave item 4 comment).
    // Restored to its real length now that the per-frame zoom cap (G.topNow/Rig.topAt) means a tall
    // prop only taxes the frames it's actually held up in, not the whole fight.
    if(propId==='club'){const h=j.rHand;return[{x:h.x+face*12,y:h.y-30}]}
    if(propId==='spikedclub'){const h=j.rHand,len=look.armLen*.6;return[{x:h.x+face*len*.3,y:h.y-len}]}
    if(propId==='horns'){const r=look.headR;
      return[-1,1].map(s=>({x:j.head.x+s*r*1.05,y:j.head.y-r*2.1}))}
    if(propId==='tiara'){const w=look.headR*.7,h=look.headR*.42,cy=j.head.y-look.headR*.9;
      return[{x:j.head.x,y:cy-h*.2},{x:j.head.x-w,y:cy+h},{x:j.head.x+w,y:cy+h}]}
    if(propId==='whiskers'){const wx=j.head.x+face*look.headR*.68,wy=j.head.y+look.headR*.12;
      return[{x:wx+face*look.headR*1.35,y:wy}]}
    if(propId==='teeth'){const tx=j.head.x+face*look.headR*.85;
      return[{x:tx+face*7,y:j.head.y+look.headR*.25}]}
    return[]}, // 'vest','boxers','bandages','gear','rags','trousers','scars','segments': stay within
               // joint bounds (torso/hip/limb strokes), no separate extent contribution.
  // Worst-case {top, reach} (both positive) a look can strike across EVERY pose it can reach, sampled
  // at every keyframe and its neighbors' midpoint (not just t=0/.5/1 globally — a multi-keyframe
  // flurry like s3 has real peaks at interior keyframes a coarse global sample could straddle and
  // miss), plus every prop's own geometry via propExtra above. Computed once per (look, scale) and
  // cached on the look itself — this walks every pose key's full FK plus props, so it's not free, but
  // it never changes for a given look/scale pair.
  // top = height above the floor, INCLUDING each pose's own off.y (a crouch/lunge genuinely changes
  // how high the rig's own base sits, and that's exactly the real screen-space clipping G's zoom cap
  // (80_game.js) needs to know about — see the "big rig idle height"/HUD zoom-cap tests, where this
  // is the whole point of the fix).
  // reach = max |x| from the fighter's own x, EXCLUDING each pose's own off.x. EDGE_PAD's own
  // definition (see its comment in 40_movedata.js) has always meant "how far the rig's limbs reach
  // from the fighter's actual sim x" — a static, proportion-driven number the wall-clamp sizes itself
  // against — not "how far a specific attack's cosmetic forward-lean animation (POSES.s3's off.x:46,
  // purely a render-time flourish; the sim's own x for s3 never moves, unlike a dash-tagged move) can
  // fling the rendered hand." Including off.x here was tried first and made carl/hobgoblin/donut/
  // mother_rat/mongo/grull *all* fail this test at 1.5-2x EDGE_PAD — a real (and probably worth its
  // own future task) latent gap between how far s3's pose art reaches and how much wall margin the sim
  // reserves, but not something this rig/camera fix round should silently paper over by inflating
  // EDGE_PAD or rewriting other characters' frozen pose data. Subtracting each sample's own off.x
  // before folding it into reach is valid because off.x only ever enters the FK once, as a straight
  // additive shift to hip.x that every other joint's position is built from (sin/cos terms all compose
  // on top of it) — so undoing it after the fact is exactly equivalent to solving with off.x=0.
  // opts.excludePoses (default none): pose keys to skip entirely — used ONLY by G.startFight's
  // per-fight camera zoom cap (Fix round 2, controller review), to leave out 'win'/'ko': those play
  // under the RESULT overlay after the fight is already over, not during ordinary play, so their own
  // (often raised-arm) height shouldn't drag every fight's normal zoom cap down. The reach test (and
  // anything else caring about the true worst case) always calls extent() with no opts, so it still
  // sees every pose. Folded into the cache key (scale plus a sorted, joined excludePoses string) so
  // the two call shapes cache independently instead of clobbering each other.
  extent(look,scale,opts){
    scale=scale||1;
    const excl=opts&&opts.excludePoses;
    const cacheKey=scale+(excl&&excl.length?'|excl:'+excl.slice().sort().join(','):'');
    look._extentCache=look._extentCache||{};
    if(look._extentCache[cacheKey])return look._extentCache[cacheKey];
    const table=look.rig==='quad'?POSES_QUAD:look.rig==='big'?POSES_BIG:POSES;
    const skip=excl&&excl.length?new Set(excl):null;
    let minY=0,maxReach=0;
    for(const key in table){
      if(skip&&skip.has(key))continue;
      const kf=table[key];
      for(let i=0;i<kf.length-1;i++){
        const ta=kf[i].t,tb=kf[i+1].t;
        for(const t of[ta,(ta+tb)/2,tb]){
          const offX=samplePose(table,key,t).off.x||0;
          const j=this.solve(look,key,t,1);
          const fold=(x,y)=>{if(y<minY)minY=y;const rx=Math.abs(x-offX);if(rx>maxReach)maxReach=rx};
          for(const b in j)fold(j[b].x,j[b].y);
          // Fix-wave item 3: the head is drawn as a filled circle of radius look.headR around j.head
          // (draw()/drawBig()/drawQuad()'s own c.arc(j.head.x,j.head.y,look.headR,...) calls), which
          // every joint-only fold above misses entirely — j.head is the circle's CENTER, not its
          // topmost/widest point. Deficit was 11-34px across the roster (Mongo 32.5px at his 1.25
          // scale), enough to put his head 28px into the HUD at his pair cap. Folding the two top
          // corners of the circle's bounding square is a deliberately cheap, slightly-conservative
          // stand-in for the true circle bound (its exact top point is (j.head.x, j.head.y-headR),
          // its exact side points are ((j.head.x±headR, j.head.y)) — the corners fold BOTH top and
          // reach through the same two fold() calls without adding a third).
          fold(j.head.x-look.headR,j.head.y-look.headR);
          fold(j.head.x+look.headR,j.head.y-look.headR);
          for(const propId of look.props||[])
            for(const ep of this.propExtra(propId,look,j,1))fold(ep.x,ep.y)}}}
    const result={top:-minY*scale,reach:maxReach*scale};
    return look._extentCache[cacheKey]=result},
  // Fix-wave item 4: the per-frame counterpart to extent() above — instead of the worst case across
  // EVERY pose a look can ever reach, this is just the height of the ONE pose it's actually in right
  // now (poseKey/t01, from poseFor(f)), so a single tall pose (e.g. Carl's own 'dash' lunge) doesn't
  // tax the camera's zoom cap for the whole fight, only the frames it's actually on screen for. Same
  // fold as extent() (every joint, the head circle's bounding corners, every prop's own geometry) but
  // for one sample instead of walking every keyframe. t01 is quantized to the nearest 1/20 (0.05) so
  // a fight's continuously-varying t01 collapses onto a small, stable set of cache entries per (look,
  // poseKey) instead of allocating one entry per distinct floating-point t01 ever seen — checked to
  // cost nothing measurable against --perf 300 (see docs/ARENA.md's fix-wave notes).
  topAt(look,poseKey,t01,scale){
    scale=scale||1;
    const qt=Math.round(clamp(t01,0,1)*20)/20;
    const cacheKey=poseKey+'|'+scale+'|'+qt;
    look._topCache=look._topCache||{};
    const cached=look._topCache[cacheKey];
    if(cached!==undefined)return cached;
    const j=this.solve(look,poseKey,qt,1);
    let minY=0;
    for(const b in j)if(j[b].y<minY)minY=j[b].y;
    if(j.head.y-look.headR<minY)minY=j.head.y-look.headR;
    for(const propId of look.props||[])
      for(const ep of this.propExtra(propId,look,j,1))if(ep.y<minY)minY=ep.y;
    return look._topCache[cacheKey]=-minY*scale},
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
  // Dispatches on look.rig (Phase 3 ruling #5: new rigs are separate bone sets, not recolors), not
  // def.rig — see lookFor's comment on why that indirection exists (a def without its real .look
  // yet renders through whatever placeholder LOOKS entry it has today).
  solve(look,poseKey,t01,face){
    if(look.rig==='quad')return this.solveQuad(look,poseKey,t01,face);
    if(look.rig==='big')return this.solveBig(look,poseKey,t01,face);
    const{ang,off}=samplePose(POSES,poseKey,t01),a=k=>ang[k]||0;
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
  // Big-brute FK (Phase 3 ruling #5 / Task 3.5's frozen interface): the SAME bone chain formula as
  // solve() above — same bone names, same hip->torso->neck->head + shoulder/hip-mounted arm/leg FK —
  // sampled against POSES_BIG instead of POSES, with one structural addition: look.hunch (a per-look
  // radian constant) is added on top of the per-pose 'torso' angle, every frame, for every pose. That
  // single line is the "hunched spine offset" — it pitches the whole torso->neck->head chain forward/
  // down relative to hip on top of whatever that pose's own torso lean already does, which is what
  // reads as a permanently stooped brute stance rather than a human rig standing up straight. See
  // POSES_BIG's own table comment for how heavyCharge/s3 combine with this to stay under the HUD's
  // zoom-cap test despite 'idle' standing well over 1.25x a human's height (the "big rig idle height"
  // test) — this function makes no other distinction between poses.
  solveBig(look,poseKey,t01,face){
    const{ang,off}=samplePose(POSES_BIG,poseKey,t01),a=k=>ang[k]||0;
    const legU=look.legLen*.5,legL=look.legLen*.5,armU=look.armLen*.5,armL=look.armLen*.5;
    const hip={x:(off.x||0)*face,y:-look.legLen+(off.y||0)};
    const torsoA=a('torso')+look.hunch;
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
  // Quadruped FK. Body chain hip->spine->chest->neck->head runs horizontal (face is the direction
  // it points), unlike the human chain's mostly-vertical hip->waist->torso->neck: at angle 0 each
  // body-chain segment extends straight in the facing direction (cos term), not straight up (the
  // human chain's sin/cos roles are swapped for exactly this reason). tail1/tail2 extend the other
  // way (backward, -face) from hip. Each of the four legs is a two-segment FK chain hanging from a
  // fixed attach point (flHip/frHip off chest, blHip/brHip off hip — named to echo the human rig's
  // lShoulder/rShoulder-off-neck and lHip/rHip-off-hip attach convention) using the same "0 = hangs
  // straight down" leg convention the human rig's legFK uses, so idle's near-zero angles plant all
  // four paws at y≈0 the same way idle's opposing hip/knee angles do for the human rig.
  solveQuad(look,poseKey,t01,face){
    const{ang,off}=samplePose(POSES_QUAD,poseKey,t01),a=k=>ang[k]||0;
    const hip={x:(off.x||0)*face,y:-look.hipH+(off.y||0)};
    const spineA=a('spine');
    const spine={x:hip.x+face*Math.cos(spineA)*look.bodyLen*.5,y:hip.y-Math.sin(spineA)*look.bodyLen*.5};
    const chestA=spineA+a('chest');
    const chest={x:spine.x+face*Math.cos(chestA)*look.bodyLen*.5,y:spine.y-Math.sin(chestA)*look.bodyLen*.5};
    const neckA=chestA+a('neck');
    const neck={x:chest.x+face*Math.sin(neckA)*look.neckLen,y:chest.y-Math.cos(neckA)*look.neckLen};
    const headA=neckA+a('head'),headNeckLen=look.headR*1.6;
    const head={x:neck.x+face*Math.sin(headA)*headNeckLen,y:neck.y-Math.cos(headA)*headNeckLen};
    const tailA1=a('tail1');
    const tail1={x:hip.x-face*Math.cos(tailA1)*look.tailLen*.5,y:hip.y-Math.sin(tailA1)*look.tailLen*.5};
    const tailA2=tailA1+a('tail2');
    const tail2={x:tail1.x-face*Math.cos(tailA2)*look.tailLen*.5,y:tail1.y-Math.sin(tailA2)*look.tailLen*.5};
    const legFK=(attach,upA,lowA,upLen,lowLen)=>{
      const kx=attach.x+face*Math.sin(upA)*upLen,ky=attach.y+Math.cos(upA)*upLen;
      const tot=upA+lowA;
      return{knee:{x:kx,y:ky},paw:{x:kx+face*Math.sin(tot)*lowLen,y:ky+Math.cos(tot)*lowLen}}};
    const fUp=look.legLen*.5,fLow=look.legLen*.5,
      bLen=look.backLegLen!==undefined?look.backLegLen:look.legLen,bUp=bLen*.5,bLow=bLen*.5;
    const flHip={x:chest.x-face*look.frontW/2,y:chest.y},frHip={x:chest.x+face*look.frontW/2,y:chest.y};
    const blHip={x:hip.x-face*look.backW/2,y:hip.y},brHip={x:hip.x+face*look.backW/2,y:hip.y};
    const fl=legFK(flHip,a('flU'),a('flL'),fUp,fLow),fr=legFK(frHip,a('frU'),a('frL'),fUp,fLow);
    const bl=legFK(blHip,a('blU'),a('blL'),bUp,bLow),br=legFK(brHip,a('brU'),a('brL'),bUp,bLow);
    return{hip,spine,chest,neck,head,tail1,tail2,
      flHip,fl1:fl.knee,fl2:fl.paw,frHip,fr1:fr.knee,fr2:fr.paw,
      blHip,bl1:bl.knee,bl2:bl.paw,brHip,br1:br.knee,br2:br.paw}},
  draw(c,F,cam,frame){
    const look0=lookFor(F.def);
    if(look0.rig==='quad')return this.drawQuad(c,F,cam,frame,look0);
    if(look0.rig==='big')return this.drawBig(c,F,cam,frame,look0);
    const look=look0,scale=F.def.scale||1,face=F.face;
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
        // Fix round 2 (controller review, Task 3.5 fix round 2): shaft shortened 30->9 (knob spacing
        // to match) — Hobgoblin's held club extended past his hand in every pose he holds it in
        // (block's own raised guard, not just an attack, ended up the tallest once 'heavy' was
        // trimmed), and propExtra's matching formula (kept in sync with this shape) was what pinned
        // carl×hobgoblin's zoom cap below 1.12/1.28 under the old per-fight worst-case cap.
        // Fix-wave item 4: restored to its real length (shaft back out to face*12,-30, knobs spread
        // back along it) now that G's zoom cap is per-frame (Rig.topAt/G.topNow) — a tall prop only
        // taxes the frames it's actually held up in, not the whole fight, so there's no reason left
        // to keep it artificially short.
        c.strokeStyle=look.secondary;c.lineWidth=10;c.lineCap='round';
        c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.x+face*12,h.y-30);c.stroke();
        c.fillStyle='#3a2f22';for(let i=0;i<3;i++){c.beginPath();
          c.arc(h.x+face*(4+i*4),h.y-10-i*10,3,0,Math.PI*2);c.fill()}}}
    c.restore()},
  // Big-brute draw: same shading philosophy as draw() (thick rounded-cap limb strokes with a dark
  // outline under the fill, back-limbs-then-torso-then-front-limbs layering, a waist-tapered torso
  // hexagon) but built on solveBig's joints and with three brute-specific additions the human rig has
  // no fields for: a filled fist circle at each hand (radius (look.limb/2)*1.5 — the human rig never
  // draws a distinct hand shape at all, just the forearm stroke's own round line cap, so "1.5x human
  // size" reads as 1.5x that stroke's own half-width), a heavy brow ridge arced across the upper head
  // (unconditional — both Mongo and Grull read as "hulking brute"), and dark boots instead of Carl's
  // optional bare feet (no look.bareFeet field on either big look). look is passed through from
  // draw()'s dispatch so it doesn't re-resolve lookFor(F.def) a second time.
  drawBig(c,F,cam,frame,look){
    look=look||lookFor(F.def);
    const scale=F.def.scale||1,face=F.face;
    const{key,t01}=this.poseFor(F),j=this.solveBig(look,key,t01,face);
    const skinDark=shade(look.skin,-.35);
    c.save();c.translate(F.x,FLOOR);c.scale(scale,scale);
    const limb=(p,q,w)=>{c.lineCap='round';
      c.lineWidth=w+3;c.strokeStyle=skinDark;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
      c.lineWidth=w;c.strokeStyle=look.skin;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke()};
    const foot=(p)=>{const w=look.limb*1.15,h=look.limb*.68,fx=p.x+face*w*.3,fy=p.y+h*.22;
      c.fillStyle='#241a12';c.strokeStyle='#120c08';c.lineWidth=1.4;c.beginPath();
      if(c.roundRect)c.roundRect(fx-w/2,fy-h/2,w,h,Math.min(w,h)*.4);else c.rect(fx-w/2,fy-h/2,w,h);
      c.fill();c.stroke()};
    const fist=(p)=>{const r=(look.limb/2)*1.5;c.fillStyle=look.skin;c.strokeStyle=skinDark;c.lineWidth=1.8;
      c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();c.stroke()};
    limb(j.lHip,j.lKnee,look.limb);limb(j.lKnee,j.lFoot,look.limb*.85);foot(j.lFoot);
    limb(j.lShoulder,j.lElbow,look.limb*.95);limb(j.lElbow,j.lHand,look.limb*.8);fist(j.lHand);
    // Torso: drawn as TWO separate quads (hip->waist pelvis, waist->shoulder chest) with a visible
    // seam stroke between them, not one hip-to-shoulder hexagon. A big look's torsoLen (needed for
    // height — see LOOKS.mongo's Fix round 1 note) is long enough that one unbroken hexagon reads as
    // a featureless slab regardless of width tuning; splitting it at the waist and stroking a seam
    // there gives the eye a torso/pelvis joint to read, at any torsoLen.
    const waistW=look.waistW!==undefined?look.waistW:(look.hipW+look.shoulderW)/2*.7;
    const lWaist={x:j.waist.x-face*waistW/2,y:j.waist.y},rWaist={x:j.waist.x+face*waistW/2,y:j.waist.y};
    c.beginPath();c.moveTo(j.lHip.x,j.lHip.y);c.lineTo(lWaist.x,lWaist.y);c.lineTo(rWaist.x,rWaist.y);c.lineTo(j.rHip.x,j.rHip.y);c.closePath();
    c.fillStyle=shade(look.skin,-.08);c.fill();c.lineWidth=2;c.strokeStyle=skinDark;c.stroke();
    c.beginPath();c.moveTo(lWaist.x,lWaist.y);c.lineTo(j.lShoulder.x,j.lShoulder.y);c.lineTo(j.rShoulder.x,j.rShoulder.y);c.lineTo(rWaist.x,rWaist.y);c.closePath();
    c.fillStyle=look.skin;c.fill();c.lineWidth=2.4;c.strokeStyle=skinDark;c.stroke();
    c.strokeStyle=shade(look.skin,-.3);c.lineWidth=1.8;
    c.beginPath();c.moveTo(lWaist.x,lWaist.y);c.lineTo(rWaist.x,rWaist.y);c.stroke();
    c.fillStyle=shade(look.skin,.16);c.beginPath();
    c.ellipse((j.lShoulder.x+j.rShoulder.x)/2,(j.lShoulder.y+j.rShoulder.y)/2+look.torsoLen*.08,
      look.shoulderW*.26,look.torsoLen*.1,0,0,Math.PI*2);c.fill();
    c.fillStyle=look.skin;c.beginPath();c.arc(j.head.x,j.head.y,look.headR,0,Math.PI*2);c.fill();
    c.lineWidth=1.6;c.strokeStyle=skinDark;c.stroke();
    // Heavy brow ridge: a thick dark arc across the upper-front third of the head.
    c.strokeStyle=shade(look.skin,-.42);c.lineWidth=look.headR*.32;c.lineCap='round';
    c.beginPath();c.arc(j.head.x,j.head.y-look.headR*.08,look.headR*.76,D(195),D(345));c.stroke();
    if(look.hair){c.fillStyle=look.hair;c.beginPath();
      c.arc(j.head.x,j.head.y-look.headR*.3,look.headR*1.05,Math.PI*1.05,Math.PI*1.95);c.fill()}
    c.fillStyle='#141414';c.beginPath();c.arc(j.head.x+face*look.headR*.3,j.head.y+look.headR*.1,1.8,0,Math.PI*2);c.fill();
    limb(j.rHip,j.rKnee,look.limb);limb(j.rKnee,j.rFoot,look.limb*.85);foot(j.rFoot);
    limb(j.rShoulder,j.rElbow,look.limb*.95);limb(j.rElbow,j.rHand,look.limb*.8);fist(j.rHand);
    for(const p of look.props||[]){
      if(p==='trousers'){ // dark trousers with a belt, down to mid-thigh — a bare barrel chest above
        const hw=look.hipW/2+10,topY=j.hip.y-4,botY=j.hip.y+look.legLen*.42;
        c.fillStyle=look.primary;
        c.beginPath();c.moveTo(j.hip.x-hw,topY);c.lineTo(j.hip.x+hw,topY);
        c.lineTo(j.hip.x+hw*.7,botY);c.lineTo(j.hip.x+hw*.15,botY-6);
        c.lineTo(j.hip.x-hw*.15,botY-6);c.lineTo(j.hip.x-hw*.7,botY);c.closePath();c.fill();
        c.strokeStyle=shade(look.primary,-.4);c.lineWidth=1.6;c.stroke();
        c.fillStyle=look.secondary||shade(look.primary,-.5);c.fillRect(j.hip.x-hw,topY-3,hw*2,6)}
      if(p==='scars'){ // a couple of jagged lighter lines across the bare chest
        c.strokeStyle=shade(look.skin,.35);c.lineWidth=2;c.lineCap='round';
        const cx=(j.lShoulder.x+j.rShoulder.x)/2,cy=(j.lShoulder.y+j.rShoulder.y)/2+look.torsoLen*.16;
        for(const dx of[-10,8]){c.beginPath();c.moveTo(cx+dx-6,cy-14);c.lineTo(cx+dx+5,cy+16);c.stroke()}}
      if(p==='horns'){ // two curved horns sweeping up and back from the temples
        c.strokeStyle='#e8ded0';c.lineWidth=5;c.lineCap='round';
        for(const s of[-1,1]){c.beginPath();c.moveTo(j.head.x+s*look.headR*.5,j.head.y-look.headR*.7);
          c.quadraticCurveTo(j.head.x+s*look.headR*1.3,j.head.y-look.headR*1.5,
            j.head.x+s*look.headR*1.05,j.head.y-look.headR*2.1);c.stroke()}}
      if(p==='spikedclub'){ // a bigger, spiked take on the human rig's 'club' prop
        const h=j.rHand,len=look.armLen*.6;
        c.strokeStyle=look.secondary;c.lineWidth=16;c.lineCap='round';
        c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.x+face*len*.3,h.y-len);c.stroke();
        c.fillStyle='#c9c2b0';
        for(let i=0;i<4;i++){const t=.25+i*.2,px=h.x+face*len*.3*t,py=h.y-len*t;
          c.beginPath();c.moveTo(px,py);c.lineTo(px+face*7,py-3);c.lineTo(px,py+5);c.closePath();c.fill()}}}
    c.restore()},
  // Quadruped draw: same shading philosophy as the human draw() (thick rounded-cap limb strokes with
  // a dark outline under the fill, back-limbs-then-body-then-front-limbs layering) built around the
  // horizontal body capsule (hip->spine->chest) instead of a torso hexagon. look is passed through
  // from draw()'s dispatch so it doesn't re-resolve lookFor(F.def) a second time; solveQuad's own
  // callers (tests, the dispatch below) can still call it directly without one.
  drawQuad(c,F,cam,frame,look){
    look=look||lookFor(F.def);
    const scale=F.def.scale||1,face=F.face;
    const{key,t01}=this.poseFor(F),j=this.solveQuad(look,key,t01,face);
    const skinDark=shade(look.skin,-.35);
    c.save();c.translate(F.x,FLOOR);c.scale(scale,scale);
    const limb=(p,q,w,col)=>{c.lineCap='round';
      c.lineWidth=w+3;c.strokeStyle=shade(col||look.skin,-.35);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
      c.lineWidth=w;c.strokeStyle=col||look.skin;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke()};
    const paw=(p)=>{const r=look.legW*.58;c.fillStyle=look.skin;c.strokeStyle=skinDark;c.lineWidth=1.2;
      c.beginPath();c.ellipse(p.x,p.y,r,r*.72,0,0,Math.PI*2);c.fill();c.stroke()};
    // back legs first (behind the body), then the tail (base tucks under the hip). Upper legs
    // noticeably thicker than lower (.55 taper, was .78 in round 1 — art review called the whole rig
    // "wire-bodied" and this taper is part of giving it real limb volume, matching the human rig's
    // own thigh/shin taper).
    limb(j.blHip,j.bl1,look.legW);limb(j.bl1,j.bl2,look.legW*.55);paw(j.bl2);
    limb(j.brHip,j.br1,look.legW);limb(j.br1,j.br2,look.legW*.55);paw(j.br2);
    limb(j.hip,j.tail1,look.legW*.6,look.tailTint);limb(j.tail1,j.tail2,look.legW*.42,look.tailTint);
    c.fillStyle=look.tailTint||look.skin;c.beginPath();c.arc(j.tail2.x,j.tail2.y,look.legW*.26,0,Math.PI*2);c.fill();
    // Filled body: art review (Fix round 1) called the original hip->chest stroke (width
    // look.legW*2.1, ~31.5 for donut over a 170-unit body) a "noodle" next to the human rig's filled
    // torso. bodyW is now tied to bodyLen itself (0.42x) instead of leg thickness, so trimming
    // bodyLen (also done this round) and widening the body are the same lever — a round, low body
    // instead of a thin long one. Still drawn as a thick round-capped/joined stroke along
    // hip->spine->chest (so it follows the spine's pitch bend during pounces/rear-ups instead of a
    // rigid ellipse), plus a rounder-chest roundel at the front end and a lighter belly band.
    c.lineCap='round';c.lineJoin='round';
    const bodyW=look.bodyLen*.42;
    c.lineWidth=bodyW+4;c.strokeStyle=skinDark;
    c.beginPath();c.moveTo(j.hip.x,j.hip.y);c.lineTo(j.spine.x,j.spine.y);c.lineTo(j.chest.x,j.chest.y);c.stroke();
    c.lineWidth=bodyW;c.strokeStyle=look.skin;
    c.beginPath();c.moveTo(j.hip.x,j.hip.y);c.lineTo(j.spine.x,j.spine.y);c.lineTo(j.chest.x,j.chest.y);c.stroke();
    c.fillStyle=look.skin;c.beginPath();c.ellipse(j.chest.x,j.chest.y,bodyW*.62,bodyW*.58,0,0,Math.PI*2);c.fill();
    c.lineWidth=1.5;c.strokeStyle=skinDark;c.stroke();
    c.fillStyle=shade(look.skin,.2);c.beginPath();
    c.ellipse((j.hip.x+j.chest.x)/2,(j.hip.y+j.chest.y)/2+bodyW*.26,look.bodyLen*.36,bodyW*.26,0,0,Math.PI*2);c.fill();
    limb(j.chest,j.neck,bodyW*.5);
    // head: a distinct headFill for the grub's dark capsule, otherwise the body's own skin color
    const headFill=look.headFill||look.skin;
    c.fillStyle=headFill;c.beginPath();c.arc(j.head.x,j.head.y,look.headR,0,Math.PI*2);c.fill();
    c.lineWidth=1.5;c.strokeStyle=shade(headFill,-.35);c.stroke();
    if(look.species==='cat'||look.species==='rat'){ // cat: small pointed ears; rat: bigger rounded ears
      // ey pulls the ear's base well above the head-circle center (not just "above center") so the
      // tip clears the head's own top edge (-headR) by a visible margin instead of reading as a
      // notch cut into the head silhouette — round 1 (ey:-.55) left the ear mostly hidden inside the
      // head circle, which is why the first donut screenshot pass showed no visible ears.
      const big=look.species==='rat',er=look.headR*(big?.78:.7),ex=look.headR*(big?.6:.6),ey=-look.headR*.98;
      for(const s of[-1,1]){
        const bx=j.head.x+s*ex*face,by=j.head.y+ey;
        c.fillStyle=headFill;c.strokeStyle=shade(headFill,-.35);c.lineWidth=1.3;c.beginPath();
        if(big)c.ellipse(bx,by,er*.9,er,0,0,Math.PI*2);
        else{c.moveTo(bx-er*.7,by+er*.6);c.lineTo(bx,by-er);c.lineTo(bx+er*.7,by+er*.6);c.closePath()}
        c.fill();c.stroke();
        if(look.earInner){c.fillStyle=look.earInner;c.beginPath();
          if(big)c.ellipse(bx,by,er*.5,er*.56,0,0,Math.PI*2);
          else{c.moveTo(bx-er*.4,by+er*.35);c.lineTo(bx,by-er*.5);c.lineTo(bx+er*.4,by+er*.35);c.closePath()}
          c.fill()}}}
    c.fillStyle=look.eye||'#141414';
    c.beginPath();c.arc(j.head.x+face*look.headR*.45,j.head.y-look.headR*.05,look.headR*.14,0,Math.PI*2);c.fill();
    // front legs, drawn last of the limbs so they sit in front of the body
    limb(j.flHip,j.fl1,look.legW);limb(j.fl1,j.fl2,look.legW*.55);paw(j.fl2);
    limb(j.frHip,j.fr1,look.legW);limb(j.fr1,j.fr2,look.legW*.55);paw(j.fr2);
    for(const p of look.props||[]){
      if(p==='tiara'){ // a small gold crown resting between the ears
        const w=look.headR*.7,h=look.headR*.42,cx=j.head.x,cy=j.head.y-look.headR*.9;
        c.fillStyle=look.accent||'#f4c542';c.strokeStyle='#8a6a10';c.lineWidth=1;
        c.beginPath();c.moveTo(cx-w,cy+h);c.lineTo(cx-w,cy);c.lineTo(cx-w*.5,cy+h*.5);
        c.lineTo(cx,cy-h*.2);c.lineTo(cx+w*.5,cy+h*.5);c.lineTo(cx+w,cy);c.lineTo(cx+w,cy+h);
        c.closePath();c.fill();c.stroke()}
      if(p==='whiskers'){c.strokeStyle='#4a4238';c.lineWidth=1.1;
        const wx=j.head.x+face*look.headR*.68,wy=j.head.y+look.headR*.12;
        for(const dy of[-9,0,9]){c.beginPath();c.moveTo(wx,wy+dy*.35);c.lineTo(wx+face*look.headR*1.35,wy+dy);c.stroke()}}
      if(p==='teeth'){const tx=j.head.x+face*look.headR*.85,ty=j.head.y+look.headR*.25;
        c.fillStyle=look.teeth||'#e8d24a';c.strokeStyle='#8a7a1a';c.lineWidth=.8;
        c.beginPath();c.moveTo(tx,ty);c.lineTo(tx+face*4,ty+6);c.lineTo(tx,ty+7);c.closePath();c.fill();c.stroke()}
      if(p==='segments'){ // a few dark banding rings across the body capsule, larva-style
        c.strokeStyle=look.segDark||skinDark;c.lineWidth=2;
        for(let i=1;i<4;i++){const t=i/4,px=j.hip.x+(j.chest.x-j.hip.x)*t,py=j.hip.y+(j.chest.y-j.hip.y)*t;
          c.beginPath();c.ellipse(px,py,3,bodyW*.55,0,0,Math.PI*2);c.stroke()}}}
    c.restore()},
  // HUD portrait: a small front-facing head-and-shoulders bust built straight from the look's
  // palette/proportions (not a crop of the side-view fight rig, which has no front-facing pose).
  // Cached on the look object itself, so it's built once per character regardless of how many
  // fighters (or hp-scaled encounter clones sharing the same look) use it.
  portrait(look){
    if(look.rig==='quad')return this.portraitQuad(look);
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
    look._portrait=cnv;return cnv},
  // Quadruped HUD bust: same front-facing head-and-shoulders shape language as the human portrait
  // (a fill wedge for shoulders, a round head on top) but with cat/rat ears, tiara/whiskers/teeth
  // props, and no hair — quads have no LOOKS.hair field.
  portraitQuad(look){
    if(look._portrait)return look._portrait;
    const S=56,cnv=document.createElement('canvas');cnv.width=S;cnv.height=S;
    const c=cnv.getContext('2d'),skinDark=shade(look.skin,-.35);
    const cx=S/2,headR=Math.min(18,look.headR*.72),headY=S*0.46,shW=Math.min(S*0.85,look.bodyLen*.3),shY=S*0.7;
    const headFill=look.headFill||look.skin,props=look.props||[];
    if(look.species==='cat'||look.species==='rat'){ // drawn behind the head so the head fill covers each ear's base
      const big=look.species==='rat',er=headR*(big?.7:.55),ex=headR*(big?.62:.65),ey=-headR*.82;
      for(const s of[-1,1]){const bx=cx+s*ex,by=headY+ey;
        c.fillStyle=headFill;c.strokeStyle=shade(headFill,-.35);c.lineWidth=1.2;c.beginPath();
        if(big)c.ellipse(bx,by,er*.9,er,0,0,Math.PI*2);
        else{c.moveTo(bx-er*.7,by+er*.6);c.lineTo(bx,by-er);c.lineTo(bx+er*.7,by+er*.6);c.closePath()}
        c.fill();c.stroke();
        if(look.earInner){c.fillStyle=look.earInner;c.beginPath();
          if(big)c.ellipse(bx,by,er*.5,er*.56,0,0,Math.PI*2);
          else{c.moveTo(bx-er*.4,by+er*.35);c.lineTo(bx,by-er*.5);c.lineTo(bx+er*.4,by+er*.35);c.closePath()}
          c.fill()}}}
    c.fillStyle=look.skin;
    c.beginPath();c.moveTo(cx-shW/2,S+4);c.lineTo(cx-shW*.32,shY);c.lineTo(cx+shW*.32,shY);c.lineTo(cx+shW/2,S+4);c.closePath();c.fill();
    c.strokeStyle=skinDark;c.lineWidth=1.5;c.stroke();
    c.fillStyle=headFill;c.beginPath();c.arc(cx,headY,headR,0,Math.PI*2);c.fill();
    c.lineWidth=1.5;c.strokeStyle=shade(headFill,-.35);c.stroke();
    c.fillStyle=look.eye||'#141414';
    c.beginPath();c.arc(cx-headR*.4,headY-1,1.6,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(cx+headR*.4,headY-1,1.6,0,Math.PI*2);c.fill();
    if(props.includes('tiara')){
      const w=headR*.7,h=headR*.42,tcx=cx,tcy=headY-headR*.95;
      c.fillStyle=look.accent||'#f4c542';c.strokeStyle='#8a6a10';c.lineWidth=1;
      c.beginPath();c.moveTo(tcx-w,tcy+h);c.lineTo(tcx-w,tcy);c.lineTo(tcx-w*.5,tcy+h*.5);
      c.lineTo(tcx,tcy-h*.2);c.lineTo(tcx+w*.5,tcy+h*.5);c.lineTo(tcx+w,tcy);c.lineTo(tcx+w,tcy+h);
      c.closePath();c.fill();c.stroke()}
    if(props.includes('whiskers')){c.strokeStyle='#4a4238';c.lineWidth=1;
      for(const s of[-1,1])for(const dy of[-5,0,5]){c.beginPath();c.moveTo(cx+s*headR*.7,headY+dy*.35);c.lineTo(cx+s*headR*1.6,headY+dy);c.stroke()}}
    if(props.includes('teeth')){c.fillStyle=look.teeth||'#e8d24a';c.strokeStyle='#8a7a1a';c.lineWidth=.7;
      for(const s of[-1,1]){c.beginPath();c.moveTo(cx+s*headR*.28,headY+headR*.55);c.lineTo(cx+s*headR*.5,headY+headR*.55);
        c.lineTo(cx+s*headR*.39,headY+headR*.8);c.closePath();c.fill();c.stroke()}}
    look._portrait=cnv;return cnv}};
for(const id in DEFS)if(LOOKS[id])DEFS[id].look=LOOKS[id];

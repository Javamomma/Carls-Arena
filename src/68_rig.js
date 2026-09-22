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
// Medium (Task 6.5 / Phase 6 ruling 4: KICK is a leg strike in every rig): a rear-leg front kick, not
// an arm move at all — anticipation (t:0) pulls weight back and lifts the rear (right) knee; strike
// (t:.43, chosen so it lands inside the move's own active window — MOVES.medium is
// startup:10/active:4/recovery:14, active frames 10-13 of 28, t01 in [0.357,0.5) — so the hitbox's
// active frames coincide with the foot's own furthest-forward point, not some other part of the
// swing) snaps the rear leg forward and up to roughly hip height while the torso leans back ~20deg;
// recovery (t:1) draws the leg back in. The lead (left) arm counterbalances the backward torso lean
// by swinging forward just enough that its HAND stays near its own idle position in absolute (not
// torso-relative) x — a torso lean this size drags the whole shoulder girdle back with it (neck.x
// shifts by torsoLen*sin(torsoA)), so the arm has to actively compensate, not just hold its idle
// angle, to read as "counterbalancing" rather than "also flung backward". The right ARM (rShoulder/
// rElbow, independent of the right LEG doing the kick — arms and legs are separate FK chains off the
// same shoulder/hip attach points) swings back for a real visual counterbalance, unconstrained by any
// test. Silhouette (a raised, extended leg with a back-leaning torso) reads nothing like light1's
// near-upright jab or heavy's vertical wind-up-then-smash, and nothing like the old arm-lunge design
// this replaces — see the 'kick: medium's active-phase pose...' test (90_tests.js) for the frozen
// "foot >=60px forward of idle, lead hand within 20px of idle" pose contract this satisfies for all
// three rig kinds, and 40_movedata.js's MOVES.medium comment for why hitting exactly hip height/20deg
// isn't load-bearing (only the two pose-test numbers are).
POSES.medium=[
  {t:0, ang:{torso:D(-10),rHip:D(-46),rKnee:D(78),lHip:D(-6),lKnee:D(8),
             lShoulder:D(10),lElbow:D(50),rShoulder:D(-28),rElbow:D(46)},off:{x:-6,y:0}},
  {t:.43,ang:{torso:D(-20),rHip:D(80),rKnee:D(8),lHip:D(4),lKnee:D(-4),
             lShoulder:D(45),lElbow:D(48),rShoulder:D(-46),rElbow:D(18)},off:{x:6,y:-2}},
  {t:1, ang:{torso:D(4), rHip:D(10),rKnee:D(-4),lHip:D(-10),lKnee:D(10),
             lShoulder:D(6),lElbow:D(52),rShoulder:D(-6),rElbow:D(30)},off:{x:0,y:0}}];
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
// Medium (Task 6.5 / Phase 6 ruling 4, quad carve-out — Fix round 2, controller ruling): a rearing
// double-front-paw slam, not the hind-leg buck this pose started as. Round 1's hind-leg buck (kept
// only in this comment's own git history, not below) numerically satisfied "leg travels forward
// >=60px" but the striking leg swung AWAY from the foe (behind the body, toward the tail side) once
// actually viewed in a screenshot — a hind leg attached at the REAR of a quadruped simply cannot kick
// something standing in FRONT without an impossible whole-body spin, which the frozen ruling's own
// "KICK is a leg strike in every rig" language didn't anticipate for a quadruped's proportions. The
// controller ruling carves the quad rig out of "leg" specifically and into "front paws, with visible
// claws/pads" instead — still reads as a strike that isn't the arm-equivalent (front paws are what
// pawSwipe()/light1-5 already use, but this move's rearing wind-up and both-paws-at-once strike read
// nothing like a single light swipe's small flick, matching "a leg strike, not an arm move" in spirit
// even though the striking limb is anatomically a foreleg here).
// anticipation (t:0): the cat rocks BACK onto its hind legs — hips drop (off.y:10, cheap in reach, see
// Rig.extent's own comment on off.y) while the front half rears up (spine+chest pitch to a combined
// ~40deg, the literal "chest rises ~40deg" ask — solveQuad's chain accumulates pitch, chestA=spineA+
// a('chest'), so spine:20+chest:20 gets there) — front paws lift off the ground, hind legs bend to
// bear the shifted weight. strike (t:.43, chosen so it lands inside the move's own active window
// exactly like the human/big rigs above — see POSES.medium's own comment for the frame math, identical
// here since MOVES.medium is shared by every rig) drives both front paws forward and down from that
// reared height toward the foe — they land partway down (fl2.y roughly -70 to -75 for donut, well
// above true floor y=0, reading as "chest height" rather than a full ground slam) while the chest/
// spine ease back off their anticipation peak (a slam descending into the strike, not still rising)
// and the neck pitches up (neck:36, "head thrust forward"). recovery (t:1) drops back to an ordinary
// all-fours idle-like stance. See the 'kick: medium's active-phase pose...' test (90_tests.js) for the
// frozen ">=60px forward of idle, front paw driven" contract this satisfies for the quad rig (checked
// via fl2, the same joint the pre-existing 'quad light1...' test already uses as its representative
// paw) — donut/mother_rat's reach budget (EDGE_PAD, see their own LOOKS comments) is already close to
// its ceiling from OTHER poses (light5/s2/s3), so this slam was tuned (flU/flL, off.x) to land inside
// that existing budget with real margin (reach 253.7/250.8 vs the 260 ceiling) rather than becoming
// the new worst case; `top` is unaffected (210.0/234.5, matching every pre-existing pose's own ceiling)
// — the rear-up's own peak height never exceeds each look's already-tallest pose (s3/knockdown/win).
// Fix-wave item 9 (final review, Minor): the deferred-item triage found the round-2 re-spec still
// reading as a lunge, not a slam -- "no anticipation frame, hind legs hidden inside the body capsule".
// t:0 already carried SOME rear-up pitch, but the hind legs (blU/blL/brU/brL) barely differed from
// POSES_QUAD.idle's own near-straight stance, so the coil never read as distinct from a plain idle-ish
// pose. Deepened the hind-leg crouch (a real weight-bearing bend, not a token lift) and the hip drop
// (off.y 10->16, the "hips drop" ask -- see off.y's own reach-is-cheap comment further up this file),
// and dialled spine/chest to the frozen "chest up ~30deg" (solveQuad's own chain: chestA=spineA+
// a('chest'), so spine:14+chest:16 lands exactly there).
POSES_QUAD.medium=[
  {t:0, ang:{spine:D(14),chest:D(16),neck:D(20),tail1:D(10),tail2:D(-4),
             flU:D(-40),flL:D(30),frU:D(-36),frL:D(28),
             blU:D(36),blL:D(-28),brU:D(34),brL:D(-26)},off:{x:-6,y:16}},
  {t:.43,ang:{spine:D(8),chest:D(10),neck:D(36),tail1:D(4),tail2:D(2),
             flU:D(78),flL:D(-26),frU:D(74),frL:D(-24),
             blU:D(16),blL:D(-10),brU:D(14),brL:D(-8)},off:{x:12,y:0}},
  {t:1, ang:{spine:D(2),chest:D(2),neck:D(32),tail1:D(10),tail2:D(-4),
             flU:D(-2),flL:D(4),frU:D(2),frL:D(-2),
             blU:D(-4),blL:D(5),brU:D(6),brL:D(-6)},off:{x:0,y:0}}];
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
// Note (Task 6.5 review, big-rig legs during arm moves): jab()'s keyframes never set lHip/rHip/
// lKnee/rKnee, so samplePose's per-pose angKeys union has no leg entries for light1 (or light2-5,
// heavy, s1-3, every other jab()/flurry()-built POSES_BIG move) and the legs render at angle 0
// ("attention") instead of holding POSES_BIG.idle's own small stance angles during any of them —
// pre-existing, not introduced by this task, and out of this task's scope to fix (see the "light1
// keeps legs near idle" contrast test in 90_tests.js, which only checks the human/quad rigs because
// of this).
POSES_BIG.light1=jab('r',{startSh:-10,startEl:36,peakSh:66,peakEl:22,peakOffX:12,torsoPeak:6});
POSES_BIG.light2=jab('l',{startSh:-10,startEl:36,peakSh:72,peakEl:22,peakOffX:14,torsoPeak:7});
POSES_BIG.light3=jab('r',{startSh:-10,startEl:38,peakSh:78,peakEl:20,peakOffX:16,torsoPeak:8});
POSES_BIG.light4=jab('l',{startSh:-10,startEl:38,peakSh:84,peakEl:20,peakOffX:18,torsoPeak:9});
POSES_BIG.light5=jab('r',{startSh:-12,startEl:42,peakSh:94,peakEl:12,peakOffX:24,torsoPeak:10});
// Medium (Task 6.5 / Phase 6 ruling 4: KICK is a leg strike in every rig): a stomping front kick, not
// the old driving shoulder charge. Torso stays close to upright (a small angle on top of look.hunch,
// unlike the human rig's dramatic 20deg back-lean — a brute's stomp reads as weight driven STRAIGHT
// DOWN through the kick, not a back-leaning snap) while both fists stay near their own idle guard
// position throughout — "both fists guarding" — rather than the human rig's single counterbalancing
// lead arm; the right leg (rHip/rKnee, independent of the right ARM doing the guard — arms and legs
// are separate FK chains) lifts the knee high and pushes the foot forward at roughly chest height (a
// much bigger vertical reach than the human kick's hip-height, matching a stomping brute's longer
// legs and lower stance). Strike lands at t:.43, same active-window reasoning as POSES.medium's own
// comment (MOVES.medium is shared by every rig). See the 'kick: medium's active-phase pose...' test
// (90_tests.js) for the frozen "foot >=60px forward of idle, guard hand within 20px of idle" contract
// this satisfies for all three rig kinds — Mongo/Grull's own reach budget has real margin here (their
// worst-case reach across the whole pose set is s3/knockdown, not this kick), unlike the human/quad
// rigs' much tighter budgets (see those tables' own comments).
// Fix-wave item 9 (final review, Minor): the active-frame rHip/rKnee (106/24) put the kicking foot
// only ~5px below the torso joint (chest height's own representative joint in this rig -- see
// solveBig's hip/torso/waist/neck chain) with next to no margin, which the final review's hands-on
// screenshot read as a head-height kick rather than the frozen "stomping front kick... at roughly
// chest height" contract. Retuned to rHip:95/rKnee:20 (tot 115) so the foot lands close to the
// midpoint between hip.y and torso.y with real margin on both sides -- still clears the >=60px-forward
// bar with room to spare (measured ~150px forward of idle at Mongo's own proportions) and keeps this
// well inside the existing reach budget (Mongo's own worst-case pose is still s3/knockdown, unaffected
// by this change). See the 'kick: medium's active-phase pose...' test (90_tests.js), extended to assert
// this foot-height contract directly instead of only forward distance.
POSES_BIG.medium=[
  {t:0, ang:{torso:D(2),head:D(-2),rHip:D(-40),rKnee:D(70),lHip:D(-4),lKnee:D(6),
             lShoulder:D(10),lElbow:D(62),rShoulder:D(14),rElbow:D(62)},off:{x:-4,y:8}},
  {t:.43,ang:{torso:D(4),head:D(-2),rHip:D(95),rKnee:D(20),lHip:D(6),lKnee:D(-4),
             lShoulder:D(16),lElbow:D(66),rShoulder:D(20),rElbow:D(66)},off:{x:4,y:4}},
  {t:1, ang:{torso:D(1),rHip:D(12),rKnee:D(-6),lHip:D(-10),lKnee:D(10),
             lShoulder:D(4),lElbow:D(64),rShoulder:D(16),rElbow:D(64)},off:{x:0,y:0}}];
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
  // Task 8.1: every human look also carries a `.body` block — the layered-vector spec BodyStyle
  // reads (outline color, the two skin shade stops, the cloth kinds worn on torso/legs, and the
  // face module's eyes/brow/mouth/hair/ears/horns). It is PURELY additive: no proportion, palette
  // or prop field above it changed, so Rig.solve/Rig.extent/Rig.topAt (and therefore every
  // HUD-clearance, reach and zoom-cap number the earlier phases pinned) are bit-identical to
  // before the body layer existed. See the 'human-look extent snapshot' test (90_tests.js) for the
  // table that holds that claim.
  carl:{skin:'#d9a066',hair:'#241610',primary:'#3a3226',secondary:'#c0392b',
    limb:20,legLen:114,armLen:101,torsoLen:91,headR:25,shoulderW:83,hipW:53,waistW:40,earLen:0,bareFeet:true,
    props:['boxers','vest','bandages'],
    // Torn open vest over a bare, defined chest; red heart boxers; wrapped hands; bare feet; a dark
    // messy crop and a blue-grey iris — the rendition's own Carl (docs/reference/rendition.jpg).
    body:{outline:'#1c120a',skinShade:[-0.34,0.20],
      cloth:{torso:'vest',legs:'shorts',primary:'#3a3226',secondary:'#c0392b'},
      face:{eyes:'human',iris:'#5b7c93',brow:true,mouth:'human',hair:'crop',ears:'human',horns:false}}},
  katia:{skin:'#c98a5e',hair:'#171310',primary:'#232f2b',secondary:'#48594f',
    limb:12,legLen:117,armLen:91,torsoLen:78,headR:20,shoulderW:38,hipW:28,earLen:0,
    props:['gear'],
    // Full-coverage practical gear (the 'gear' prop's intent, now drawn as real cloth): a dark
    // green tunic with a belt, matching trousers, long black hair.
    body:{outline:'#100d0b',skinShade:[-0.30,0.17],
      cloth:{torso:'shirt',legs:'pants',primary:'#232f2b',secondary:'#48594f'},
      face:{eyes:'human',iris:'#7fa98c',brow:true,mouth:'human',hair:'long',ears:'human',horns:false}}},
  goblin:{skin:'#5f8a3f',hair:null,primary:'#4a3b28',secondary:'#7a6248',
    limb:13,legLen:82,armLen:72,torsoLen:58,headR:18,shoulderW:33,hipW:21,earLen:29,
    props:['rags','dagger'],
    // Scavenger rags over a scrawny green frame, long pointed ears (earLen still drives their
    // size), a jutting nose, a yellow slit eye and a lower fang — the rendition's scavenger.
    body:{outline:'#16240d',skinShade:[-0.36,0.24],
      cloth:{torso:'vest',legs:'shorts',primary:'#4a3b28',secondary:'#7a6248'},
      face:{eyes:'goblin',iris:'#e3c74a',brow:true,mouth:'fangs',hair:'none',ears:'pointed',horns:false}}},
  // Fix round 2: trimmed back from the round-1 numbers, which combined with def.scale=1.2 (a
  // second, canvas-level multiplier on top of these) made the hobgoblin's overhead reach the worst
  // case in the whole roster by a wide margin at max zoom — see EDGE_PAD and the HUD-safety test.
  hobgoblin:{skin:'#5c6b52',hair:null,primary:'#3d3428',secondary:'#6b5c46',
    limb:23,legLen:106,armLen:99,torsoLen:86,headR:25,shoulderW:65,hipW:40,earLen:18,
    props:['rags','club'],
    // The goblin's bigger cousin: same rag/fang/pointed-ear language, heavier build, plus a pair of
    // small stub horns. horns:'small' is a FACE-module decoration, not the 'horns' PROP grull wears
    // (propExtra), so it is drawn well inside the head circle's own bound and adds no extent.
    body:{outline:'#141a10',skinShade:[-0.33,0.21],
      cloth:{torso:'vest',legs:'pants',primary:'#3d3428',secondary:'#6b5c46'},
      face:{eyes:'goblin',iris:'#d8913a',brow:true,mouth:'fangs',hair:'none',ears:'pointed',horns:'small'}}},
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
  // Fix-wave item 9: bodyLen 144->134. solveQuad's body chain (hip->spine->chest, each segment
  // bodyLen*.5*cos(angle)) puts the chest very nearly a full bodyLen forward of the hip even at small
  // pitch angles, and everything downstream (neck, head, and the 'whiskers' prop off the head) rides
  // on top of that — 'medium's own forward lean made the whisker tip Donut's true worst-case reach
  // point, 266.5px, past EDGE_PAD (260, bumped from 220 in item 3). This is the "quad EDGE_PAD
  // carve-out" the final review flagged as a real, player-visible gap (Important) between the rig's
  // drawn reach and the sim's wall-clamp budget. Trimmed until Rig.extent's reach (props included)
  // clears 260 with real margin (257.2 to the old 266.5), not just past it by a rounding error.
  donut:{rig:'quad',species:'cat',skin:'#f7ecdc',earInner:'#f6b8d6',eye:'#3f7fd6',accent:'#f4c542',
    hipH:65,legLen:65,bodyLen:134,neckLen:46,headR:26,tailLen:120,
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
    props:['rags','dagger'],
    // cloth 'bone' is not an overlay at all — it swaps the limb tube for a shaft-and-knob bone and
    // the torso for a rib cage over a dark void, so the skeleton reads as bone rather than a
    // bone-COLORED body. eyes:'skull' is the dark socket with an ember (Phase 8 ruling).
    body:{outline:'#4a4131',skinShade:[-0.24,0.15],
      cloth:{torso:'bone',legs:'bone',primary:'#2a2a2a',secondary:'#555555'},
      face:{eyes:'skull',iris:'#ff8a2a',brow:false,mouth:'none',hair:'none',ears:'none',horns:false}}},
  // PLACEHOLDER (Task 3.4/3.5): a copy of Donut's proportions with a mystic-purple palette and
  // rig:'human' set explicitly.
  shaman:{skin:'#8a6aa8',hair:'#2a1a3a',primary:'#4a2f6a',secondary:'#8a4fae',
    limb:14,legLen:107,armLen:88,torsoLen:74,headR:23,shoulderW:39,hipW:29,earLen:0,rig:'human',
    props:['gear'],
    // cloth.torso:'robe' is what carries the hood (Phase 8 ruling: "the shaman keeps its hood
    // shape") — the frozen face schema has no hood field, so BodyStyle.head draws the cowl for any
    // look whose TORSO cloth is 'robe', keeping the hood and the robe a single wardrobe decision.
    body:{outline:'#1a1026',skinShade:[-0.32,0.22],
      cloth:{torso:'robe',legs:'robe',primary:'#4a2f6a',secondary:'#8a4fae'},
      face:{eyes:'human',iris:'#e0c84a',brow:true,mouth:'human',hair:'none',ears:'human',horns:false}}},
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
  // Mother Rat (boss): Task 3.4's RigQuad bone set at boss scale (def.scale, 40_movedata.js's
  // BOSSES.mother_rat, applied on top of these already-large numbers). Grey-brown fur, a long pink
  // tail, big rounded ears, and yellow teeth drawn in drawQuad.
  // Fix round 1 (art review): bodyLen trimmed ~15% (170->144), legW bumped (18->20) for "bulkier
  // chest/haunches" on top of the filled-capsule body drawQuad now draws for every quad look.
  // Fix-wave item 9: def.scale 1.3->1.15 and bodyLen 144->125 — same "quad EDGE_PAD carve-out" gap
  // as Donut above (solveQuad's body chain puts most of a look's reach a bodyLen forward of the hip),
  // compounded here by the 1.3x boss scale on top of it: 310.9px reach at the old numbers, nearly 1.5x
  // EDGE_PAD (260, bumped from 220 in item 3). Scale alone (1.3->1.15) only got to 275.1; bodyLen
  // trimmed further on top clears 260 with real margin (254.7).
  mother_rat:{rig:'quad',species:'rat',skin:'#6b5a4a',earInner:'#d98fa0',tailTint:'#d98fa0',
    teeth:'#e8d24a',eye:'#1a1a1a',
    hipH:65,legLen:65,bodyLen:125,neckLen:42,headR:26,tailLen:170,
    frontW:22,backW:26,legW:20,
    props:['teeth']}};
// Task 8.1: every look learns its own key, so BodyStyle's offscreen cache can name its entries
// (`look|bone|face|zoomBucket`) without every call site threading an id down. Assigned here rather
// than written into each literal above so it can never drift from the key it is filed under.
for(const id in LOOKS)LOOKS[id].id=id;

// Resolves a def's look, falling back to LOOKS.carl (once, with a console.warn) for a Phase-3-added
// def that ships without one, instead of every reader (Rig.draw, Render.overlayY/shadow) crashing on
// an unguarded F.def.look dereference. Shared across 68_rig.js/70_render.js via plain global scope.
let _warnedNoLook=false;
function lookFor(def){
  if(def.look)return def.look;
  if(!_warnedNoLook){_warnedNoLook=true;
    console.warn('Rig: def "'+(def.id||'?')+'" has no .look; falling back to LOOKS.carl')}
  return LOOKS.carl}

// ---- Task 5.5: optional sprite atlas hook -----------------------------------------------------
// ATLAS[lookId] is the single source of truth Rig.draw's short-circuit (below) reads every frame:
// undefined = never loaded/attempted (draw the FK rig, as always); a Promise = a real fetch is in
// flight (still draw the FK rig -- this is what "never blocks first render" means in practice: the
// rig path keeps drawing every frame until the promise resolves); a plain {img,meta} object or null
// = settled (an atlas to draw from, or a permanent "this look has none" -- also draw the FK rig).
// Kept as a bare global object (not a property on Atlas) specifically so a test can assign a
// synthetic {img,meta} straight onto ATLAS.<lookId> without going through Atlas.load at all, per the
// frozen interface ("Rig.draw uses ATLAS[lookId] when present").
const ATLAS={};
const Atlas={
  // Promise<{img,meta}|null>, cached in ATLAS[lookId] itself (see the comment above): while a real
  // fetch is in flight the SAME promise this call returns sits in ATLAS[lookId], so a second
  // concurrent Atlas.load(lookId) call finds it there and returns that exact cached promise instead
  // of starting a second fetch; once it settles, ATLAS[lookId] is overwritten with the resolved
  // value ({img,meta} or null) itself, which is what Rig.draw actually reads. Never fetches unless
  // Save.data.settings.useAtlas is true or the page URL has ?atlas=1 (Ruling #4) -- the disabled
  // path resolves null WITHOUT writing to ATLAS at all, so flipping the setting on later and
  // starting a fresh fight can still trigger a real, uncached attempt.
  load(lookId){
    if(lookId in ATLAS){
      const cached=ATLAS[lookId];
      return cached&&typeof cached.then==='function'?cached:Promise.resolve(cached)}
    const enabled=!!(Save.data&&Save.data.settings&&Save.data.settings.useAtlas)||/(?:^|[?&])atlas=1(?:&|$)/.test(location.search);
    if(!enabled)return Promise.resolve(null);
    // Missing files, bad JSON, and a rejected/thrown fetch (file:// rejects rather than 404ing) all
    // funnel through this one try/catch into a clean null -- Atlas.load itself must never throw or
    // leave a rejected promise for a caller (G.startFight below) that never attaches a .catch.
    const p=(async()=>{
      try{
        const res=await fetch('assets/'+lookId+'/sheet.json');
        if(!res||!res.ok)return null;
        const meta=await res.json();
        if(!meta||typeof meta!=='object'||!meta.frame||!meta.poses)return null;
        const img=await new Promise(resolve=>{
          const im=new Image();
          im.onload=()=>resolve(im);
          im.onerror=()=>resolve(null);
          im.src='assets/'+lookId+'/sheet.png'});
        return img?{img,meta}:null
      }catch(e){return null}
    })().then(result=>{ATLAS[lookId]=result;return result});
    ATLAS[lookId]=p;
    return p}};

// ---- Task 8.1: BodyStyle -- the layered vector body/face renderer for the human rig ------------
// Replaces the old draw() primitives (a two-pass round-cap stroke per limb, one flat hexagon for the
// torso, a flat circle head with a single 1.6px eye dot) with real layered art: gradient-shaded,
// outlined, tapered limb tubes with cloth over them; a torso split into chest and abdomen under a
// cloth layer; and a head carrying an actual face that changes with what the fighter is doing.
// Reference: docs/reference/rendition.jpg -- lit wet-stone dungeon, gritty painted realism. The
// target is a good STYLIZED game read at 854x480, not a repaint of that image.
//
// PERF -- why every layer can be baked once and blitted forever after. Every part this draws is a
// rigid shape under an affine function of the pose, which is not obvious until you look for it:
//   * a bone (upper arm, forearm, thigh, shin) has a FIXED length for a given look -- Rig.solve
//     splits armLen/legLen in half and never varies them -- so its art is one bitmap plus a
//     rotate() about the proximal joint;
//   * the head is a rigid disc-plus-features that only translates and rotates (by face*headA);
//   * the TORSO looks non-rigid, and it genuinely does shear -- solve() hangs the shoulders off the
//     neck with an axis-aligned +/-shoulderW/2 offset that does NOT rotate with the torso -- but
//     that shear is exactly linear in the pose. With (sx,sy) the hip->chest vector and L its length,
//         (lx,ly) -> (hip.x + lx - (sx/L)*ly,  hip.y - (sy/L)*ly)
//     maps the upright local torso onto the real one for ANY torso angle: ly=0 lands the hips, ly=-L
//     lands the shoulder line, and every intermediate ly lands the waist exactly where solve() puts
//     it. So one upright bitmap plus a 6-value c.transform() covers every pose the torso can reach.
// The cache is therefore keyed on look|part|face|zoomBucket and nothing pose-dependent, which is what
// the "600 frames add no cache entries" test (90_tests.js) actually proves.
//
// `lit` is accepted by limb/torso/head and ignored while undefined -- Task 8.3 (stage lighting) is
// what supplies it. Nothing here consumes randomness of any kind (no presRng, no Math.random): the
// art is a pure function of the look, so two fighters sharing a look share every bitmap.
const HEAD_STATES=['idle','hit','ko','block','attack','win'];
const BodyStyle={
  _cache:{},
  // Bitmap pixels per world unit at zoom bucket 1. 2x, so a bucket-1 bitmap blitted at the fight
  // camera's usual ~1.0-1.3 zoom is DOWNsampled rather than magnified -- a rotated blit of an
  // exactly-1:1 bitmap aliases badly along a limb's outline.
  SS:2,
  cacheCount(){return Object.keys(this._cache).length},
  clearCache(){this._cache={}},
  // The context's own world->device scale, quantized to 1/2 steps in [0.5,4]. Read off the live CTM
  // rather than off cam.zoom so every caller -- the fight camera, Render.shadow's vertically flipped
  // transform, a portrait's identity transform -- gets a bucket matching the pixels it will cover.
  zoomBucket(c){
    let s=1;
    if(c&&c.getTransform){
      const m=c.getTransform(),v=Math.hypot(m.a,m.b);
      if(isFinite(v)&&v>1e-4)s=v}
    return Math.max(.5,Math.min(4,Math.round(s*2)/2))},
  // look|part|face|zoomBucket -- the frozen key shape. face is folded into EVERY part, including the
  // ones whose art happens to be facing-symmetric today (a bone tube): Task 8.3's lighting makes
  // every part facing-dependent, and a key whose shape has to change then is a key that gets
  // forgotten. Two extra small bitmaps per look is not a memory problem.
  key(look,part,face,zb){return (look.id||'anon')+'|'+part+'|'+(face>0?'r':face<0?'l':'f')+'|'+zb},
  cache(key,w,h,paint){
    const hit=this._cache[key];
    if(hit)return hit;
    const cnv=document.createElement('canvas');
    cnv.width=Math.max(1,Math.ceil(w));cnv.height=Math.max(1,Math.ceil(h));
    paint(cnv.getContext('2d'),cnv.width,cnv.height);
    return this._cache[key]=cnv},

  // ---- pose key -> face state -------------------------------------------------------------------
  // The Phase 8 ruling's six expressions, reached with no new sim state at all: Rig.poseFor already
  // turns Fighter.state into a pose key every frame, so the face rides on that. 'dash' wears the
  // braced block face (a backdash is a defensive retreat, not an attack); 'getup' stays on the ko
  // face because a fighter pushing himself off the floor has not recovered his composure yet.
  FACE_STATE:{idle:'idle',walk:'idle',dash:'block',
    light1:'attack',light2:'attack',light3:'attack',light4:'attack',light5:'attack',
    medium:'attack',heavyCharge:'attack',heavy:'attack',s1:'attack',s2:'attack',s3:'attack',
    block:'block',blockstun:'block',hit:'hit',stunned:'hit',
    knockdown:'ko',getup:'ko',ko:'ko',win:'win'},
  faceState(poseKey){return this.FACE_STATE[poseKey]||'idle'},

  // ---- shared paint helpers ---------------------------------------------------------------------
  waistW(look){return look.waistW!==undefined?look.waistW:(look.hipW+look.shoulderW)/2*.8},
  // A cylinder's shade ACROSS the tube: dark rim, a highlight band on the up-side, core color, dark
  // underside. Baked across the bone's own axis rather than world-up, which is exactly what makes one
  // cached bitmap valid at every rotation the bone can reach.
  _tube(g,col,lo,hi,w){
    const gr=g.createLinearGradient(0,-w/2,0,w/2);
    gr.addColorStop(0,shade(col,lo*.55));
    gr.addColorStop(.22,shade(col,hi));
    gr.addColorStop(.55,col);
    gr.addColorStop(1,shade(col,lo));
    return gr},
  // A tapered capsule from (0,0) to (len,0), half-widths wa/wb, optionally grown by `grow` (used to
  // lay the outline down as a slightly larger copy of the same shape under the fill).
  _capsule(g,len,wa,wb,grow){
    const ra=Math.max(.2,wa/2+grow),rb=Math.max(.2,wb/2+grow);
    g.beginPath();
    g.arc(0,0,ra,Math.PI/2,Math.PI*1.5);
    g.lineTo(len,-rb);
    g.arc(len,0,rb,-Math.PI/2,Math.PI/2);
    g.closePath()},

  // ---- limb -------------------------------------------------------------------------------------
  // opts: {cloth, bone, face, w2, lit}. `bone` is a name for the cache key only; `cloth` is one of
  // bare/sleeve/pant/shorts/robe/ragged/wrap/bone/full (see Rig.clothFor; 'full' is used only by the
  // prone-torso underlay below).
  limb(c,x1,y1,x2,y2,w,look,opts){
    opts=opts||{};
    const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
    if(!(len>.01))return;
    const b=look&&look.body;
    if(!b){ // pre-8.1 fallback: the old two-pass stroke, for a look with no .body block
      const d=shade(look.skin,-.35);c.lineCap='round';
      c.lineWidth=w+3;c.strokeStyle=d;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
      c.lineWidth=w;c.strokeStyle=look.skin;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
      return}
    const face=opts.face||0,cloth=opts.cloth||'bare',bone=opts.bone||'limb';
    const w2=opts.w2!==undefined?opts.w2:w*.84;
    const zb=this.zoomBucket(c),px=this.SS*zb;
    // Bone lengths are constants of the look, so rounding len into the key is a no-op in practice --
    // it is here only so a caller passing an odd-length segment can never collide with a cached
    // bitmap of a different size.
    const part='limb:'+bone+':'+cloth+':'+Math.round(len)+':'+Math.round(w*4)+':'+Math.round(w2*4);
    const half=Math.max(w,w2)*.5+Math.max(4,w*.5); // outline + cloth bulge + bone-knob headroom
    const bw=Math.ceil((len+half*2)*px),bh=Math.ceil(half*2*px);
    const cv=this.cache(this.key(look,part,face,zb),bw,bh,g=>{
      g.scale(px,px);g.translate(half,half);
      this._paintLimb(g,len,w,w2,look,cloth)});
    c.save();
    c.translate(x1,y1);c.rotate(Math.atan2(dy,dx));
    c.drawImage(cv,-half,-half,cv.width/px,cv.height/px);
    c.restore()},
  _paintLimb(g,len,w,w2,look,cloth){
    const b=look.body,lo=b.skinShade[0],hi=b.skinShade[1];
    if(cloth==='bone')return this._paintBoneLimb(g,len,w,w2,look);
    g.lineJoin='round';
    // 1. outline -- the same capsule, grown, in the look's own outline color
    g.fillStyle=b.outline;this._capsule(g,len,w,w2,1.3);g.fill();
    // 2. skin
    this._capsule(g,len,w,w2,0);g.fillStyle=this._tube(g,look.skin,lo,hi,Math.max(w,w2));g.fill();
    // 3. muscle -- a long soft belly highlight up-side and a crease along the under-side, both scaled
    //    off the tube's own width so a forearm doesn't get a thigh's worth of definition
    g.save();
    g.globalAlpha=.45;g.fillStyle=shade(look.skin,Math.min(.95,hi*1.5));
    g.beginPath();g.ellipse(len*.40,-w*.16,len*.30,Math.max(.7,w*.16),0,0,Math.PI*2);g.fill();
    g.globalAlpha=.30;g.fillStyle=shade(look.skin,lo*.95);
    g.beginPath();g.ellipse(len*.54,w*.25,len*.28,Math.max(.6,w*.10),0,0,Math.PI*2);g.fill();
    g.restore();
    // 4. cloth
    if(cloth==='wrap'){ // hand wraps climbing the distal third of the forearm
      g.lineCap='butt';
      for(let i=0;i<3;i++){const t=len*(.62+i*.12);
        g.strokeStyle='#e6dccb';g.lineWidth=Math.max(1.4,w*.30);
        g.beginPath();g.moveTo(t,-w2*.62);g.lineTo(t-w2*.36,w2*.62);g.stroke();
        g.strokeStyle='rgba(58,46,32,.40)';g.lineWidth=Math.max(.6,w*.09);
        g.beginPath();g.moveTo(t+w2*.17,-w2*.62);g.lineTo(t-w2*.19,w2*.62);g.stroke()}
      return}
    if(cloth==='bare')return;
    const frac=cloth==='full'?1.0:cloth==='pant'?.84:cloth==='robe'?.60:cloth==='ragged'?.44:cloth==='shorts'?.36:.52;
    const L=len*frac,wa=w+2.4,wb=w2*(cloth==='robe'?1.34:1.0)+1.6;
    const prim=b.cloth.primary;
    g.fillStyle=b.outline;this._capsule(g,L,wa,wb,1.2);g.fill();
    const cg=g.createLinearGradient(0,-wa/2,0,wa/2);
    cg.addColorStop(0,shade(prim,-.34));cg.addColorStop(.24,shade(prim,.20));
    cg.addColorStop(.58,prim);cg.addColorStop(1,shade(prim,-.44));
    this._capsule(g,L,wa,wb,0);g.fillStyle=cg;g.fill();
    if(cloth==='ragged'){ // a torn hem: four alternating teeth across the cuff
      g.fillStyle=shade(prim,-.26);g.beginPath();
      const rb=wb/2;g.moveTo(L-1.2,-rb);
      for(let i=0;i<=4;i++)g.lineTo(L+(i%2?5.2:.6),-rb+rb*2*(i/4));
      g.lineTo(L-1.2,rb);g.closePath();g.fill()}
    else{g.strokeStyle=shade(b.cloth.secondary,-.08);g.lineWidth=Math.max(1.1,w*.15);
      g.beginPath();g.moveTo(L,-wb*.52);g.lineTo(L,wb*.52);g.stroke()}
    g.strokeStyle=shade(prim,-.32);g.lineWidth=Math.max(.7,w*.08);
    g.beginPath();g.moveTo(L*.26,-wa*.20);g.lineTo(L*.74,-wb*.10);g.stroke();
    g.beginPath();g.moveTo(L*.34,wa*.16);g.lineTo(L*.80,wb*.20);g.stroke()},
  // Skeleton limbs are not a bone-COLORED tube: a thin shaft between two lobed joint knobs, which is
  // what actually reads as bone at this scale.
  _paintBoneLimb(g,len,w,w2,look){
    const b=look.body,lo=b.skinShade[0],hi=b.skinShade[1];
    const shaft=Math.max(2.2,w*.44),ka=Math.max(2.6,w*.58),kb=Math.max(2.2,w2*.58);
    g.fillStyle=b.outline;
    this._capsule(g,len,shaft,shaft,1.2);g.fill();
    g.beginPath();g.arc(0,0,ka+1.2,0,Math.PI*2);g.fill();
    g.beginPath();g.arc(len,0,kb+1.2,0,Math.PI*2);g.fill();
    const gr=g.createLinearGradient(0,-ka,0,ka);
    gr.addColorStop(0,shade(look.skin,lo*.55));gr.addColorStop(.3,shade(look.skin,hi));
    gr.addColorStop(.7,look.skin);gr.addColorStop(1,shade(look.skin,lo));
    g.fillStyle=gr;
    this._capsule(g,len,shaft,shaft,0);g.fill();
    g.beginPath();g.arc(0,0,ka,0,Math.PI*2);g.fill();
    g.beginPath();g.arc(len,0,kb,0,Math.PI*2);g.fill();
    g.strokeStyle=shade(look.skin,lo*1.3);g.lineWidth=Math.max(.6,w*.08);
    g.beginPath();g.moveTo(0,-ka*.55);g.lineTo(0,ka*.55);g.stroke();
    g.beginPath();g.moveTo(len,-kb*.55);g.lineTo(len,kb*.55);g.stroke()},

  // ---- torso ------------------------------------------------------------------------------------
  // `chest` is the neck joint, `hip` the hip joint; every width comes from the look. See the header
  // comment for why the shear between them is an exact affine of one upright bitmap.
  torso(c,chest,hip,look,face,lit){
    const b=look&&look.body;
    if(!b)return;
    const sx=chest.x-hip.x,sy=chest.y-hip.y,L=Math.hypot(sx,sy);
    if(!(L>.01))return;
    const zb=this.zoomBucket(c),px=this.SS*zb;
    const MW=Math.max(look.shoulderW,look.hipW,this.waistW(look))+look.limb*2.4;
    const topPad=look.headR*1.15,botPad=look.limb*1.9;
    const bw=Math.ceil(MW*px),bh=Math.ceil((L+topPad+botPad)*px);
    // A torso leaning past about 66deg from vertical (knockdown/ko) foreshortens to a sliver under
    // the exact shear -- faithful to the FK, and exactly what the pre-8.1 hexagon did, but it reads
    // as a body that simply isn't there. Laying a rotated capsule along the hip->chest axis first
    // gives a prone fighter real mass; the fade is 0 for every upright pose, so nothing else changes.
    const flat=1-Math.min(1,Math.abs(sy)/(L*.42));
    if(flat>0){
      const tw=Math.max(look.hipW,this.waistW(look))*.88;
      const covered=b.cloth.torso==='shirt'||b.cloth.torso==='plate'||b.cloth.torso==='chitin'||b.cloth.torso==='fur';
      c.save();c.globalAlpha=Math.min(1,flat);
      this.limb(c,hip.x,hip.y,chest.x,chest.y,tw,look,
        {bone:'trunk',cloth:b.cloth.torso==='bone'?'bare':covered?'full':b.cloth.torso==='robe'?'full':'bare',face,lit,w2:tw*.94});
      c.restore()}
    const cv=this.cache(this.key(look,'torso:'+Math.round(L),face,zb),bw,bh,g=>{
      g.scale(px,px);g.translate(MW/2,L+topPad);
      this._paintTorso(g,L,look,face)});
    c.save();
    c.transform(1,0,-sx/L,-sy/L,hip.x,hip.y);
    c.drawImage(cv,-MW/2,-(L+topPad),cv.width/px,cv.height/px);
    c.restore()},
  _paintTorso(g,L,look,face){
    const b=look.body,lo=b.skinShade[0],hi=b.skinShade[1];
    const sw=look.shoulderW,hw=look.hipW,ww=this.waistW(look),limb=look.limb;
    // solve() hangs the shoulders at neck.y+4, so the local shoulder line sits 4 units below the
    // top of the chain -- that is what puts this torso's collar exactly where the arms attach.
    const shY=-L+4,wY=-L*.42,fw=face<0?-1:1;
    const cl=b.cloth,bone=cl.torso==='bone';
    g.lineJoin='round';
    const body=()=>{
      g.beginPath();
      g.moveTo(-hw/2-limb*.18,limb*.55);
      g.quadraticCurveTo(-ww/2-limb*.12,wY*.42,-ww/2,wY);
      g.quadraticCurveTo(-sw/2*.93,shY+L*.22,-sw/2,shY+limb*.24);
      g.quadraticCurveTo(-sw/2*.52,shY-limb*.32,0,shY-limb*.26);
      g.quadraticCurveTo(sw/2*.52,shY-limb*.32,sw/2,shY+limb*.24);
      g.quadraticCurveTo(sw/2*.93,shY+L*.22,ww/2,wY);
      g.quadraticCurveTo(ww/2+limb*.12,wY*.42,hw/2+limb*.18,limb*.55);
      g.quadraticCurveTo(0,limb*1.0,-hw/2-limb*.18,limb*.55);
      g.closePath()};
    // --- neck, under everything so the collar and the head both cover its ends
    const neckTop=shY-look.headR*.95;
    if(!bone){
      // A neck plus the trapezius wedge that ties it into the shoulders -- without the wedge the head
      // rides a bare stalk, which was the single worst read of the first pass.
      const nw=Math.max(7,look.headR*.86);
      const neck=k=>{g.beginPath();
        g.moveTo(-nw/2*k,neckTop);g.lineTo(nw/2*k,neckTop);
        g.quadraticCurveTo(nw*.62*k,shY-limb*.10,sw*.32*k,shY+limb*.30);
        g.lineTo(-sw*.32*k,shY+limb*.30);
        g.quadraticCurveTo(-nw*.62*k,shY-limb*.10,-nw/2*k,neckTop);
        g.closePath()};
      g.fillStyle=b.outline;neck(1.10);g.fill();
      const ng=g.createLinearGradient(-nw*.6,neckTop,nw*.6,shY);
      ng.addColorStop(0,shade(look.skin,lo*.30));ng.addColorStop(.55,shade(look.skin,lo*.55));
      ng.addColorStop(1,shade(look.skin,lo*1.05));
      g.fillStyle=ng;neck(1);g.fill();
      g.strokeStyle=shade(look.skin,lo*1.4);g.lineWidth=Math.max(.8,limb*.07);
      g.beginPath();g.moveTo(fw*nw*.16,neckTop+look.headR*.2);g.lineTo(fw*nw*.22,shY-limb*.05);g.stroke()}
    else{ // the skeleton's own neck: a stack of vertebrae, so the skull isn't left floating
      g.strokeStyle=b.outline;g.lineWidth=Math.max(2.6,limb*.30);g.lineCap='round';
      g.beginPath();g.moveTo(0,neckTop);g.lineTo(0,shY+limb*.3);g.stroke();
      g.strokeStyle=look.skin;g.lineWidth=Math.max(1.6,limb*.20);
      g.beginPath();g.moveTo(0,neckTop);g.lineTo(0,shY+limb*.3);g.stroke();
      g.fillStyle=look.skin;g.strokeStyle=b.outline;g.lineWidth=Math.max(.7,limb*.06);
      for(let i=0;i<4;i++){const y=neckTop+(shY+limb*.2-neckTop)*(i/3);
        g.beginPath();g.ellipse(0,y,Math.max(1.8,limb*.26),Math.max(1.1,limb*.14),0,0,Math.PI*2);
        g.fill();g.stroke()}}
    // --- silhouette
    g.strokeStyle=b.outline;g.lineWidth=Math.max(1.7,limb*.15);body();g.stroke();
    if(bone)return this._paintRibCage(g,L,look,body);
    // The one place in the body layer where a world-locked light is possible: the torso bitmap is
    // world-AXIS-aligned (the affine only shears and scales it, never rotates it), so this gradient
    // stays a genuine upper-left key light in world space, matching the rendition's torchlight.
    const sg=g.createLinearGradient(-sw*.46,shY,sw*.46,limb*.5);
    sg.addColorStop(0,shade(look.skin,hi));sg.addColorStop(.42,look.skin);
    sg.addColorStop(1,shade(look.skin,lo*.85));
    g.fillStyle=sg;body();g.fill();
    // --- chest / abdomen split
    g.save();body();g.clip();
    const pcY=shY+L*.24,pcR=Math.min(sw*.27,L*.21);
    g.globalAlpha=.55;g.fillStyle=shade(look.skin,Math.min(.95,hi*1.15));
    for(const s of[-1,1]){g.beginPath();g.ellipse(s*sw*.21,pcY,pcR,pcR*.64,s*.14,0,Math.PI*2);g.fill()}
    g.globalAlpha=.42;g.strokeStyle=shade(look.skin,lo);g.lineCap='round';
    g.lineWidth=Math.max(1.2,limb*.11);
    g.beginPath();g.moveTo(0,pcY-pcR*.55);g.lineTo(0,pcY+pcR*.95);g.stroke();               // sternum
    g.beginPath();g.moveTo(-sw*.37,pcY+pcR*.58);
    g.quadraticCurveTo(0,pcY+pcR*1.06,sw*.37,pcY+pcR*.58);g.stroke();                        // pec shelf
    g.lineWidth=Math.max(.9,limb*.075);
    const abTop=pcY+pcR*1.40;
    for(let i=0;i<3;i++){const y=abTop+i*(L*.115),hx=ww*.36*(1-i*.14);
      g.beginPath();g.moveTo(-hx,y);g.lineTo(hx,y);g.stroke()}
    g.beginPath();g.moveTo(0,abTop-L*.05);g.lineTo(0,wY+L*.10);g.stroke();                   // linea alba
    g.beginPath();g.moveTo(-ww*.48,wY+L*.04);g.lineTo(-hw*.20,limb*.30);g.stroke();          // obliques
    g.beginPath();g.moveTo(ww*.48,wY+L*.04);g.lineTo(hw*.20,limb*.30);g.stroke();
    // collarbones, always visible whatever the torso wears
    g.globalAlpha=.38;g.lineWidth=Math.max(1,limb*.09);
    g.beginPath();g.moveTo(-sw*.30,shY+limb*.36);g.quadraticCurveTo(0,shY+limb*.62,sw*.30,shY+limb*.36);g.stroke();
    g.globalAlpha=1;g.restore();
    this._paintTorsoCloth(g,L,look,fw,body)},
  _paintTorsoCloth(g,L,look,fw,body){
    const b=look.body,cl=b.cloth,prim=cl.primary,sec=cl.secondary,lo=b.skinShade[0];
    const sw=look.shoulderW,hw=look.hipW,ww=this.waistW(look),limb=look.limb;
    const shY=-L+4,wY=-L*.42;
    const cg=a=>{const gr=g.createLinearGradient(-sw*.46,shY,sw*.46,limb*.5);
      gr.addColorStop(0,shade(a,.24));gr.addColorStop(.42,a);gr.addColorStop(1,shade(a,-.34));
      return gr};
    if(cl.torso==='vest'){
      // An open, torn vest: two panels down the sides with a ragged inner edge, the chest bare
      // between them (the rendition's Carl, and the goblins' scavenged rags).
      // Narrow panels hanging off each shoulder with a torn inner edge, leaving the chest and abs
      // bare between them -- the first pass ran them nearly to the sternum, which read as a closed
      // coat and buried the whole chest/abdomen layer underneath it.
      const panel=s=>{g.beginPath();
        g.moveTo(s*sw*.56,shY+limb*.10);
        g.lineTo(s*sw*.30,shY+L*.10);
        g.lineTo(s*ww*.44,wY-L*.02);
        g.lineTo(s*ww*.34,wY+L*.10);
        g.lineTo(s*ww*.52,wY+L*.06);
        g.lineTo(s*ww*.44,wY+L*.22);
        g.lineTo(s*(ww*.72+limb*.10),wY+L*.26);
        g.lineTo(s*(sw*.54+limb*.10),shY+L*.30);
        g.closePath()};
      for(const s of[-1,1]){
        g.strokeStyle=b.outline;g.lineWidth=Math.max(1.4,limb*.11);panel(s);g.stroke();
        g.fillStyle=cg(prim);panel(s);g.fill();
        g.save();panel(s);g.clip();
        g.globalAlpha=.45;g.strokeStyle=shade(prim,-.45);g.lineWidth=Math.max(.9,limb*.07);
        for(let i=0;i<3;i++){g.beginPath();
          g.moveTo(s*sw*.52,shY+L*.14+i*L*.17);g.lineTo(s*ww*.40,wY-L*.02+i*L*.14);g.stroke()}
        g.globalAlpha=1;g.restore()}
      // A ragged fur collar riding the shoulder line, following the collar curve rather than cutting
      // a straight bar across the chest.
      g.fillStyle=shade(prim,-.18);
      g.beginPath();g.moveTo(-sw*.50,shY-limb*.04);
      g.quadraticCurveTo(0,shY-limb*.44,sw*.50,shY-limb*.04);
      for(let i=6;i>=0;i--){const t=-.50+(i/6)*1.00;
        g.lineTo(sw*t,shY+limb*(i%2?.26:.06))}
      g.closePath();g.fill();
      g.strokeStyle=b.outline;g.lineWidth=Math.max(1.1,limb*.08);g.stroke();
      return}
    if(cl.torso==='shirt'||cl.torso==='plate'||cl.torso==='chitin'||cl.torso==='fur'){
      g.save();body();g.clip();
      g.fillStyle=cg(prim);g.fillRect(-sw,shY-limb,sw*2,L+limb*3);
      // a V of bare throat so the head doesn't sit on a solid color block
      g.fillStyle=shade(look.skin,lo*.35);
      g.beginPath();g.moveTo(-sw*.15,shY-1);g.lineTo(sw*.15,shY-1);g.lineTo(0,shY+L*.15);g.closePath();g.fill();
      // shoulder seams + a couple of folds, so it reads as cloth over a body rather than a decal
      g.strokeStyle=shade(prim,-.42);g.lineWidth=Math.max(1,limb*.10);g.lineCap='round';
      for(const s of[-1,1]){g.beginPath();
        g.moveTo(s*sw*.30,shY+limb*.16);g.quadraticCurveTo(s*sw*.40,shY+L*.16,s*sw*.34,shY+L*.30);g.stroke()}
      g.globalAlpha=.55;
      for(let i=0;i<2;i++){g.beginPath();
        g.moveTo(-ww*.40,wY-L*.12+i*L*.10);g.quadraticCurveTo(0,wY-L*.06+i*L*.10,ww*.40,wY-L*.13+i*L*.10);g.stroke()}
      g.globalAlpha=1;
      if(cl.torso==='chitin'||cl.torso==='plate'){ // banded plates for the schema's armored kinds
        g.strokeStyle=shade(prim,-.5);g.lineWidth=Math.max(1.4,limb*.14);
        for(let i=0;i<3;i++){const y=shY+L*.34+i*L*.18;
          g.beginPath();g.moveTo(-ww*.46,y);g.quadraticCurveTo(0,y+L*.05,ww*.46,y);g.stroke()}}
      // belt
      g.fillStyle=b.outline;g.fillRect(-sw,wY+L*.09,sw*2,limb*.58);
      g.fillStyle=shade(sec,.04);g.fillRect(-sw,wY+L*.09+1,sw*2,limb*.58-2);
      g.fillStyle=shade(sec,.38);
      g.fillRect(fw*ww*.04-limb*.26,wY+L*.09,limb*.52,limb*.58);
      g.restore();
      g.strokeStyle=b.outline;g.lineWidth=Math.max(1.7,limb*.15);body();g.stroke();
      return}
    if(cl.torso==='robe'){
      // Full coverage that flares past the body silhouette below the waist, plus a sash. The hood
      // itself lives in _paintHead -- see LOOKS.shaman's comment for why the robe carries it.
      const robe=()=>{g.beginPath();
        g.moveTo(-sw*.50,shY+limb*.10);
        g.quadraticCurveTo(-ww*.80,wY,-hw*.78-limb*.72,limb*1.5);
        g.quadraticCurveTo(0,limb*1.95,hw*.78+limb*.72,limb*1.5);
        g.quadraticCurveTo(ww*.80,wY,sw*.50,shY+limb*.10);
        g.quadraticCurveTo(0,shY-limb*.22,-sw*.50,shY+limb*.10);
        g.closePath()};
      g.strokeStyle=b.outline;g.lineWidth=Math.max(1.7,limb*.15);robe();g.stroke();
      g.fillStyle=cg(prim);robe();g.fill();
      g.save();robe();g.clip();
      g.strokeStyle=shade(prim,-.42);g.lineWidth=Math.max(1.1,limb*.11);g.lineCap='round';
      for(const s of[-1,-.35,.35,1]){g.beginPath();
        g.moveTo(s*sw*.30,shY+L*.16);g.quadraticCurveTo(s*ww*.62,wY+L*.20,s*(hw*.62+limb*.5),limb*1.35);g.stroke()}
      g.fillStyle=b.outline;g.fillRect(-sw,wY+L*.16,sw*2,limb*.62);
      g.fillStyle=shade(sec,.06);g.fillRect(-sw,wY+L*.16+1,sw*2,limb*.62-2);
      g.restore();
      // a knot with two tails hanging off the sash
      g.fillStyle=shade(sec,.3);
      g.beginPath();g.ellipse(fw*ww*.22,wY+L*.16+limb*.3,limb*.30,limb*.34,0,0,Math.PI*2);g.fill();
      g.strokeStyle=shade(sec,-.12);g.lineWidth=Math.max(1.6,limb*.16);g.lineCap='round';
      g.beginPath();g.moveTo(fw*ww*.22,wY+L*.16+limb*.5);g.lineTo(fw*ww*.30,limb*.9);g.stroke();
      return}},
  // The pelvis garment (a waistband, and for 'shorts' real trunks) rides the HIP JOINT in world
  // space, deliberately OUTSIDE the torso's shear transform. At a knockdown/ko torso angle (-92deg)
  // that transform squashes local y to nearly nothing and stretches x to nearly a full torso length,
  // which turned Carl's trunks into a 90px red streak lying along the floor -- caught in the --pose
  // ko shot. A garment hanging off the hips does not foreshorten with the ribcage, so it does not
  // belong in the ribcage's bitmap. Drawn after both legs so the trunks cover the top of each thigh,
  // the same z-order the pre-8.1 'boxers'/'gear' props had at the end of the prop loop.
  hips(c,x,y,look,face){
    const b=look&&look.body;
    if(!b)return;
    const cl=b.cloth;
    if(cl.legs==='bare'||cl.legs==='bone')return;
    const zb=this.zoomBucket(c),px=this.SS*zb,limb=look.limb,hw=look.hipW;
    const halfW=hw*.5+limb*.8+3,up=limb*.8,down=cl.legs==='shorts'?limb*2.0:limb*1.0;
    const bw=Math.ceil(halfW*2*px),bh=Math.ceil((up+down)*px);
    const cv=this.cache(this.key(look,'hips:'+cl.legs,face,zb),bw,bh,g=>{
      g.scale(px,px);g.translate(halfW,up);
      this._paintHipCloth(g,look,face<0?-1:1)});
    c.drawImage(cv,x-halfW,y-up,cv.width/px,cv.height/px)},
  _paintHipCloth(g,look,fw){
    const b=look.body,cl=b.cloth,prim=cl.primary,sec=cl.secondary,limb=look.limb,hw=look.hipW;
    if(cl.legs==='bare'||cl.legs==='bone')return;
    const shorts=cl.legs==='shorts';
    const col=shorts?sec:prim;
    const halfW=hw*.5+limb*.62,top=-limb*.42,bot=shorts?limb*1.72:limb*.62;
    g.strokeStyle=b.outline;g.lineWidth=2.4;g.lineJoin='round';
    const hipPath=()=>{g.beginPath();
      g.moveTo(-halfW,top);g.lineTo(halfW,top);
      g.lineTo(halfW*.92,bot);
      if(shorts){g.lineTo(halfW*.24,bot*.86);g.lineTo(-halfW*.24,bot*.86)}
      g.lineTo(-halfW*.92,bot);g.closePath()};
    hipPath();g.stroke();
    const gr=g.createLinearGradient(-halfW,top,halfW,bot);
    gr.addColorStop(0,shade(col,.24));gr.addColorStop(.45,col);gr.addColorStop(1,shade(col,-.34));
    g.fillStyle=gr;hipPath();g.fill();
    g.save();hipPath();g.clip();
    g.fillStyle=b.outline;g.fillRect(-halfW,top,halfW*2,limb*.38);      // waistband
    g.fillStyle=shade(col,-.3);g.fillRect(-halfW,top+limb*.38,halfW*2,1.4);
    if(shorts&&(look.props||[]).includes('boxers')){
      // Carl's heart-print boxers, straight out of the rendition -- the same three-heart bezier the
      // old 'boxers' prop drew, now printed on real trunks instead of a flat rectangle.
      g.fillStyle='#ff9fd0';
      for(const dx of[-halfW*.46,0,halfW*.46])for(const dy of[limb*.72,limb*1.24]){
        const hx=dx+(dy>limb*1.0?halfW*.22:0),hy=dy,s=Math.max(2,limb*.15);
        g.beginPath();g.moveTo(hx,hy+s*.3);
        g.bezierCurveTo(hx-s,hy-s*.6,hx-s*1.6,hy+s*.4,hx,hy+s*1.4);
        g.bezierCurveTo(hx+s*1.6,hy+s*.4,hx+s,hy-s*.6,hx,hy+s*.3);g.fill()}}
    g.strokeStyle=shade(col,-.4);g.lineWidth=Math.max(.9,limb*.08);g.lineCap='round';
    g.beginPath();g.moveTo(-halfW*.5,top+limb*.5);g.lineTo(-halfW*.3,bot*.8);g.stroke();
    g.beginPath();g.moveTo(halfW*.5,top+limb*.5);g.lineTo(halfW*.3,bot*.8);g.stroke();
    g.restore()},
  // Skeleton torso: a rib cage over a dark void, not a bone-tinted body.
  // Skeleton torso. The first pass filled the whole torso silhouette black and drew ribs on it,
  // which read as a dark slab with scratches; the cage is now its own tapered shape, so the ribs and
  // the pelvis ARE the silhouette and the body outline is never stroked at all.
  _paintRibCage(g,L,look,body){
    const b=look.body,lo=b.skinShade[0],hi=b.skinShade[1];
    const sw=look.shoulderW,hw=look.hipW,ww=this.waistW(look),limb=look.limb;
    const shY=-L+4,wY=-L*.42;
    const top=shY+limb*.55,bot=wY+L*.24,mid=(top+bot)/2;
    const cage=k=>{const w1=sw*.44*k,w2=ww*.34*k;
      g.beginPath();
      g.moveTo(-w1,top);
      g.quadraticCurveTo(-w1*1.10,mid,-w2,bot);
      g.quadraticCurveTo(0,bot+L*.07,w2,bot);
      g.quadraticCurveTo(w1*1.10,mid,w1,top);
      g.quadraticCurveTo(0,top-L*.06,-w1,top);
      g.closePath()};
    g.strokeStyle=shade(look.skin,hi*.5);g.lineWidth=Math.max(1.8,limb*.24);g.lineCap='round';
    g.beginPath();g.moveTo(-sw*.40,shY+limb*.24);                                  // clavicles
    g.quadraticCurveTo(0,shY+limb*.70,sw*.40,shY+limb*.24);g.stroke();
    g.fillStyle=b.outline;cage(1.10);g.fill();
    g.fillStyle='#17160f';cage(1);g.fill();
    g.save();cage(1);g.clip();
    g.strokeStyle=shade(look.skin,lo*1.2);g.lineWidth=Math.max(2.0,limb*.24);
    g.beginPath();g.moveTo(0,top-L*.04);g.lineTo(0,bot+L*.06);g.stroke();          // sternum/spine
    g.strokeStyle=look.skin;g.lineWidth=Math.max(1.6,limb*.19);
    const span=bot-top;
    for(let i=0;i<5;i++){const y=top+span*(.12+i*.19),wid=sw*.46*(1-i*.11);
      for(const s of[-1,1]){g.beginPath();g.moveTo(0,y);
        g.quadraticCurveTo(s*wid,y+span*.02,s*wid*.78,y+span*.13);g.stroke()}}
    g.restore();
    g.fillStyle=b.outline;                                                          // pelvis
    const pel=k=>{g.beginPath();
      g.moveTo(-hw*.74*k,bot+L*.03);g.lineTo(hw*.74*k,bot+L*.03);
      g.quadraticCurveTo(hw*.62*k,limb*.55,hw*.40*k,limb*.85);
      g.lineTo(-hw*.40*k,limb*.85);
      g.quadraticCurveTo(-hw*.62*k,limb*.55,-hw*.74*k,bot+L*.03);
      g.closePath()};
    pel(1.09);g.fill();
    const pg2=g.createLinearGradient(-hw*.7,bot,hw*.7,limb);
    pg2.addColorStop(0,shade(look.skin,hi));pg2.addColorStop(.5,look.skin);
    pg2.addColorStop(1,shade(look.skin,lo));
    g.fillStyle=pg2;pel(1);g.fill();
    g.fillStyle='#17160f';
    g.beginPath();g.ellipse(0,limb*.28,hw*.24,limb*.34,0,0,Math.PI*2);g.fill()},

  // ---- head / face ------------------------------------------------------------------------------
  head(c,x,y,r,look,face,state,lit){
    const b=look&&look.body;
    if(!b)return;
    const st=HEAD_STATES.indexOf(state)>=0?state:'idle';
    const fx=face>0?1:face<0?-1:0;
    const zb=this.zoomBucket(c),px=this.SS*zb;
    const ear=b.face.ears==='pointed'?this.earLen(look,r):0;
    const halfW=r+Math.max(ear*1.15,r*.55)+4;
    const up=r*1.62,down=r*1.60;
    const bw=Math.ceil(halfW*2*px),bh=Math.ceil((up+down)*px);
    const cv=this.cache(this.key(look,'head:'+st+':'+Math.round(r),fx,zb),bw,bh,g=>{
      g.scale(px,px);g.translate(halfW,up);
      this._paintHead(g,r,look,fx,st)});
    c.drawImage(cv,x-halfW,y-up,cv.width/px,cv.height/px)},
  // The look's ear length rescaled to whatever radius the head is being drawn at (look.headR in a
  // fight, S*.27 in a portrait), so one head module serves both.
  earLen(look,r){return (look.earLen||r*.7)*(r/(look.headR||r))},
  _paintHead(g,r,look,face,st){
    const b=look.body,F=b.face,lo=b.skinShade[0],hi=b.skinShade[1];
    const fw=face<0?-1:1,front=face===0,skull=F.eyes==='skull';
    const hood=b.cloth.torso==='robe';
    g.lineJoin='round';g.lineCap='round';
    // --- hair behind the head (a long mane reads as mass BEHIND the skull, not a hat)
    if(F.hair==='long'){
      g.fillStyle=b.outline;
      g.beginPath();g.ellipse(front?0:-fw*r*.20,r*.10,r*(front?1.06:.98),r*1.30,0,0,Math.PI*2);g.fill();
      g.fillStyle=shade(look.hair||'#1a1410',-.05);
      g.beginPath();g.ellipse(front?0:-fw*r*.20,r*.08,r*(front?1.00:.92),r*1.24,0,0,Math.PI*2);g.fill()}
    // --- ears, behind the skull so its fill covers each base
    if(F.ears==='pointed'){
      // Drawn as a tapered capsule along the ear's own axis rather than as a triangle. A goblin ear
      // is 29 units long on an 18-unit head: as a polygon with quadratic sides it pinched to a 1-2px
      // dark line that the outline alone filled, which is how the first passes read -- two scratches
      // rather than ears. A capsule keeps a real width all the way up the taper.
      const el=this.earLen(look,r);
      const ears=front?[[-1,0,el],[1,0,el]]:[[-fw,-r*.10,el*.80],[-fw,r*.26,el]];
      for(const e of ears){
        const dir=e[0],dy=e[1],len=e[2];
        const bx=dir*r*.55,by=dy,tx=dir*(r*.90+len*.90),ty=dy-len*.85;
        const L2=Math.hypot(tx-bx,ty-by);
        g.save();g.translate(bx,by);g.rotate(Math.atan2(ty-by,tx-bx));
        g.fillStyle=b.outline;this._capsule(g,L2,r*.70,r*.12,1.3);g.fill();
        const eg=g.createLinearGradient(0,-r*.35,0,r*.35);
        eg.addColorStop(0,shade(look.skin,hi));eg.addColorStop(.55,look.skin);
        eg.addColorStop(1,shade(look.skin,lo));
        g.fillStyle=eg;this._capsule(g,L2,r*.70,r*.12,0);g.fill();
        g.fillStyle=shade(look.skin,lo*.75);
        this._capsule(g,L2*.80,r*.36,r*.07,0);g.fill();
        g.restore()}}
    // --- skull silhouette
    const shape=()=>{
      g.beginPath();
      if(front){g.ellipse(0,0,r*.90,r,0,0,Math.PI*2);return}
      if(skull){ // a real skull: big cranium, pinched temple, narrow jaw
        g.moveTo(-fw*r*.92,-r*.18);
        g.quadraticCurveTo(-fw*r*.88,-r*1.00,0,-r*1.00);
        g.quadraticCurveTo(fw*r*.90,-r*.96,fw*r*.92,-r*.14);
        g.quadraticCurveTo(fw*r*.96,r*.24,fw*r*.60,r*.34);
        g.quadraticCurveTo(fw*r*.56,r*.98,0,r*1.00);
        g.quadraticCurveTo(-fw*r*.58,r*.94,-fw*r*.78,r*.30);
        g.quadraticCurveTo(-fw*r*.96,r*.10,-fw*r*.92,-r*.18);
        g.closePath();return}
      // A profile, not a disc. The decisive part is that the NOSE is cut INTO the silhouette rather
      // than painted on the cheek: a nose drawn inside the head's own clip can only ever read as a
      // loop sitting on the face, which is exactly how the earlier passes read at 6x. Cranium, brow
      // ridge, bridge dip, nose, lip, chin, jawline, back of the skull -- in that order.
      // Forward extent: the tip caps at 1.24r for the goblins' hook and 1.04r otherwise. Rig.extent
      // and Rig.topAt fold the head as a circle of radius headR, so the goblin hook is the one place
      // the drawn silhouette exceeds the folded one, by 0.24*headR (4.3px on a goblin, 6px on a
      // hobgoblin). Deliberate -- the hooked nose is the scavenger's whole read in the rendition --
      // and far inside the margin those two looks have against EDGE_PAD (goblin 144 of 260).
      const gob=F.eyes==='goblin';
      const nx=fw*r*(gob?1.24:1.04),ny=r*(gob?.30:.12);
      g.moveTo(-fw*r*.90,-r*.14);
      g.quadraticCurveTo(-fw*r*.94,-r*.90,fw*r*.02,-r*.98);
      g.quadraticCurveTo(fw*r*.72,-r*.90,fw*r*.84,-r*.40);   // forehead into the brow ridge
      g.quadraticCurveTo(fw*r*.72,-r*.30,fw*r*.64,-r*.20);   // the bridge dip under the brow
      g.quadraticCurveTo(fw*r*(gob?1.06:.94),-r*.02,nx,ny);  // out to the tip
      g.quadraticCurveTo(fw*r*.78,ny+r*.14,fw*r*.60,r*.30);  // back in under the nostril
      g.quadraticCurveTo(fw*r*.86,r*.50,fw*r*.58,r*.82);     // lip, then the chin
      g.quadraticCurveTo(fw*r*.06,r*1.10,-fw*r*.50,r*.76);   // jawline running back
      g.quadraticCurveTo(-fw*r*.98,r*.30,-fw*r*.90,-r*.14);
      g.closePath()};
    g.strokeStyle=b.outline;g.lineWidth=Math.max(1.5,r*.11);shape();g.stroke();
    const hg=g.createLinearGradient(-r*.85,-r*.95,r*.75,r*.95);
    hg.addColorStop(0,shade(look.skin,hi));hg.addColorStop(.48,look.skin);
    hg.addColorStop(1,shade(look.skin,lo*.9));
    g.fillStyle=hg;shape();g.fill();
    g.save();shape();g.clip();
    if(F.ears==='human'&&!front){ // inside the clip, so it sits ON the profile instead of behind it
      g.fillStyle=shade(look.skin,lo*.45);g.strokeStyle=b.outline;g.lineWidth=Math.max(.9,r*.055);
      g.beginPath();g.ellipse(-fw*r*.46,r*.06,r*.15,r*.21,fw*.18,0,Math.PI*2);g.fill();g.stroke();
      g.strokeStyle=shade(look.skin,lo*1.2);g.lineWidth=Math.max(.7,r*.045);
      g.beginPath();g.arc(-fw*r*.46,r*.06,r*.08,0,Math.PI*1.4);g.stroke()}
    // --- cheekbone / jaw shading
    g.globalAlpha=.30;g.fillStyle=shade(look.skin,lo);
    g.beginPath();g.ellipse(front?0:-fw*r*.30,r*.46,r*.62,r*.40,0,0,Math.PI*2);g.fill();
    g.globalAlpha=1;
    // --- eye geometry: a 3/4 read -- the near eye large and forward, the far one smaller and tucked
    //     toward the far edge. Front-facing portraits get two equal eyes.
    const eyeY=-r*.06;
    const eyes=front
      ?[{x:-r*.33,y:eyeY,s:1,in:1},{x:r*.33,y:eyeY,s:1,in:-1}]
      :[{x:fw*r*.32,y:eyeY,s:1,in:-fw}];
    const open={idle:1,attack:.78,block:.60,hit:.42,win:.66,ko:0}[st];
    for(const e of eyes)this._paintEye(g,r,look,e,open,st,fw,front);
    // --- brow
    if(F.brow&&!skull){
      const tilt={idle:0,attack:.34,block:.40,hit:-.30,win:-.10,ko:-.05}[st];
      g.strokeStyle=look.hair?shade(look.hair,.10):shade(look.skin,lo*1.55);
      g.lineWidth=Math.max(1.6,r*.11);g.lineCap='round';
      for(const e of eyes){
        const inner=e.in;
        g.beginPath();
        g.moveTo(e.x-inner*r*.26*e.s,e.y-r*.24*e.s+inner*tilt*r*.14);
        g.quadraticCurveTo(e.x,e.y-r*.32*e.s+inner*tilt*r*.08,
          e.x+inner*r*.22*e.s,e.y-r*.20*e.s-inner*tilt*r*.12);
        g.stroke()}}
    // --- nose
    if(!front&&!skull){
      // The nose is in the outline now, so all that is left is the far nostril's plane and the
      // nostril itself.
      const gob2=F.eyes==='goblin';
      g.globalAlpha=.5;g.fillStyle=shade(look.skin,lo);
      g.beginPath();g.moveTo(fw*r*.62,r*(gob2?.10:.02));
      g.quadraticCurveTo(fw*r*(gob2?1.02:.88),r*(gob2?.30:.16),fw*r*.58,r*.30);
      g.closePath();g.fill();g.globalAlpha=1;
      g.fillStyle=shade(look.skin,lo*1.6);
      g.beginPath();g.ellipse(fw*r*(gob2?.82:.72),r*(gob2?.30:.20),r*.085,r*.05,fw*.4,0,Math.PI*2);g.fill()}
    else if(front&&!skull){
      g.strokeStyle=shade(look.skin,lo*1.2);g.lineWidth=Math.max(1.2,r*.08);
      g.beginPath();g.moveTo(r*.05,-r*.02);g.lineTo(r*.10,r*.22);g.lineTo(-r*.07,r*.24);g.stroke()}
    this._paintMouth(g,r,look,st,fw,front,skull);
    g.restore();
    // --- hair on top (drawn after the clip is released so a fringe may overhang the silhouette)
    const hair=look.hair||'#221a12';
    if(F.hair==='crop'){
      // A short, messy crop: a cap over the cranium with a torn front edge and a fringe that falls
      // toward the face, plus a sideburn down past the ear. A smooth arc here read as a bowl cut.
      const cap=()=>{g.beginPath();
        g.moveTo(-fw*r*.96,-r*.10);
        g.quadraticCurveTo(-fw*r*1.02,-r*.92,fw*r*.04,-r*1.12);
        g.quadraticCurveTo(fw*r*.84,-r*1.02,fw*r*.92,-r*.34);
        g.lineTo(fw*r*.74,-r*.62);g.lineTo(fw*r*.62,-r*.46);
        g.lineTo(fw*r*.44,-r*.66);g.lineTo(fw*r*.22,-r*.50);
        g.lineTo(fw*r*.04,-r*.68);g.lineTo(-fw*r*.22,-r*.50);
        g.lineTo(-fw*r*.50,-r*.62);g.lineTo(-fw*r*.74,-r*.36);
        g.closePath()};
      g.fillStyle=b.outline;g.lineWidth=Math.max(1.4,r*.10);g.lineJoin='round';
      cap();g.stroke();
      g.fillStyle=hair;cap();g.fill();
      g.save();cap();g.clip();
      g.strokeStyle=shade(hair,.26);g.lineWidth=Math.max(.9,r*.055);g.lineCap='round';
      for(let i=0;i<5;i++){const t=-.8+i*.4;
        g.beginPath();g.moveTo(fw*r*t,-r*.40);
        g.quadraticCurveTo(fw*r*(t+.16),-r*.86,fw*r*(t+.06),-r*1.10);g.stroke()}
      g.restore()}
    else if(F.hair==='long'){
      g.fillStyle=hair;
      g.beginPath();g.moveTo(-fw*r*1.00,-r*.20);
      g.quadraticCurveTo(-fw*r*.86,-r*1.28,fw*r*.16,-r*1.26);
      g.quadraticCurveTo(fw*r*.94,-r*1.06,fw*r*.90,-r*.26);
      g.quadraticCurveTo(fw*r*.60,-r*.66,fw*r*.16,-r*.60);
      g.quadraticCurveTo(-fw*r*.44,-r*.54,-fw*r*1.00,-r*.20);
      g.closePath();g.fill();
      g.strokeStyle=shade(hair,.20);g.lineWidth=Math.max(1,r*.055);
      for(let i=0;i<3;i++){const t=-.6+i*.5;
        g.beginPath();g.moveTo(fw*r*t,-r*.62);g.quadraticCurveTo(fw*r*(t+.1),-r*1.0,fw*r*(t+.02),-r*1.18);g.stroke()}}
    else if(F.hair==='mohawk'){
      g.fillStyle=hair;g.beginPath();
      g.moveTo(-fw*r*.50,-r*.86);
      for(let i=0;i<5;i++){const t=-.5+i*.26;
        g.lineTo(fw*r*(t+.08),-r*(1.30-Math.abs(i-2)*.08));g.lineTo(fw*r*(t+.18),-r*.90)}
      g.closePath();g.fill()}
    // --- horns (face-module stubs: deliberately inside the head circle's own r*1.35 bound, so they
    //     add nothing to the silhouette the HUD-clearance test measures)
    if(F.horns){
      const hl=F.horns==='big'?r*.62:r*.40;
      g.strokeStyle=b.outline;g.lineWidth=Math.max(3.4,r*.24);g.lineCap='round';
      for(const s of[-1,1]){g.beginPath();g.moveTo(s*r*.60,-r*.66);
        g.quadraticCurveTo(s*r*.86,-r*.66-hl*.5,s*r*.70,-r*.66-hl);g.stroke()}
      g.strokeStyle=shade('#d8cdb4',-.12);g.lineWidth=Math.max(2,r*.15);
      for(const s of[-1,1]){g.beginPath();g.moveTo(s*r*.60,-r*.66);
        g.quadraticCurveTo(s*r*.86,-r*.66-hl*.5,s*r*.70,-r*.66-hl);g.stroke()}}
    // --- hood (the shaman's cowl; carried by cloth.torso==='robe', see LOOKS.shaman)
    if(hood){
      const prim=b.cloth.primary;
      const cowl=k=>{g.beginPath();
        g.moveTo(-fw*r*1.14*k,r*.78*k+1);
        g.quadraticCurveTo(-fw*r*1.26*k,-r*1.26*k,fw*r*.20*k,-r*1.32*k);
        g.quadraticCurveTo(fw*r*1.06*k,-r*1.08*k,fw*r*.86*k,-r*.34*k);
        g.quadraticCurveTo(fw*r*.66*k,-r*.66*k,fw*r*.14*k,-r*.62*k);
        g.quadraticCurveTo(-fw*r*.56*k,-r*.52*k,-fw*r*.76*k,r*.86*k+1);
        g.closePath()};
      g.fillStyle=b.outline;cowl(1);g.fill();
      const cg2=g.createLinearGradient(-r,-r*1.3,r,r*.6);
      cg2.addColorStop(0,shade(prim,.26));cg2.addColorStop(.5,prim);cg2.addColorStop(1,shade(prim,-.36));
      g.fillStyle=cg2;cowl(.94);g.fill();
      g.strokeStyle=shade(prim,-.4);g.lineWidth=Math.max(1,r*.06);
      g.beginPath();g.moveTo(-fw*r*.90,r*.30);g.quadraticCurveTo(-fw*r*.60,-r*.60,fw*r*.20,-r*.90);g.stroke();
      g.save();shape();g.clip();                       // the cowl's own shadow across the brow
      g.globalAlpha=.34;g.fillStyle='#0a0710';
      g.beginPath();g.rect(-r*1.2,-r*1.2,r*2.4,r*.90);g.fill();
      g.globalAlpha=1;g.restore()}},
  _paintEye(g,r,look,e,open,st,fw,front){
    const b=look.body,F=b.face,lo=b.skinShade[0];
    const s=e.s,ew=r*.195*s,eh=r*.145*s;
    if(F.eyes==='none')return;
    if(F.eyes==='skull'){
      // A dark socket with an ember in it. 'ko' dims the ember to an almost-out coal -- that is what
      // "x-eyes" means for a skull.
      g.fillStyle='#14120c';
      g.beginPath();g.ellipse(e.x,e.y,ew*1.25,eh*1.55,front?0:fw*.16,0,Math.PI*2);g.fill();
      const lit=st==='ko'?.35:st==='attack'||st==='win'?1.25:1;
      const gr=g.createRadialGradient(e.x,e.y,0,e.x,e.y,ew*1.35);
      gr.addColorStop(0,F.iris);gr.addColorStop(.35,shade(F.iris,-.35));
      gr.addColorStop(1,'rgba(0,0,0,0)');
      g.save();g.globalAlpha=.85*lit;g.fillStyle=gr;
      g.beginPath();g.ellipse(e.x,e.y,ew*1.35,eh*1.6,0,0,Math.PI*2);g.fill();g.restore();
      g.fillStyle=F.iris;
      g.beginPath();g.arc(e.x,e.y,Math.max(.7,ew*.30*lit),0,Math.PI*2);g.fill();
      return}
    if(st==='ko'){ // crossed-out eyes: the one unambiguous "this fighter is done" signal
      g.strokeStyle=shade(look.skin,lo*1.7);g.lineWidth=Math.max(1.6,r*.10);g.lineCap='round';
      g.beginPath();g.moveTo(e.x-ew*.8,e.y-eh*1.0);g.lineTo(e.x+ew*.8,e.y+eh*1.0);g.stroke();
      g.beginPath();g.moveTo(e.x+ew*.8,e.y-eh*1.0);g.lineTo(e.x-ew*.8,e.y+eh*1.0);g.stroke();
      return}
    const gob=F.eyes==='goblin';
    const oh=Math.max(eh*.22,eh*open);
    // sclera
    g.fillStyle=gob?'#2d2a15':'#f0e8d8';
    g.beginPath();g.ellipse(e.x,e.y,ew,oh,front?0:fw*.14,0,Math.PI*2);g.fill();
    g.strokeStyle=b.outline;g.lineWidth=Math.max(.9,r*.05);g.stroke();
    // iris + pupil, nudged toward the facing direction so the fighter looks at the opponent
    const ix=e.x+(front?0:fw*ew*.24),ir=Math.min(oh*1.02,ew*.62);
    g.save();
    g.beginPath();g.ellipse(e.x,e.y,ew,oh,front?0:fw*.14,0,Math.PI*2);g.clip();
    g.fillStyle=F.iris;g.beginPath();g.arc(ix,e.y,ir,0,Math.PI*2);g.fill();
    g.strokeStyle=shade(F.iris,-.55);g.lineWidth=Math.max(.6,ir*.24);
    g.beginPath();g.arc(ix,e.y,ir*.88,0,Math.PI*2);g.stroke();
    g.fillStyle='#120e08';
    if(gob){g.beginPath();g.ellipse(ix,e.y,Math.max(.6,ir*.28),ir*.92,0,0,Math.PI*2);g.fill()}
    else{g.beginPath();g.arc(ix,e.y,Math.max(.7,ir*.48),0,Math.PI*2);g.fill()}
    g.fillStyle='rgba(255,255,255,.85)';
    g.beginPath();g.arc(ix-ew*.20,e.y-oh*.34,Math.max(.5,ir*.26),0,Math.PI*2);g.fill();
    g.restore();
    // lids: an upper lid that actually closes over the eye for the narrowed states
    if(open<.95){
      g.fillStyle=shade(look.skin,lo*.35);
      g.beginPath();g.ellipse(e.x,e.y-eh*(1+open*.55),ew*1.22,eh*1.05,0,0,Math.PI*2);g.fill()}
    if(st==='win'){ // a smiling lower lid
      g.strokeStyle=shade(look.skin,lo*1.5);g.lineWidth=Math.max(1,r*.055);
      g.beginPath();g.moveTo(e.x-ew*.9,e.y+oh*.5);
      g.quadraticCurveTo(e.x,e.y-oh*.3,e.x+ew*.9,e.y+oh*.5);g.stroke()}},
  _paintMouth(g,r,look,st,fw,front,skull){
    const b=look.body,F=b.face,lo=b.skinShade[0];
    const mx=front?0:fw*r*.34,my=r*.52,w=r*.34,fang=F.mouth==='fangs';
    if(skull||F.mouth==='none'){
      // The skull's own teeth: a row of them across the jaw, dropped open when it is done.
      const drop=st==='ko'?r*.16:st==='attack'?r*.07:0;
      const tw=r*(skull?.62:.5),ty=my+drop*.5;
      g.fillStyle='#14120c';
      g.beginPath();g.rect(mx-tw*.5,ty-r*.10,tw,r*.20+drop);g.fill();
      g.strokeStyle=shade(look.skin,-.05);g.lineWidth=Math.max(.9,r*.06);
      for(let i=0;i<=5;i++){const x=mx-tw*.5+tw*(i/5);
        g.beginPath();g.moveTo(x,ty-r*.10);g.lineTo(x,ty+r*.10+drop);g.stroke()}
      g.strokeStyle=shade(look.skin,lo*.6);g.lineWidth=Math.max(1,r*.07);
      g.beginPath();g.moveTo(mx-tw*.55,ty-r*.10);g.lineTo(mx+tw*.55,ty-r*.10);g.stroke();
      return}
    g.lineCap='round';g.lineJoin='round';
    const dark='#3a1d18';
    const openMouth=(hw,hh,tilt)=>{
      g.fillStyle=dark;g.beginPath();g.ellipse(mx,my,hw,hh,tilt||0,0,Math.PI*2);g.fill();
      g.strokeStyle=shade(look.skin,lo*1.5);g.lineWidth=Math.max(1,r*.055);g.stroke();
      g.save();g.beginPath();g.ellipse(mx,my,hw,hh,tilt||0,0,Math.PI*2);g.clip();
      g.fillStyle='#efe6d4';g.fillRect(mx-hw,my-hh,hw*2,hh*.62);                   // upper teeth
      if(fang){g.fillStyle='#e8dcc0';
        for(const s of[-.5,.5]){g.beginPath();
          g.moveTo(mx+s*hw*.9,my+hh);g.lineTo(mx+s*hw*.55,my-hh*.1);g.lineTo(mx+s*hw*1.15,my-hh*.05);
          g.closePath();g.fill()}}
      g.restore()};
    if(st==='hit'){openMouth(w*.72,r*.26,fw*.18);return}
    if(st==='attack'){openMouth(w*.92,r*.20,0);return}
    if(st==='win'){
      g.strokeStyle=shade(look.skin,lo*1.7);g.lineWidth=Math.max(1.6,r*.10);
      g.beginPath();g.moveTo(mx-w,my-r*.06);
      g.quadraticCurveTo(mx,my+r*.20,mx+w,my-r*.08);g.stroke();
      g.save();g.beginPath();g.moveTo(mx-w,my-r*.06);
      g.quadraticCurveTo(mx,my+r*.20,mx+w,my-r*.08);g.lineTo(mx+w,my-r*.20);g.lineTo(mx-w,my-r*.20);
      g.closePath();g.clip();g.fillStyle='#efe6d4';g.fillRect(mx-w,my-r*.2,w*2,r*.22);g.restore();
      return}
    if(st==='block'){ // clenched: a short, thick, hard line
      g.strokeStyle=shade(look.skin,lo*1.8);g.lineWidth=Math.max(2,r*.13);
      g.beginPath();g.moveTo(mx-w*.7,my);g.lineTo(mx+w*.7,my-r*.03);g.stroke()}
    else{ // idle: a relaxed flat line with a hint of a corner shadow
      g.strokeStyle=shade(look.skin,lo*1.5);g.lineWidth=Math.max(1.3,r*.08);
      g.beginPath();g.moveTo(mx-w*.75,my);g.quadraticCurveTo(mx,my+r*.05,mx+w*.75,my-r*.02);g.stroke()}
    if(fang){ // two lower fangs riding over the closed lip
      g.fillStyle='#e8dcc0';g.strokeStyle=shade('#e8dcc0',-.45);g.lineWidth=.8;
      for(const s of[-.6,.6]){g.beginPath();
        g.moveTo(mx+s*w*.9,my+r*.02);g.lineTo(mx+s*w*.62,my-r*.18);g.lineTo(mx+s*w*1.16,my-r*.14);
        g.closePath();g.fill();g.stroke()}}},

  // ---- hands and feet ---------------------------------------------------------------------------
  // The old rig drew no hand at all -- a forearm's round line cap was the fist. A real fist is what
  // sells a punch at this size.
  hand(c,x,y,r,look,face,ang,wrap){
    const b=look&&look.body;
    if(!b)return;
    const zb=this.zoomBucket(c),px=this.SS*zb;
    const half=r*1.75+3;
    const bw=Math.ceil(half*2*px);
    const cv=this.cache(this.key(look,'hand:'+Math.round(r*4)+':'+(wrap?'w':'b'),face,zb),bw,bw,g=>{
      g.scale(px,px);g.translate(half,half);
      this._paintHand(g,r,look,wrap)});
    c.save();c.translate(x,y);c.rotate(ang||0);
    c.drawImage(cv,-half,-half,cv.width/px,cv.height/px);
    c.restore()},
  _paintHand(g,r,look,wrap){
    const b=look.body,lo=b.skinShade[0],hi=b.skinShade[1];
    const bone=b.cloth.torso==='bone';
    g.fillStyle=b.outline;
    g.beginPath();g.ellipse(r*.18,0,r*1.24,r*1.06,0,0,Math.PI*2);g.fill();
    const gr=g.createLinearGradient(0,-r,0,r);
    gr.addColorStop(0,shade(look.skin,hi));gr.addColorStop(.55,look.skin);
    gr.addColorStop(1,shade(look.skin,lo));
    g.fillStyle=gr;
    g.beginPath();g.ellipse(r*.18,0,r*1.10,r*.92,0,0,Math.PI*2);g.fill();
    if(bone){ // a splayed claw of finger bones rather than a fist
      g.strokeStyle=look.skin;g.lineWidth=Math.max(1.2,r*.22);g.lineCap='round';
      for(const a of[-.5,-.16,.18,.52]){g.beginPath();g.moveTo(0,0);
        g.lineTo(Math.cos(a)*r*1.5,Math.sin(a)*r*1.5);g.stroke()}
      return}
    g.strokeStyle=shade(look.skin,lo*1.3);g.lineWidth=Math.max(.8,r*.13);g.lineCap='round';
    for(const dy of[-.44,0,.44]){g.beginPath();
      g.moveTo(r*.70,dy*r);g.lineTo(r*1.02,dy*r*.86);g.stroke()}          // knuckles
    if(wrap){
      g.strokeStyle='#e6dccb';g.lineWidth=Math.max(1.4,r*.34);g.lineCap='butt';
      g.beginPath();g.moveTo(-r*.92,-r*.30);g.lineTo(r*.42,-r*.52);g.stroke();
      g.beginPath();g.moveTo(-r*.92,r*.36);g.lineTo(r*.50,r*.24);g.stroke();
      g.strokeStyle='rgba(58,46,32,.38)';g.lineWidth=Math.max(.6,r*.10);
      g.beginPath();g.moveTo(-r*.92,-r*.05);g.lineTo(r*.46,-r*.16);g.stroke()}},
  // A ball at a limb's attach point. Without it the tube's flat proximal cap leaves a visible notch
  // against the torso silhouette, which is what made the first pass read as parts bolted together.
  joint(c,x,y,r,look,face,col){
    const b=look&&look.body;
    if(!b)return;
    const base=col||look.skin;
    const zb=this.zoomBucket(c),px=this.SS*zb,half=r*1.3+3;
    const bw=Math.ceil(half*2*px);
    const cv=this.cache(this.key(look,'joint:'+Math.round(r*4)+':'+base,face,zb),bw,bw,g=>{
      g.scale(px,px);g.translate(half,half);
      const lo=b.skinShade[0],hi=b.skinShade[1];
      const bone=b.cloth.torso==='bone';
      g.fillStyle=b.outline;g.beginPath();g.arc(0,0,r+1.2,0,Math.PI*2);g.fill();
      const gr=g.createLinearGradient(-r*.7,-r*.9,r*.6,r*.9);
      gr.addColorStop(0,shade(base,hi));gr.addColorStop(.5,base);
      gr.addColorStop(1,shade(base,lo));
      g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();
      if(bone){g.strokeStyle=shade(base,lo*1.3);g.lineWidth=Math.max(.7,r*.16);
        g.beginPath();g.moveTo(-r*.5,0);g.lineTo(r*.5,0);g.stroke()}});
    c.drawImage(cv,x-half,y-half,cv.width/px,cv.height/px)},
  // ---- seam cap (Task 8.2) ----------------------------------------------------------------------
  // The controller's visual read of 8.1 was that every rig looked like "a jointed wooden mannequin".
  // Two separate things cause that, and this is the second one. Every limb is a CAPSULE, so each
  // segment ends in a rounded OUTLINE cap; where two segments meet, those two dark arcs cross INSIDE
  // the limb and read as the pin of a ball joint. (The first cause is the joint ball itself: drawn
  // with its own ring, at a radius larger than the limbs it joins, and -- at the elbow/knee -- drawn
  // BETWEEN the two segments so the ring sat on top of the proximal one. Both are fixed at the call
  // sites: the balls shrank inside the limb and moved UNDER both segments.)
  //
  // The seam cap is a small disc of the limb's own color with NO outline at all, drawn AFTER both
  // segments and sized by the caller to sit strictly inside BOTH of their fills. It erases the two
  // interior arcs while leaving the outer silhouette -- the only place the outline is actually doing
  // work -- completely untouched. It is deliberately not a ring, per the ruling.
  //
  // Not used for 'bone' limbs: a skeleton's lobed joint knobs ARE the art (see _paintBoneLimb), so
  // there is no seam to hide there.
  seam(c,x,y,r,look,face,col){
    const b=look&&look.body;
    if(!b||!(r>.4))return;
    const base=col||look.skin;
    const zb=this.zoomBucket(c),px=this.SS*zb,half=r+2;
    const bw=Math.ceil(half*2*px);
    const cv=this.cache(this.key(look,'seam:'+Math.round(r*4)+':'+base,face,zb),bw,bw,g=>{
      g.scale(px,px);g.translate(half,half);
      const lo=b.skinShade[0],hi=b.skinShade[1];
      // A shallower gradient than joint()'s: the disc has to read as MORE of the same tube, not as
      // its own sphere, so the stops sit well inside the tube's own lo/hi range.
      const gr=g.createLinearGradient(0,-r,0,r);
      gr.addColorStop(0,shade(base,hi*.75));gr.addColorStop(.45,base);gr.addColorStop(1,shade(base,lo*.6));
      g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill()});
    c.drawImage(cv,x-half,y-half,cv.width/px,cv.height/px)},
  foot(c,x,y,look,face,ang){
    const b=look&&look.body;
    if(!b)return;
    const zb=this.zoomBucket(c),px=this.SS*zb;
    const w=look.limb*1.35,h=look.limb*.82,half=Math.max(w,h)*1.15+3;
    const bw=Math.ceil(half*2*px);
    const bare=!!look.bareFeet,kind=b.cloth.legs==='bone'?'bone':bare?'bare':'boot';
    const cv=this.cache(this.key(look,'foot:'+kind+':'+Math.round(w*2),face,zb),bw,bw,g=>{
      g.scale(px,px);g.translate(half,half);
      this._paintFoot(g,w,h,look,kind)});
    c.save();c.translate(x,y);c.rotate(ang||0);
    c.drawImage(cv,-half,-half,cv.width/px,cv.height/px);
    c.restore()},
  _paintFoot(g,w,h,look,kind){
    const b=look.body,lo=b.skinShade[0],hi=b.skinShade[1];
    const skin=kind==='boot'?'#3a2a1c':look.skin;
    const path=()=>{g.beginPath();
      g.moveTo(-w*.42,-h*.52);
      g.quadraticCurveTo(w*.30,-h*.62,w*.62,-h*.14);
      g.quadraticCurveTo(w*.74,h*.46,w*.30,h*.50);
      g.lineTo(-w*.40,h*.50);
      g.quadraticCurveTo(-w*.60,0,-w*.42,-h*.52);
      g.closePath()};
    g.strokeStyle=b.outline;g.lineWidth=2.2;g.lineJoin='round';path();g.stroke();
    const gr=g.createLinearGradient(0,-h*.6,0,h*.6);
    gr.addColorStop(0,shade(skin,hi));gr.addColorStop(.55,skin);gr.addColorStop(1,shade(skin,lo));
    g.fillStyle=gr;path();g.fill();
    g.save();path();g.clip();
    if(kind==='boot'){
      g.fillStyle='#1a120b';g.fillRect(-w,h*.22,w*2,h);                       // sole
      g.strokeStyle=shade(look.body.cloth.secondary,-.2);g.lineWidth=Math.max(1.2,h*.16);
      g.beginPath();g.moveTo(-w*.42,-h*.10);g.lineTo(w*.40,-h*.22);g.stroke()} // strap
    else if(kind==='bone'){
      g.strokeStyle=shade(look.skin,lo*1.2);g.lineWidth=Math.max(.9,h*.12);
      for(const t of[-.2,.1,.4]){g.beginPath();g.moveTo(w*t,-h*.5);g.lineTo(w*t,h*.5);g.stroke()}}
    else{ // bare toes
      g.strokeStyle=shade(look.skin,lo*1.2);g.lineWidth=Math.max(.8,h*.10);
      for(const t of[.18,.40,.58]){g.beginPath();
        g.moveTo(w*t,h*.08);g.lineTo(w*(t+.04),h*.46);g.stroke()}}
    g.restore()}};

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
  // Task 5.5: deliberately UNCHANGED by the atlas hook. extent() always walks the FK rig's own
  // geometry (never a sprite sheet's pixels), on the assumption that a hand-drawn atlas frame is
  // authored to fit within its character's own rig silhouette -- the camera's per-fight zoom cap
  // (G.startFight, 80_game.js) and the wall-clamp reach check (90_tests.js) both size themselves off
  // this number regardless of whether that character ends up drawn as the rig or an atlas frame. An
  // atlas artist who draws a limb reaching visibly further than the rig's own FK would silently
  // exceed those margins; nothing here catches that case.
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
    // Task 7.2: MOVES.light1..5 collapsed into one MOVES.light entry (moveName is always the literal
    // 'light', never 'light1'..'light5'), but the pose TABLE still keys its five jab keyframe sets as
    // light1..light5 (POSES.light1..5, one per rig -- see 40_movedata.js's own comment for why only the
    // landed damage varies by node, not the pose). f.chainNode (1..5, set by Fighter.startMove) is what
    // picks which of those five poses plays; clamped defensively to [1,5] (a bare hand-built ATTACK
    // fixture that skipped startMove would otherwise read chainNode 0). medium never needed a per-node
    // pose split -- POSES.medium is a single set, so its own moveName key already resolves correctly
    // with no remapping, same as every other move (heavy, s1-s3).
    if(st==='ATTACK'&&f.move){
      const key=f.moveName==='light'?'light'+clamp(f.chainNode||1,1,5):f.moveName;
      return{key,t01:clamp(f.f/(f.move.startup+f.activeSpan()+f.move.recovery),0,1)}}
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
  // Task 5.5: draws one atlas frame in place of the whole FK rig -- broken out of draw() as its own
  // method purely so a test can spy on it (wrap-and-restore) to confirm draw() took this path without
  // needing to decode pixels back off the canvas. sheet coordinates come from meta.poses[key][idx]
  // (idx = floor(t01*(frames-1)), the frozen sampling rule -- no easing, no interpolation between
  // frames, same "just pick the nearest keyframe" spirit as a low-frame-count sprite sheet always
  // has); meta.frame gives the shared {w,h,anchorX,anchorY} every frame in the sheet shares. The
  // anchor is where the fighter's feet sit within the frame, so translating to (F.x,FLOOR) and
  // drawing the subimage offset by -anchorX,-anchorY plants that point exactly on the floor line,
  // the same origin every FK pose already draws from (see draw()'s own c.translate(F.x,FLOOR) just
  // below). Mirrored by face and scaled by def.scale via the canvas transform itself (a flat image
  // has no per-joint face math to redo, unlike the FK solve() paths) -- negative x-scale flips the
  // drawImage call along with everything else drawn in this transform.
  _drawAtlasFrame(c,F,cam,frame,atlas,key,t01){
    const meta=atlas.meta,fr=meta.frame,frames=meta.poses[key];
    const idx=Math.max(0,Math.min(frames.length-1,Math.floor(clamp(t01,0,1)*(frames.length-1))));
    const[sx,sy]=frames[idx];
    const scale=F.def.scale||1,face=F.face||1;
    c.save();
    c.translate(F.x,FLOOR);
    c.scale(scale*face,scale);
    c.drawImage(atlas.img,sx,sy,fr.w,fr.h,-fr.anchorX,-fr.anchorY,fr.w,fr.h);
    c.restore()},
  draw(c,F,cam,frame){
    // Task 5.5: the atlas short-circuit. F.def.id doubles as the atlas lookId (it's the same key
    // LOOKS/DEFS are both keyed on -- see the DEFS[id].look=LOOKS[id] wiring loop at the bottom of
    // this file). ATLAS[lookId] only ever holds a real {img,meta} once Atlas.load's promise has
    // settled successfully (see its own comment above) -- a pending promise or a settled `null` both
    // fail the `atlas&&atlas.meta` check below and fall straight through to the ordinary FK rig path,
    // exactly the "missing files fall back to the rig silently" contract (Ruling #4). Only short-
    // circuits when this fighter's CURRENT pose key has frames in the manifest -- a partial atlas
    // (some poses covered, not others) still lets the rig path fill in whatever's missing.
    // Fix-wave item 5 (final review, Minor): the short-circuit used to only ever check ATLAS[lookId]
    // -- once a sheet loaded, it kept drawing from it for the rest of the session even after the
    // player flipped USE SPRITE ATLAS back off (settings), since Rig.draw never re-checked it. Now
    // also requires the atlas to currently be enabled -- the same two conditions Atlas.load's own
    // `enabled` check already gates the FETCH on (Save.data.settings.useAtlas, or G.atlasQuery, the
    // page's own ?atlas=1 override, computed once at load in G, 80_game.js) -- so turning the setting
    // off mid-session falls straight back to the FK rig path on the very next frame, with the
    // already-cached ATLAS[lookId] entry left alone (turning it back on needs no re-fetch).
    const lookId=F.def&&F.def.id,atlas=lookId&&ATLAS[lookId];
    const atlasEnabled=!!(Save.data&&Save.data.settings&&Save.data.settings.useAtlas)||G.atlasQuery;
    if(atlasEnabled&&atlas&&atlas.meta&&atlas.meta.poses){
      const{key,t01}=this.poseFor(F);
      if(atlas.meta.poses[key]){this._drawAtlasFrame(c,F,cam,frame,atlas,key,t01);return}}
    const look0=lookFor(F.def);
    if(look0.rig==='quad')return this.drawQuad(c,F,cam,frame,look0);
    if(look0.rig==='big')return this.drawBig(c,F,cam,frame,look0);
    const look=look0,scale=F.def.scale||1,face=F.face;
    const{key,t01}=this.poseFor(F),j=this.solve(look,key,t01,face);
    // Task 8.1: every human look ships a `.body` block, so this is the live path; everything below
    // it is the pre-8.1 stroke rig, kept intact as the fallback for a look that has none (the
    // lookFor() fallback target, LOOKS.carl, does have one, so nothing reaches it today).
    if(look.body)return this._drawHuman(c,F,look,j,face,scale,key);
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
  // Which limb cloth each bone of the human rig wears, derived from the look's own cloth block
  // rather than from a per-look list -- one wardrobe decision (cloth.torso/cloth.legs) dresses the
  // whole body consistently, so a new look cannot end up with a shirt and bare sleeves.
  // 'shorts' deliberately maps the THIGH to bare: the trunks themselves are drawn by the torso
  // module, because they ride the hip joint rather than the thigh bone (see _paintHipCloth).
  // What color the ball at a joint takes: whatever the limb on the far side of it is wearing, so a
  // shoulder/elbow/knee cap never punches a skin-toned hole through a sleeve or a trouser leg.
  jointCol(look,part){
    const c=this.clothFor(look,part);
    return (c==='sleeve'||c==='pant'||c==='robe'||c==='ragged'||c==='shorts')
      ?look.body.cloth.primary:look.skin},
  clothFor(look,part){
    const cl=look.body.cloth,t=cl.torso,l=cl.legs;
    if(part==='upperArm')return t==='bone'?'bone':t==='robe'?'robe':
      (t==='shirt'||t==='plate'||t==='chitin')?'sleeve':t==='fur'?'ragged':'bare';
    if(part==='foreArm')return t==='bone'?'bone':
      (look.props||[]).includes('bandages')?'wrap':t==='robe'?'robe':'bare';
    if(part==='thigh')return l==='bone'?'bone':l==='pants'?'pant':l==='robe'?'robe':
      l==='fur'?'ragged':'bare';
    if(part==='shin')return l==='bone'?'bone':(l==='pants'||l==='robe')?'pant':'bare';
    return 'bare'},
  // Cloth that BodyStyle now draws for itself. Left in each look's `props` array on purpose: props
  // is also what Rig.extent/propExtra walk, and removing entries (even entries propExtra returns []
  // for) would have meant touching the one structure the extent snapshot is pinned against. The
  // prop LOOP skips them instead, so only real held objects -- a dagger, a club -- still draw there.
  BODY_CLOTH_PROPS:{vest:1,rags:1,boxers:1,gear:1,bandages:1,scars:1,trousers:1},
  // The layered human body. Same z-order the old stroke rig used -- back leg, back arm, torso, head,
  // front leg, front arm, then held props -- so the silhouette and the overlap read are unchanged;
  // only what fills each layer is new. `lit` rides through untouched for Task 8.3.
  _drawHuman(c,F,look,j,face,scale,poseKey,lit){
    const limb=look.limb,fs=BodyStyle.faceState(poseKey);
    const cf=part=>this.clothFor(look,part);
    const wrapped=(look.props||[]).includes('bandages');
    const armW=limb*.88,foreW=limb*.70,thighW=limb*1.08,shinW=limb*.86;
    c.save();c.translate(F.x,FLOOR);c.scale(scale,scale);
    // Task 8.2 joint-seam polish, applied to all three rigs (see BodyStyle.seam). Three changes per
    // chain: the balls shrank from proud-of-the-limb (.62/.58/.56 of a width, i.e. 12-24% WIDER than
    // the tube they joined) to inside it; BOTH balls are laid down before EITHER segment, so no ring
    // is ever drawn on top of a limb; and a seam cap closes the crossing outline arcs afterwards.
    const boney=cf('upperArm')==='bone';
    const arm=(sh,el,hand)=>{
      const jc=this.jointCol(look,'foreArm');
      BodyStyle.joint(c,sh.x,sh.y,armW*.48,look,face,this.jointCol(look,'upperArm'));
      BodyStyle.joint(c,el.x,el.y,Math.min(armW*.86,foreW)*.48,look,face,jc);
      BodyStyle.limb(c,sh.x,sh.y,el.x,el.y,armW,look,{bone:'upperArm',cloth:cf('upperArm'),face,lit,w2:armW*.86});
      BodyStyle.limb(c,el.x,el.y,hand.x,hand.y,foreW,look,{bone:'foreArm',cloth:cf('foreArm'),face,lit,w2:foreW*.90});
      if(!boney){
        BodyStyle.seam(c,sh.x,sh.y,armW*.42,look,face,this.jointCol(look,'upperArm'));
        BodyStyle.seam(c,el.x,el.y,Math.min(armW*.86,foreW)*.5-1.4,look,face,jc)}
      BodyStyle.hand(c,hand.x,hand.y,limb*.40,look,face,Math.atan2(hand.y-el.y,hand.x-el.x),wrapped)};
    const leg=(hp,kn,ft)=>{
      const jc=this.jointCol(look,'shin');
      BodyStyle.joint(c,kn.x,kn.y,Math.min(thighW*.78,shinW)*.48,look,face,jc);
      BodyStyle.limb(c,hp.x,hp.y,kn.x,kn.y,thighW,look,{bone:'thigh',cloth:cf('thigh'),face,lit,w2:thighW*.78});
      BodyStyle.limb(c,kn.x,kn.y,ft.x,ft.y,shinW,look,{bone:'shin',cloth:cf('shin'),face,lit,w2:shinW*.72});
      if(cf('shin')!=='bone')
        BodyStyle.seam(c,kn.x,kn.y,Math.min(thighW*.78,shinW)*.5-1.4,look,face,jc);
      BodyStyle.foot(c,ft.x+face*limb*.28,ft.y+limb*.14,look,face,0)};
    leg(j.lHip,j.lKnee,j.lFoot);
    arm(j.lShoulder,j.lElbow,j.lHand);
    BodyStyle.torso(c,j.neck,j.hip,look,face,lit);
    // The head rotates rigidly with the neck->head bone; its world angle comes straight off that
    // vector, so no second samplePose call is needed to recover the pose's own head angle.
    const hx=j.head.x-j.neck.x,hy=j.head.y-j.neck.y;
    c.save();c.translate(j.head.x,j.head.y);
    if(hx||hy)c.rotate(Math.atan2(hx,-hy));
    BodyStyle.head(c,0,0,look.headR,look,face,fs,lit);
    c.restore();
    leg(j.rHip,j.rKnee,j.rFoot);
    BodyStyle.hips(c,j.hip.x,j.hip.y,look,face);
    arm(j.rShoulder,j.rElbow,j.rHand);
    for(const p of look.props||[]){
      if(this.BODY_CLOTH_PROPS[p])continue;
      if(p==='dagger'){
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
      if(p==='club'){ // shaft geometry kept in sync with propExtra's own 'club' entry
        const h=j.rHand;
        c.strokeStyle=look.secondary;c.lineWidth=10;c.lineCap='round';
        c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.x+face*12,h.y-30);c.stroke();
        c.strokeStyle=shade(look.secondary,-.4);c.lineWidth=2;
        c.beginPath();c.moveTo(h.x+face*2,h.y-6);c.lineTo(h.x+face*10,h.y-26);c.stroke();
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
    // Thick neck: a short wide stroke from the neck joint up to the head, drawn UNDER the head fill
    // (so only its width past the head's own radius reads) — the human rig's own neckNeckLen leaves
    // nothing at all drawn between shoulders and head, which for a brute reads as a floating head
    // rather than "thick neck" (final review, look-and-feel note 4, on Mongo specifically).
    c.lineCap='round';c.lineWidth=look.headR*1.15;c.strokeStyle=skinDark;
    c.beginPath();c.moveTo(j.neck.x,j.neck.y);c.lineTo(j.head.x,j.head.y);c.stroke();
    c.lineWidth=look.headR*.85;c.strokeStyle=look.skin;
    c.beginPath();c.moveTo(j.neck.x,j.neck.y);c.lineTo(j.head.x,j.head.y);c.stroke();
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
    // Fix round 2 (controller review, Task 6.5): the medium kick is now a rearing double-front-paw
    // slam (see POSES_QUAD.medium's own comment) — the striking limbs are the FRONT legs, which this
    // function already draws last (in front of the body), so unlike fix round 1's now-reverted
    // hind-leg-specific draw-order hack, no reordering is needed here at all; `slamming` only gates the
    // front paws' own look (a darker tint + a visible pad, see paw() below), not layering.
    const slamming=key==='medium';
    c.save();c.translate(F.x,FLOOR);c.scale(scale,scale);
    const limb=(p,q,w,col)=>{c.lineCap='round';
      c.lineWidth=w+3;c.strokeStyle=shade(col||look.skin,-.35);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
      c.lineWidth=w;c.strokeStyle=col||look.skin;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke()};
    // pad: an optional second/third arg draws a bigger, tinted "slam paw" -- a visible paw pad (a
    // smaller lighter oval set into the fill, the same "shade a highlight into a flat fill" trick
    // drawBig's own scars/brow-ridge props already use) instead of the ordinary flat ellipse, so the
    // striking paw itself reads as a deliberate foot with claws/pad, not just a leg-end. col overrides
    // the fill/stroke entirely (the slamming front paws' own darker tint, see below); undefined keeps
    // the ordinary look every non-kick pose still uses.
    const paw=(p,col,pad)=>{const r=look.legW*(pad?.68:.58);
      c.fillStyle=col||look.skin;c.strokeStyle=shade(col||look.skin,-.35);c.lineWidth=1.2;
      c.beginPath();c.ellipse(p.x,p.y,r,r*.72,0,0,Math.PI*2);c.fill();c.stroke();
      if(pad){c.fillStyle=look.earInner||shade(col||look.skin,.32);
        c.beginPath();c.ellipse(p.x,p.y+r*.06,r*.46,r*.32,0,0,Math.PI*2);c.fill()}};
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
    // front legs, drawn last of the limbs so they sit in front of the body -- which is exactly why the
    // medium slam (Fix round 2) needs no special draw-order handling at all, unlike fix round 1's now-
    // reverted hind-leg version: the striking limbs are already the last (frontmost) thing drawn here.
    // `slamming` only swaps in the tinted, pad-marked paw() variant for legibility ("claws/paw pads
    // visible" per the review) -- a shade darker than the body fill so the striking paws separate from
    // it even where they overlap it, matching Fix round 1's own paw-pad treatment, just correctly
    // applied to the limb that's actually doing the striking this round.
    const slamCol=slamming?shade(look.skin,-.22):undefined;
    limb(j.flHip,j.fl1,look.legW,slamCol);limb(j.fl1,j.fl2,look.legW*.55,slamCol);paw(j.fl2,slamCol,slamming);
    limb(j.frHip,j.fr1,look.legW,slamCol);limb(j.fr1,j.fr2,look.legW*.55,slamCol);paw(j.fr2,slamCol,slamming);
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
  // Task 8.1: for a look with a `.body` block the bust is now BodyStyle.head at state 'idle' and
  // face 0 (the module's front-facing branch) over a shoulder wedge in the look's own cloth, so the
  // HUD portrait, the roster card and the fight sprite are demonstrably the same character. `size`
  // is 56 (HUD/map) or 112 (roster cards, Task 8.4); each size is cached separately on the look,
  // since the head bitmap is resolution-dependent. Looks with no `.body` (the big and quad rigs)
  // keep the pre-8.1 bust below, unchanged.
  portrait(look,size){
    if(look.rig==='quad')return this.portraitQuad(look);
    const S=size||56;
    look._portraits=look._portraits||{};
    if(look._portraits[S])return look._portraits[S];
    if(look.body)return look._portraits[S]=this._portraitBody(look,S);
    if(look._portrait)return look._portraits[S]=look._portrait;
    const cnv=document.createElement('canvas');cnv.width=S;cnv.height=S;
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
    // Fix-wave item 10: the 'big' rig (Mongo/Grull) shared this exact plain human bust — no brow, no
    // hair (both have hair:null) — so a recolored circle read as "a generic green head" in the HUD
    // (final review, look-and-feel note 4, on Mongo specifically). Mirrors drawBig's own unconditional
    // brow-ridge arc so the portrait reads as the same brute the fight sprite does.
    if(look.rig==='big'){c.strokeStyle=shade(look.skin,-.42);c.lineWidth=headR*.32;c.lineCap='round';
      c.beginPath();c.arc(cx,headY-headR*.08,headR*.76,D(195),D(345));c.stroke()}
    c.fillStyle='#141414';
    c.beginPath();c.arc(cx-headR*.35,headY-1,1.4,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(cx+headR*.35,headY-1,1.4,0,Math.PI*2);c.fill();
    look._portrait=cnv;look._portraits[S]=cnv;return cnv},
  _portraitBody(look,S){
    const b=look.body,cl=b.cloth;
    const cnv=document.createElement('canvas');cnv.width=S;cnv.height=S;
    const c=cnv.getContext('2d');
    const cx=S/2,headR=S*.245,headY=S*.42,shW=S*1.02,shY=S*.71;
    // A bare or vested torso shows skin at the shoulders; anything with real coverage shows cloth.
    const worn=cl.torso==='bare'||cl.torso==='vest'||cl.torso==='bone';
    const garment=cl.torso==='bone'?look.skin:worn?look.skin:cl.primary;
    const wedge=(inset,drop)=>{c.beginPath();
      c.moveTo(cx-shW/2+inset,S+4);
      c.quadraticCurveTo(cx-shW*.36+inset,shY+drop,cx-shW*.20+inset,shY+drop);
      c.lineTo(cx+shW*.20-inset,shY+drop);
      c.quadraticCurveTo(cx+shW*.36-inset,shY+drop,cx+shW/2-inset,S+4);
      c.closePath()};
    c.fillStyle=b.outline;wedge(0,0);c.fill();
    const gr=c.createLinearGradient(cx-shW*.4,shY,cx+shW*.4,S);
    gr.addColorStop(0,shade(garment,.22));gr.addColorStop(.5,garment);gr.addColorStop(1,shade(garment,-.32));
    c.fillStyle=gr;wedge(2,2);c.fill();
    if(cl.torso==='vest'){ // the same open panels the fight sprite wears, read head-on
      c.fillStyle=shade(cl.primary,-.06);
      for(const s of[-1,1]){c.beginPath();
        c.moveTo(cx+s*shW*.44,S+4);c.lineTo(cx+s*shW*.16,shY+4);
        c.lineTo(cx+s*shW*.05,S+4);c.closePath();c.fill()}}
    if(cl.torso==='bone'){ // clavicles instead of a chest
      c.strokeStyle=shade(look.skin,-.18);c.lineWidth=Math.max(2,S*.045);c.lineCap='round';
      c.beginPath();c.moveTo(cx-shW*.20,shY+S*.07);
      c.quadraticCurveTo(cx,shY+S*.15,cx+shW*.20,shY+S*.07);c.stroke()}
    // neck
    const nw=headR*.68;
    c.fillStyle=b.outline;c.fillRect(cx-nw/2-1.4,headY,nw+2.8,shY-headY+4);
    c.fillStyle=shade(look.skin,b.skinShade[0]*.55);c.fillRect(cx-nw/2,headY,nw,shY-headY+4);
    BodyStyle.head(c,cx,headY,headR,look,0,'idle');
    return cnv},
  // Quadruped HUD bust: same front-facing head-and-shoulders shape language as the human portrait
  // (a fill wedge for shoulders, a round head on top) but with cat/rat ears, tiara/whiskers/teeth
  // props, and no hair — quads have no LOOKS.hair field.
  portraitQuad(look){
    if(look._portrait)return look._portrait;
    const S=56,cnv=document.createElement('canvas');cnv.width=S;cnv.height=S;
    const c=cnv.getContext('2d'),skinDark=shade(look.skin,-.35);
    const cx=S/2,headR=Math.min(18,look.headR*.72),headY=S*0.46,shW=Math.min(S*0.85,look.bodyLen*.3),shY=S*0.7;
    const headFill=look.headFill||look.skin,props=look.props||[];
    // Fix-wave item 10: Grub's HUD portrait used to fall through to the generic cat/rat-shaped bust
    // (a plain wedge body + round head), which for a species with neither ears nor ear-adjacent props
    // read as "a generic green head" (final review, look-and-feel note 4) — nothing distinguished it
    // as a grub. Drawn as its own shape instead: a low, elongated segmented capsule (echoing
    // drawQuad's own body-drawing language for grub) with a small dark head-end, not the human/cat
    // silhouette other quads share.
    if(look.species==='grub'){
      const capW=S*.8,capH=S*.32,capY=S*.6;
      c.fillStyle=look.skin;c.strokeStyle=skinDark;c.lineWidth=1.4;
      c.beginPath();
      if(c.roundRect)c.roundRect(cx-capW/2,capY-capH/2,capW,capH,capH/2);
      else c.ellipse(cx,capY,capW/2,capH/2,0,0,Math.PI*2);
      c.fill();c.stroke();
      c.strokeStyle=look.segDark||skinDark;c.lineWidth=1.6;
      for(const fx of[-.18,.1,.36])/* segment lines, head-end excluded */{
        c.beginPath();c.moveTo(cx+fx*capW,capY-capH*.4);c.lineTo(cx+fx*capW,capY+capH*.4);c.stroke()}
      const hx=cx-capW*.34,hr=Math.min(headR,capH*.62);
      c.fillStyle=headFill;c.beginPath();c.arc(hx,capY,hr,0,Math.PI*2);c.fill();
      c.lineWidth=1.4;c.strokeStyle=shade(headFill,-.3);c.stroke();
      c.fillStyle=look.eye||'#141414';c.beginPath();c.arc(hx-hr*.2,capY-1,1.3,0,Math.PI*2);c.fill();
      look._portrait=cnv;return cnv}
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

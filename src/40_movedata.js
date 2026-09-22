// All frame counts at 60 Hz. dash = px the attacker advances during startup. push = px the defender is shoved on hit.
const MOVES={
  light1:{startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light2',dash:18,hitstop:3},
  light2:{startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light3',dash:18,hitstop:3},
  light3:{startup:5,active:3,recovery:9, dmg:1.05,range:75, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light4',dash:18,hitstop:3},
  light4:{startup:6,active:3,recovery:10,dmg:1.1, range:75, hitstun:15,blockstun:10,push:20,powHit:8, powTaken:4,chain:'light5',dash:20,hitstop:3},
  light5:{startup:7,active:4,recovery:16,dmg:1.4, range:80, hitstun:20,blockstun:12,push:60,powHit:10,powTaken:5,chain:null,dash:10,knockdown:true,hitstop:5},
  medium:{startup:10,active:4,recovery:14,dmg:1.6,range:120,hitstun:18,blockstun:11,push:24,powHit:12,powTaken:6,chain:'light1',dash:140,hitstop:5},
  heavy: {charge:22,startup:8,active:5,recovery:26,dmg:2.6,range:130,hitstun:26,blockstun:14,push:70,powHit:18,powTaken:9,chain:null,knockdown:true,hitstop:9},
  s1:{startup:8, active:4,recovery:22,dmg:1.5,hits:3,gap:6,range:130,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:100,chain:null,knockdown:true,hitstop:6},
  s2:{startup:10,active:4,recovery:28,dmg:1.6,hits:5,gap:6,range:150,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:200,chain:null,knockdown:true,hitstop:8},
  s3:{startup:20,active:6,recovery:40,dmg:3,  hits:4,gap:8,range:220,hitstun:20,blockstun:0, push:90,powHit:0,powTaken:0,cost:300,chain:null,knockdown:true,unblockable:true,hitstop:14}};
const CHAMPS={
  carl: {id:'carl', name:'CARL',           cls:'brawler',  hp:1000,atk:60,color:'#f4c542',armor:0,  crit:.10,critMul:1.6,blockProf:0,  scale:1,   rig:'human'},
  // rig:'quad' — Donut is a real cat (Task 3.4's RigQuad, a four-legged bone set; see LOOKS.donut
  // and Rig.solve's 'quad' branch in 68_rig.js).
  donut:{id:'donut',name:'PRINCESS DONUT', cls:'caster',   hp:820, atk:70,color:'#e8a0d8',armor:0,  crit:.18,critMul:1.6,blockProf:0,  scale:1,   rig:'quad'},
  katia:{id:'katia',name:'KATIA',          cls:'trickster',hp:900, atk:64,color:'#7fb0a8',armor:0,  crit:.22,critMul:1.6,blockProf:0,  scale:1,   rig:'human',
    moves:{s1:{hits:5,gap:4,dmg:1.2}}},
  // rig:'big' — Mongo is Task 3.5's brute bone set (Rig.solveBig/drawBig; see LOOKS.mongo, 68_rig.js).
  mongo:{id:'mongo',name:'MONGO',          cls:'tank',     hp:1300,atk:66, color:'#a3742f',armor:.15,crit:.08,critMul:1.6,blockProf:.15,scale:1.25,rig:'big'}};
const MOBS={
  goblin:   {id:'goblin',   name:'GOBLIN SCAVENGER',cls:'rogue',hp:300,atk:38,color:'#6b9a45',armor:0,  crit:.15,critMul:1.6,blockProf:0,  scale:.85,rig:'human',
    moves:{heavy:{charge:14,dmg:2.0}}},
  hobgoblin:{id:'hobgoblin',name:'HOBGOBLIN BRUTE',  cls:'tank', hp:700,atk:55,color:'#5c6b52',armor:.15,crit:.05,critMul:1.6,blockProf:.1, scale:1.1,rig:'human', // fix round 2: 1.2->1.1, see LOOKS.hobgoblin
    moves:{heavy:{charge:30,dmg:3.4,hitstop:12}}},
  skeleton: {id:'skeleton',name:'SKELETON',cls:'rogue', hp:260,atk:34,color:'#d8d0c0',armor:0,  crit:.15,critMul:1.6,blockProf:0,  scale:.95,rig:'human'},
  // s1 override: a longer 6-hit flurry (base s1 is 3 hits) — the shaman's signature multi-hit special.
  shaman:   {id:'shaman',  name:'SHAMAN',  cls:'caster',hp:240,atk:44,color:'#6a4c93',armor:0,  crit:.1, critMul:1.6,blockProf:0,  scale:.95,rig:'human',
    moves:{s1:{hits:6,gap:4,dmg:1.1}}},
  // rig:'quad' — Task 3.4's four-legged bone set, same as Donut above (LOOKS.grub, 68_rig.js) but
  // drawn as a segmented larva with stubby leg nubs instead of a cat.
  grub:     {id:'grub',    name:'GRUB',    cls:'beast', hp:380,atk:40,color:'#8a9a4f',armor:.05,crit:.05,critMul:1.6,blockProf:0,  scale:.8, rig:'quad'}};
const BOSSES={
  // rig:'big' — Task 3.5's brute bone set (see LOOKS.grull, 68_rig.js). scale is .94, trimmed down
  // from the Task 3.4-era placeholder's 1.3 during Task 3.5 (a real --sim screenshot showed his head/
  // horns going off the top of the canvas at both 1.3 and an intermediate 1.1 — see
  // docs/shots/p3-floor1-boss.png). At the time, the only HUD safety net was a fixed test against
  // heavyCharge/s3, which happen to be Grull's *shortest* poses (a deep crouch by design), so scale
  // was the only lever available and got tuned down until the visible clipping stopped.
  // Fix round 1 (controller review): that fixed-pose test was replaced with a per-fight camera zoom
  // cap computed from Rig.extent's true worst case across every pose and prop (G.startFight,
  // 68_rig.js/65_stage.js) — the camera itself now stays out of any look's way at whatever scale it's
  // set to, which is the real fix for this class of bug. Left at .94 rather than re-tuned back up,
  // since nothing in this task required changing it further.
  // s3 override + buffs are his boss-signature mechanics per Phase 3 ruling #4 (a mob def with
  // boss:true, a bigger rig, a unique S3, and one signature buff — no boss-only engine).
  grull:{id:'grull',name:'GRULL',cls:'tank',hp:1600,atk:70,color:'#5c2f2f',armor:.2,crit:.05,critMul:1.6,blockProf:.15,scale:.94,rig:'big',
    boss:true,buffs:['armorUp'],moves:{s3:{dmg:3.6,hits:3,gap:10}}},
  // rig:'quad' — Task 3.4's four-legged bone set at boss scale (LOOKS.mother_rat, 68_rig.js).
  mother_rat:{id:'mother_rat',name:'MOTHER RAT',cls:'beast',hp:1400,atk:62,color:'#4a3040',armor:.1,crit:.1,critMul:1.6,blockProf:.05,scale:1.3,rig:'quad',
    boss:true,buffs:['regen'],moves:{s3:{dmg:2.4,hits:6,gap:5}}}};
const DEFS=Object.assign({},CHAMPS,MOBS,BOSSES);
const CLASS_BEATS={brawler:'rogue',rogue:'caster',caster:'brawler',tank:'beast',beast:'trickster',trickster:'tank'};
const CLASS_BONUS=1.15,PARRY_WINDOW=6,PARRY_STUN=50,CHIP=.08,POWER_MAX=300,PARRY_LOCKOUT=20,CRIT_MUL_DEFAULT=1.6;
const DASH_BACK={frames:12,dist:90,inv:8},KNOCKDOWN={frames:40,inv:10};
const STAGE_W=1400;
// Wall clamp half-width for Fighter.tick's x clamp. Wide enough that a fighter pinned at the wall
// stays fully on screen: the rig can reach (shoulderW/2 + armLen + limb) * def.scale past the
// fighter's x. Fix round 1 set this to 110 against the Phase-2-era rig; fix round 2's rescaled
// LOOKS push that reach to ~162px for Carl and ~212px for the hobgoblin (its def.scale=1.1 on top
// of already-larger proportions), so 110 was no longer enough — see the "every look's reach fits
// inside EDGE_PAD" test. A camera margin can't fix this alone because the parallax-1.0 floor layer
// is drawn exactly STAGE_W wide, so letting the camera past its own limit would expose blank canvas
// past the stage edge; this has to be a sim-side constant (Fighter stays independent of Rig) instead.
const EDGE_PAD=220;

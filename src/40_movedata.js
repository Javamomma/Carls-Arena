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
  donut:{id:'donut',name:'PRINCESS DONUT', cls:'caster',   hp:820, atk:70,color:'#e8a0d8',armor:0,  crit:.18,critMul:1.6,blockProf:0,  scale:1,   rig:'human'},
  katia:{id:'katia',name:'KATIA',          cls:'trickster',hp:900, atk:64,color:'#7fb0a8',armor:0,  crit:.22,critMul:1.6,blockProf:0,  scale:1,   rig:'human',
    moves:{s1:{hits:5,gap:4,dmg:1.2}}}};
const MOBS={
  goblin:   {id:'goblin',   name:'GOBLIN SCAVENGER',cls:'rogue',hp:300,atk:38,color:'#6b9a45',armor:0,  crit:.15,critMul:1.6,blockProf:0,  scale:.85,rig:'human',
    moves:{heavy:{charge:14,dmg:2.0}}},
  hobgoblin:{id:'hobgoblin',name:'HOBGOBLIN BRUTE',  cls:'tank', hp:700,atk:55,color:'#5c6b52',armor:.15,crit:.05,critMul:1.6,blockProf:.1, scale:1.2,rig:'human',
    moves:{heavy:{charge:30,dmg:3.4,hitstop:12}}}};
const DEFS=Object.assign({},CHAMPS,MOBS);
const CLASS_BEATS={brawler:'rogue',rogue:'caster',caster:'brawler',tank:'beast',beast:'trickster',trickster:'tank'};
const CLASS_BONUS=1.15,PARRY_WINDOW=6,PARRY_STUN=50,CHIP=.08,POWER_MAX=300,PARRY_LOCKOUT=20,CRIT_MUL_DEFAULT=1.6;
const DASH_BACK={frames:12,dist:90,inv:8},KNOCKDOWN={frames:40,inv:10};
const STAGE_W=1400;
// Wall clamp half-width for Fighter.tick's x clamp. Wider than the old width/2+8 inset (32px) so a
// fighter pinned at the wall stays fully on screen: the rig can reach shoulderW/2+armLen+limb past
// the fighter's x, which is ~86px for Carl and ~108px for a scaled-up hobgoblin. A camera margin
// can't fix this alone because the parallax-1.0 floor layer is drawn exactly STAGE_W wide, so
// letting the camera past its own limit would expose blank canvas past the stage edge; this has to
// be a sim-side constant (Fighter stays independent of Rig) instead.
const EDGE_PAD=110;

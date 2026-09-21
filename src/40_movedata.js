// All frame counts at 60 Hz. dash = px the attacker advances during startup. push = px the defender is shoved on hit.
const MOVES={
  light1:{startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light2',dash:18},
  light2:{startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light3',dash:18},
  light3:{startup:5,active:3,recovery:9, dmg:1.05,range:75, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light4',dash:18},
  light4:{startup:6,active:3,recovery:10,dmg:1.1, range:75, hitstun:15,blockstun:10,push:20,powHit:8, powTaken:4,chain:'light5',dash:20},
  light5:{startup:7,active:4,recovery:16,dmg:1.4, range:80, hitstun:20,blockstun:12,push:60,powHit:10,powTaken:5,chain:null,dash:10,knockdown:true},
  medium:{startup:10,active:4,recovery:14,dmg:1.6,range:120,hitstun:18,blockstun:11,push:24,powHit:12,powTaken:6,chain:'light1',dash:140},
  heavy: {charge:22,startup:8,active:5,recovery:26,dmg:2.6,range:130,hitstun:26,blockstun:14,push:70,powHit:18,powTaken:9,chain:null,knockdown:true},
  s1:{startup:8, active:4,recovery:22,dmg:1.5,hits:3,gap:6,range:130,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:100,chain:null,knockdown:true},
  s2:{startup:10,active:4,recovery:28,dmg:1.6,hits:5,gap:6,range:150,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:200,chain:null,knockdown:true},
  s3:{startup:20,active:6,recovery:40,dmg:3,  hits:4,gap:8,range:220,hitstun:20,blockstun:0, push:90,powHit:0,powTaken:0,cost:300,chain:null,knockdown:true,unblockable:true}};
const CHAMPS={
  carl: {id:'carl', name:'CARL',           cls:'brawler',hp:1000,atk:60,color:'#f4c542',armor:0,  crit:.10},
  donut:{id:'donut',name:'PRINCESS DONUT', cls:'caster', hp:820, atk:70,color:'#e8a0d8',armor:0,  crit:.18}};
const CLASS_BEATS={brawler:'rogue',rogue:'caster',caster:'brawler',tank:'beast',beast:'trickster',trickster:'tank'};
const CLASS_BONUS=1.15,PARRY_WINDOW=6,PARRY_STUN=50,CHIP=.08,HITSTOP=4,POWER_MAX=300;
const DASH_BACK={frames:12,dist:90,inv:8},KNOCKDOWN={frames:40,inv:10};

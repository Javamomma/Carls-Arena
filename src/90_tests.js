const Test={cases:[],add(n,fn){this.cases.push({n,fn})},
  run(){const out=[];for(const c of this.cases){try{c.fn();out.push({name:c.n,ok:true})}catch(e){out.push({name:c.n,ok:false,err:String(e&&e.message||e)})}}
    return{pass:out.filter(o=>o.ok).length,fail:out.filter(o=>!o.ok).length,results:out}}};
const eq=(a,b,m)=>{if(a!==b)throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a))};
const ok=(v,m)=>{if(!v)throw new Error(m||'expected truthy')};
const threw=fn=>{try{fn()}catch(e){return true}return false};
Test.add('rng is deterministic per seed',()=>{const a=RNG(42),b=RNG(42);for(let i=0;i<5;i++)eq(a.next(),b.next());ok(RNG(1).next()!==RNG(2).next())});
Test.add('move table is complete and sane',()=>{
  for(const k of ['light1','light2','light3','light4','light5','medium','heavy','s1','s2','s3']){const m=MOVES[k];ok(m,k+' missing');
    for(const f of ['startup','active','recovery','dmg','range','hitstun','blockstun','push','powHit','powTaken'])ok(typeof m[f]==='number',k+'.'+f)}
  eq(MOVES.light1.chain,'light2');eq(MOVES.light5.chain,null);ok(MOVES.light5.knockdown);ok(MOVES.s3.unblockable);
  eq(MOVES.s1.cost,100);eq(MOVES.s2.cost,200);eq(MOVES.s3.cost,300);
  eq(CLASS_BEATS[CLASS_BEATS[CLASS_BEATS.brawler]],'brawler');eq(CLASS_BEATS[CLASS_BEATS[CLASS_BEATS.tank]],'tank');
  ok(CHAMPS.carl.hp>0&&CHAMPS.donut.atk>0)});
function mkFighter(ctrl){return new Fighter(CHAMPS.carl,1,ctrl||Ctrl.idle())}
Test.add('fighter light attack walks startup/active/recovery then idles',()=>{
  const F=mkFighter();F.act(Object.assign(Ctrl.EMPTY(),{light:true}));eq(F.state,'ATTACK');eq(F.phase(),'startup');
  for(let i=0;i<5;i++)F.tick();eq(F.phase(),'active');ok(F.hitbox(),'hitbox during active');
  for(let i=0;i<3;i++)F.tick();eq(F.phase(),'recovery');eq(F.hitbox(),null);
  for(let i=0;i<8;i++)F.tick();eq(F.state,'IDLE');eq(F.move,null)});
Test.add('heavy charges while held and cancels when released early',()=>{
  const F=mkFighter();const held=Object.assign(Ctrl.EMPTY(),{heavy:true});F.act(held);eq(F.state,'CHARGE');
  for(let i=0;i<10;i++){F.act(held);F.tick()}eq(F.state,'CHARGE');
  F.act(Ctrl.EMPTY());eq(F.state,'IDLE');
  const G2=mkFighter();G2.act(held);for(let i=0;i<MOVES.heavy.charge;i++){G2.act(held);G2.tick()}eq(G2.state,'ATTACK')});
Test.add('dash back grants invulnerable frames and moves away from facing',()=>{
  const F=mkFighter();const x0=F.x;F.act(Object.assign(Ctrl.EMPTY(),{dashBack:true}));eq(F.state,'DASH');eq(F.inv,DASH_BACK.inv);
  for(let i=0;i<DASH_BACK.frames;i++)F.tick();eq(F.state,'IDLE');ok(F.x<x0,'moved back')});
Test.add('blockAge counts held frames and resets',()=>{
  const F=mkFighter();const b=Object.assign(Ctrl.EMPTY(),{block:true});F.act(b);eq(F.state,'BLOCK');eq(F.blockAge,1);F.act(b);eq(F.blockAge,2);F.act(Ctrl.EMPTY());eq(F.blockAge,0);eq(F.state,'IDLE')});
Test.add('special requires power and deducts it',()=>{
  const F=mkFighter();F.act(Object.assign(Ctrl.EMPTY(),{special:1}));eq(F.state,'IDLE');F.power=250;F.act(Object.assign(Ctrl.EMPTY(),{special:2}));eq(F.state,'ATTACK');eq(F.power,50);eq(F.moveName,'s2')});
Test.add('script controller fires at frames and holds through until',()=>{
  const c=Ctrl.script([{f:0,intent:{light:true}},{f:2,until:4,intent:{block:true}}]);
  eq(c.next().light,true);eq(c.next().block,false);eq(c.next().block,true);eq(c.next().block,true);eq(c.next().block,true);eq(c.next().block,false)});
Test.add('random controller is deterministic per seed',()=>{const a=Ctrl.random(5),b=Ctrl.random(5);for(let i=0;i<50;i++)eq(JSON.stringify(a.next()),JSON.stringify(b.next()))});
function mkFight(o={}){return new Fight(Object.assign({seed:1,p1:CHAMPS.carl,p2:CHAMPS.carl,ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle(),clock:120,noCrit:true},o))}
function run(f,n){for(let i=0;i<n;i++)f.step()}
function closeIn(f){f.p1.x=f.p2.x-f.p1.width-10}   // p1 within light range of p2
const L=(f,until)=>({f,until,intent:{light:true}});
Test.add('light connects on first active frame for atk*dmg',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.p2.hp,940);eq(f.p2.state,'HITSTUN');eq(f.hitstop,MOVES.light1.hitstop);eq(f.p1.combo,1)});
Test.add('held block takes chip and blockstun, attacker may chain',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(10)]),ctrl2:Ctrl.hold({block:true})});closeIn(f);run(f,15);
  eq(f.p2.hp,995);eq(f.p2.state,'BLOCKSTUN');eq(f.p1.landed,true);eq(f.log.filter(e=>e.type==='block').length,1)});
Test.add('block pressed inside the window parries and stuns the attacker',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.script([{f:2,until:40,intent:{block:true}}])});closeIn(f);run(f,5);
  eq(f.p2.hp,1000);eq(f.p1.state,'STUNNED');eq(f.p1.stun,PARRY_STUN);eq(f.log[f.log.length-1].type,'parry')});
Test.add('specials cannot be parried',()=>{
  const f=mkFight({ctrl1:Ctrl.script([{f:0,intent:{special:1}}]),ctrl2:Ctrl.script([{f:5,until:40,intent:{block:true}}])});closeIn(f);f.p1.power=100;run(f,8);
  ok(f.p1.state!=='STUNNED');eq(f.log.filter(e=>e.type==='block').length,1)});
Test.add('dash back evades a light',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.script([{f:0,intent:{dashBack:true}}])});closeIn(f);run(f,5);
  eq(f.p2.hp,1000);eq(f.log[f.log.length-1].type,'miss')});
Test.add('holding light chains five hits into a knockdown and hits stop landing while down',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0,200)])});closeIn(f);run(f,90);
  eq(f.log.filter(e=>e.type==='hit').length,5);eq(f.p2.hp,667);eq(f.p2.state,'KNOCKDOWN');
  run(f,20);eq(f.log.filter(e=>e.type==='hit').length,5)});
Test.add('power accrues for both sides and caps',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0,200)])});closeIn(f);run(f,90);
  eq(f.p1.power,7+7+7+8+10);eq(f.p2.power,4+4+4+4+5);f.p1.power=299;f.p1.hits=new Set();f.p1.power=Math.min(POWER_MAX,f.p1.power+50);eq(f.p1.power,300)});
Test.add('S3 is unblockable, costs three bars, knocks down on last hit',()=>{
  // Amended for Task 2.7: s3 leaving startup now arms a 72-frame cinematic freeze that raw step()
  // never decrements on its own (only G.tick does), so the freeze has to be cleared by hand here,
  // same as the dedicated cinematic test below, before the remaining three hits can land.
  const f=mkFight({ctrl1:Ctrl.script([{f:0,intent:{special:3}}]),ctrl2:Ctrl.hold({block:true})});closeIn(f);f.p1.power=300;
  run(f,21);f.cinematic=0;run(f,90);
  eq(f.p1.power,0);eq(f.log.filter(e=>e.type==='hit').length,4);eq(f.p2.hp,1000-4*180);eq(f.p2.state,'KNOCKDOWN')});
Test.add('class advantage adds 15%',()=>{
  const f=mkFight({p1:CHAMPS.donut,p2:CHAMPS.carl,ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.p2.hp,1000-Math.round(70*1.15))});
Test.add('KO ends the fight with WIN/KO states',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);f.p2.hp=1;run(f,5);
  ok(f.over);eq(f.winner,f.p1);eq(f.p1.state,'WIN');eq(f.p2.state,'KO');eq(f.log[f.log.length-1].type,'ko');run(f,10);eq(f.p1.state,'WIN')});
Test.add('time-up picks the higher health percentage',()=>{
  const f=mkFight({p1:CHAMPS.carl,p2:CHAMPS.donut,clock:.05});f.p1.hp=500;run(f,5);ok(f.over);eq(f.winner,f.p2)});
Test.add('a mirrored simultaneous trade lands both hits, not just p1\'s',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.script([L(0)])});
  f.p1.x=W/2-40;f.p2.x=W/2+40;run(f,5);
  eq(f.p1.hp,940);eq(f.p2.hp,940);eq(f.log.filter(e=>e.type==='hit').length,2)});
Test.add('combo resets after the defender is free for 20 frames',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.p1.combo,1);run(f,60);eq(f.p1.combo,0)});
Test.add('dummy AI never attacks',()=>{const f=mkFight({ctrl2:AI.make('dummy',3)});run(f,600);eq(f.log.filter(e=>e.type==='hit'&&e.who===-1).length,0)});
Test.add('basic AI lands hits on an idle target within 10 seconds',()=>{const f=mkFight({ctrl2:AI.make('basic',3)});run(f,600);ok(f.log.some(e=>e.type==='hit'&&e.who===-1))});
Test.add('AI vs random bot is deterministic',()=>{
  const a=mkFight({ctrl1:Ctrl.random(3),ctrl2:AI.make('basic',9)}),b=mkFight({ctrl1:Ctrl.random(3),ctrl2:AI.make('basic',9)});run(a,900);run(b,900);
  eq(a.p1.hp,b.p1.hp);eq(a.p2.hp,b.p2.hp);eq(a.log.length,b.log.length)});
Test.add('an unknown AI profile throws instead of silently falling back to basic',()=>{
  ok(threw(()=>AI.make('nope',1)))});
Test.add('brawl AI blocks a medium at least once in 20 seconds',()=>{
  const f=mkFight({ctrl1:Ctrl.script(Array.from({length:40},(_,i)=>({f:i*30,intent:{medium:true}}))),ctrl2:AI.make('brawl',11)});run(f,1200);
  ok(f.log.some(e=>e.type==='block'||e.type==='parry'))});
Test.add('Input.drain folds the action queue into one intent and clears it',()=>{
  Input.q.push('light','special2','dashBack');Input.held.block=true;const it=Input.drain();
  eq(it.light,true);eq(it.special,2);eq(it.dashBack,true);eq(it.block,true);eq(Input.q.length,0);Input.held.block=false;
  const it2=Input.drain();eq(it2.light,false);eq(it2.special,0);eq(it2.block,false)});
function withFight(fn){const prev=G.state;G.state='FIGHT';Input.q.length=0;Input.held.block=false;Input.held.heavy=false;Input._ptrs.clear();
  try{fn()}finally{Input.q.length=0;Input.held.block=false;Input.held.heavy=false;Input._ptrs.clear();G.state=prev}}
function tap(id,x){const r=canvas.getBoundingClientRect(),cx=r.left+x*r.width/W,cy=r.top+r.height/2;return{cx,cy,
  down(){canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,clientX:cx,clientY:cy,bubbles:true}))},
  up(){canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:id,clientX:cx,clientY:cy,bubbles:true}))}}}
Test.add('two-thumb touch: second thumb releasing does not clear the first thumb block',()=>{
  withFight(()=>{
    const left=tap(1,Input.DEF_ZONE/2),right=tap(2,Input.DEF_ZONE+50);
    left.down();ok(Input.held.block,'left thumb holds block');
    right.down();right.up();
    eq(Input.held.block,true,'block must stay held: left thumb never lifted')})});
Test.add('keyboard actions do not queue while paused',()=>{
  const prev=G.state;G.state='PAUSED';Input.q.length=0;
  try{dispatchEvent(new KeyboardEvent('keydown',{key:'j'}));eq(Input.q.length,0,'light must not queue while paused')}
  finally{Input.q.length=0;G.state=prev}});
Test.add('Fight never calls Audio directly; G.onEvent dispatches sound per event',()=>{
  ok(!/Audio\./.test(Fight.prototype.resolve.toString()),'resolve must not call Audio');
  ok(!/Audio\./.test(Fight.prototype.finish.toString()),'finish must not call Audio');
  const orig=Audio.recipes.light1;let called=false;Audio.recipes.light1=()=>{called=true};
  try{G.onEvent('hit',{moveName:'light1',combo:1})}finally{Audio.recipes.light1=orig}
  ok(called,'G.onEvent must dispatch hit to Audio.recipes[moveName]')});
Test.add('two-thumb touch: right thumb lifting clears heavy even after a second thumb touches',()=>{
  withFight(()=>{
    const right=tap(1,Input.DEF_ZONE+50),left=tap(2,Input.DEF_ZONE/2);
    right.down();const rec=Input._ptrs.get(1);rec.holdFired=true;Input.held.heavy=true; // simulate the 180ms hold firing
    left.down();ok(Input.held.block,'left thumb also holds block');
    right.up();
    eq(Input.held.heavy,false,'heavy must clear: right thumb (its owner) lifted')})});
Test.add('stage builds offscreen layers with parallax factors',()=>{const s=Stage.build('depths');ok(s.layers.length>=4,'>=4 layers');for(const L of s.layers){ok(L.canvas&&L.canvas.width>0);ok(L.parallax>=0&&L.parallax<=1)}ok(s.torches.length>=2)});
Test.add('camera target sits at the fighters midpoint and zooms in when close',()=>{const f=mkFight();run(f,1);const mid=(f.p1.x+f.p2.x)/2;ok(Math.abs(f.camTarget.x-mid)<1);const far=f.camTarget.zoom;closeIn(f);run(f,1);ok(f.camTarget.zoom>far,'zoom increases when close');ok(f.camTarget.zoom<=1.35&&far>=1)});
Test.add('camera lerps toward target and clamps to stage edges',()=>{const cam={x:0,zoom:1};const f=mkFight();run(f,1);Camera.update(cam,f);ok(cam.x>0&&cam.x<f.camTarget.x,'moved toward target');for(let i=0;i<200;i++)Camera.update(cam,f);ok(Math.abs(cam.x-f.camTarget.x)<0.5);cam.x=-999;f.camTarget.x=-999;Camera.update(cam,f);ok(cam.x>=W/2/cam.zoom-1,'clamped left')});
Test.add('fighters clamp to STAGE_W not W',()=>{const F=mkFighter();F.x=STAGE_W+50;F.tick();ok(F.x<=STAGE_W-F.width/2-8&&F.x>W,'clamped to stage, beyond old W')});
Test.add('every look has every pose the state machine can reach',()=>{const need=['idle','walk','dash','light1','light2','light3','light4','light5','medium','heavyCharge','heavy','block','blockstun','hit','knockdown','getup','stunned','s1','s2','s3','win','ko'];for(const k of need)ok(POSES[k]&&POSES[k].length>=2,'pose '+k);for(const id of ['carl','katia','goblin','hobgoblin'])ok(LOOKS[id]&&DEFS[id].look===LOOKS[id],'look '+id)});
Test.add('rig solve returns all joints with feet on the floor line',()=>{const j=Rig.solve(LOOKS.carl,'idle',0,1);for(const b of Rig.bones)ok(j[b]&&isFinite(j[b].x)&&isFinite(j[b].y),b);ok(Math.abs(j.lFoot.y)<6&&Math.abs(j.rFoot.y)<6,'feet at y≈0');ok(j.head.y<j.hip.y,'head above hip')});
Test.add('poses differ: light1 active frame moves the lead hand forward of idle',()=>{const a=Rig.solve(LOOKS.carl,'idle',0,1),b=Rig.solve(LOOKS.carl,'light1',0.5,1);ok(b.rHand.x>a.rHand.x+20,'punch extends')});
Test.add('poseFor maps fighter state to pose key and progress',()=>{const F=mkFighter();eq(Rig.poseFor(F).key,'idle');F.act(Object.assign(Ctrl.EMPTY(),{light:true}));for(let i=0;i<3;i++)F.tick();const p=Rig.poseFor(F);eq(p.key,'light1');ok(p.t01>0&&p.t01<1);F.setState('KNOCKDOWN');F.f=35;eq(Rig.poseFor(F).key,'getup')});
Test.add('mob defs have hp/atk/scale and resolve through DEFS',()=>{ok(DEFS.goblin.hp<DEFS.carl.hp);ok(DEFS.hobgoblin.scale>1);eq(DEFS.katia.cls,'trickster');ok(DEFS.goblin.rig==='human')});
Test.add('hitstop is per move',()=>{const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.hitstop,MOVES.light1.hitstop);ok(MOVES.heavy.hitstop>MOVES.light1.hitstop&&MOVES.s3.hitstop>MOVES.heavy.hitstop)});
Test.add('a hit queues spark, popup and shake fx; a block queues dust',()=>{const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);const kinds=f.fx.map(e=>e.kind);ok(kinds.includes('spark')&&kinds.includes('popup')&&kinds.includes('shake'),kinds.join());const g=mkFight({ctrl1:Ctrl.script([L(10)]),ctrl2:Ctrl.hold({block:true})});closeIn(g);run(g,15);ok(g.fx.some(e=>e.kind==='dust'))});
Test.add('KO starts slow-mo and G steps the sim every 4th tick during it',()=>{const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);f.p2.hp=1;run(f,5);ok(f.over&&f.slowmo>0);const before=f.slowmo;G.fight=f;G.state='FIGHT';G._tickN=0;for(let i=0;i<8;i++)G.tick();eq(f.slowmo,before-2);G.fight=null;G.state='TITLE'});
Test.add('FX updates and expires particles deterministically',()=>{FX.reset();FX.push({kind:'spark',x:0,y:0,n:6,col:'#fff'});eq(FX.list.length,6);for(let i=0;i<120;i++)FX.update();eq(FX.list.length,0);FX.push({kind:'shake',amt:8});FX.update();ok(FX.shake>0&&FX.shake<8)});
Test.add('on-screen buttons map to intents',()=>{Input.q.length=0;const btn=id=>document.getElementById(id);ok(btn('btnBlock')&&btn('btnPunch')&&btn('btnKick')&&btn('btnPower'));btn('btnPunch').dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,bubbles:true}));btn('btnKick').dispatchEvent(new PointerEvent('pointerdown',{pointerId:8,bubbles:true}));ok(Input.q.includes('light')&&Input.q.includes('medium'));btn('btnBlock').dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,bubbles:true}));eq(Input.held.block,true);btn('btnBlock').dispatchEvent(new PointerEvent('pointerup',{pointerId:9,bubbles:true}));eq(Input.held.block,false);Input.q.length=0});
Test.add('POWER tap fires the highest affordable special',()=>{const f=mkFight();G.fight=f;f.p1.power=250;Input.q.push('powerAuto');eq(Input.drain().special,2);f.p1.power=50;Input.q.push('powerAuto');eq(Input.drain().special,0);G.fight=null});
Test.add('encounter resolves floor, name and enemy def',()=>{const e=Encounter.resolve('f1_goblin');eq(e.floor,1);eq(e.name,'THE DEPTHS');eq(e.enemy.id,'goblin');const o=Encounter.resolve({floor:3,name:'X',enemy:'hobgoblin',tier:'brawl'});eq(o.enemy.hp,DEFS.hobgoblin.hp)});
Test.add('startFight with an encounter sets p2 to the mob and scales hp',()=>{G.startFight({encounter:{floor:2,name:'T',enemy:'goblin',tier:'dummy',hpMul:2,atkMul:1},ctrl1:Ctrl.idle()});eq(G.fight.p2.def.id,'goblin');eq(G.fight.p2.maxHp,600);eq(G.encounter.floor,2);G.toTitle()});
Test.add('every move has a sound recipe and announcer lines exist per kind',()=>{for(const k in MOVES)ok(typeof Audio.recipes[k]==='function',k);for(const k of ['start','streak3','streak5','streak10','parry','special','win','loss'])ok(Lines[k]&&Lines[k].length>=8,k)});
Test.add('announce picks deterministically from the fight rng and throttles',()=>{const r1=RNG(5),r2=RNG(5);eq(Audio.pickLine('parry',r1),Audio.pickLine('parry',r2));G._sayAt=-999;G.frameNow=100;G.say('a');eq(document.getElementById('toast').textContent,'a');G.say('b');eq(document.getElementById('toast').textContent,'a');G.frameNow=200;G.say('b');eq(document.getElementById('toast').textContent,'b')});
Test.add('a multi-hit special plays its recipe once and a light thud per landed sub-hit',()=>{
  const f=mkFight({ctrl1:Ctrl.script([{f:0,intent:{special:2}}]),onEvent:(t,a,b,v)=>G.onEvent(t,a,b,v)});
  closeIn(f);f.p1.power=200;
  G.fight=f;G.state='FIGHT';G._tickN=0;
  const origS2=Audio.recipes.s2,origL1=Audio.recipes.light1;let s2n=0,l1n=0;
  Audio.recipes.s2=()=>{s2n++};Audio.recipes.light1=()=>{l1n++};
  try{for(let i=0;i<90;i++)G.tick()}
  finally{Audio.recipes.s2=origS2;Audio.recipes.light1=origL1;G.fight=null;G.state='TITLE'}
  eq(s2n,1,'s2 recipe fires once, on the moveName transition');eq(l1n,5,'one light thud per landed sub-hit')});
Test.add('crit rolls from the fight rng and multiplies damage; noCrit disables',()=>{const a=mkFight({ctrl1:Ctrl.script([L(0)]),noCrit:false,seed:3});a.p1.def=Object.assign({},CHAMPS.carl,{crit:1});closeIn(a);run(a,5);eq(a.p2.hp,1000-Math.round(60*1.6));const b=mkFight({ctrl1:Ctrl.script([L(0)])});b.p1.def=Object.assign({},CHAMPS.carl,{crit:1});closeIn(b);run(b,5);eq(b.p2.hp,940)});
Test.add('block proficiency reduces chip',()=>{const f=mkFight({ctrl1:Ctrl.script([L(10)]),ctrl2:Ctrl.hold({block:true})});f.p2.def=Object.assign({},CHAMPS.carl,{blockProf:.5});closeIn(f);run(f,15);eq(f.p2.hp,Math.round(1000-5*.5))});
Test.add('a missed parry locks out re-parry for PARRY_LOCKOUT frames',()=>{const mash=Ctrl.script(Array.from({length:40},(_,i)=>({f:i*7,until:i*7+5,intent:{block:true}})));const f=mkFight({ctrl1:Ctrl.script([L(0,300)]),ctrl2:mash});closeIn(f);run(f,300);const parries=f.log.filter(e=>e.type==='parry').length;ok(parries<=2,'mash parries: '+parries);const hold=mkFight({ctrl1:Ctrl.script([L(0,300)]),ctrl2:Ctrl.hold({block:true})});closeIn(hold);run(hold,300);ok(hold.p2.hp>=f.p2.hp-50,'holding is not much worse than mashing')});
Test.add('per-champion move overrides merge over MOVES',()=>{const F=new Fighter(DEFS.goblin,-1,Ctrl.idle());eq(F.moveDef('heavy').charge,14);eq(F.moveDef('light1').startup,MOVES.light1.startup);const H=new Fighter(DEFS.hobgoblin,-1,Ctrl.idle());eq(H.moveDef('heavy').hitstop,12)});
Test.add('medium as a combo ender pushes the defender out of light range',()=>{
  // Chain 3 lights (light1/2/3 all have a non-null .chain) then, from light3's recovery, cancel
  // into a medium (script: light only through frame 23, medium from frame 24 on — the frame light3
  // enters recovery, verified against the fight's own frame counter, not guessed) so the ender
  // branch (att.moveName==='medium'&&att.combo>=3) is actually exercised, not just incidentally
  // satisfied by prior pushback. Capture the landing hit's attacker via a wrapped onEvent (Fight.emit
  // hands it the live Fighter, so a.moveName/a.combo reflect that exact hit) and diff its knockback
  // against a plain medium thrown from IDLE with combo 0. Both scenarios share identical dash/
  // separate() contamination on the hit-landing step (medium's approach dash runs through
  // f<=startup, which is also its first active frame, so the last dash increment and the hit
  // resolve in the same step), so the *difference* between the two deltas isolates the push
  // (90 vs MOVES.medium.push) exactly, independent of that shared collision noise.
  let capture=null;
  const f=mkFight({ctrl1:Ctrl.script([{f:0,until:23,intent:{light:true}},{f:24,until:60,intent:{medium:true}}]),
    onEvent:(type,a)=>{if(type==='hit'&&a.moveName==='medium'&&!capture)capture={moveName:a.moveName,combo:a.combo}}});
  f.p2.x=STAGE_W/2;closeIn(f); // room to be pushed; hitstop pauses Fight.frame for a few steps per landed hit, so budget generously
  let dx=0;
  for(let i=0;i<70&&dx===0;i++){const before=f.p2.x;f.step();const last=f.log[f.log.length-1];
    if(capture&&last&&last.type==='hit'&&last.f===f.frame&&last.who===1)dx=f.p2.x-before}
  ok(capture,'medium landed as the chain-cancel finisher');eq(capture.moveName,'medium');ok(capture.combo>=4,'combo at ender: '+capture.combo);
  const g=mkFight();closeIn(g);g.p1.combo=0;g.p1.startMove('medium');
  let dx2=0;
  for(let i=0;i<40&&dx2===0;i++){const before=g.p2.x;g.step();const last=g.log[g.log.length-1];
    if(last&&last.type==='hit'&&last.f===g.frame)dx2=g.p2.x-before}
  ok(dx2<60,'non-ender medium push stays well under 90, got '+dx2);
  eq(dx-dx2,90-MOVES.medium.push,'ender push (90) vs normal push ('+MOVES.medium.push+') differential; dx='+dx+' dx2='+dx2)});
Test.add('S3 freezes the sim for the cinematic then lands all hits',()=>{const f=mkFight({ctrl1:Ctrl.script([{f:0,intent:{special:3}}])});closeIn(f);f.p1.power=300;run(f,21);ok(f.cinematic>0,'cinematic armed');const hpBefore=f.p2.hp;run(f,30);eq(f.p2.hp,hpBefore,'frozen');f.cinematic=0;run(f,120);eq(f.log.filter(e=>e.type==='hit').length,4)});
Test.add('G.tick decrements cinematic without stepping the sim',()=>{const f=mkFight();f.cinematic=5;const fr=f.frame;G.fight=f;G.state='FIGHT';G.tick();eq(f.cinematic,4);eq(f.frame,fr);G.fight=null;G.state='TITLE'});
Test.add('brute profile exists and prefers heavies',()=>{ok(AI.profiles.brute);ok(AI.profiles.brute.heavy>=.5)});
Test.add('brute AI lands a heavy on an idle target within 600 frames',()=>{
  let landed=false;
  const f=mkFight({ctrl2:AI.make('brute',13),onEvent:(type,a)=>{if(type==='hit'&&a&&a.side===-1&&a.moveName==='heavy')landed=true}});
  closeIn(f);run(f,600);
  ok(landed,'brute AI should land at least one heavy on an idle p1 within 600 frames')});
Test.add('HUD statics are cached across frames',()=>{Render.frame(null);const a=Render._hudCache;Render.frame(null);ok(a&&a===Render._hudCache)});
Test.add('FX ages once per sim tick in sim mode, deterministically (not off wall-clock rAF)',()=>{
  const runOnce=()=>{
    const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);
    G.fight=f;G.state='FIGHT';G.sim=true;G._tickN=0;FX.reset();
    for(let i=0;i<8;i++)G.tick(); // lands the scripted light1, queueing a spark via Fight.resolve
    ok(FX.list.some(p=>p.kind==='spark'),'hit landed and queued a spark');
    for(let i=0;i<10;i++)G.tick(); // 10 further sim ticks, each aging FX exactly once via G.tick
    return FX.list.length};
  const a=runOnce(),b=runOnce();
  eq(a,b,'identical script/seed -> identical FX state after the same tick count');
  G.fight=null;G.state='TITLE';G.sim=false});

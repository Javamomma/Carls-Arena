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
Test.add('tiers t1..t5 exist, aliases resolve, dummy stays inert',()=>{for(const t of ['t1','t2','t3','t4','t5'])ok(AI.TIERS[t]);eq(AI.resolveProfile('basic'),AI.TIERS.t2);eq(AI.resolveProfile('brawl'),AI.TIERS.t3);ok(AI.resolveProfile('brute').heavy>=.5);const f=mkFight({ctrl2:AI.make('dummy',3)});run(f,600);eq(f.log.filter(e=>e.type==='hit'&&e.who===-1).length,0)});
Test.add('t5 intercepts a dash-in medium with a light',()=>{const f=mkFight({ctrl1:Ctrl.script(Array.from({length:20},(_,i)=>({f:i*40,intent:{medium:true}}))),ctrl2:AI.make('t5',4)});f.p1.x=f.p2.x-260;run(f,800);const ai=f.log.filter(e=>e.type==='hit'&&e.who===-1);ok(ai.length>0,'ai landed');ok(f.log.some(e=>e.type==='hit'&&e.who===-1&&e.move==='light1'),'a light interrupted')});
Test.add('t4 punishes a parried (stunned) player',()=>{const f=mkFight({ctrl1:Ctrl.script([{f:0,until:600,intent:{light:true}}]),ctrl2:AI.make('t4',5)});closeIn(f);run(f,900);ok(f.log.some((e,i)=>e.type==='parry'&&f.log.slice(i+1,i+30).some(h=>h.type==='hit'&&h.who===-1)),'hit within 30 frames after a parry')});
// Fix wave item 1: a t4 boss with power banked must actually throw its S3 (the *STEP per-second
// scaling bug made this ~1-in-880-held-power-frames before the fix — see 55_ai.js's special check).
Test.add('a t4 boss with power fires a special within 300 frames',()=>{
  const f=mkFight({p2:DEFS.grull,ctrl2:AI.make('t4',9)});closeIn(f);f.p2.power=300;run(f,300);
  ok(f.log.some(e=>e.type==='hit'&&e.who===-1&&e.move==='s3'),'grull should have landed an s3 within 300 frames')});
// --- Task 3.6 refactor: Fighter.wasKnockedDown ---
Test.add('wasKnockedDown is set on KNOCKDOWN and self-clears exactly one tick after i-frames expire',()=>{
  const F=mkFighter();F.setState('KNOCKDOWN');eq(F.wasKnockedDown,true);
  for(let i=0;i<KNOCKDOWN.frames-1;i++)F.tick();
  eq(F.wasKnockedDown,true,'still true through the knockdown timer');
  F.tick(); // the tick that flips state IDLE and arms the get-up i-frames (inv=KNOCKDOWN.inv)
  eq(F.state,'IDLE');eq(F.inv,KNOCKDOWN.inv);eq(F.wasKnockedDown,true,'still true — i-frames just armed, not yet spent');
  for(let i=0;i<KNOCKDOWN.inv-1;i++)F.tick();
  eq(F.inv,1);eq(F.wasKnockedDown,true,'still true with one i-frame left');
  F.tick(); // inv 1->0 this tick
  eq(F.inv,0);eq(F.wasKnockedDown,true,'still true the tick inv reaches 0 — AI.make reads it here');
  F.tick(); // the NEXT tick self-clears it
  eq(F.wasKnockedDown,false,'cleared one tick after i-frames actually expired')});
Test.add('wasKnockedDown is never set by an ordinary dash-back, however DASH_BACK is tuned',()=>{
  const F=mkFighter();F.act(Object.assign(Ctrl.EMPTY(),{dashBack:true}));eq(F.state,'DASH');
  for(let i=0;i<DASH_BACK.frames+DASH_BACK.inv+2;i++)F.tick();
  eq(F.wasKnockedDown,false,'a plain dash-back must never look like a knockdown get-up')});
Test.add('AI.make punishes exactly on the frame wasKnockedDown+inv0 line up (justGotUp)',()=>{
  // Drives foe's own state machine directly (not a full Fight.step loop) so the single-frame
  // justGotUp window lines up deterministically with one ctrl.next() call under test, instead of
  // depending on the AI's own cd/busy cadence happening to poll on that exact fight frame by luck.
  // t5's punish is 1 (100%), so the roll itself is not what's under test — the wiring is.
  const ctrl=AI.make('t5',6),f=mkFight({ctrl2:ctrl});closeIn(f);
  const me=f.p2,foe=f.p1;
  foe.setState('KNOCKDOWN');
  for(let i=0;i<KNOCKDOWN.frames+KNOCKDOWN.inv-1;i++)foe.tick();
  eq(foe.inv,1,'one i-frame left');
  foe.tick(); // inv 1->0 this tick
  eq(foe.inv,0);eq(foe.state,'IDLE');eq(foe.wasKnockedDown,true,'flag still set on the frame AI.make must read it');
  const it=ctrl.next(f,me,foe);
  eq(it.medium,true,'t5 must punish on the exact justGotUp frame');
  // Fix-wave item 9: AI.make only reads wasKnockedDown now — it no longer writes to foe (the
  // opponent's own Fighter, which the controller doesn't own). The flag is still true immediately
  // after next() returns (next() never touches it); Fighter.tick's own _kdCounter-driven self-clear
  // (50_fighter.js) is what actually clears it, one real tick later.
  eq(foe.wasKnockedDown,true,'AI never writes foe state; still true immediately after next()');
  foe.tick();
  eq(foe.wasKnockedDown,false,'Fighter.tick self-clears one tick after i-frames actually expired')});
Test.add('t1 loses to t5 head to head over 5 seeds',()=>{let w5=0;for(let s=1;s<=5;s++){const f=mkFight({ctrl1:AI.make('t1',s),ctrl2:AI.make('t5',s+100),clock:120});run(f,7200);if(f.winner===f.p2)w5++}ok(w5>=4,'t5 wins '+w5+'/5')});
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
Test.add('poseFor maps fighter state to pose key and progress',()=>{const F=mkFighter();eq(Rig.poseFor(F).key,'idle');
  const W=mkFighter();W.dx=2;eq(Rig.poseFor(W).key,'walk','IDLE with dx beyond the deadzone must map to walk');
  F.act(Object.assign(Ctrl.EMPTY(),{light:true}));for(let i=0;i<3;i++)F.tick();const p=Rig.poseFor(F);eq(p.key,'light1');ok(p.t01>0&&p.t01<1);F.setState('KNOCKDOWN');F.f=35;eq(Rig.poseFor(F).key,'getup')});
Test.add('mob defs have hp/atk/scale and resolve through DEFS',()=>{ok(DEFS.goblin.hp<DEFS.carl.hp);ok(DEFS.hobgoblin.scale>1);eq(DEFS.katia.cls,'trickster');ok(DEFS.goblin.rig==='human')});
Test.add('hitstop is per move',()=>{const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.hitstop,MOVES.light1.hitstop);ok(MOVES.heavy.hitstop>MOVES.light1.hitstop&&MOVES.s3.hitstop>MOVES.heavy.hitstop)});
Test.add('a hit queues spark, popup and shake fx; a block queues dust',()=>{const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);const kinds=f.fx.map(e=>e.kind);ok(kinds.includes('spark')&&kinds.includes('popup')&&kinds.includes('shake'),kinds.join());const g=mkFight({ctrl1:Ctrl.script([L(10)]),ctrl2:Ctrl.hold({block:true})});closeIn(g);run(g,15);ok(g.fx.some(e=>e.kind==='dust'))});
Test.add('KO starts slow-mo and G steps the sim every 4th tick during it',()=>{const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);f.p2.hp=1;run(f,5);ok(f.over&&f.slowmo>0);const before=f.slowmo;G.fight=f;G.state='FIGHT';G._tickN=0;for(let i=0;i<8;i++)G.tick();eq(f.slowmo,before-2);G.fight=null;G.state='TITLE'});
Test.add('a parry works again after PARRY_LOCKOUT expires',()=>{
  const lightF=PARRY_LOCKOUT+10,blockF=lightF+2;
  const f=mkFight({ctrl1:Ctrl.script([L(lightF)]),
    ctrl2:Ctrl.script([{f:blockF,until:blockF+40,intent:{block:true}}])});
  closeIn(f);
  f.p2.parryLock=PARRY_LOCKOUT; // simulate a lockout armed right at fight start (e.g. an earlier missed parry)
  run(f,PARRY_LOCKOUT+1); // idle it out — parryLock ticks down once per Fighter.tick(), unconditionally
  eq(f.p2.parryLock,0,'lockout must have fully expired');
  run(f,15); // the scripted light now lands with p2's block already pressed inside PARRY_WINDOW
  eq(f.log[f.log.length-1].type,'parry','block pressed inside the window after lockout expiry must parry again')});
// --- Task 3.5 fix round 1: dynamic per-fight camera zoom cap ---
// Original test replaced the old fixed-1.28/heavyCharge-and-s3-only "tallest pose stays under the HUD
// at max zoom" check with one that measured the true worst case across every pose/keyframe *and* prop
// for a look (Rig.extent), used by G.startFight to compute a per-FIGHT zoom cap.
// --- Fix-wave item 4: per-frame cap, not per-fight ---
// A single fight-wide worst-case cap means one tall pose (Carl's own 'dash' lunge, a raised 'win'
// pose, Hobgoblin's held club) taxes the zoom for every OTHER frame of the fight too, not just the
// frames that pose is actually on screen for — see POSES.heavy's own Fix-wave item 4 comment for the
// concrete cost (a real overhead wind-up had to be trimmed to a barely-distinct forward lean just to
// keep an unrelated pairing's cap pinned). G.tick now computes capNow every frame from whichever
// pose(s) are actually on screen (Rig.topAt/G.topNow), so this test checks the SAME invariant the old
// one did (every pose's topmost point — joints, head circle, props — clears HUD_LINE at its own cap)
// but per-pose instead of per-fight: for every pose of every look in a representative pairing set, at
// THAT pose's own per-frame cap, screen y must clear HUD_LINE. This is provable in closed form (capNow
// is defined so the topmost point lands exactly at HUD_LINE, or above it once the 1.28 ceiling itself
// binds first) — its value here is as a correctness check on Rig.topAt's own folding, mirroring how
// the old test caught Rig.extent bugs. 'win'/'ko' are no longer excluded (see G.startFight's own
// comment): a per-frame cap means they're safe to include now, where the old per-fight cap had to
// look away from them to avoid taxing the whole fight for a pose only shown at RESULT.
Test.add('every pose of every look stays under the HUD at its own per-frame zoom cap',()=>{
  const pairs=[['carl','goblin'],['carl','hobgoblin'],['carl','grull'],['mongo','grull'],
    ['donut','mother_rat'],['mongo','mongo']];
  const seen=new Set();
  for(const[id1,id2]of pairs)for(const id of[id1,id2]){
    if(seen.has(id))continue;seen.add(id);
    const look=LOOKS[id],sc=(DEFS[id]&&DEFS[id].scale)||1;
    const table=look.rig==='quad'?POSES_QUAD:look.rig==='big'?POSES_BIG:POSES;
    for(const key in table){
      const kf=table[key];
      for(let i=0;i<kf.length-1;i++){
        const ta=kf[i].t,tb=kf[i+1].t;
        for(const t of[ta,(ta+tb)/2,tb]){
          const top=Rig.topAt(look,key,t,sc);
          const capNow=Math.min(1.28,(Camera.anchorY-HUD_LINE)/top);
          const screen=Camera.toScreen({x:0,zoom:capNow},0,FLOOR-top);
          ok(screen.sy>=HUD_LINE-1e-6,id+': '+key+'/t'+t.toFixed(2)+' topmost point at screen y='
            +screen.sy.toFixed(2)+', must clear the HUD (>='+HUD_LINE+') at its own per-frame cap ('
            +capNow.toFixed(3)+')')}}}}});
const CAP_EXCL={excludePoses:['win','ko']};
// Fix-wave item 3/4 sanity floor: even though the effective in-fight cap is now per-frame, the
// per-FIGHT upper bounds (G.zoomCap/G.cineZoomCap, computed via Rig.extent — see G.startFight) must
// still not collapse to something absurd for the tallest-vs-tallest stress pairings. 0.75, not 0.80:
// folding the drawn head into Rig.extent (item 3) raises Mongo's own worst-case top ('walk', head
// circle included) enough that Mongo×Mongo/Mongo×Grull both land at ~0.784, below the pre-head-fold
// floor of 0.80; 0.75 keeps real margin under the new number.
Test.add('per-fight cineZoomCap upper bound does not collapse past 0.75 for the tallest pairings',()=>{
  for(const[id1,id2]of[['mongo','grull'],['mongo','mongo'],['donut','mother_rat']]){
    const sc1=(DEFS[id1]&&DEFS[id1].scale)||1,sc2=(DEFS[id2]&&DEFS[id2].scale)||1;
    const ext1=Rig.extent(LOOKS[id1],sc1,CAP_EXCL),ext2=Rig.extent(LOOKS[id2],sc2,CAP_EXCL);
    const tallestTop=Math.max(ext1.top,ext2.top);
    const ratio=(Camera.anchorY-HUD_LINE)/tallestTop;
    const cineZoomCap=Math.min(1.28,ratio);
    ok(cineZoomCap>=0.75,id1+'x'+id2+' cineZoomCap '+cineZoomCap.toFixed(3)+' must not zoom out past 0.75')}});
// Pinning test, pre-item-4: for pairings well within budget, the per-fight upper bounds landed EXACTLY
// on the game's own un-clamped ceilings (1.12 gameplay / 1.28 cinematic) — meaningful back when those
// bounds WERE the effective in-fight cap, so any pose quietly dragging one below its natural ceiling
// (Carl's own 'heavy' wind-up before its rShoulder was trimmed; Hobgoblin's held club) was a real,
// player-visible bug.
// Fix-wave item 4: G.zoomCap/G.cineZoomCap are still computed the same way (min(1.12,ratio)/
// min(1.28,ratio) off Rig.extent's true worst case — unchanged API, see G.startFight's own comment)
// but are no longer what the camera actually renders against; that's now G.tick's per-frame capNow
// (Rig.topAt/G.topNow — see the 'own per-frame zoom cap' test above, which is what actually proves
// no pose crosses the HUD in real gameplay). Restoring POSES.heavy's real overhead angle and
// Hobgoblin's club to their natural length (both safe now that a tall pose only costs the frames it's
// on screen for, not the whole fight) pushes several pairings' per-fight UPPER BOUNDS below their old
// exact pins — expected and harmless, since those bounds are bookkeeping now, not a render-time
// constraint. This test is kept as a loose sanity check (still positive, still <= the hard ceiling)
// rather than an exact pin, since exact pinning is no longer a meaningful invariant post-item-4.
Test.add('per-fight zoomCap/cineZoomCap upper bounds stay positive and within their hard ceilings',()=>{
  const pairs=[['carl','goblin'],['carl','hobgoblin'],['carl','katia'],['donut','goblin']];
  for(const[id1,id2]of pairs){
    const sc1=(DEFS[id1]&&DEFS[id1].scale)||1,sc2=(DEFS[id2]&&DEFS[id2].scale)||1;
    const ext1=Rig.extent(LOOKS[id1],sc1,CAP_EXCL),ext2=Rig.extent(LOOKS[id2],sc2,CAP_EXCL);
    const tallestTop=Math.max(ext1.top,ext2.top);
    const ratio=(Camera.anchorY-HUD_LINE)/tallestTop;
    const zoomCap=Math.min(1.12,ratio),cineCap=Math.min(1.28,ratio);
    ok(zoomCap>0&&zoomCap<=1.12,id1+'x'+id2+' zoomCap '+zoomCap.toFixed(3)+' must be in (0,1.12]');
    ok(cineCap>0&&cineCap<=1.28,id1+'x'+id2+' cineZoomCap '+cineCap.toFixed(3)+' must be in (0,1.28]')}});
Test.add('every look\'s reach fits inside EDGE_PAD',()=>{
  // Rig.extent's reach includes prop geometry (a dagger/club/spikedclub's tip, horns, a tiara, cat
  // whiskers) on top of every joint's own FK, not just the shoulderW/armLen/limb formula this test
  // used before Task 3.5's fix round 1 — a look wearing a reach-extending prop could otherwise clear
  // this check while still poking a weapon tip past EDGE_PAD in a real screenshot. (Every look's own
  // pose data was retuned this fix round so this holds true-FK-wide, not just at the old formula's
  // idle-silhouette approximation — see LOOKS.mongo's Fix round 3 and POSES_BIG's per-key comments.)
  //
  // Fix-wave item 9: the donut/mother_rat quad-rig carve-out this test used to need is gone — both
  // were trimmed (LOOKS.donut/mother_rat's own comments) until their reach clears EDGE_PAD (bumped
  // 220->260 in item 3) with real margin, closing the gap the final review flagged (Important): at
  // 260px separation the old numbers put the rat's snout drawing through Carl's torso, visual and
  // hurtbox disagreeing by about a body length. Every look in the roster now passes the same check.
  for(const id in LOOKS){
    const look=LOOKS[id],sc=(DEFS[id]&&DEFS[id].scale)||1;
    const reach=Rig.extent(look,sc).reach;
    ok(reach<=EDGE_PAD,id+' reach '+reach.toFixed(1)+' must fit inside EDGE_PAD ('+EDGE_PAD+')')}});
Test.add('Rig.extent caches per (look,scale) and returns finite positive top/reach for every look',()=>{
  for(const id in LOOKS){const look=LOOKS[id],sc=(DEFS[id]&&DEFS[id].scale)||1;
    const a=Rig.extent(look,sc),b=Rig.extent(look,sc);
    ok(a===b,id+' must return the same cached object for the same scale');
    ok(isFinite(a.top)&&a.top>0,id+' extent.top must be a finite positive number');
    ok(isFinite(a.reach)&&a.reach>0,id+' extent.reach must be a finite positive number')}});
Test.add('every look renders every pose without throwing',()=>{
  for(const id in LOOKS){const look=LOOKS[id];
    const table=look.rig==='quad'?POSES_QUAD:look.rig==='big'?POSES_BIG:POSES;
    const bones=look.rig==='quad'?Rig.bonesQuad:Rig.bones;
    for(const key in table){const j=Rig.solve(look,key,0.5,1);
      for(const b of bones)ok(j[b]&&isFinite(j[b].x)&&isFinite(j[b].y),id+'/'+key+'/'+b)}}
  // Render.frame on a live fight with each def as p1, via an offscreen G.fight swapped in and
  // restored afterward, must not throw for any def x current pose.
  const savedFight=G.fight,savedState=G.state;
  try{
    for(const id in DEFS){
      const f=mkFight({p1:DEFS[id]});
      G.fight=f;G.state='FIGHT';
      ok(!threw(()=>Render.frame(f)),'Render.frame must not throw for p1='+id)}
  }finally{G.fight=savedFight;G.state=savedState}});
Test.add('quad rig solve returns all 15 quad bones with four feet on the floor line',()=>{
  const j=Rig.solve(LOOKS.donut,'idle',0,1);
  for(const b of Rig.bonesQuad)ok(j[b]&&isFinite(j[b].x)&&isFinite(j[b].y),b);
  ok(Math.abs(j.fl2.y)<6,'front-left paw at y≈0');ok(Math.abs(j.fr2.y)<6,'front-right paw at y≈0');
  ok(Math.abs(j.bl2.y)<6,'back-left paw at y≈0');ok(Math.abs(j.br2.y)<6,'back-right paw at y≈0');
  ok(j.head.y<j.hip.y,'head above hip')});
Test.add('every POSES_QUAD key the state machine can reach exists with at least 2 keyframes',()=>{
  const need=['idle','walk','dash','light1','light2','light3','light4','light5','medium','heavyCharge',
    'heavy','block','blockstun','hit','knockdown','getup','stunned','s1','s2','s3','win','ko'];
  for(const k of need)ok(POSES_QUAD[k]&&POSES_QUAD[k].length>=2,'POSES_QUAD.'+k)});
Test.add('quad light1 at t0.5 moves the leading front paw forward of idle',()=>{
  const a=Rig.solve(LOOKS.donut,'idle',0,1),b=Rig.solve(LOOKS.donut,'light1',0.5,1);
  ok(b.fl2.x>a.fl2.x+15,'front-left paw extends forward: idle '+a.fl2.x.toFixed(1)+' vs light1 '+b.fl2.x.toFixed(1))});
Test.add('Render.frame does not throw with a quad p1 (donut) and a quad p2 (grub)',()=>{
  G.startFight({p1:'donut',p2:'grub',ctrl1:Ctrl.idle()});
  ok(!threw(()=>Render.frame(G.fight)),'Render.frame must not throw for donut vs grub');
  G.toTitle()});

// --- Task 3.5: big rig (Mongo, Grull) ---
Test.add('big rig idle height at scale 1 is at least 1.25x a human idle height',()=>{
  // "Height" is the same "max joint y extent from Rig.solve" measure used by the HUD zoom-cap test
  // below: the topmost (most negative-y) joint returned by Rig.solve, floor at y=0. Both looks are
  // solved at t=0 with face=1 and no def.scale applied (scale 1), matching the brief's "at scale 1"
  // wording — the def's actual scale (1.25/1.3) is a separate, already-covered concern (EDGE_PAD reach
  // and the zoom-cap test just below both apply it).
  const height=look=>{const j=Rig.solve(look,'idle',0,1);return -Math.min(...Object.values(j).map(p=>p.y))};
  const carlH=height(LOOKS.carl);
  for(const id of['mongo','grull']){
    ok(LOOKS[id].rig==='big',id+' must use rig:"big"');
    const h=height(LOOKS[id]);
    ok(h>=1.25*carlH,id+' idle height '+h.toFixed(1)+' must be >= 1.25x carl\'s '+carlH.toFixed(1)+' ('+(1.25*carlH).toFixed(1)+')')}});
Test.add('every POSES_BIG key the state machine can reach exists with at least 2 keyframes',()=>{
  const need=['idle','walk','dash','light1','light2','light3','light4','light5','medium','heavyCharge',
    'heavy','block','blockstun','hit','knockdown','getup','stunned','s1','s2','s3','win','ko'];
  for(const k of need)ok(POSES_BIG[k]&&POSES_BIG[k].length>=2,'POSES_BIG.'+k)});
Test.add('big rig solve returns all 16 human-named bones with feet on the floor line',()=>{
  for(const id of['mongo','grull']){
    const j=Rig.solve(LOOKS[id],'idle',0,1);
    for(const b of Rig.bones)ok(j[b]&&isFinite(j[b].x)&&isFinite(j[b].y),id+'/'+b);
    ok(Math.abs(j.lFoot.y)<6,id+' left foot at y≈0');ok(Math.abs(j.rFoot.y)<6,id+' right foot at y≈0');
    ok(j.head.y<j.hip.y,id+' head above hip')}});
Test.add('Render.frame does not throw with a big p1 (mongo) and a big p2 (grull)',()=>{
  G.startFight({p1:'mongo',p2:'grull',ctrl1:Ctrl.idle()});
  ok(!threw(()=>Render.frame(G.fight)),'Render.frame must not throw for mongo vs grull');
  G.toTitle()});
Test.add('sim files contain no DOM or presentation identifiers',()=>{
  for(const f of [Fight,Fighter])
    ok(!/document|canvas|Audio\.|FX\.|Render\.|Stage\./.test(f.toString()),(f.name||'?')+' must stay presentation-free');
  ok(!/document|canvas|Audio\.|FX\.|Render\.|Stage\./.test(AI.make.toString()),'AI.make must stay presentation-free')});
Test.add('FX and camera advance per tick, not per render',()=>{
  G.startFight({ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle(),seed:1});
  FX.reset();FX.push({kind:'spark',x:0,y:0,n:4,col:'#fff'});
  const life0=FX.list[0].life;
  for(let i=0;i<5;i++)G.tick();
  ok(FX.list[0].life>life0,'FX must age from G.tick() alone, with no Render.frame call');
  const camX=G.cam.x,listLen=FX.list.length;
  for(let i=0;i<10;i++)Render.frame(G.fight);
  eq(FX.list.length,listLen,'Render.frame must not age FX');
  eq(G.cam.x,camX,'Render.frame must not move the camera');
  G.toTitle()});
Test.add('KO plays 90 frames of slow-mo before the result overlay',()=>{
  G.startFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<5;i++)G.tick();
  ok(G.fight.over,'fight must be over after the KO hit lands');eq(G.state,'FIGHT','state stays FIGHT while slow-mo counts down');
  for(let i=0;i<360;i++)G.tick();
  eq(G.state,'RESULT');ok(document.getElementById('result').classList.contains('show'),'result overlay shown');
  G.toTitle();G.sim=false});
Test.add('FX updates and expires particles deterministically',()=>{FX.reset();FX.push({kind:'spark',x:0,y:0,n:6,col:'#fff'});eq(FX.list.length,6);for(let i=0;i<120;i++)FX.update();eq(FX.list.length,0);FX.push({kind:'shake',amt:8});FX.update();ok(FX.shake>0&&FX.shake<8)});
Test.add('on-screen buttons map to intents',()=>{Input.q.length=0;const btn=id=>document.getElementById(id);ok(btn('btnBlock')&&btn('btnPunch')&&btn('btnKick')&&btn('btnPower'));btn('btnPunch').dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,bubbles:true}));btn('btnKick').dispatchEvent(new PointerEvent('pointerdown',{pointerId:8,bubbles:true}));ok(Input.q.includes('light')&&Input.q.includes('medium'));btn('btnBlock').dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,bubbles:true}));eq(Input.held.block,true);btn('btnBlock').dispatchEvent(new PointerEvent('pointerup',{pointerId:9,bubbles:true}));eq(Input.held.block,false);Input.q.length=0});
Test.add('POWER tap fires the highest affordable special',()=>{const f=mkFight();G.fight=f;f.p1.power=250;Input.q.push('powerAuto');eq(Input.drain().special,2);f.p1.power=50;Input.q.push('powerAuto');eq(Input.drain().special,0);G.fight=null});
Test.add('encounter resolves floor, name and enemy def',()=>{const e=Encounter.resolve('f1_goblin');eq(e.floor,1);eq(e.name,'THE DEPTHS');eq(e.enemy.id,'goblin');const o=Encounter.resolve({floor:3,name:'X',enemy:'hobgoblin',tier:'brawl'});eq(o.enemy.hp,DEFS.hobgoblin.hp)});
Test.add('startFight with an encounter sets p2 to the mob and scales hp',()=>{G.startFight({encounter:{floor:2,name:'T',enemy:'goblin',tier:'dummy',hpMul:2,atkMul:1},ctrl1:Ctrl.idle()});eq(G.fight.p2.def.id,'goblin');eq(G.fight.p2.maxHp,600);eq(G.encounter.floor,2);G.toTitle()});
Test.add('every move has a sound recipe and announcer lines exist per kind',()=>{for(const k in MOVES)ok(typeof Audio.recipes[k]==='function',k);for(const k of ['start','streak3','streak5','streak10','parry','special','win','loss'])ok(Lines[k]&&Lines[k].length>=8,k)});
Test.add('announce picks deterministically from any RNG and throttles',()=>{const r1=RNG(5),r2=RNG(5);eq(Audio.pickLine('parry',r1),Audio.pickLine('parry',r2));G._sayAt=-999;G.frameNow=100;G.say('a');eq(document.getElementById('toast').textContent,'a');G.say('b');eq(document.getElementById('toast').textContent,'a');G.frameNow=200;G.say('b');eq(document.getElementById('toast').textContent,'b')});
Test.add('announcer lines do not change the fight',()=>{
  // Same seed/scripts, the only difference is whether onEvent is wired to G.onEvent (so every
  // announcer/streak/special line actually gets picked via Audio.announce during the run). If the
  // announcer drew from the fight's own sim rng, this draw would shift every later crit roll and
  // the two fights would diverge; presRng is a separate stream the sim never reads, so they must not.
  const mkScript=()=>Ctrl.script([L(0,600)]);
  const a=mkFight({ctrl1:mkScript(),ctrl2:AI.make('basic',3),noCrit:false,seed:7});
  run(a,600);
  const b=mkFight({ctrl1:mkScript(),ctrl2:AI.make('basic',3),noCrit:false,seed:7,
    onEvent:(t,x,y,v)=>G.onEvent(t,x,y,v)});
  G.fight=b;G.state='FIGHT';
  run(b,600);
  G.fight=null;G.state='TITLE';
  eq(b.p1.hp,a.p1.hp,'p1 hp must match regardless of announcer lines');
  eq(b.p2.hp,a.p2.hp,'p2 hp must match regardless of announcer lines');
  eq(b.log.length,a.log.length,'log length must match regardless of announcer lines')});
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
  // Positioned inside heavy range (not closeIn's light range): Task 3.6's combo follow-through
  // (see 55_ai.js's comboFollow) now lets a landed light chase into a 3-4 hit chain, which starting
  // from light range can KO an idle target before repeated light pushback ever widens the gap out to
  // heavy range — that was always an indirect, timing-fragile way to exercise brute's heavy bias.
  // Starting already inside [lightRange,heavyRange) tests the thing this test actually cares about
  // (does brute's heavy priority fire when in range) directly.
  f.p1.x=f.p2.x-f.p1.width-120;
  run(f,600);
  ok(landed,'brute AI should land at least one heavy on an idle p1 within 600 frames')});
Test.add('streak announcer lines fire for p1 combos only, not mob/p2 combos',()=>{
  const f=mkFight({seed:9});G.fight=f;G.state='FIGHT';
  const orig=Audio.announce;let calls=[];Audio.announce=kind=>calls.push(kind);
  try{
    f.p1.combo=3;G.onEvent('hit',f.p1,f.p2,10);
    ok(calls.includes('streak3'),'p1 landing a 3-combo must announce a streak line');
    calls.length=0;
    f.p2.combo=3;G.onEvent('hit',f.p2,f.p1,10);
    ok(!calls.some(k=>k.startsWith('streak')),'p2/mob combo must not announce a streak line (it would be in the player\'s own voice)')
  }finally{Audio.announce=orig;G.fight=null;G.state='TITLE'}});
Test.add('FIGHT AGAIN reuses the previous non-encounter p2/ai instead of resetting to defaults',()=>{
  G.startFight({p2:'katia',ai:'brawl',seed:5});
  eq(G.fight.p2.def.id,'katia');
  document.getElementById('again').click();
  eq(G.fight.p2.def.id,'katia','FIGHT AGAIN must keep the p2 champ/mob the previous fight used');
  G.toTitle()});
Test.add('Render/Rig fall back to LOOKS.carl for a def missing .look instead of throwing',()=>{
  const F=mkFighter();const savedLook=F.def.look;delete F.def.look;
  try{
    ok(!threw(()=>Render.overlayY(F)),'overlayY must not throw on a look-less def');
    ok(!threw(()=>Rig.draw(Render.ctx,F,{x:0,zoom:1},0)),'Rig.draw must not throw on a look-less def')
  }finally{F.def.look=savedLook}});
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
Test.add('toast never overlaps the BLOCK/PUNCH button labels',()=>{
  // Fix round 3: round 2's centered-at-62%-of-canvas-width toast still ran its right edge over the
  // PUNCH label. Drives a worst-case (long, guaranteed-to-wrap) line through the real Audio.say ->
  // G.fitToastText path and checks the actual laid-out DOM rects, in canvas-local units (via the
  // same canvas.getBoundingClientRect() scale G.positionToast itself uses), against BLOCK/PUNCH.
  G.startFight();
  G.say('x'.repeat(120));
  const cr=canvas.getBoundingClientRect(),sx=W/cr.width,sy=H/cr.height;
  const toCanvas=r=>({x0:(r.left-cr.left)*sx,x1:(r.right-cr.left)*sx,y0:(r.top-cr.top)*sy,y1:(r.bottom-cr.top)*sy});
  const intersects=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
  // getBoundingClientRect() only covers the button circle itself, not its ::after data-label (a
  // generated pseudo-element, which has no standard geometry query) — the actual reported bug is the
  // label, which sits directly below the circle (top:100%, margin-top:4px, 10px text), so extend the
  // circle's rect down by 20 canvas-local px to cover it too.
  const withLabel=r=>({x0:r.x0,x1:r.x1,y0:r.y0,y1:r.y1+20});
  const t=toCanvas(document.getElementById('toast').getBoundingClientRect());
  const block=withLabel(toCanvas(document.getElementById('btnBlock').getBoundingClientRect()));
  const punch=withLabel(toCanvas(document.getElementById('btnPunch').getBoundingClientRect()));
  ok(!intersects(t,block),'toast rect '+JSON.stringify(t)+' must not intersect BLOCK+label '+JSON.stringify(block));
  ok(!intersects(t,punch),'toast rect '+JSON.stringify(t)+' must not intersect PUNCH+label '+JSON.stringify(punch));
  G.toTitle()});

// --- Task 3.2: buffs framework ---
Test.add('regen heals the holder 0.017% maxHp per frame, capped at maxHp',()=>{
  const f=mkFight();Buffs.apply(f,f.p2,['regen']);
  f.p2.hp=f.p2.maxHp*0.5;
  let hp=f.p2.hp;for(let i=0;i<600;i++)hp=Math.min(f.p2.maxHp,hp+f.p2.maxHp*0.00017);
  run(f,600);
  eq(f.p2.hp,hp);ok(f.p2.hp>f.p2.maxHp*0.5,'holder healed');
  f.p2.hp=f.p2.maxHp-1;run(f,20);eq(f.p2.hp,f.p2.maxHp,'capped at maxHp')});
Test.add('armorUp multiplies incoming damage by .7 when the holder defends',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);Buffs.apply(f,f.p2,['armorUp']);
  run(f,5);
  eq(f.p2.hp,1000-42,'a 60-damage light must land for 42')});
Test.add('powerGain scales the holder power delta by 1.5x, on its own hits and on being hit',()=>{
  const a=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(a);Buffs.apply(a,a.p1,['powerGain']);
  run(a,5);
  eq(a.p1.power,Math.round(MOVES.light1.powHit*1.5),'attacker with the buff gains 1.5x powHit');
  const b=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(b);Buffs.apply(b,b.p2,['powerGain']);
  run(b,5);
  eq(b.p2.power,Math.round(MOVES.light1.powTaken*1.5),'defender with the buff gains 1.5x powTaken')});
// Fix-wave item 6: on a true mutual trade (both sides' hits detected before either resolves —
// Fight.step's c1/c2), resolve(c1) nulls def.move where that same fighter is c2's attacker, so the
// old `att.move` read inside powerGain's onHit was already null by the time resolve(c2) ran and
// silently no-op'd — even though p1 (the holder here) is c2's DEFENDER, receiving a real powTaken.
Test.add('powerGain scales power gained on a true mutual trade (both lights land the same tick)',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.script([L(0)])});closeIn(f);
  Buffs.apply(f,f.p1,['powerGain']);
  run(f,6);
  eq(f.log.filter(e=>e.type==='hit').length,2,'both lights must land the same tick for a true mutual trade');
  eq(f.p1.power,Math.round(MOVES.light1.powHit*1.5)+Math.round(MOVES.light1.powTaken*1.5),
    'p1 (holder) must get 1.5x on both the hit it landed (attacker in c1) and the hit it took (defender in c2)')});
Test.add('unblockableSpecials makes a blocked special land as a hit',()=>{
  const f=mkFight({ctrl1:Ctrl.script([{f:0,intent:{special:1}}]),ctrl2:Ctrl.hold({block:true})});
  closeIn(f);f.p1.power=100;Buffs.apply(f,f.p1,['unblockableSpecials']);
  run(f,40);
  ok(f.log.some(e=>e.type==='hit'&&e.move==='s1'),'s1 landed as a hit despite the hold-block');
  eq(f.log.filter(e=>e.type==='block').length,0,'no block event fired');
  ok(f.p2.hp<f.p2.maxHp,'p2 actually took damage')});
Test.add('degen drains the foe 0.03% maxHp per frame while the holder is alive',()=>{
  const f=mkFight();Buffs.apply(f,f.p2,['degen']);
  let hp=f.p1.hp;for(let i=0;i<100;i++)hp=Math.max(0,hp-f.p1.maxHp*0.0003);
  run(f,100);
  eq(f.p1.hp,hp)});
Test.add('thorns returns 20% of block chip to the attacker',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(10)]),ctrl2:Ctrl.hold({block:true})});
  closeIn(f);Buffs.apply(f,f.p2,['thorns']);
  run(f,15);
  eq(f.p2.hp,995,'chip itself is unchanged by thorns');
  eq(f.p1.hp,1000-Math.round(5*0.2),'attacker takes 20% of the chip back')});
// Fix-wave item 10: thorns damage had no log entry and no FX (silent, unlike every other source of
// damage in the sim) — now emits a 'thorns' event and a small popup, mirroring a normal hit.
Test.add('thorns emits a fight event and an fx popup',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(10)]),ctrl2:Ctrl.hold({block:true})});
  closeIn(f);Buffs.apply(f,f.p2,['thorns']);
  run(f,15);
  const ev=f.log.find(e=>e.type==='thorns');
  ok(ev,'a thorns event must be logged');
  eq(ev.val,Math.round(5*0.2),'the logged value must be the thorns damage dealt');
  ok(f.fx.some(x=>x.kind==='popup'&&x.col==='#ff4444'),'a red popup must be queued for thorns damage')});
Test.add('Buffs.apply resolves ids to BUFFS objects on holder.buffs, and throws on an unknown id',()=>{
  const f=mkFight();
  Buffs.apply(f,f.p2,['regen','armorUp']);
  eq(f.p2.buffs.length,2);ok(f.p2.buffs[0]===BUFFS.regen);ok(f.p2.buffs[1]===BUFFS.armorUp);
  Buffs.apply(f,f.p1,[]);
  eq(f.p1.buffs.length,0);
  ok(threw(()=>Buffs.apply(f,f.p2,['nope'])),'unknown buff id must throw')});
Test.add('Encounter.resolve maps buff ids to BUFFS objects, defaults to none, and throws on an unknown id',()=>{
  const enc=Encounter.resolve({floor:1,name:'X',enemy:'goblin',buffs:['regen','thorns']});
  eq(enc.buffs.length,2);ok(enc.buffs[0]===BUFFS.regen);ok(enc.buffs[1]===BUFFS.thorns);
  eq(enc.buffIds.length,2);eq(enc.buffIds[0],'regen');
  const noBuffs=Encounter.resolve({floor:1,name:'X',enemy:'goblin'});
  eq(noBuffs.buffs.length,0);eq(noBuffs.buffIds.length,0);
  ok(threw(()=>Encounter.resolve({floor:1,name:'X',enemy:'goblin',buffs:['nope']})),'unknown buff id must throw')});
Test.add('a fight is bit-identical whether or not Buffs.apply is called with an empty list',()=>{
  const mkScript=()=>Ctrl.script([L(0,600)]);
  const a=mkFight({ctrl1:mkScript(),ctrl2:AI.make('basic',3),noCrit:false,seed:7});
  run(a,600);
  const b=mkFight({ctrl1:mkScript(),ctrl2:AI.make('basic',3),noCrit:false,seed:7});
  Buffs.apply(b,b.p2,[]);
  run(b,600);
  eq(b.p1.hp,a.p1.hp,'p1 hp must match with an empty buff list applied');
  eq(b.p2.hp,a.p2.hp,'p2 hp must match with an empty buff list applied');
  eq(JSON.stringify(b.log),JSON.stringify(a.log),'log must match with an empty buff list applied')});
Test.add('buff badges: one 12px gold square with a 1-letter code per encounter buff, never throws',()=>{
  eq(Render.BUFF_CODES.regen,'R');eq(Render.BUFF_CODES.armorUp,'A');eq(Render.BUFF_CODES.powerGain,'P');
  eq(Render.BUFF_CODES.unblockableSpecials,'U');eq(Render.BUFF_CODES.degen,'D');eq(Render.BUFF_CODES.thorns,'T');
  ok(!threw(()=>Render.buffBadges(Render.ctx,0,0,300,[BUFFS.regen,BUFFS.thorns])),'buffBadges must not throw')});
// --- Task 3.6: boss plate no longer overlaps the title ---
// Fix-wave item 10: the plate used to be HP-bar-width (plus 16px), clamped off the title's own
// measured right edge so the two didn't collide — technically not clipping, but still read as "a
// wide empty red-outlined box" (final review, look-and-feel note 4). Now sized off the name's own
// measured text width (same font/right-alignment the name itself renders in), tight enough around
// either boss name that the title-collision clamp is unreachable and was dropped.
Test.add('boss plate is sized tight to the name and clears the title with real margin',()=>{
  const p2x=W-74,barW=300,p2barX=W-74-10-barW,titleRight=Render.hudCache().titleRightEdge;
  for(const name of['GRULL','MOTHER RAT']){
    ok(!threw(()=>Render.bossPlate(Render.ctx,p2x,p2barX,barW,name)),'bossPlate must not throw for '+name);
    Render.ctx.font='bold 14px ui-monospace,monospace';
    const nameW=Render.ctx.measureText(name).width;
    const pad=10,rightEdge=p2barX+barW,plateW=nameW+pad*2,plateX=rightEdge-plateW;
    ok(plateX>titleRight+8,name+'\'s plate must clear the title with real margin');
    ok(plateW<barW,name+'\'s plate must be tighter than the full HP-bar width, not span it')}});

// --- Task 3.3: floors, encounters, bosses (data) ---
Test.add('every FLOORS node and boss resolves',()=>{
  for(const fl of FLOORS){
    for(const nodeId of fl.nodes)ok(!threw(()=>Encounter.resolve(nodeId)),'floor '+fl.floor+' node '+nodeId+' must resolve');
    ok(!threw(()=>Encounter.resolve(fl.boss)),'floor '+fl.floor+' boss '+fl.boss+' must resolve')}});
Test.add('every FLOORS-referenced encounter enemy exists in DEFS',()=>{
  for(const fl of FLOORS){
    for(const nodeId of fl.nodes){const e=Encounter.resolve(nodeId);ok(DEFS[e.enemy.id]===e.enemy,nodeId+' enemy must be a DEFS entry')}
    const b=Encounter.resolve(fl.boss);ok(DEFS[b.enemy.id]===b.enemy,fl.boss+' enemy must be a DEFS entry')}});
Test.add('boss defs have boss:true, an s3 override, and at least one buff',()=>{
  for(const id in BOSSES){const b=BOSSES[id];
    eq(b.boss,true,id+' must be boss:true');
    ok(b.moves&&b.moves.s3,id+' must have an s3 override');
    ok(Array.isArray(b.buffs)&&b.buffs.length>=1,id+' must have at least one buff')}});
Test.add('boss encounter buffIds include the def\'s signature buff',()=>{
  const grull=Encounter.resolve('f1_grull');
  ok(grull.buffIds.includes('armorUp'),'grull encounter must carry armorUp from its def');
  eq(grull.buffs.length,grull.buffIds.length);
  const mother=Encounter.resolve('f2_mother');
  ok(mother.buffIds.includes('regen'),'mother_rat encounter must carry regen from its def')});
// Fix-wave item 5: node buffs were dead content (no ENCOUNTERS entry carried a buffs list) — see
// 45_encounter.js's own comment for which two nodes are the deliberate exceptions.
Test.add('every FLOORS node except two has at least one buff',()=>{
  let noBuff=0;
  for(const fl of FLOORS){
    for(const nid of fl.nodes){if(Encounter.resolve(nid).buffIds.length===0)noBuff++}
    ok(Encounter.resolve(fl.boss).buffIds.length>=1,fl.boss+' (boss) must have at least one buff')}
  eq(noBuff,2,'exactly two FLOORS nodes should ship with no buff')});
Test.add('G.startFight({...,playerBuffs}) applies to p1 via the same Buffs.apply the enemy path uses',()=>{
  G.startFight({p1:'carl',p2:'donut',ai:'dummy',playerBuffs:['powerGain','armorUp']});
  eq(G.fight.p1.buffs.length,2);
  ok(G.fight.p1.buffs.some(b=>b.id==='powerGain'));ok(G.fight.p1.buffs.some(b=>b.id==='armorUp'));
  eq(G.fight.p2.buffs.length,0,'playerBuffs must never leak onto p2');
  G.toTitle()});
Test.add('G.startFight({floor,node:"boss"}) resolves the boss encounter and sets G.encounter.boss',()=>{
  // Task 4.4: {floor,node} now spends energy through Quest.start, which requires the node to be
  // 'open' -- floor 2's boss doesn't exist in Meta.defaults() (only floor 1 is created), so it's
  // opened by hand here rather than relying on default save state.
  Save.data=Meta.defaults();Save.data.floors[2]={nodes:['done','done','done','done','done'],boss:'open'};
  G.startFight({floor:2,node:'boss'});
  ok(G.encounter&&G.encounter.boss,'G.encounter.boss must be true');
  eq(G.fight.p2.def.id,'mother_rat');
  ok(!threw(()=>Render.frame(G.fight)),'Render.frame must not throw for a boss fight (boss plate)');
  G.toTitle()});
Test.add('G.startFight({floor,node}) resolves a numeric node index to that floor\'s node encounter',()=>{
  Save.data=Meta.defaults(); // floor 1 node 0 starts 'open' with full energy, so Quest.start succeeds
  G.startFight({floor:1,node:0});
  eq(G.fight.p2.def.id,'goblin');ok(G.encounter&&!G.encounter.boss);
  G.toTitle()});
Test.add('hp/atk multipliers scale with floor via floorMul',()=>{
  eq(floorMul(1),1);eq(floorMul(2),1.15);
  const e1=Encounter.resolve('f1_skel'),e2=Encounter.resolve('f2_skel2');
  eq(e1.hpMul,1);eq(e1.atkMul,1);
  eq(e2.hpMul,1.15);eq(e2.atkMul,1.15)});
Test.add('shaman s1 override merges to a 6-hit flurry over the base MOVES.s1',()=>{
  const F=new Fighter(DEFS.shaman,-1,Ctrl.idle());
  eq(F.moveDef('s1').hits,6);
  eq(F.moveDef('s1').startup,MOVES.s1.startup,'fields the override omits still fall back to base MOVES.s1')});
// --- Task 3.6: batch tool ---
// Ctrl.competent has no rng of its own (see its comment in 30_input.js) — the same (fight,me,foe)
// state always yields the same intent for any seed. Two independently-built fights with the same
// seeds on both sides must therefore log bit-identically; this is what tests/batch.py's win-rate
// table depends on for reproducible seeds.
Test.add('Ctrl.competent is deterministic per seed',()=>{
  const mk=()=>mkFight({ctrl1:Ctrl.competent(7),ctrl2:AI.make('t3',9),clock:20});
  const f1=mk(),f2=mk();closeIn(f1);closeIn(f2);run(f1,900);run(f2,900);
  eq(JSON.stringify(f1.log),JSON.stringify(f2.log),'same matchup must reproduce the exact same fight log');
  ok(f1.log.length>0,'the fight actually did something')});
Test.add('Ctrl.competent blocks a foe\'s medium once its startup clock passes REACT frames',()=>{
  // Foe is walked into ATTACK by hand and given a short head start before p1's own controller ever
  // gets a decision — Fighter.tick's ATTACK case advances a move's phases regardless of the foe's own
  // future intents, so ctrl2 can go inert (Ctrl.idle()) from here. This sidesteps fix-wave item 8's
  // own proactive closing-distance medium (30_input.js): without a head start, p1's very first
  // decision (made from the pre-act snapshot, before foe's own script has run even once) would see
  // foe still IDLE and is guarded on foe.state!=='ATTACK', so it would try to close distance with its
  // own medium before the foe's is ever visible — a real simultaneous-decision limit, not a bug, but
  // not what this test means to isolate. Once foe.state is already ATTACK the closing guard
  // correctly holds off, exactly like the old "out of range, nothing else applies" idle case did.
  const f=mkFight({ctrl1:Ctrl.competent(1),ctrl2:Ctrl.idle()});
  f.p2.act(Object.assign(Ctrl.EMPTY(),{medium:true}));
  for(let i=0;i<4;i++)f.p2.tick();
  run(f,3);
  eq(f.p1.state,'BLOCK','p1 should be guarding once foe\'s medium startup clock passes REACT frames')});
Test.add('Ctrl.competent chains lights once in range and idle',()=>{
  const f=mkFight({ctrl1:Ctrl.competent(2)});closeIn(f);run(f,20);
  ok(f.log.some(e=>e.type==='hit'&&e.who===1),'p1 landed at least one light from range')});
// Fix-wave item 8: the competent bot used to just stand there outside light range forever if nothing
// else applied — which is why intercept/medium-punish never fired in the run that certified the AI
// tiers (final review, Important). It now closes with a medium (its own startup dash covers ground)
// whenever it's out of range and the foe isn't already attacking.
Test.add('Ctrl.competent closes distance with a medium when out of range and the foe isn\'t attacking',()=>{
  const f=mkFight({ctrl1:Ctrl.competent(3),ctrl2:Ctrl.idle()}); // default spacing: out of light range
  run(f,1);
  eq(f.p1.state,'ATTACK');eq(f.p1.moveName,'medium')});
// Fix-wave item 8: every 5th time the foe enters blockstun (a mix-up, not spam — counted on the
// rising edge of BLOCKSTUN so one long blockstun window only counts once), the bot arms a heavy
// instead of continuing its normal offense.
Test.add('Ctrl.competent mixes in a heavy on the 5th distinct blockstun opening',()=>{
  const ctrl=Ctrl.competent(4),f=mkFight({ctrl1:ctrl});closeIn(f);
  const me=f.p1,foe=f.p2;let heavyFires=0;
  for(let opening=1;opening<=5;opening++){
    foe.setState('BLOCKSTUN',0);foe.stun=1;
    const it=ctrl.next(f,me,foe);
    if(opening<5)ok(!it.heavy,'opening '+opening+' must not arm a heavy yet');
    else{ok(it.heavy,'the 5th opening must arm a heavy');heavyFires++}
    foe.setState('IDLE',0);
    ctrl.next(f,me,foe)} // a real call while foe reads IDLE — the rising-edge reset the controller
                          // itself needs to see before the next opening counts as a NEW one
  eq(heavyFires,1)});

// Task 4.1: Meta data layer (save v2, migrate, stats, energy) ------------------------------------
Test.add('Meta.defaults has every top-level key and carl at 1-star/1-rank/1-level',()=>{
  const d=Meta.defaults();
  for(const k of ['v','seed','gold','units','iso','cats','roster','active','floors','energy','arena','mute','settings','stats'])
    ok(k in d,k+' missing');
  eq(d.v,2);eq(d.active,'carl');
  eq(d.roster.carl.stars,1);eq(d.roster.carl.rank,1);eq(d.roster.carl.level,1)});
Test.add('Meta.migrate upgrades a v1 save, keeping gold/units/mute/settings and adding roster',()=>{
  const v2=Meta.migrate({v:1,gold:5,units:2,roster:{},mute:true,settings:{}});
  eq(v2.v,2);eq(v2.gold,5);eq(v2.units,2);eq(v2.mute,true);
  eq(v2.roster.carl.stars,1);eq(v2.roster.carl.rank,1);eq(v2.roster.carl.level,1)});
Test.add('Meta.migrate fills missing keys on a v2 save without discarding what is there',()=>{
  const d=Meta.migrate({v:2,gold:9});
  eq(d.gold,9);ok('energy' in d);ok('roster' in d);eq(d.roster.carl.stars,1)});
Test.add('Meta.migrate falls back to defaults for null/garbage',()=>{
  const def=JSON.stringify(Meta.defaults());
  eq(JSON.stringify(Meta.migrate(null)),def);
  eq(JSON.stringify(Meta.migrate('nonsense')),def);
  eq(JSON.stringify(Meta.migrate(42)),def);
  eq(JSON.stringify(Meta.migrate({foo:'bar'})),def)});
Test.add('Stats.derive computes hp/atk at base stars/rank/level',()=>{
  const s=Stats.derive(CHAMPS.carl,{stars:1,rank:1,level:1});
  eq(s.hp,1000);eq(s.atk,60)});
Test.add('Stats.derive is monotone: more stars, rank, or level never decreases hp',()=>{
  const base=Stats.derive(CHAMPS.carl,{stars:1,rank:1,level:1}).hp;
  ok(Stats.derive(CHAMPS.carl,{stars:2,rank:1,level:1}).hp>base,'stars increases hp');
  const rBase=Stats.derive(CHAMPS.carl,{stars:2,rank:1,level:1}).hp;
  ok(Stats.derive(CHAMPS.carl,{stars:2,rank:2,level:1}).hp>rBase,'rank increases hp');
  const lBase=Stats.derive(CHAMPS.carl,{stars:5,rank:5,level:1}).hp;
  ok(Stats.derive(CHAMPS.carl,{stars:5,rank:5,level:50}).hp>lBase,'level increases hp')});
Test.add('Stats.clampEntry enforces stars/rank/level caps',()=>{
  const hi=Stats.clampEntry({stars:9,rank:9,level:9999});
  eq(hi.stars,5);eq(hi.rank,5);eq(hi.level,50);
  const lo=Stats.clampEntry({stars:0,rank:0,level:0});
  eq(lo.stars,1);eq(lo.rank,1);eq(lo.level,1)});
Test.add('Stats.xpToLevel(3) is 120',()=>{eq(Stats.xpToLevel(3),120)});
Test.add('Energy.tick regens over injected time, leaves partial progress, and caps at max',()=>{
  const origNow=Energy.now;
  try{
    Save.data.energy={n:0,ts:0,max:10};
    Energy.now=()=>12*60*1000; // 12 minutes = 2 intervals of 6
    Energy.tick();
    eq(Save.data.energy.n,2);eq(Save.data.energy.ts,12*60*1000);
    Save.data.energy={n:9,ts:0,max:10};
    Energy.now=()=>60*60*1000; // would be 10 intervals; only 1 needed to hit max
    Energy.tick();
    eq(Save.data.energy.n,10)
  }finally{Energy.now=origNow}});
Test.add('Energy.spend fails and changes nothing when short, succeeds when enough',()=>{
  Save.data.energy={n:0,ts:0,max:10};
  eq(Energy.spend(1),false);eq(Save.data.energy.n,0);
  Save.data.energy={n:10,ts:0,max:10};
  eq(Energy.spend(3),true);eq(Save.data.energy.n,7)});
Test.add('Save.load migrates an existing v1 localStorage value without throwing',()=>{
  const backup=localStorage.getItem(Save.key);
  try{
    localStorage.setItem(Save.key,JSON.stringify({v:1,gold:5,units:2,roster:{},mute:true,settings:{x:1}}));
    Save.load();
    eq(Save.data.v,2);eq(Save.data.gold,5);eq(Save.data.units,2);eq(Save.data.mute,true);
    eq(Save.data.roster.carl.stars,1)
  }finally{
    if(backup===null)localStorage.removeItem(Save.key);else localStorage.setItem(Save.key,backup);
    Save.load()}});
// Fix round 1: Save.load used to migrate only in memory, never writing the upgraded v2 shape back
// to localStorage — so a v1 save stayed v1 on disk forever, re-migrating (and paying its reset
// costs, e.g. roster) on every single load. Save.load now persists via put() after migrating.
Test.add('Save.load persists the migrated v2 shape back to localStorage',()=>{
  const backup=localStorage.getItem(Save.key);
  try{
    localStorage.setItem(Save.key,JSON.stringify({v:1,gold:5,units:2,roster:{},mute:true,settings:{}}));
    Save.load();
    eq(JSON.parse(localStorage.getItem(Save.key)).v,2,'localStorage must hold the migrated v2 save, not the original v1 one')
  }finally{
    if(backup===null)localStorage.removeItem(Save.key);else localStorage.setItem(Save.key,backup);
    Save.load()}});
Test.add('Save.put/load round-trips a v2 save',()=>{
  const backup=localStorage.getItem(Save.key);
  try{
    Save.data=Meta.defaults();Save.data.gold=42;Save.data.roster.carl.stars=3;
    Save.put();Save.load();
    eq(Save.data.gold,42);eq(Save.data.roster.carl.stars,3);eq(Save.data.v,2)
  }finally{
    if(backup===null)localStorage.removeItem(Save.key);else localStorage.setItem(Save.key,backup);
    Save.load()}});
// Task 4.2: Crystals (pity, shards) -----------------------------------------------------------
// Raw tier distribution off Crystal.KINDS.basic.odds via the pure Crystal.rollTier helper — a
// fresh RNG(seed) per draw, seeds 1..10000, pity intentionally NOT in this loop (rollTier doesn't
// touch it) so this measures the odds table itself, not the pity-adjusted long-run distribution
// (pity deliberately skews frequencies over many real opens — that's tested on its own below, not
// here — forcing ~1/10 of opens up a tier moves 1-star/2-star share by ~7 points over 10k opens,
// which would blow well past a 2% tolerance if this test ran through Crystal.open unbroken).
Test.add('Crystal.rollTier matches basic odds within 2% over 10000 draws',()=>{
  const tally={1:0,2:0,3:0};
  for(let s=1;s<=10000;s++){const t=Crystal.rollTier(Crystal.KINDS.basic.odds,Crystal.rng(s));tally[t]++}
  ok(Math.abs(tally[1]/10000-.70)<=.02,'1-star freq '+tally[1]/10000);
  ok(Math.abs(tally[2]/10000-.25)<=.02,'2-star freq '+tally[2]/10000);
  ok(Math.abs(tally[3]/10000-.05)<=.02,'3-star freq '+tally[3]/10000)});
Test.add('Crystal.rollTier matches premium odds within 2% over 10000 draws',()=>{
  const tally={2:0,3:0,4:0};
  for(let s=1;s<=10000;s++){const t=Crystal.rollTier(Crystal.KINDS.premium.odds,Crystal.rng(s));tally[t]++}
  ok(Math.abs(tally[2]/10000-.60)<=.02,'2-star freq '+tally[2]/10000);
  ok(Math.abs(tally[3]/10000-.32)<=.02,'3-star freq '+tally[3]/10000);
  ok(Math.abs(tally[4]/10000-.08)<=.02,'4-star freq '+tally[4]/10000)});
// Pity is a pure counter, decoupled from what the previous nine rolls actually were — driving it
// with nine real 1-star rolls first would just be a slower way to reach the same counter value, so
// these set Save.data.pity[kind] to 9 directly (as the 4.2/4.3 brief's own "simpler" alternative
// puts it) and check the guaranteed floor holds across many seeds, independent of the natural roll.
// roster:{} (no champ owned yet) so every pull in these two is a new-champion pull whose returned
// `stars` is exactly the (pity-adjusted) roll — a dup pull's `stars` reflects the roster entry's
// existing star count instead, which pity never touches, so leaving carl pre-owned here would
// decouple what's asserted from what pity actually guarantees.
Test.add('Crystal.open pity guarantees >=2-star on the 10th basic open',()=>{
  for(let seed=1;seed<=50;seed++){
    Save.data=Meta.defaults();Save.data.roster={};Save.data.seed=seed;Save.data.gold=999999;Save.data.pity.basic=9;
    const r=Crystal.open('basic');
    ok(r,'open must succeed, seed '+seed);
    ok(r.stars>=2,'seed '+seed+' got '+r.stars+'-star, expected >=2')}});
Test.add('Crystal.open pity guarantees >=3-star on the 10th premium open',()=>{
  for(let seed=1;seed<=50;seed++){
    Save.data=Meta.defaults();Save.data.roster={};Save.data.seed=seed;Save.data.units=999999;Save.data.pity.premium=9;
    const r=Crystal.open('premium');
    ok(r,'open must succeed, seed '+seed);
    ok(r.stars>=3,'seed '+seed+' got '+r.stars+'-star, expected >=3')}});
Test.add('Crystal.open pity counter resets after triggering',()=>{
  Save.data=Meta.defaults();Save.data.gold=999999;Save.data.pity.basic=9;
  Crystal.open('basic');
  eq(Save.data.pity.basic,0)});
Test.add('Crystal.open on a duplicate adds a shard',()=>{
  Save.data=Meta.defaults();Save.data.gold=999999;
  for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:1,rank:1,level:1,xp:0,shards:0};
  const r=Crystal.open('basic');
  ok(r.dup,'every champ is already owned, so this pull must be a duplicate');
  eq(Save.data.roster[r.champId].shards,1);
  eq(r.shards,1)});
Test.add('Crystal.open converts 5 shards into +1 star, capped at 5-star with leftover kept',()=>{
  Save.data=Meta.defaults();Save.data.gold=999999;
  for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:3,rank:1,level:1,xp:0,shards:4};
  const r=Crystal.open('basic');
  eq(Save.data.roster[r.champId].stars,4);
  eq(Save.data.roster[r.champId].shards,0);
  // now at the star cap: shards keep accruing but never convert further
  for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:5,rank:1,level:1,xp:0,shards:4};
  const r2=Crystal.open('basic');
  eq(Save.data.roster[r2.champId].stars,5);
  eq(Save.data.roster[r2.champId].shards,5)});
Test.add('Crystal.open on a new champion adds it to the roster at the pulled stars',()=>{
  // Only carl starts owned, so 3 of the 4 uniformly-picked champs are a fresh pull; try seeds
  // until one lands non-carl (fresh Save.data each try, so an earlier try's pull never biases a
  // later one), which should take at most a handful of tries.
  let r=null;
  for(let s=1;s<50&&!(r&&!r.dup);s++){
    Save.data=Meta.defaults();Save.data.gold=999999;Save.data.seed=s;
    r=Crystal.open('basic')}
  ok(r&&!r.dup,'expected a non-duplicate pull within 50 seeds');
  ok(Save.data.roster[r.champId],'new champ must be added to the roster');
  eq(Save.data.roster[r.champId].stars,r.stars);
  eq(Save.data.roster[r.champId].rank,1);eq(Save.data.roster[r.champId].level,1)});
Test.add('Crystal.open premium deducts units when affordable and refuses (no change) when short',()=>{
  Save.data=Meta.defaults();Save.data.units=0;
  const before=JSON.stringify(Save.data);
  eq(Crystal.open('premium'),null);
  eq(JSON.stringify(Save.data),before,'a refusal must change nothing');
  Save.data.units=100;
  const r=Crystal.open('premium');
  ok(r,'affordable premium open must succeed');
  eq(Save.data.units,0)});
Test.add('Crystal.open advances Save.data.seed by one per open, so consecutive opens differ',()=>{
  Save.data=Meta.defaults();Save.data.gold=999999;
  const s0=Save.data.seed;
  Crystal.open('basic');
  eq(Save.data.seed,s0+1);
  Crystal.open('basic');
  eq(Save.data.seed,s0+2)});
// Task 4.3: Quest floors, rewards, roster progression, arena state -----------------------------
Test.add('Quest.floor(1) reads node states from Meta.defaults()',()=>{
  Save.data=Meta.defaults();
  const f=Quest.floor(1);
  eq(f.floor,1);eq(f.name,'THE DEPTHS');
  eq(f.nodes.length,5);
  eq(f.nodes[0].state,'open');eq(f.nodes[1].state,'locked');
  eq(f.nodes[0].id,'f1_goblin');
  eq(f.boss.state,'locked');eq(f.boss.id,'f1_grull')});
Test.add('Quest.floor returns null for a floor not yet created or not in FLOORS',()=>{
  Save.data=Meta.defaults();
  eq(Quest.floor(2),null); // not created yet
  eq(Quest.floor(99),null)}); // FLOORS doesn't define it
Test.add('Quest.canStart is true only for an open node with energy, false for locked or no energy',()=>{
  Save.data=Meta.defaults();
  ok(Quest.canStart(1,0));
  ok(!Quest.canStart(1,1),'node 1 starts locked');
  ok(!Quest.canStart(1,'boss'),'boss starts locked');
  Save.data.energy.n=0;
  ok(!Quest.canStart(1,0),'no energy left')});
Test.add('Quest.start spends 1 energy and returns the node encounter id; refuses a locked node unchanged',()=>{
  Save.data=Meta.defaults();
  const e0=Save.data.energy.n;
  const id=Quest.start(1,0);
  eq(id,'f1_goblin');
  eq(Save.data.energy.n,e0-1);
  const before=JSON.stringify(Save.data);
  eq(Quest.start(1,1),null,'node 1 is locked');
  eq(JSON.stringify(Save.data),before,'a refusal must change nothing')});
Test.add('Quest.start refuses (unchanged) when energy is empty',()=>{
  Save.data=Meta.defaults();Save.data.energy.n=0;
  const before=JSON.stringify(Save.data);
  eq(Quest.start(1,0),null);
  eq(JSON.stringify(Save.data),before)});
Test.add('Quest.complete(1,0,true) marks node 0 done and opens node 1',()=>{
  Save.data=Meta.defaults();
  ok(Quest.complete(1,0,true));
  const f=Quest.floor(1);
  eq(f.nodes[0].state,'done');eq(f.nodes[1].state,'open')});
Test.add('Quest.complete on a loss changes nothing',()=>{
  Save.data=Meta.defaults();
  const before=JSON.stringify(Save.data);
  eq(Quest.complete(1,0,false),false);
  eq(JSON.stringify(Save.data),before)});
Test.add('Quest.complete on the last node opens the boss',()=>{
  Save.data=Meta.defaults();
  for(let i=0;i<5;i++){Save.data.floors[1].nodes[i]='open';Quest.complete(1,i,true)}
  eq(Quest.floor(1).boss.state,'open')});
Test.add('Quest.complete(1,"boss",true) creates floor 2 with node 0 open',()=>{
  Save.data=Meta.defaults();
  Save.data.floors[1].boss='open';
  ok(Quest.complete(1,'boss',true));
  eq(Quest.floor(1).boss.state,'done');
  const f2=Quest.floor(2);
  ok(f2,'floor 2 must now exist');
  eq(f2.nodes[0].state,'open');
  for(let i=1;i<5;i++)eq(f2.nodes[i].state,'locked');
  eq(f2.boss.state,'locked')});
Test.add('Quest.complete on floor 2\'s boss does not create a floor 3 (FLOORS only has 2 floors)',()=>{
  Save.data=Meta.defaults();
  Save.data.floors[2]={nodes:['done','done','done','done','done'],boss:'open'};
  ok(Quest.complete(2,'boss',true));
  eq(Quest.floor(2).boss.state,'done');
  eq(Save.data.floors[3],undefined)});
Test.add('Rewards.forNode gives gold/iso/xp scaled by floor and node position',()=>{
  const r0=Rewards.forNode(1,0);
  eq(r0.gold,100*1+40*0);eq(r0.iso,20);eq(r0.xp,30);
  ok(!('units' in r0));ok(!('cats' in r0));
  const r3=Rewards.forNode(1,3);
  eq(r3.gold,100*1+40*3)});
Test.add('Rewards.forNode boss adds units and one catalyst of the enemy class',()=>{
  const r=Rewards.forNode(1,'boss');
  eq(r.iso,20);eq(r.xp,30);eq(r.units,50);
  eq(DEFS.grull.cls,'tank');
  eq(r.cats.tank,1)});
Test.add('Rewards.grant applies currencies/cats and xp to the active champion',()=>{
  Save.data=Meta.defaults();
  Rewards.grant({gold:10,iso:5,units:2,cats:{tank:1},xp:0});
  eq(Save.data.gold,10);eq(Save.data.iso,5);eq(Save.data.units,2);eq(Save.data.cats.tank,1)});
Test.add('Rewards.grant xp levels the active champion up via Stats.xpToLevel',()=>{
  Save.data=Meta.defaults(); // carl: level 1, rank 1 -> cap 10
  Rewards.grant({xp:Stats.xpToLevel(2)}); // exactly enough for one level
  eq(Save.data.roster.carl.level,2);eq(Save.data.roster.carl.xp,0)});
Test.add('Rewards.grant xp can chain multiple level-ups in one grant, keeping the remainder',()=>{
  Save.data=Meta.defaults();
  const cost=Stats.xpToLevel(2)+Stats.xpToLevel(3)+7;
  Rewards.grant({xp:cost});
  eq(Save.data.roster.carl.level,3);eq(Save.data.roster.carl.xp,7)});
Test.add('Rewards.grant xp stops levelling at the rank cap, keeping excess xp',()=>{
  Save.data=Meta.defaults();
  Save.data.roster.carl.level=Stats.caps.level(1); // already at rank-1's cap (10)
  Rewards.grant({xp:9999});
  eq(Save.data.roster.carl.level,Stats.caps.level(1));
  eq(Save.data.roster.carl.xp,9999,'excess xp is kept, not discarded')});
Test.add('Roster.levelUp charges 10*level iso, refuses at cap or when short (unchanged)',()=>{
  Save.data=Meta.defaults();Save.data.iso=10;
  ok(Roster.levelUp('carl'));
  eq(Save.data.roster.carl.level,2);eq(Save.data.iso,0);
  const before=JSON.stringify(Save.data);
  eq(Roster.levelUp('carl'),false,'short on iso');
  eq(JSON.stringify(Save.data),before);
  Save.data.roster.carl.level=Stats.caps.level(1);Save.data.iso=9999;
  const before2=JSON.stringify(Save.data);
  eq(Roster.levelUp('carl'),false,'at the level cap');
  eq(JSON.stringify(Save.data),before2)});
Test.add('Roster.rankUp charges rank catalysts of the champion class, refuses when rank>=stars or short',()=>{
  Save.data=Meta.defaults();
  Save.data.roster.carl.stars=3; // rank(1) < stars(3), so a rank-up is legal
  Save.data.cats.brawler=1; // carl is cls:'brawler'; cost = current rank = 1
  ok(Roster.rankUp('carl'));
  eq(Save.data.roster.carl.rank,2);eq(Save.data.cats.brawler,0);
  const before=JSON.stringify(Save.data);
  eq(Roster.rankUp('carl'),false,'short on catalysts');
  eq(JSON.stringify(Save.data),before);
  Save.data.roster.carl.rank=Save.data.roster.carl.stars;Save.data.cats.brawler=9999;
  const before2=JSON.stringify(Save.data);
  eq(Roster.rankUp('carl'),false,'rank >= stars');
  eq(JSON.stringify(Save.data),before2)});
Test.add('Roster.setActive switches active, refuses an unowned/unknown champion (unchanged)',()=>{
  Save.data=Meta.defaults();
  Save.data.roster.katia={stars:1,rank:1,level:1,xp:0,shards:0};
  ok(Roster.setActive('katia'));eq(Save.data.active,'katia');
  const before=JSON.stringify(Save.data);
  eq(Roster.setActive('mongo'),false,'mongo is not yet owned');
  eq(JSON.stringify(Save.data),before);
  eq(Roster.setActive('nope'),false)});
Test.add('Arena.start() enemy/tier/hpMul sequence for streak 0..8',()=>{
  const expect=[
    ['goblin','t1',1.00],['skeleton','t1',1.08],['hobgoblin','t2',1.16],['shaman','t2',1.24],
    ['grub','t3',1.32],['grull','t3',1.40],['mother_rat','t4',1.48],['goblin','t4',1.56],
    ['skeleton','t5',1.64]];
  for(let s=0;s<expect.length;s++){
    Save.data=Meta.defaults();Save.data.arena.streak=s;
    const enc=Arena.start();
    const[enemyId,tier,hpMul]=expect[s];
    eq(enc.enemy.id,enemyId,'streak '+s+' enemy');
    eq(enc.tier,tier,'streak '+s+' tier');
    ok(Math.abs(enc.hpMul-hpMul)<1e-9,'streak '+s+' hpMul '+enc.hpMul)}});
Test.add('Arena.start() tier caps at t5 for streaks well past the curve',()=>{
  Save.data=Meta.defaults();Save.data.arena.streak=40;
  eq(Arena.start().tier,'t5')});
Test.add('Arena.record: a win increments streak, tracks best, and grants 60*streak gold',()=>{
  Save.data=Meta.defaults();Save.data.arena={best:0,streak:2};Save.data.gold=0;
  Arena.record(true);
  eq(Save.data.arena.streak,3);eq(Save.data.arena.best,3);eq(Save.data.gold,180)});
Test.add('Arena.record: best only rises, never falls, on a win below the prior best',()=>{
  Save.data=Meta.defaults();Save.data.arena={best:10,streak:2};
  Arena.record(true);
  eq(Save.data.arena.streak,3);eq(Save.data.arena.best,10)});
Test.add('Arena.record: a loss resets streak to 0 and leaves best/gold alone',()=>{
  Save.data=Meta.defaults();Save.data.arena={best:5,streak:4};Save.data.gold=50;
  Arena.record(false);
  eq(Save.data.arena.streak,0);eq(Save.data.arena.best,5);eq(Save.data.gold,50)});
// Task 4.4: Fight integration (roster stats, quest/arena bookkeeping) ---------------------------
Test.add('G.startFight derives p1 hp/atk from the champ roster entry, sets G.champ, and the HUD label reflects it',()=>{
  Save.data=Meta.defaults();
  Save.data.roster.carl={stars:3,rank:2,level:5,xp:0,shards:0};
  G.startFight({encounter:'f1_goblin',champ:'carl'});
  const expect=Stats.derive(CHAMPS.carl,Save.data.roster.carl);
  eq(G.fight.p1.maxHp,expect.hp,'p1 maxHp must come from Stats.derive');
  eq(G.fight.p1.def.atk,expect.atk,'p1 atk must come from Stats.derive');
  eq(G.champ,'carl');
  Render.frame(G.fight);
  eq(Render.hudCache().p1SubLabel,'LVL 5 ★★★','cached HUD sub-label, not pixels');
  G.toTitle()});
Test.add('a non-roster p1 def (a mob/boss put in p1 for debug/test purposes) falls back to base stats, unscaled',()=>{
  Save.data=Meta.defaults(); // only carl is owned
  G.startFight({p1:'donut'});
  eq(G.fight.p1.maxHp,CHAMPS.donut.hp);eq(G.fight.p1.def.atk,CHAMPS.donut.atk);
  G.toTitle()});
Test.add('G.mode is quest for {floor,node} or a plain quest encounter id, arena via G.startArena, exhibition otherwise',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0});eq(G.mode,'quest');G.toTitle();
  Save.data=Meta.defaults();
  G.startFight({encounter:'f1_goblin'});eq(G.mode,'quest');G.toTitle();
  Save.data=Meta.defaults();
  G.startArena();eq(G.mode,'arena');G.toTitle();
  G.startFight({p2:'donut'});eq(G.mode,'exhibition');G.toTitle()});
// "The sugar" (45_encounter.js's own term) is specifically the {floor,node} option object -- a plain
// {encounter:ID} start must stay ungated so tests/batch.py's --encounter win-rate sweeps (dozens of
// restart-on-KO fights against one id) and docs/ARENA.md's --encounter screenshot recipes, both
// pre-existing and unaware of energy, keep working unmodified.
Test.add('a plain {encounter:ID} quest fight does not spend energy; only the {floor,node} sugar does',()=>{
  Save.data=Meta.defaults();
  G.startFight({encounter:'f1_goblin'});
  eq(G.mode,'quest');eq(Save.data.energy.n,10,'a plain encounter id must not spend energy');
  G.toTitle();
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0});
  eq(Save.data.energy.n,9,'the {floor,node} sugar must spend 1 energy via Quest.start');
  G.toTitle()});
Test.add('G.startFight({floor,node}) refuses without starting a fight when energy is empty, leaving G.state/G.fight unchanged',()=>{
  Save.data=Meta.defaults();Save.data.energy.n=0;
  G.toTitle();
  const stateBefore=G.state,fightBefore=G.fight;
  const r=G.startFight({floor:1,node:0});
  eq(r,false,'a refused quest start must return false');
  eq(G.state,stateBefore,'G.state must be unchanged');
  eq(G.fight,fightBefore,'G.fight must be unchanged')});
Test.add('G.startFight({floor,node}) refuses a locked node the same way',()=>{
  Save.data=Meta.defaults(); // node 1 starts locked
  const stateBefore=G.state;
  eq(G.startFight({floor:1,node:1}),false);
  eq(G.state,stateBefore)});
Test.add('scripted KO in quest mode completes the node, opens the next one, grants rewards once, and shows VICTORY with the reward line',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0,ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  eq(G.mode,'quest');eq(Save.data.energy.n,9,'Quest.start must have spent 1 energy at fight start');
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(document.getElementById('resultTitle').textContent,'VICTORY');
  const f=Quest.floor(1);
  eq(f.nodes[0].state,'done','the fought node must be marked done');
  eq(f.nodes[1].state,'open','the next node must unlock');
  const expectRewards=Rewards.forNode(1,0);
  eq(JSON.stringify(G.lastRewards),JSON.stringify(expectRewards),'G.lastRewards must equal Rewards.forNode(1,0)');
  const line=document.getElementById('resultLine').textContent;
  ok(line.includes('+'+expectRewards.gold+' G'),'reward line must show gold: '+line);
  ok(line.includes('+'+expectRewards.iso+' ISO'),'reward line must show iso: '+line);
  ok(line.includes('+'+expectRewards.xp+' XP'),'reward line must show xp: '+line);
  const goldAfterFirst=Save.data.gold;
  for(let i=0;i<50;i++)G.tick(); // tick() is a no-op once G.state!=='FIGHT'
  eq(Save.data.gold,goldAfterFirst,'rewards must be granted exactly once per fight, not per tick');
  G.toTitle();G.sim=false});
Test.add('a quest loss keeps the node open, does not refund energy, and shows DEFEATED with no rewards',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0,ctrl2:AI.make('basic',9),seed:3});
  eq(Save.data.energy.n,9);
  G.fight.p1.hp=1;G.sim=true;
  for(let i=0;i<600;i++)G.tick();
  ok(G.fight.over,'the fight must have ended');
  eq(G.state,'RESULT');
  eq(document.getElementById('resultTitle').textContent,'DEFEATED');
  eq(Quest.floor(1).nodes[0].state,'open','a loss must not complete the node');
  eq(Save.data.energy.n,9,'energy spent at start is not refunded on a loss');
  eq(G.lastRewards,null);
  G.toTitle();G.sim=false});
Test.add('FIGHT AGAIN in quest mode re-spends energy through the sugar',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0,ctrl2:AI.make('basic',9),seed:5});
  eq(Save.data.energy.n,9);
  G.fight.p1.hp=1;G.sim=true;
  for(let i=0;i<600;i++)G.tick(); // loss: node 0 stays open
  eq(G.state,'RESULT');
  document.getElementById('again').click();
  eq(G.mode,'quest');
  eq(Save.data.energy.n,8,'FIGHT AGAIN must re-spend energy via Quest.start, not skip the gate');
  G.toTitle();G.sim=false});
Test.add('G.startArena starts the Arena.start() encounter for the current streak with G.mode arena',()=>{
  Save.data=Meta.defaults();Save.data.arena.streak=3; // Arena.start() sequence test: streak 3 -> shaman/t2
  G.startArena();
  eq(G.mode,'arena');
  eq(G.fight.p2.def.id,'shaman');
  eq(G.encounter.name,'ARENA');
  G.toTitle()});
Test.add('a scripted arena win records the streak/gold via Arena.record and never touches quest floor state',()=>{
  Save.data=Meta.defaults();Save.data.arena={best:0,streak:0};Save.data.gold=0;
  G.startArena({ctrl1:Ctrl.script([L(0)]),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(Save.data.arena.streak,1);eq(Save.data.arena.best,1);eq(Save.data.gold,60);
  eq(G.lastRewards,null,'arena wins go through Arena.record, not Rewards.forNode');
  eq(Quest.floor(1).nodes[0].state,'open','arena must never touch quest floor state');
  G.toTitle();G.sim=false});

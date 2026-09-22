// Task 5.5: run() is now async so a case's fn may return a Promise (an async test, e.g. one that
// awaits Atlas.load) -- `await`ing a plain non-Promise return value (every existing sync test) is a
// same-tick no-op, so every sync case's pass/fail behavior is unchanged. Test.add itself needs no
// change at all: async and sync fns are added identically, and a sync fn that throws synchronously
// is still caught by the same try/catch (the throw happens before the `await` line is even reached).
// tests/harness.py's `pg.evaluate('Test.run()')` already awaits whatever it evaluates to when that's
// a Promise (Playwright's own behavior), so no harness change was needed for this either.
const Test={cases:[],add(n,fn){this.cases.push({n,fn})},
  async run(){const out=[];for(const c of this.cases){try{await c.fn();out.push({name:c.n,ok:true})}catch(e){out.push({name:c.n,ok:false,err:String(e&&e.message||e)})}}
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
// ---- Task 5.5: optional sprite atlas hook ----------------------------------------------------
// Atlas.load never fetches unless enabled (settings.useAtlas or ?atlas=1); this run leaves useAtlas
// at its default (false) so this first case also doubles as "disabled means no cache entry, no
// fetch" -- it resolves synchronously-fast (no network attempted) and must still never throw.
Test.add('Atlas.load resolves null (never throws) when disabled',async()=>{
  const saved=Save.data.settings.useAtlas;Save.data.settings.useAtlas=false;
  try{const r=await Atlas.load('__atlas_test_disabled__');eq(r,null)}
  finally{Save.data.settings.useAtlas=saved}});
// Enabled but the manifest doesn't exist (a real deploy 404s over HTTP -- stubbed here rather than
// hitting the real file:// network layer, which fails at the SCHEME level under the headless
// harness and logs its own browser-side console error unrelated to anything this code does).
// Atlas.load's own try/catch turns any of missing/bad-JSON/network-error into a clean null
// resolution, same contract as the disabled case above -- a missing atlas is never visible to a
// caller as a thrown error, and never logs anything of its own either.
Test.add('Atlas.load resolves null (never throws) for a missing manifest',async()=>{
  const saved=Save.data.settings.useAtlas,savedFetch=window.fetch;
  Save.data.settings.useAtlas=true;
  window.fetch=async()=>({ok:false,status:404});
  try{const r=await Atlas.load('__atlas_test_missing__');eq(r,null)}
  finally{Save.data.settings.useAtlas=saved;window.fetch=savedFetch}});
// G.startFight fires Atlas.load for both looks; with useAtlas off that must never reach fetch() at
// all -- stubbing fetch to throw and starting a fight is the frozen way to prove the default path
// stays fully offline.
Test.add('default path never calls fetch: G.startFight with useAtlas off never invokes it',()=>{
  const savedFetch=window.fetch,savedUseAtlas=Save.data.settings.useAtlas;
  Save.data.settings.useAtlas=false;
  window.fetch=()=>{throw new Error('fetch must not be called on the default (atlas-off) path')};
  try{ok(G.startFight({p1:'carl',p2:'donut',ctrl1:Ctrl.idle()})!==false,'startFight should still succeed')}
  finally{window.fetch=savedFetch;Save.data.settings.useAtlas=savedUseAtlas;G.toTitle()}});
// A synthetic per-look atlas assigned straight onto ATLAS (as Atlas.load itself would once a real
// fetch resolves) -- Rig.draw must short-circuit to the atlas path (Rig._drawAtlasFrame) instead of
// the FK rig path whenever ATLAS[lookId] has a manifest with poses for the fighter's current key.
function mkSyntheticAtlas(){
  const oc=document.createElement('canvas');oc.width=4;oc.height=2;
  const ox=oc.getContext('2d');
  ox.fillStyle='#f00';ox.fillRect(0,0,2,2); // frame 0: red
  ox.fillStyle='#0f0';ox.fillRect(2,0,2,2); // frame 1: green
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve({img,meta:{frame:{w:2,h:2,anchorX:1,anchorY:2},poses:{idle:[[0,0],[2,0]]}}});
    img.onerror=reject;
    img.src=oc.toDataURL()})}
Test.add('Rig.draw takes the atlas path (spy on Rig._drawAtlasFrame) when ATLAS[lookId] has the pose and the atlas is enabled',async()=>{
  const atlas=await mkSyntheticAtlas();
  const savedAtlas=ATLAS.carl,savedHook=Rig._drawAtlasFrame,savedUseAtlas=Save.data.settings.useAtlas;
  ATLAS.carl=atlas;
  // Fix-wave item 5: Rig.draw's short-circuit now also requires the atlas to be currently enabled
  // (Save.data.settings.useAtlas||G.atlasQuery), not just a populated ATLAS[lookId] entry.
  Save.data.settings.useAtlas=true;
  const calls=[];
  Rig._drawAtlasFrame=function(...args){calls.push(args);return savedHook.apply(this,args)};
  const c=document.createElement('canvas').getContext('2d');
  const F={x:0,def:{id:'carl',scale:1},face:1,state:'IDLE',f:0,dx:0};
  try{
    Rig.draw(c,F,null,0);
    eq(calls.length,1,'the atlas hook should fire exactly once');
    eq(calls[0][5],'idle','pose key passed through');
    eq(calls[0][6],0,'t01 passed through (idle at f=0 is t01=0)')
  }finally{Rig._drawAtlasFrame=savedHook;Save.data.settings.useAtlas=savedUseAtlas;
    if(savedAtlas===undefined)delete ATLAS.carl;else ATLAS.carl=savedAtlas}});
// Fix-wave item 5 (final review, Minor): turning USE SPRITE ATLAS off mid-session used to do nothing
// -- Rig.draw read ATLAS[lookId] and never re-checked the setting, so a cached sheet kept drawing
// while the toggle read OFF. With an ATLAS entry present but the setting off (and no ?atlas=1
// override), Rig.draw must now fall back to the ordinary FK rig path instead of the atlas one.
Test.add('Rig.draw falls back to the FK rig path when ATLAS[lookId] has the pose but the atlas is disabled',async()=>{
  const atlas=await mkSyntheticAtlas();
  const savedAtlas=ATLAS.carl,savedHook=Rig._drawAtlasFrame,savedUseAtlas=Save.data.settings.useAtlas,
    savedQuery=G.atlasQuery;
  ATLAS.carl=atlas;
  Save.data.settings.useAtlas=false;G.atlasQuery=false;
  const calls=[];
  Rig._drawAtlasFrame=function(...args){calls.push(args)}; // spy only -- must never be called
  const c=document.createElement('canvas').getContext('2d');
  const F={x:0,def:{id:'carl',scale:1},face:1,state:'IDLE',f:0,dx:0};
  try{
    ok(!threw(()=>Rig.draw(c,F,{x:0,zoom:1},0)),'Rig.draw must not throw on the FK fallback path');
    eq(calls.length,0,'the atlas hook must not fire while the setting is off and no ?atlas=1 override is present')
  }finally{Rig._drawAtlasFrame=savedHook;Save.data.settings.useAtlas=savedUseAtlas;G.atlasQuery=savedQuery;
    if(savedAtlas===undefined)delete ATLAS.carl;else ATLAS.carl=savedAtlas}});
Test.add('Rig._drawAtlasFrame picks frame 0 at t01=0 and frame 1 at t01=1 (via each frame\'s sheet x)',async()=>{
  const atlas=await mkSyntheticAtlas();
  const c=document.createElement('canvas').getContext('2d');
  const F={x:0,def:{id:'carl',scale:1},face:1};
  const draws=[];
  const origDrawImage=c.drawImage.bind(c);
  c.drawImage=(...a)=>{draws.push(a);return origDrawImage(...a)};
  Rig._drawAtlasFrame(c,F,null,0,atlas,'idle',0);
  Rig._drawAtlasFrame(c,F,null,0,atlas,'idle',1);
  eq(draws.length,2);
  eq(draws[0][1],0,'t01=0 should sample frame 0 (sheet x=0)');
  eq(draws[1][1],2,'t01=1 should sample frame 1 (sheet x=2)')});
Test.add('Rig.draw falls back to the ordinary FK rig path (spy on Rig.solve) when no atlas is loaded',()=>{
  ok(!ATLAS.carl,'test isolation: ATLAS.carl must be unset here');
  const savedSolve=Rig.solve,calls=[];
  Rig.solve=function(...a){calls.push(a);return savedSolve.apply(this,a)};
  const c=document.createElement('canvas').getContext('2d');
  const F={x:0,def:{id:'carl',scale:1},face:1,state:'IDLE',f:0,dx:0};
  try{Rig.draw(c,F,null,0);ok(calls.length>=1,'the FK solve path should run when no atlas is present')}
  finally{Rig.solve=savedSolve}});
// Frozen constraint: nothing outside Atlas.load's own body may reference `fetch` at 68_rig.js's top
// level -- the whole file's build.py-concatenated source lives verbatim in the page's one inline
// <script> (no per-file wrapper), so this reads it back via document.scripts and isolates the
// 68_rig.js segment between its own known first line and 70_render.js's own first line.
Test.add('Atlas: fetch is referenced nowhere in 68_rig.js except inside Atlas.load',()=>{
  const full=[...document.scripts].map(s=>s.textContent||'').join('\n');
  const start=full.indexOf('// Stylized vector-rig renderer.');
  const end=full.indexOf('const Render={ctx:canvas.getContext');
  ok(start>=0&&end>start,'could not locate src/68_rig.js in the built page');
  const rigSrc=full.slice(start,end);
  const loadSrc=Atlas.load.toString();
  ok(/fetch\s*\(/.test(loadSrc),'Atlas.load itself must fetch when enabled');
  ok(rigSrc.indexOf(loadSrc)>=0,'Atlas.load\'s body should appear verbatim inside 68_rig.js source');
  const withoutLoad=rigSrc.split(loadSrc).join('');
  ok(!/\bfetch\s*\(/.test(withoutLoad),'fetch must not be referenced outside Atlas.load in 68_rig.js')});
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
  const PURITY=/document|canvas|Audio\.|FX\.|Render\.|Stage\./;
  for(const f of [Fight,Fighter])
    ok(!PURITY.test(f.toString()),(f.name||'?')+' must stay presentation-free');
  ok(!PURITY.test(AI.make.toString()),'AI.make must stay presentation-free');
  // Fix round 1 (Important): Broadcast sits right next to the sim boundary (fed by Fight.emit'd
  // events) and its own header claims the same no-DOM/no-presentation purity -- folded into this
  // existing scan (rather than only the separate Math.random/Date.now one below) so a Render./FX./
  // Audio./document/canvas leak into 13_broadcast.js is caught the same way one in Fight/Fighter/AI
  // already is.
  for(const fn of[Broadcast.reset,Broadcast.onEvent,Broadcast.tick,Broadcast._gain,Broadcast._setMult])
    ok(!PURITY.test(fn.toString()),
      'Broadcast.'+(fn.name||'?')+' must stay presentation-free');
  // Release pass (Important, deferred from Task 5.3): every BUFFS.* hook body scanned too -- these
  // run from inside Fight.resolve/Fight.step (Fight.buffHook) so they're exactly as much on the sim
  // side of the boundary as Fight/Fighter/AI.make/Broadcast are, and BUFFS.tutorialGuard's own
  // Tutorial.state.step read (now fixed -- see 47_buffs.js and holder.guardActive) proved a hook here
  // can drift onto a presentation global with nothing catching it. This scan uses a WIDER pattern
  // than PURITY above (also bans Tutorial./Screens./G., not just the DOM/render/audio surface) since
  // a buff hook has no legitimate reason to reach into ANY global outside its own (fight, att, def,
  // ref, holder) args -- unlike Fight/Fighter/AI.make/Broadcast's own comments, which mention G./
  // Tutorial. by name often enough (as prose, not code) that the wider pattern would false-positive
  // on class-body comment text; a single-method toString() like a buff hook's never includes the
  // doc comment that precedes it, only comments genuinely inside the hook body, so this is safe here.
  const BUFF_PURITY=/document|canvas|Audio\.|FX\.|Render\.|Stage\.|Tutorial\.|Screens\.|G\./;
  for(const id in BUFFS){
    const b=BUFFS[id];
    for(const hook of['onFrame','onHit','onBlock'])
      if(b[hook])ok(!BUFF_PURITY.test(b[hook].toString()),'BUFFS.'+id+'.'+hook+' must stay presentation-free')}});
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
// Fix-wave item 1: unit-level reproduction of the final-review repro
// (`--sim --seconds 4 --encounter f1_grull`) — Grull (rig:'big', a tall boss) as p2 in CHARGE, camera
// at its own hard zoom ceiling (1.12, the ordinary gameplay cap — see G.tick's capNow), which is
// exactly the situation the review found the bare overlayY(F) world-space point crossing HUD_LINE at
// (screen y≈66, over "THE DEPTHS" in docs/shots/p3-floor1-boss.png). Same Camera.toScreen idiom the
// per-frame zoom-cap test above uses, checking Render.overlayScreenY's clamped result directly rather
// than re-driving a live fight into the exact lag window that triggers it.
Test.add('the heavy-charge bar and the block/parry ring never cross HUD_LINE for a tall fighter at the zoom cap',()=>{
  const cam={x:0,zoom:1.12};
  const charging={x:0,def:DEFS.grull,state:'CHARGE',move:MOVES.heavy,f:5};
  const barSy=Render.overlayScreenY(charging,cam,6);
  ok(barSy>=HUD_LINE-1e-6,'heavy-charge bar top at screen y='+barSy.toFixed(2)+' must clear the HUD ('+HUD_LINE+')');
  const blocking={x:0,def:DEFS.grull,state:'BLOCK'};
  const ringSy=Render.overlayScreenY(blocking,cam,6);
  ok(ringSy>=HUD_LINE-1e-6,'block ring top at screen y='+ringSy.toFixed(2)+' must clear the HUD ('+HUD_LINE+')');
  // Sanity: the UNCLAMPED world-space point really would have crossed the line at this zoom — proves
  // this test exercises the clamp, not a pairing that was never at risk.
  const rawSy=Camera.toScreen(cam,0,Render.overlayY(charging)).sy;
  ok(rawSy<HUD_LINE,'sanity check: the unclamped overlay point ('+rawSy.toFixed(2)+') must be the bug this test guards against')});
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
// Fix-wave item 1 (Critical): e.ts defaulted to 0 and was only ever advanced by regen*360000, never
// anchored to Energy.now() -- so now-ts was always ~57 real years and every tick() refilled to max
// instantly, making the energy gate inert. Fix: Energy.spend anchors e.ts=Energy.now() the instant
// it spends FROM full (the transition out of "already regenerated"); Energy.tick() re-anchors
// e.ts=Energy.now() whenever e.n is already at/over max (both the "never spent" and "just regenerated
// back to max" cases). Regen math itself (floor((now-ts)/360000)) is unchanged.
Test.add('Energy regenerates against the wall clock (fix-wave item 1): spend anchors ts, tick regens at 5/12/60 minutes',()=>{
  const origNow=Energy.now;
  try{
    let t=1000000;Energy.now=()=>t;
    Save.data=Meta.defaults(); // energy.n=10 (full), ts=0 -- must not matter once a real spend anchors it
    ok(Energy.spend(3),'spend from full must succeed');
    eq(Save.data.energy.n,7);
    eq(Save.data.energy.ts,t,'spending from full must anchor ts to now, not leave it at the stale default');
    t+=5*60*1000; // T+5min since the spend
    Energy.tick();
    eq(Save.data.energy.n,7,'no regen yet -- under the 6-minute interval');
    t=1000000+12*60*1000; // T+12min since the spend
    Energy.tick();
    eq(Save.data.energy.n,9,'2 full 6-minute intervals since the spend => +2');
    t=1000000+60*60*1000; // T+60min since the spend
    Energy.tick();
    eq(Save.data.energy.n,10,'caps at max');
    eq(Save.data.energy.ts,t,'ts is pinned to now once full, so a later real spend anchors correctly again')
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
// Fix-wave item 4 (plan defect, ruled): the frozen interface line said pity guarantees "the kind's
// top-1 tier" but Task 4.2's own checklist said "the 10th open is >=3-star even after nine 1-star"
// -- for basic (top tier 3), those two readings happen to agree (top-1 = 2, but the checklist's
// literal >=3 does not), so the implementer shipped top-1 (pityFloor = topTier-1), which review
// caught as a genuine plan contradiction, not an implementer error. Ruling: pity guarantees the
// kind's TOP tier outright (not top-1) -- basic's 10th open is always exactly 3-star, premium's
// always exactly 4-star.
Test.add('Crystal.open pity guarantees the kind\'s top tier (3-star) on the 10th basic open',()=>{
  for(let seed=1;seed<=50;seed++){
    Save.data=Meta.defaults();Save.data.roster={};Save.data.seed=seed;Save.data.gold=999999;Save.data.pity.basic=9;
    const r=Crystal.open('basic');
    ok(r,'open must succeed, seed '+seed);
    eq(r.stars,3,'seed '+seed+' got '+r.stars+'-star, expected the top tier (3)')}});
Test.add('Crystal.open pity guarantees the kind\'s top tier (4-star) on the 10th premium open',()=>{
  for(let seed=1;seed<=50;seed++){
    Save.data=Meta.defaults();Save.data.roster={};Save.data.seed=seed;Save.data.units=999999;Save.data.pity.premium=9;
    const r=Crystal.open('premium');
    ok(r,'open must succeed, seed '+seed);
    eq(r.stars,4,'seed '+seed+' got '+r.stars+'-star, expected the top tier (4)')}});
Test.add('Crystal.open pity counter resets after triggering',()=>{
  Save.data=Meta.defaults();Save.data.gold=999999;Save.data.pity.basic=9;
  Crystal.open('basic');
  eq(Save.data.pity.basic,0)});
// Ruled alongside item 4: a NATURAL top-tier roll (the raw table hitting the top tier on its own,
// well before the pity counter reaches 10) also resets pity, the same as a pity-forced one -- a
// player who gets lucky shouldn't have that luck "wasted" against a counter that only reset on a
// forced pull. Forced with pity deliberately LOW (3, not 9) so any 3-star result here is provably
// natural, never the forced-10th-open path.
Test.add('Crystal.open pity counter resets on a natural top-tier pull too, not only the forced 10th (fix-wave item 4, ruled)',()=>{
  let found=false;
  for(let seed=1;seed<=2000&&!found;seed++){
    Save.data=Meta.defaults();Save.data.roster={};Save.data.seed=seed;Save.data.gold=999999;Save.data.pity.basic=3;
    const r=Crystal.open('basic');
    if(r.stars===3){
      eq(Save.data.pity.basic,0,'a natural top-tier pull must reset pity, not increment it to 4');
      found=true}}
  ok(found,'expected at least one natural 3-star pull within 2000 seeds (basic\'s odds are ~5% for it)')});
// Fix-wave item 5 (ruled): once the roster is full (four champions, uniform picking), every
// duplicate crystal used to pay out exactly one shard regardless of the rolled tier -- a 100-unit
// premium crystal and a 500-gold basic became worth identically little the moment the roster filled,
// and the whole odds/pity apparatus stopped mattering (final-review-verdict.md issue 5). Ruled:
// shards now scale by the rolled tier via Crystal.SHARDS_PER_TIER (1/2/3/5 shards for a 1/2/3/4-star
// roll); 5 shards still converts to +1 star, capped at 5-star, with any leftover kept.
Test.add('Crystal.open on a duplicate adds shards scaled by the rolled tier, not a flat 1 (fix-wave item 5)',()=>{
  // A low-tier roll grants exactly 1 shard, same as the old flat behavior -- scan a few seeds with
  // no pity forcing so this exercises a genuinely natural (not pity-forced) low roll.
  let low=null;
  for(let s=1;s<200&&!(low&&low.shards===1);s++){
    Save.data=Meta.defaults();Save.data.gold=999999;Save.data.seed=s;
    for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:2,rank:1,level:1,xp:0,shards:0};
    low=Crystal.open('basic')}
  ok(low&&low.shards===1,'expected a 1-star (1-shard) dup pull within 200 seeds');
  // Pity-forced rolls make the higher tiers deterministic: basic's top tier (3-star) grants 3 shards.
  Save.data=Meta.defaults();Save.data.gold=999999;Save.data.pity.basic=9;
  for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:1,rank:1,level:1,xp:0,shards:0};
  const r3=Crystal.open('basic');
  eq(r3.stars,1,'entry.stars reflects the OWNED star count on a dup, unaffected by the rolled tier');
  eq(Save.data.roster[r3.champId].shards,3,'a pity-forced 3-star dup pull must grant 3 shards');
  eq(r3.shards,3);
  // premium's top tier (4-star) grants 5 shards.
  Save.data=Meta.defaults();Save.data.units=999999;Save.data.pity.premium=9;
  for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:2,rank:1,level:1,xp:0,shards:0};
  const r4=Crystal.open('premium');
  eq(Save.data.roster[r4.champId].stars,3,'0+5 shards converts to exactly +1 star with 0 leftover, proving the grant was exactly 5');
  eq(Save.data.roster[r4.champId].shards,0)});
Test.add('Crystal.open converts 5 shards into +1 star, capped at 5-star with leftover kept (fix-wave item 5: shards now scale by rolled tier)',()=>{
  // Pity forces the top tier (3-star for basic -> 3 shards per Crystal.SHARDS_PER_TIER).
  Save.data=Meta.defaults();Save.data.gold=999999;Save.data.pity.basic=9;
  for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:3,rank:1,level:1,xp:0,shards:2};
  const r=Crystal.open('basic'); // 2 existing + 3 gained = 5 -> exactly one star conversion, no leftover
  eq(Save.data.roster[r.champId].stars,4);
  eq(Save.data.roster[r.champId].shards,0);
  // already at the 5-star cap: shards keep accruing (nothing left to convert into) instead of being
  // discarded once the cap is hit.
  Save.data.pity.basic=9;
  for(const id of Object.keys(CHAMPS))Save.data.roster[id]={stars:5,rank:1,level:1,xp:0,shards:4};
  const r2=Crystal.open('basic'); // 4 existing + 3 gained = 7, capped at 5-star: nothing converts
  eq(Save.data.roster[r2.champId].stars,5);
  eq(Save.data.roster[r2.champId].shards,7,'leftover shards accrue past 5 once the star cap is hit; never discarded')});
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
// Fix-wave item 9 (Phase 5 seams, ruled): floors used to be looked up by array index (FLOORS[n-1])
// in three separate places (Quest.floor, Rewards.forNode, G.startFight's {floor,node} sugar), which
// would all need renumbering together the day a tutorial floor 0 is inserted at FLOORS[0].
// Quest.floorDef(n) looks a floor up by its own .floor field instead, so a future floor:0 just plugs
// in without touching any of the three call sites' indexing math.
Test.add('Quest.floorDef(n) looks floors up by their own .floor field, not array index (fix-wave item 9, Phase 5 seam)',()=>{
  eq(Quest.floorDef(1).id,'f1');
  eq(Quest.floorDef(2).id,'f2');
  eq(Quest.floorDef(99),null,'a floor number FLOORS doesn\'t define must return null, same as before')});
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
// Fix-wave item 8 (ruled): node gold raised from 100*n+40*k to 160*n+60*k -- floor 1 only yielded
// ~1200 gold total under the old numbers, while one roster star costs ~5 dupes worth of crystals
// (~10000 gold at 500g/basic), gating floor-2 progression almost entirely behind a wall unrelated to
// actual play (final-review-verdict.md UX/balance note 3). iso/xp are unchanged; boss k stays
// def.nodes.length, as before.
Test.add('Rewards.forNode gives gold/iso/xp scaled by floor and node position (fix-wave item 8: gold 160*n+60*k)',()=>{
  const r0=Rewards.forNode(1,0);
  eq(r0.gold,160*1+60*0);eq(r0.iso,20);eq(r0.xp,30);
  ok(!('units' in r0));ok(!('cats' in r0));
  const r3=Rewards.forNode(1,3);
  eq(r3.gold,160*1+60*3)});
Test.add('Rewards.forNode boss adds units and one catalyst of the enemy class',()=>{
  const r=Rewards.forNode(1,'boss');
  eq(r.iso,20);eq(r.xp,30);eq(r.units,50);
  eq(DEFS.grull.cls,'tank');
  eq(r.cats.tank,1)});
// Fix-wave item 9 (Phase 5 seam, ruled): Rewards had no multiplier hook, which is exactly where a
// future ratings/viewers system needs to land -- without it, that multiplier would have to thread
// through onFightEnd or every call site individually. Rewards.mult (default {gold:1,iso:1,xp:1}) is
// applied once, inside forNode, so nothing downstream needs to know it exists.
Test.add('Rewards.mult multiplies forNode\'s gold/iso/xp (fix-wave item 9, Phase 5 seam): mult 2 doubles gold',()=>{
  const orig=Rewards.mult;
  try{
    Rewards.mult={gold:2,iso:1,xp:1};
    const r=Rewards.forNode(1,0);
    eq(r.gold,2*(160*1+60*0));
    eq(r.iso,20*1);eq(r.xp,30*1)
  }finally{Rewards.mult=orig}});
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
Test.add('G.mode is quest ONLY via a successful {floor,node} Quest.start; a bare encounter id is exhibition (still populates G.encounter)',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0});eq(G.mode,'quest');G.toTitle();
  Save.data=Meta.defaults();
  G.startFight({encounter:'f1_goblin'});
  eq(G.mode,'exhibition','a bare encounter id must never be quest mode (fix round 1: farming fix)');
  ok(G.encounter&&G.encounter.floor===1&&G.encounter.name==='THE DEPTHS','G.encounter must still be populated for the HUD floor line');
  G.toTitle();
  Save.data=Meta.defaults();
  G.startArena();eq(G.mode,'arena');G.toTitle();
  G.startFight({p2:'donut'});eq(G.mode,'exhibition');G.toTitle()});
// Fix round 1 (controller review, Important): the pre-fix version labeled a bare {encounter:ID}
// start G.mode='quest' too, so a scripted win through it ran Quest.complete/Rewards.grant with no
// energy spent and no lock check -- free, unlimited reward/progression farming for anything that
// repeatedly starts an encounter id (tests/batch.py's --encounter win-rate sweeps and
// docs/ARENA.md's --encounter screenshot recipes already do exactly that, dozens of times per run).
// Now a bare encounter id is 'exhibition': no energy spent AND no rewards/floor-state changes on a
// win either -- verified end to end here, not just "no energy spent" as the old (insufficient) test
// checked.
Test.add('a bare {encounter:ID} scripted KO win grants nothing: no rewards, no energy spent, no floor/roster/gold change',()=>{
  Save.data=Meta.defaults();
  const before=JSON.stringify(Save.data);
  G.startFight({encounter:'f1_goblin',ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  eq(G.mode,'exhibition');
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(document.getElementById('resultTitle').textContent,'VICTORY','the fight itself still plays out normally');
  eq(G.lastRewards,null,'a bare encounter win must not grant anything');
  eq(JSON.stringify(Save.data),before,'Save.data (gold/iso/xp/energy/floor node states) must be completely unchanged');
  G.toTitle();G.sim=false});
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
  G.startFight({floor:1,node:0,champ:'carl',ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  eq(G.champ,'carl','fix round 1: onFightEnd\'s level-up check reads this.champ, exercised here explicit');
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
// Task 5.1: Broadcast (viewers, ratings multipliers, leaderboard) -------------------------------
// Fake-fight helpers below build the minimal {p1,p2} shape Broadcast.onEvent/tick actually read
// (identity via ===, .combo, .moveName, .hits, .state) rather than driving a real Fight through a
// script -- isolates the pure math from sim timing, matching how mkFighter/mkFight isolate the sim
// itself from the rest of the game. Broadcast._firstBlood is poked directly to neutralize the
// one-time +250 first-blood bonus in tests that are isolating a different formula.
Test.add('Broadcast: a hit landed by the player at mult 1 gains dmg*2',()=>{
  Broadcast.reset();Broadcast._firstBlood=true;
  const f={p1:{combo:1,moveName:'light1',hits:new Set([0])},p2:{}};
  Broadcast.onEvent('hit',f.p1,f.p2,60,f);
  eq(Broadcast.state.viewers,120)});
Test.add('Broadcast: a player parry gains +300 and sets mult 1.5 for 180 frames',()=>{
  Broadcast.reset();
  const f={p1:{state:'IDLE'},p2:{}};
  Broadcast.onEvent('parry',f.p1,f.p2,0,f);
  eq(Broadcast.state.viewers,300);eq(Broadcast.state.mult,1.5);
  for(let i=0;i<179;i++)Broadcast.tick(f);
  eq(Broadcast.state.mult,1.5,'must still be active one frame before the window ends');
  Broadcast.tick(f);
  eq(Broadcast.state.mult,1,'must revert to 1 once the 180-frame window elapses')});
Test.add('Broadcast: an S3 first hit gains the flat +1500 bonus (not dmg*2*mult) and sets mult 3 for 240 frames',()=>{
  Broadcast.reset();Broadcast._firstBlood=true;
  const f={p1:{combo:1,moveName:'s3',hits:new Set([0])},p2:{}};
  Broadcast.onEvent('hit',f.p1,f.p2,999,f); // val (dmg) must be ignored -- the bonus is flat
  eq(Broadcast.state.viewers,1500);eq(Broadcast.state.mult,3);
  for(let i=0;i<239;i++)Broadcast.tick({p1:{state:'IDLE'}});
  eq(Broadcast.state.mult,3);
  Broadcast.tick({p1:{state:'IDLE'}});
  eq(Broadcast.state.mult,1)});
Test.add('Broadcast: a 5-hit combo adds +500 and sets mult 2 for 180 frames',()=>{
  Broadcast.reset();Broadcast._firstBlood=true;
  const f={p1:{combo:5,moveName:'light1',hits:new Set([0,1,2])},p2:{}};
  Broadcast.onEvent('hit',f.p1,f.p2,10,f); // 10*2*1 + 500
  eq(Broadcast.state.viewers,520);eq(Broadcast.state.mult,2)});
Test.add('Broadcast: the player\'s own first landed hit of the fight adds a one-time +250 first-blood bonus',()=>{
  Broadcast.reset();
  const f={p1:{combo:1,moveName:'light1',hits:new Set([0])},p2:{}};
  Broadcast.onEvent('hit',f.p1,f.p2,10,f); // 10*2*1 + 250
  eq(Broadcast.state.viewers,270);
  Broadcast.onEvent('hit',f.p1,f.p2,10,f); // no more first-blood on a later hit
  eq(Broadcast.state.viewers,290)});
Test.add('Broadcast: a lower-value trigger cannot downgrade or reset an active higher multiplier window',()=>{
  Broadcast.reset();Broadcast._firstBlood=true;
  const f={p1:{combo:1,moveName:'s3',hits:new Set([0])},p2:{}};
  Broadcast.onEvent('hit',f.p1,f.p2,10,f); // mult -> 3, 240 frames
  for(let i=0;i<100;i++)Broadcast.tick({p1:{state:'IDLE'}}); // 140 frames left
  Broadcast.onEvent('parry',f.p1,f.p2,0,f); // a would-be x1.5 must not win against the active x3
  eq(Broadcast.state.mult,3,'the active x3 must not be downgraded by a later x1.5 trigger');
  for(let i=0;i<139;i++)Broadcast.tick({p1:{state:'IDLE'}});
  eq(Broadcast.state.mult,3,'the original window (not reset by the parry) must still be counting down');
  Broadcast.tick({p1:{state:'IDLE'}});
  eq(Broadcast.state.mult,1)});
Test.add('Broadcast: the player taking a hit loses dmg viewers, floored at 0',()=>{
  Broadcast.reset();Broadcast.state.viewers=40;Broadcast.state.peak=40;
  const f={p1:{combo:0},p2:{combo:1,moveName:'light1',hits:new Set([0])}};
  Broadcast.onEvent('hit',f.p2,f.p1,60,f); // enemy (a) hits the player (b); dmg 60 > current 40
  eq(Broadcast.state.viewers,0,'40-60 must floor at 0, not go negative')});
Test.add('Broadcast.tick decays 0.5 viewers/frame while the player is in HITSTUN',()=>{
  Broadcast.reset();Broadcast.state.viewers=100;Broadcast.state.peak=100;
  const f={p1:{state:'HITSTUN'}};
  for(let i=0;i<20;i++)Broadcast.tick(f);
  eq(Broadcast.state.viewers,90)});
Test.add('Broadcast.state.peak tracks the running max and is unaffected by later decay',()=>{
  Broadcast.reset();Broadcast._firstBlood=true;
  const f={p1:{combo:1,moveName:'light1',hits:new Set([0])},p2:{}};
  Broadcast.onEvent('hit',f.p1,f.p2,100,f); // +200
  eq(Broadcast.state.viewers,200);eq(Broadcast.state.peak,200);
  Broadcast.tick({p1:{state:'HITSTUN'}});
  eq(Broadcast.state.viewers,199.5);eq(Broadcast.state.peak,200,'peak must not drop with decay')});
Test.add('Broadcast source contains no Math.random or wall-clock reads (same rule as the sim boundary)',()=>{
  for(const fn of[Broadcast.reset,Broadcast.onEvent,Broadcast.tick,Broadcast._gain,Broadcast._setMult])
    ok(!/Math\.random|Date\.now|performance\.now/.test(fn.toString()),(fn.name||'?')+' must stay pure')});
Test.add('Meta.recordScore inserts, sorts desc by viewers, and caps at 10',()=>{
  Save.data=Meta.defaults();
  for(let i=0;i<12;i++)Meta.recordScore({viewers:i*100,champ:'carl',floor:1,date:'2026-01-0'+(i%9+1)});
  eq(Save.data.leaderboard.length,10,'must cap at 10');
  eq(Save.data.leaderboard[0].viewers,1100,'must be sorted descending');
  eq(Save.data.leaderboard[9].viewers,200,'the lowest 2 of 12 entries must have been dropped')});
Test.add('Meta.today() reads the injectable clock (Energy.now), not a raw Date.now()/new Date()',()=>{
  const orig=Energy.now;
  Energy.now=()=>new Date('2026-03-15T12:00:00Z').getTime();
  eq(Meta.today(),'2026-03-15');
  Energy.now=orig});
Test.add('G wires Broadcast: startFight resets it, a scripted landed hit raises viewers, and tick() drives decay',()=>{
  Save.data=Meta.defaults();
  G.startFight({p2:'donut',ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  eq(Broadcast.state.viewers,0,'G.startFight must call Broadcast.reset()');
  closeIn(G.fight);G.sim=true;
  for(let i=0;i<8;i++)G.tick();
  ok(Broadcast.state.viewers>0,'a landed player hit must raise viewers via G.onEvent -> Broadcast.onEvent');
  G.toTitle();G.sim=false});
// Fix round 1 (ruling): Broadcast.tick must fire once per actual SIM frame (f.step()), not once per
// G.tick() call -- during the KO slow-mo throttle (one real f.step() every 4th G.tick() call) the
// hitstun decay/multiplier-window countdown must advance at the fight's own frame rate, not 4x it.
Test.add('Broadcast.tick advances once per sim frame during KO slow-mo, not once per G.tick() call',()=>{
  Save.data=Meta.defaults();
  G.startFight({p2:'donut',ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  closeIn(G.fight);G.sim=true;
  Broadcast.onEvent('parry',G.fight.p1,G.fight.p2,0,G.fight); // arm a 180-frame x1.5 window
  eq(Broadcast.state.mult,1.5);
  G.fight.slowmo=90; // same throttle Fight.finish() arms on KO: one real f.step() per 4 G.tick() calls
  const frameBefore=G.fight.frame;
  for(let i=0;i<4;i++)G.tick(); // exactly one slow-mo'd sim step should occur
  eq(G.fight.frame,frameBefore+1,'sanity: slow-mo must still only have advanced the sim by 1 frame');
  eq(Broadcast._multFrames,179,'Broadcast.tick must have run exactly once (180-1), not 4 times (180-4)');
  G.toTitle();G.sim=false});
Test.add('a scripted quest KO win records a leaderboard entry (peak viewers) and the result text shows PEAK VIEWERS',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0,champ:'carl',ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(Save.data.leaderboard.length,1,'a quest win must record exactly one leaderboard entry');
  const entry=Save.data.leaderboard[0];
  eq(entry.champ,'carl');eq(entry.floor,1);ok(entry.viewers>0,'recorded viewers must be > 0');
  ok(!!entry.date,'entry must carry a date');
  const line=document.getElementById('resultLine').textContent;
  ok(line.includes('PEAK VIEWERS'),'result text must include PEAK VIEWERS: '+line);
  G.toTitle();G.sim=false});
Test.add('a quest win records the leaderboard date via the injectable clock (Energy.now), not a raw Date.now()',()=>{
  Save.data=Meta.defaults();
  const orig=Energy.now;
  Energy.now=()=>new Date('2027-01-02T00:00:00Z').getTime();
  G.startFight({floor:1,node:0,champ:'carl',ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(Save.data.leaderboard[0].date,'2027-01-02','recorded date must come from the injected clock');
  Energy.now=orig;
  G.toTitle();G.sim=false});
Test.add('a scripted arena win through G banks a leaderboard entry with a streak field (not floor)',()=>{
  Save.data=Meta.defaults();Save.data.arena={best:0,streak:0};
  G.startArena({ctrl1:Ctrl.script([L(0)]),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(Save.data.leaderboard.length,1,'an arena win must record exactly one leaderboard entry');
  const entry=Save.data.leaderboard[0];
  eq(entry.streak,1,'must record the post-win streak (Arena.record already ran by the time this reads it)');
  eq(entry.floor,undefined,'an arena entry must not carry a floor field');
  eq(entry.champ,'carl');
  G.toTitle();G.sim=false});
Test.add('a quest loss still shows PEAK VIEWERS on the result screen but records no leaderboard entry',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0,ctrl2:AI.make('basic',9),seed:3});
  G.fight.p1.hp=1;G.sim=true;
  for(let i=0;i<600;i++)G.tick();
  eq(G.state,'RESULT');
  eq(Save.data.leaderboard.length,0,'a loss must never record a leaderboard entry');
  ok(document.getElementById('resultLine').textContent.includes('PEAK VIEWERS'));
  G.toTitle();G.sim=false});
Test.add('HUD viewers counter is a cached label, updated only when the rounded value changes',()=>{
  G.startFight({p2:'donut',ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()});
  Broadcast.state.viewers=1234;
  Render.frame(G.fight);
  eq(Render.hudCache().viewersLabel,'VIEWERS 1,234','cached HUD label, not pixels');
  Broadcast.state.viewers=1234.4; // rounds to the same 1234 -- label must not change
  Render.frame(G.fight);
  eq(Render.hudCache().viewersLabel,'VIEWERS 1,234');
  Broadcast.state.viewers=5000;
  Render.frame(G.fight);
  eq(Render.hudCache().viewersLabel,'VIEWERS 5,000');
  G.toTitle()});
Test.add('the arena screen renders the top 5 leaderboard rows (viewers, champ, floor/streak, date)',()=>{
  Save.data=Meta.defaults();
  Save.data.leaderboard=[
    {viewers:900,champ:'carl',floor:2,date:'2026-09-01'},
    {viewers:800,champ:'carl',streak:3,date:'2026-09-02'}];
  Screens.arena();
  const lb=document.getElementById('arenaLeaderboard');
  eq(lb.querySelectorAll('.lbrow').length,2);
  ok(lb.textContent.includes('900')&&lb.textContent.includes('CARL'),'row must show viewers and champ name: '+lb.textContent);
  ok(lb.textContent.includes('FLOOR 2')&&lb.textContent.includes('STREAK 3'),
    'must show floor for one entry and streak for the other: '+lb.textContent);
  Screens.title()});
// Fix-wave item 2 (Critical): FIGHT AGAIN's 'again' button (bound once in G.init()) always replayed
// this.lastFightOpts verbatim, which for arena still carried the ALREADY-RESOLVED Arena.start()
// object (enemy/tier/hpMul) from the fight that just ended -- so a win at streak 0 re-fought the
// exact same (now stale) opponent while still banking the streak, unlimited farming of the easiest
// arena matchup with one button. Fix: the 'again' handler now routes through G.startArena() when
// G.mode==='arena' (which draws a fresh Arena.start() for the NEW streak) instead of startFight
// with the stale encounter object.
Test.add('Arena FIGHT AGAIN draws a fresh Arena.start() encounter for the post-win streak, not the stale resolved one (fix-wave item 2)',()=>{
  Save.data=Meta.defaults();Save.data.arena={best:0,streak:0};
  G.startArena({ctrl1:Ctrl.script([L(0)]),seed:1}); // streak 0 -> goblin/t1/hpMul 1.00
  const staleEnemyId=G.fight.p2.def.id,staleHp=G.fight.p2.maxHp;
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(Save.data.arena.streak,1,'the win must have banked the streak to 1 first');
  document.getElementById('again').click();
  eq(G.mode,'arena','FIGHT AGAIN must still be an arena fight');
  const expect=Arena.start(); // pure query off the now-current streak (1) -- goblin/t1 no longer,
  // per the Arena.start() sequence test: streak 1 -> skeleton/t1/hpMul 1.08
  eq(G.fight.p2.def.id,expect.enemy.id,'the new fight must use the CURRENT streak\'s encounter');
  eq(G.encounter.tier,expect.tier);
  ok(Math.abs(G.encounter.hpMul-expect.hpMul)<1e-9);
  ok(G.fight.p2.def.id!==staleEnemyId,'must not be the same stale enemy the fight just beat');
  ok(G.fight.p2.maxHp!==staleHp||G.fight.p2.def.id!==staleEnemyId,'must not be the stale resolved encounter object');
  G.toTitle();G.sim=false});
// --- Task 5.2: sponsor perks (Sponsors, secondWind, parry-window widening) ---------------------
Test.add('Sponsors.buy deducts gold and flags the perk owned; refuses (no mutation) when short or already owned',()=>{
  Save.data=Meta.defaults();Save.data.gold=800;
  ok(Sponsors.buy('dashers'));
  eq(Save.data.gold,0);
  ok(Sponsors.owned().includes('dashers'));
  eq(Sponsors.buy('dashers'),false,'already owned must refuse');
  eq(Save.data.gold,0,'a refused duplicate buy must not double-charge');
  Save.data.gold=100;
  eq(Sponsors.buy('insurance'),false,'short on gold must refuse');
  ok(!Sponsors.owned().includes('insurance'));
  eq(Save.data.gold,100,'a refused buy must never touch gold');
  ok(threw(()=>Sponsors.buy('nope')),'an unknown perk id must throw')});
Test.add('Sponsors.owned lists every purchased perk id, empty on a fresh save',()=>{
  Save.data=Meta.defaults();
  eq(Sponsors.owned().length,0,'a fresh save owns no perks');
  Save.data.gold=Sponsors.PERKS.dashers.cost+Sponsors.PERKS.insurance.cost;
  Sponsors.buy('dashers');Sponsors.buy('insurance');
  eq(Sponsors.owned().length,2);
  ok(Sponsors.owned().includes('dashers')&&Sponsors.owned().includes('insurance'))});
Test.add('Sponsors.apply folds every owned perk into opts: appends buffs, multiplies atkMul/viewersMul, sums parryWindow',()=>{
  Save.data=Meta.defaults();
  Save.data.gold=Sponsors.PERKS.dashers.cost+Sponsors.PERKS.insurance.cost+Sponsors.PERKS.secondWind.cost+Sponsors.PERKS.crowd.cost;
  Sponsors.buy('dashers');Sponsors.buy('insurance');Sponsors.buy('secondWind');Sponsors.buy('crowd');
  const o=Sponsors.apply({playerBuffs:['powerGain']});
  ok(o.playerBuffs.includes('powerGain'),'must not drop an existing playerBuffs entry');
  ok(o.playerBuffs.includes('secondWind'),'secondWind\'s own buff id must be appended');
  eq(o.playerBuffs.length,2,'no duplicate/extra buffs beyond the one existing entry plus secondWind');
  eq(o.statMul.atk,1.05,'dashers\' atkMul');
  eq(o.parryWindow,2,'insurance\'s parryWindow');
  eq(o.viewersMul,1.2,'crowd\'s viewersMul')});
Test.add('Sponsors.apply with no owned perks and no opts is a pure no-op extension',()=>{
  Save.data=Meta.defaults();
  const o=Sponsors.apply();
  eq(o.statMul.atk,1);eq(o.parryWindow,0);eq(o.viewersMul,1);eq(o.playerBuffs.length,0)});
Test.add('G.startFight applies the dashers perk\'s atkMul to p1\'s Stats.derive-d atk',()=>{
  Save.data=Meta.defaults();Save.data.gold=Sponsors.PERKS.dashers.cost;Sponsors.buy('dashers');
  const derived=Stats.derive(CHAMPS.carl,Save.data.roster.carl).atk;
  G.startFight({p1:'carl',p2:'donut',ai:'dummy'});
  eq(G.fight.p1.def.atk,Math.round(derived*1.05));
  G.toTitle()});
Test.add('G.startFight leaves p1 atk unmultiplied when no atk-affecting perk is owned',()=>{
  Save.data=Meta.defaults();
  const derived=Stats.derive(CHAMPS.carl,Save.data.roster.carl).atk;
  G.startFight({p1:'carl',p2:'donut',ai:'dummy'});
  eq(G.fight.p1.def.atk,derived);
  G.toTitle()});
Test.add('G.startFight sets the live p1 Fighter\'s parryBonus from the insurance perk\'s parryWindow (0 when unowned)',()=>{
  Save.data=Meta.defaults();
  G.startFight({p1:'carl',p2:'donut',ai:'dummy'});
  eq(G.fight.p1.parryBonus,0);
  G.toTitle();
  Save.data.gold=Sponsors.PERKS.insurance.cost;Sponsors.buy('insurance');
  G.startFight({p1:'carl',p2:'donut',ai:'dummy'});
  eq(G.fight.p1.parryBonus,2);
  G.toTitle()});
Test.add('G.startFight threads the crowd perk\'s viewersMul into Broadcast.reset',()=>{
  Save.data=Meta.defaults();
  G.startFight({p1:'carl',p2:'donut',ai:'dummy'});
  eq(Broadcast._viewersMul,1,'unowned crowd must leave the multiplier at 1');
  G.toTitle();
  Save.data.gold=Sponsors.PERKS.crowd.cost;Sponsors.buy('crowd');
  G.startFight({p1:'carl',p2:'donut',ai:'dummy'});
  eq(Broadcast._viewersMul,1.2);
  G.toTitle()});
Test.add('G.startFight applies an owned perk\'s buff (secondWind) to p1 via the same Buffs.apply path as playerBuffs',()=>{
  Save.data=Meta.defaults();Save.data.gold=Sponsors.PERKS.secondWind.cost;Sponsors.buy('secondWind');
  G.startFight({p1:'carl',p2:'donut',ai:'dummy'});
  ok(G.fight.p1.buffs.some(b=>b.id==='secondWind'),'p1 must hold the secondWind buff');
  G.toTitle();
  Save.data=Meta.defaults();
  G.startFight({p1:'carl',p2:'donut',ai:'dummy',playerBuffs:['powerGain']});
  ok(G.fight.p1.buffs.some(b=>b.id==='powerGain'),'an explicit playerBuffs entry must still apply with no perks owned');
  eq(G.fight.p1.buffs.length,1);
  G.toTitle()});
Test.add('Broadcast.reset({viewersMul}) scales a positive gain (the crowd perk) but a plain reset() never carries a stale multiplier over',()=>{
  Broadcast.reset({viewersMul:1.2});Broadcast._firstBlood=true;
  const f={p1:{combo:1,moveName:'light1',hits:new Set([0])},p2:{}};
  Broadcast.onEvent('hit',f.p1,f.p2,60,f); // base 60*2*1=120, crowd x1.2 = 144
  eq(Broadcast.state.viewers,144);
  Broadcast.reset();
  eq(Broadcast._viewersMul,1,'a bare reset() must reset to no multiplier, not keep the last one')});
Test.add('secondWind heals the holder 15% maxHp exactly once, the first frame hp is <=20% maxHp, never again',()=>{
  const f=mkFight();Buffs.apply(f,f.p2,['secondWind']);
  f.p2.hp=f.p2.maxHp*0.2;
  run(f,1);
  eq(f.p2.hp,Math.round(f.p2.maxHp*0.2)+Math.round(f.p2.maxHp*0.15),'must heal +15% maxHp on the triggering frame');
  const healedHp=f.p2.hp;
  run(f,120);
  eq(f.p2.hp,healedHp,'must never heal again once spent, even while still under 20%');
  f.p2.hp=f.p2.maxHp*0.05;run(f,1);
  eq(f.p2.hp,f.p2.maxHp*0.05,'must not fire a second time even if hp drops low again later')});
Test.add('secondWind never fires while the holder stays above 20% maxHp',()=>{
  const f=mkFight();Buffs.apply(f,f.p2,['secondWind']);
  f.p2.hp=f.p2.maxHp*0.5;
  run(f,60);
  eq(f.p2.hp,f.p2.maxHp*0.5,'no heal until hp actually drops to <=20%')});
Test.add('a press at PARRY_WINDOW+1 frames parries with the insurance perk\'s +2 parryBonus, but just blocks without it',()=>{
  // L(2) fires the light exactly on the attacker's 3rd step call; held block from step 1 gives the
  // defender blockAge===7 (PARRY_WINDOW+1) on the exact step the attack's active frame lands — see
  // this test's own derivation in the Task 5.2 report for the full frame-by-frame walkthrough.
  const withBonus=mkFight({ctrl1:Ctrl.script([L(2)]),ctrl2:Ctrl.hold({block:true})});closeIn(withBonus);
  withBonus.p2.parryBonus=2;
  run(withBonus,7);
  eq(withBonus.log[withBonus.log.length-1].type,'parry','blockAge 7 <= PARRY_WINDOW(6)+2 must parry');
  const noBonus=mkFight({ctrl1:Ctrl.script([L(2)]),ctrl2:Ctrl.hold({block:true})});closeIn(noBonus);
  run(noBonus,7);
  eq(noBonus.log[noBonus.log.length-1].type,'block','blockAge 7 > PARRY_WINDOW(6) with no bonus must just block')});
Test.add('the kiosk renders a PERKS row per Sponsors.PERKS entry, showing OWNED for an already-purchased perk and BUY otherwise',()=>{
  Save.data=Meta.defaults();Save.data.gold=Sponsors.PERKS.dashers.cost;Sponsors.buy('dashers');
  Screens.shop();
  const rows=[...document.querySelectorAll('#shopPerks .perkrow')];
  eq(rows.length,Object.keys(Sponsors.PERKS).length);
  const dashersBtn=document.getElementById('buyPerkDashers');
  ok(dashersBtn,'buyPerkDashers must exist');
  eq(dashersBtn.textContent,'OWNED');ok(dashersBtn.disabled,'an owned perk\'s button must be disabled');
  const insuranceBtn=document.getElementById('buyPerkInsurance');
  eq(insuranceBtn.textContent,'BUY');
  Screens.title()});
// Fix-wave item 3 (final review, Important): every kiosk perk row must show what it actually does,
// not just its name and gold cost -- see Sponsors.DESC's own comment (13_broadcast.js) for the exact
// wording ruling #2 specified per perk.
Test.add('every kiosk PERKS row shows its Sponsors.DESC effect text',()=>{
  Save.data=Meta.defaults();
  Screens.shop();
  const rows=[...document.querySelectorAll('#shopPerks .perkrow')];
  eq(rows.length,Object.keys(Sponsors.PERKS).length);
  for(const id in Sponsors.PERKS){
    const row=[...document.querySelectorAll('#shopPerks .perkrow')]
      .find(r=>r.textContent.includes(Sponsors.LABELS[id]||id.toUpperCase()));
    ok(row,'a row for '+id+' must exist');
    ok(row.textContent.includes(Sponsors.DESC[id]),
      id+'\'s row ('+row.textContent+') must contain its DESC ('+Sponsors.DESC[id]+')')}
  Screens.title()});
Test.add('clicking a kiosk PERKS BUY button purchases it and re-renders as OWNED',()=>{
  Save.data=Meta.defaults();Save.data.gold=Sponsors.PERKS.insurance.cost;
  Screens.shop();
  document.getElementById('buyPerkInsurance').click();
  eq(Save.data.gold,0);
  ok(Sponsors.owned().includes('insurance'));
  eq(document.getElementById('buyPerkInsurance').textContent,'OWNED');
  Screens.title()});
// Task 4.5: Screens (title, map, roster, crystal, shop, arena, result) ---------------------------
Test.add('every Phase 4 screen\'s DOM ids exist',()=>{
  const ids=['title','map','roster','crystal','shop','arena','result','pauseMenu',
    'btnCampaign','btnArenaMenu','btnRoster','btnKiosk','btnExhibition','titleMute',
    'mapTabs','mapEnergy','mapPath','mapBack',
    'rosterCards','rosterBack','crystalCards','crystalBack',
    'shopCurrency','shopCards','shopBack',
    'arenaStreak','arenaBest','arenaEnemy','arenaFight','arenaBack',
    'resultTitle','resultLine','again','resultTitleBtn'];
  for(const id of ids)ok(document.getElementById(id),'#'+id+' must exist')});
Test.add('G.bootScreens() binds the title screen\'s buttons on real page load (fix round 1, Critical: they were unbound until some other Screens.* function had run once -- Screens.renderTitle is the only place they get an onclick, and nothing called any Screens function at boot)',()=>{
  Screens._current=null;                       // simulate a fresh load: no Screens.* has rendered yet
  document.getElementById('btnCampaign').onclick=null;
  // Task 5.3: CAMPAIGN on a fresh (!tutorialDone) save now starts the tutorial instead of the map --
  // orthogonal to this test's own concern (button binding), so pin tutorialDone here to keep testing
  // exactly what it always tested.
  Save.data.tutorialDone=true;
  G.bootScreens();
  ok(typeof document.getElementById('btnCampaign').onclick==='function','CAMPAIGN must be bound after boot');
  document.getElementById('btnCampaign').click();
  eq(Screens._current,'map','clicking the now-bound button must actually show the map screen');
  G.toTitle()});
Test.add('G.toTitle() shows the title screen only (every other Phase 4 overlay and pauseMenu hidden)',()=>{
  Save.data=Meta.defaults();
  Screens.show('roster'); // start from some other screen so this isn't a no-op
  G.toTitle();
  for(const id of['map','roster','crystal','shop','arena','result','pauseMenu'])
    ok(!document.getElementById(id).classList.contains('show'),id+' must be hidden');
  ok(document.getElementById('title').classList.contains('show'))});
Test.add('Screens.show(\'map\') renders FLOORS[0].nodes.length non-boss .node elements with state classes matching Quest.floor(1), plus one .node.boss',()=>{
  Save.data=Meta.defaults();
  Screens._floor=1; // Screens.show bypasses Screens.map()'s own arg-stashing; set the floor directly
  Screens.show('map');
  const f=Quest.floor(1);
  // Task 5.3: scoped to #mapPath specifically -- the map's own permanently-open TUTORIAL entry lives
  // in #mapTabs (not #mapPath), so a bare '#map .node' scope would also match it.
  const nodeEls=[...document.querySelectorAll('#mapPath .node:not(.boss)')];
  eq(nodeEls.length,FLOORS[0].nodes.length);
  nodeEls.forEach((el,i)=>ok(el.classList.contains(f.nodes[i].state),'node '+i+' state class'));
  const bossEl=document.querySelector('#map .node.boss');
  ok(bossEl&&bossEl.classList.contains(f.boss.state),'boss node state class');
  Screens.title()});
Test.add('the map screen\'s energy pip row has energy.max pips, energy.n of them .full',()=>{
  Save.data=Meta.defaults();
  Save.data.energy.ts=Energy.now(); // renderMap calls Energy.tick(); pin ts to "now" so a fresh
  Save.data.energy.n=3;             // ts:0 default doesn't regen this straight back to max
  Screens.map(1);
  const pips=[...document.querySelectorAll('#mapEnergy .pip')];
  eq(pips.length,Save.data.energy.max);
  eq(pips.filter(p=>p.classList.contains('full')).length,3);
  Screens.title()});
// Fix-wave item 3 (Important): six node rows (5 doors + boss) at the old 44px min-height + 5x6px
// gaps summed to 294px into a 272px #mapPath box, so `overflow:hidden` clipped both ends -- BOSS cut
// off at the top, DOOR 1 half-hidden behind BACK (final-review-verdict.md issue 3, measured
// scrollHeight 283 vs clientHeight 272). .node min-height dropped to 40px, .path gap to 4px, and the
// energy row/BACK spacing tightened so a full floor's six rows actually fit.
Test.add('the map path fits a full floor with no clipping/scroll at 854x480 (fix-wave item 3)',()=>{
  Save.data=Meta.defaults();
  for(let i=0;i<5;i++)Save.data.floors[1].nodes[i]='open'; // worst case: every row rendered, none locked-thin
  Save.data.floors[1].boss='open';
  Screens.map(1);
  const path=document.getElementById('mapPath');
  ok(path.scrollHeight<=path.clientHeight,
    '#mapPath must not overflow: scrollHeight '+path.scrollHeight+' > clientHeight '+path.clientHeight);
  Screens.title()});
// Fix-wave item 6 (Important): a refused node gave no visible feedback -- map buttons were never
// `disabled`, so a locked door looked and clicked exactly like an open one, and G.refuseQuest's
// message went to #toast, which sat BEFORE every overlay in the DOM (00_head.html), so the map
// overlay's opaque background painted over it -- set and never seen (final-review-verdict.md issue
// 6). Fix: map node buttons are disabled when not 'open'; the refusal renders in #mapMsg (inside the
// map panel itself, bypassing G.say's frame-throttle entirely, which was separately broken while
// browsing since G.frameNow never advances outside a fight); #toast moved after every overlay in the
// DOM so it still paints on top during a fight.
Test.add('a locked map node is disabled (cannot be clicked to start a fight); an open node with no energy shows the refusal in #mapMsg (fix-wave item 6)',()=>{
  Save.data=Meta.defaults();
  Screens.map(1);
  const nodes=[...document.querySelectorAll('#mapPath .node:not(.boss)')];
  eq(nodes[0].disabled,false,'node 0 starts open, must be clickable');
  eq(nodes[1].disabled,true,'node 1 starts locked, must be disabled');
  const origNow=Energy.now;
  try{
    let t=5000000;Energy.now=()=>t;
    Save.data.energy.n=0;Save.data.energy.ts=t; // no regen pending: exactly 6:00 to the next point
    Screens.map(1);
    eq(document.getElementById('mapMsg').textContent,'','no stale refusal text before any click');
    document.querySelectorAll('#mapPath .node:not(.boss)')[0].click();
    eq(G.state,'TITLE','a refused start must not have begun a fight');
    eq(document.getElementById('mapMsg').textContent,'NOT ENOUGH ENERGY — next in 6:00')
  }finally{Energy.now=origNow}
  Screens.title()});
Test.add('a map node click starts the quest fight via G.startFight and records the map screen (with its floor) as the fight\'s origin',()=>{
  Save.data=Meta.defaults();
  Screens.map(1);
  document.querySelectorAll('#mapPath .node:not(.boss)')[0].click();
  eq(G.mode,'quest');eq(G.state,'FIGHT');
  eq(Screens._origin.name,'map');eq(Screens._origin.args[0],1);
  G.toTitle();G.sim=false});
Test.add('after a quest win, CONTINUE (resultTitleBtn) returns to the map screen at the floor the node was fought on',()=>{
  Save.data=Meta.defaults();
  Screens.map(1);
  document.querySelectorAll('#mapPath .node:not(.boss)')[0].click(); // floor 1, node 0: sets G.mode/origin
  eq(Screens._origin.name,'map');eq(Screens._origin.args[0],1);
  G.toTitle(); // the click above used Ctrl.player() (no scripted attacks, so it'd never KO within a
  // bounded tick budget); re-fight the same node with a scripted p1 so it actually ends, keeping the
  // origin the click already recorded (toTitle doesn't touch Screens._origin).
  G.startFight({floor:1,node:0,champ:'carl',ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  document.getElementById('resultTitleBtn').click();
  eq(Screens._current,'map');eq(Screens._floor,1);
  ok(document.getElementById('map').classList.contains('show'));
  G.toTitle();G.sim=false});
Test.add('Screens.show(\'roster\') renders one .card per roster entry, with exactly the active one marked .active',()=>{
  Save.data=Meta.defaults();
  Save.data.roster.katia={stars:3,rank:1,level:1,xp:0,shards:0};
  Screens.show('roster');
  const cards=[...document.querySelectorAll('#roster .card')];
  eq(cards.length,Object.keys(Save.data.roster).length);
  eq(cards.filter(c=>c.classList.contains('active')).length,1);
  Screens.title()});
// Fix-wave item 5: after shards became the only thing crystals actually produce once the roster is
// full, the roster screen still showed stars/level but never the shard count itself -- the one
// number that says how close a champion is to its next star. Cards now show it as "N/5".
Test.add('roster cards show the shard count as N/5 next to the stars (fix-wave item 5)',()=>{
  Save.data=Meta.defaults();Save.data.roster.carl.shards=3;
  Screens.show('roster');
  const card=document.querySelector('#roster .card');
  ok(card.textContent.includes('3/5'),'card must show the shard count: '+card.textContent);
  Screens.title()});
Test.add('roster card buttons mutate only through Roster.levelUp/rankUp/setActive',()=>{
  Save.data=Meta.defaults();Save.data.iso=10;
  Save.data.roster.katia={stars:3,rank:1,level:1,xp:0,shards:0};
  Screens.roster();
  const carlCard=document.querySelectorAll('#roster .card')[0]; // insertion order: carl, katia
  carlCard.querySelectorAll('button')[0].click(); // LEVEL UP
  eq(Save.data.roster.carl.level,2,'Roster.levelUp must have run');eq(Save.data.iso,0);
  Screens.title()});
Test.add('crystal OPEN is disabled when unaffordable and enabled once gold reaches the basic cost (500)',()=>{
  Save.data=Meta.defaults();Save.data.gold=0;
  Screens.show('crystal');
  ok(document.getElementById('openBtn_basic').disabled,'disabled at gold 0');
  Save.data.gold=500;
  Screens.refresh();
  ok(!document.getElementById('openBtn_basic').disabled,'enabled at gold 500');
  Screens.title()});
Test.add('a crystal reveal completes after exactly 40 G.tick() frames (frame-counted, not wall-clock) and then holds',()=>{
  Save.data=Meta.defaults();Save.data.gold=500;Save.data.seed=1;
  Screens.crystal();
  document.getElementById('openBtn_basic').click();
  ok(Screens._reveal&&Screens._reveal.frame===0);
  G.sim=true;G.simFrames(39);
  eq(document.getElementById('revealText_basic').textContent,'','not revealed yet at frame 39');
  G.simFrames(1);
  eq(Screens._reveal.frame,40);
  ok(document.getElementById('revealText_basic').textContent.length>0,'revealed at frame 40');
  G.simFrames(20); // ticks past 40 must not keep advancing the counter
  eq(Screens._reveal.frame,40);
  Screens.title();G.sim=false});
// Fix-wave item 9 (Phase 5 seams, ruled): the kiosk used to be three hand-copied blocks (basic
// crystal, premium crystal, ISO pack), each with its own cost/label/afford check baked in -- adding
// a fourth sponsor perk meant copying a fourth block. Meta.SHOP_ITEMS is now the single table the
// kiosk renders from (cost/label per item); Meta.buy(itemId) is the generic purchase (refuses when
// short, applies a currency `grant`, or defers to `run` for a crystal item, whose own Crystal.open
// already does its cost check/deduction); Meta.buyIso delegates to Meta.buy('isoPack'). DOM ids
// follow the item id (buyBasicCrystal/buyPremiumCrystal/buyIsoPack), replacing the old
// buyBasic/buyPremium/buyIso.
Test.add('shop BASIC CRYSTAL opens a crystal immediately on buy (ruling: buy == Crystal.open + reveal): deducts 500 gold and mutates the roster',()=>{
  Save.data=Meta.defaults();Save.data.gold=500;Save.data.seed=1;
  Screens.shop();
  const before=JSON.stringify(Save.data.roster);
  document.getElementById('buyBasicCrystal').click();
  eq(Save.data.gold,0,'500 gold deducted');
  ok(JSON.stringify(Save.data.roster)!==before,'roster must change (new champ or shards) via Crystal.open');
  eq(Screens._current,'crystal','buying navigates to the crystal screen to show the reveal');
  Screens.title()});
Test.add('Meta.buy purchases a plain currency-grant SHOP_ITEMS entry (isoPack), refusing (unchanged) when short',()=>{
  Save.data=Meta.defaults();Save.data.gold=500;
  ok(Meta.buy('isoPack'));
  eq(Save.data.gold,300);eq(Save.data.iso,60);
  Save.data.gold=100;
  const before=JSON.stringify(Save.data);
  eq(Meta.buy('isoPack'),false,'short on gold');
  eq(JSON.stringify(Save.data),before)});
Test.add('Meta.buy runs Crystal.open for a run-type SHOP_ITEMS entry (basicCrystal)',()=>{
  Save.data=Meta.defaults();Save.data.gold=999999;Save.data.seed=1;
  const before=JSON.stringify(Save.data.roster);
  const r=Meta.buy('basicCrystal');
  ok(r,'basicCrystal must run Crystal.open and return its pull result');
  eq(Save.data.gold,999999-500);
  ok(JSON.stringify(Save.data.roster)!==before,'roster must change via the underlying Crystal.open')});
Test.add('Meta.buyIso converts 200 gold into 60 iso, refuses when short (delegates to Meta.buy(\'isoPack\'))',()=>{
  Save.data=Meta.defaults();Save.data.gold=500;
  ok(Meta.buyIso());
  eq(Save.data.gold,300);eq(Save.data.iso,60);
  Save.data.gold=100;
  const before=JSON.stringify(Save.data);
  eq(Meta.buyIso(),false,'short on gold');
  eq(JSON.stringify(Save.data),before)});
Test.add('shop ISO PACK buy button calls Meta.buyIso',()=>{
  Save.data=Meta.defaults();Save.data.gold=500;
  Screens.shop();
  document.getElementById('buyIsoPack').click();
  eq(Save.data.gold,300);eq(Save.data.iso,60);
  Screens.title()});
Test.add('the kiosk renders one card per Meta.SHOP_ITEMS entry, with its own cost/label',()=>{
  Save.data=Meta.defaults();
  Screens.shop();
  const cards=[...document.querySelectorAll('#shopCards .kcard')];
  eq(cards.length,Object.keys(Meta.SHOP_ITEMS).length);
  ok(document.getElementById('buyBasicCrystal'),'basicCrystal button must exist');
  ok(document.getElementById('buyPremiumCrystal'),'premiumCrystal button must exist');
  ok(document.getElementById('buyIsoPack'),'isoPack button must exist');
  Screens.title()});
Test.add('the title screen\'s CAMPAIGN/ARENA/ROSTER/KIOSK buttons route to the matching screens',()=>{
  Save.data=Meta.defaults();
  // Task 5.3: CAMPAIGN on a fresh save now starts the tutorial instead -- see the dedicated first-run
  // routing test below; this one is about the plain screen-routing wiring, so pin tutorialDone true.
  Save.data.tutorialDone=true;
  Screens.title();document.getElementById('btnRoster').click();eq(Screens._current,'roster');
  Screens.title();document.getElementById('btnKiosk').click();eq(Screens._current,'shop');
  Screens.title();document.getElementById('btnArenaMenu').click();eq(Screens._current,'arena');
  Screens.title();document.getElementById('btnCampaign').click();eq(Screens._current,'map');eq(Screens._floor,1);
  G.toTitle()});
Test.add('title EXHIBITION starts the old quick fight (carl vs donut, mode exhibition) exactly like the old fightBtn',()=>{
  Save.data=Meta.defaults();
  Screens.title();
  document.getElementById('btnExhibition').click();
  eq(G.mode,'exhibition');eq(G.fight.p2.def.id,'donut');eq(G.champ,'carl');
  G.toTitle()});
Test.add('the arena screen\'s FIGHT button starts G.startArena with arena as the fight\'s origin, and QUIT/CONTINUE return to it',()=>{
  Save.data=Meta.defaults();
  Screens.arena();
  document.getElementById('arenaFight').click(); // Ctrl.player() p1: proves mode+origin wiring only
  eq(G.mode,'arena');eq(Screens._origin.name,'arena');
  G.toTitle(); // re-fight with a scripted p1 so this one actually reaches RESULT within the tick
  // budget below; Screens._origin is left exactly as the click above set it (toTitle doesn't touch it).
  G.startArena({ctrl1:Ctrl.script([L(0)]),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  G.backToOrigin();
  eq(Screens._current,'arena');
  G.toTitle();G.sim=false});
Test.add('FIGHT AGAIN is hidden after a quest win (the node is now done; replaying it would just refuse) and shown after other outcomes',()=>{
  Save.data=Meta.defaults();
  G.startFight({floor:1,node:0,ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(document.getElementById('again').style.display,'none','hidden after a quest win');
  G.toTitle();G.sim=false;
  Save.data=Meta.defaults();
  G.startArena({ctrl1:Ctrl.script([L(0)]),seed:1});
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  ok(document.getElementById('again').style.display!=='none','shown after an arena win');
  G.toTitle();G.sim=false});
Test.add('Screens.result({gold,iso,xp},true) fills VICTORY and the reward line',()=>{
  Screens.result({gold:120,iso:20,xp:30},true);
  eq(document.getElementById('resultTitle').textContent,'VICTORY');
  const line=document.getElementById('resultLine').textContent;
  ok(line.includes('+120 G'),'gold in reward line: '+line);
  ok(line.includes('+20 ISO'),'iso in reward line: '+line);
  ok(line.includes('+30 XP'),'xp in reward line: '+line);
  Screens.title()});
Test.add('Screens.result(null,false) fills DEFEATED with no reward line',()=>{
  Screens.result(null,false);
  eq(document.getElementById('resultTitle').textContent,'DEFEATED');
  Screens.title()});
Test.add('starting a fight from any browsing screen hides that screen (it must not linger over the fight)',()=>{
  Save.data=Meta.defaults();
  for(const show of[()=>Screens.map(1),()=>Screens.roster(),()=>Screens.crystal(),()=>Screens.shop(),()=>Screens.arena()]){
    show();
    const shown=Screens._current;
    ok(document.getElementById(shown).classList.contains('show'),shown+' must be visible before the fight starts');
    G.startFight({p2:'donut'});
    ok(!document.getElementById(shown).classList.contains('show'),shown+' must be hidden once G.startFight begins');
    G.toTitle()}});
// Fix-wave item 10 (minors, one commit) ----------------------------------------------------------
Test.add('.panel buttons are real 44px+ touch targets (fix-wave item 10)',()=>{
  Screens.title();
  const b=document.getElementById('btnCampaign');
  ok(b.getBoundingClientRect().height>=44,'.panel button height must be >=44px, got '+b.getBoundingClientRect().height);
  Screens.title()});
Test.add('a locked boss node shows the lock icon, not the crown (fix-wave item 10: .node.locked/.node.boss specificity)',()=>{
  Save.data=Meta.defaults(); // boss starts locked
  Screens.map(1);
  const bossEl=document.querySelector('#map .node.boss');
  const lockedNodeEl=document.querySelectorAll('#mapPath .node:not(.boss)')[1]; // node 1 starts locked too
  const bossContent=getComputedStyle(bossEl,'::before').content;
  const lockedContent=getComputedStyle(lockedNodeEl,'::before').content;
  eq(bossContent,lockedContent,'a locked boss must show the same icon as a plain locked node (the lock, not the crown)');
  Screens.title()});
Test.add('re-entering the crystal screen clears a prior pull\'s reveal (fix-wave item 10: _reveal never cleared)',()=>{
  Save.data=Meta.defaults();Save.data.gold=500;Save.data.seed=1;
  Screens.crystal();
  document.getElementById('openBtn_basic').click();
  G.sim=true;G.simFrames(40);
  ok(document.getElementById('revealText_basic').textContent.length>0,'a reveal must show after a real pull');
  Screens.title();
  Screens.crystal(); // re-enter without a new pull
  eq(Screens._reveal,null,'_reveal must be cleared on re-entering the crystal screen');
  eq(document.getElementById('revealText_basic').textContent,'','no stale reveal text on re-entry');
  G.sim=false;Screens.title()});
Test.add('the map and crystal screens show a gold/units/iso currency strip (fix-wave item 10)',()=>{
  Save.data=Meta.defaults();Save.data.gold=123;Save.data.units=45;Save.data.iso=6;
  Screens.map(1);
  let el=document.getElementById('mapCurrency');
  ok(el,'#mapCurrency must exist');
  ok(el.textContent.includes('123')&&el.textContent.includes('45')&&el.textContent.includes('6'),
    'map currency strip must show gold/units/iso: '+el.textContent);
  Screens.crystal();
  el=document.getElementById('crystalCurrency');
  ok(el,'#crystalCurrency must exist');
  ok(el.textContent.includes('123'),'crystal currency strip must show gold: '+el.textContent);
  Screens.title()});
Test.add('Meta.migrate repoints a stale Save.data.active to an owned champion (fix-wave item 10: xp grants were silently dropped)',()=>{
  const d=Meta.migrate({v:2,active:'mongo',roster:{carl:{stars:1,rank:1,level:1,xp:0,shards:0}}});
  eq(d.active,'carl','active must be repointed to an owned champion once mongo turns out to be unowned');
  const d2=Meta.migrate({v:2,active:'carl',roster:{carl:{stars:1,rank:1,level:1,xp:0,shards:0}}});
  eq(d2.active,'carl','an already-valid active must be left alone')});
Test.add('title screen: CAMPAIGN is the primary button, others secondary, SOUND in its own small row (fix-wave item 10)',()=>{
  Screens.title();
  const campaign=document.getElementById('btnCampaign'),roster=document.getElementById('btnRoster');
  ok(campaign.classList.contains('primary'),'CAMPAIGN must be the primary button');
  ok(!roster.classList.contains('primary'),'ROSTER must be a secondary button, not primary');
  const cs=getComputedStyle(campaign),rs=getComputedStyle(roster);
  ok(parseFloat(cs.fontSize)>parseFloat(rs.fontSize),'CAMPAIGN must read visually larger than a secondary button');
  ok(document.getElementById('titleMute').closest('.settingsrow'),'SOUND must be moved into its own small settings row');
  Screens.title()});
// --- Task 5.4: settings, orientation guard, haptics, audio unlock, share card -------------------
Test.add('Meta.defaults().settings has the frozen Phase 5 shape',()=>{
  const s=Meta.defaults().settings;
  eq(s.reduceMotion,false);eq(s.haptics,true);eq(s.leftHanded,false);
  eq(s.useAtlas,false);eq(s.sfx,true);eq(s.announcer,true)});
Test.add('Meta.migrate (v2) backfills a missing settings key without discarding an already-present one',()=>{
  const d=Meta.migrate({v:2,settings:{sfx:false}});
  eq(d.settings.sfx,false,'an existing key must survive migration');
  eq(d.settings.haptics,true,'a missing key must be backfilled to its default');
  eq(d.settings.reduceMotion,false,'another missing key must also be backfilled')});
Test.add('Meta.migrate (v1) merges the old settings object onto the new defaults instead of replacing them',()=>{
  const d=Meta.migrate({v:1,gold:10,settings:{mute:true}});
  eq(d.settings.mute,true,'an old v1 settings field must be preserved');
  eq(d.settings.haptics,true,'a new Phase 5 default must still be present, not lost to a v1 replace')});
Test.add('Screens.settings() renders one 44px+ toggle row per Screens.SETTINGS_ROWS entry, reflecting Save.data.settings',()=>{
  Save.data=Meta.defaults();Save.data.settings.reduceMotion=true;
  Screens.settings();
  const rows=[...document.querySelectorAll('#settingsRows .setrow')];
  eq(rows.length,Screens.SETTINGS_ROWS.length);
  for(const el of rows)ok(parseFloat(getComputedStyle(el).minHeight)>=44,el.id+' must be a real touch target');
  ok(document.getElementById('set_reduceMotion').textContent.includes('ON'),'reduceMotion true must render ON');
  ok(document.getElementById('set_haptics').textContent.includes('ON'),'haptics defaults true');
  Screens.title()});
Test.add('clicking a settings toggle row flips and persists Save.data.settings, then re-renders the label',()=>{
  Save.data=Meta.defaults();
  Screens.settings();
  eq(Save.data.settings.sfx,true);
  document.getElementById('set_sfx').click();
  eq(Save.data.settings.sfx,false);
  ok(document.getElementById('set_sfx').textContent.includes('OFF'));
  document.getElementById('set_sfx').click();
  eq(Save.data.settings.sfx,true);
  ok(document.getElementById('set_sfx').textContent.includes('ON'));
  Screens.title()});
Test.add('Screens.settings() BACK returns to the title screen; the title screen\'s SETTINGS button opens it',()=>{
  Screens.title();
  document.getElementById('btnSettings').click();
  eq(Screens._current,'settings');
  document.getElementById('settingsBack').click();
  eq(Screens._current,'title')});
Test.add('G.applySettings toggles the left-handed body class from Save.data.settings.leftHanded',()=>{
  Save.data=Meta.defaults();
  Save.data.settings.leftHanded=true;G.applySettings();
  ok(document.body.classList.contains('left-handed'));
  Save.data.settings.leftHanded=false;G.applySettings();
  ok(!document.body.classList.contains('left-handed'))});
Test.add('leftHanded mirrors the on-screen button layout: #btnBlock ends up right of #btnPunch/#btnKick/#btnPower',()=>{
  Save.data=Meta.defaults();
  G.startFight({p2:'donut',ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()}); // shows #btns (collapses to a
  // zero rect while hidden pre-fight -- see G.positionToast's own comment)
  document.body.classList.remove('left-handed');
  const block=document.getElementById('btnBlock'),punch=document.getElementById('btnPunch'),
        kick=document.getElementById('btnKick'),power=document.getElementById('btnPower');
  ok(block.getBoundingClientRect().left<punch.getBoundingClientRect().left,'normal layout: BLOCK left of PUNCH');
  document.body.classList.add('left-handed');
  ok(block.getBoundingClientRect().left>punch.getBoundingClientRect().left,'left-handed: BLOCK right of PUNCH');
  ok(block.getBoundingClientRect().left>kick.getBoundingClientRect().left,'left-handed: BLOCK right of KICK');
  ok(block.getBoundingClientRect().left>power.getBoundingClientRect().left,'left-handed: BLOCK right of POWER');
  document.body.classList.remove('left-handed');
  G.toTitle()});
// Task 5.6: leftHanded also mirrors the CANVAS gesture zones (Input.zoneFor/swipeDx, 30_input.js),
// not just the on-screen button layout above -- defense moves from the left third to the right
// third, offense from the right two-thirds to the left two-thirds, and swipe direction mirrors with
// them so "swipe away from the defense zone" still reads as dashBack and "swipe away from the
// offense zone" still reads as medium, whichever side each zone is currently on.
Test.add('leftHanded mirrors the canvas defense/offense zones: x=W-20 holds block, x=20 queues light',()=>{
  Save.data=Meta.defaults();Save.data.settings.leftHanded=true;
  withFight(()=>{
    const def=tap(1,W-20);def.down();
    eq(Input.held.block,true,'a pointerdown at x=W-20 must hold block when leftHanded');
    def.up();
    eq(Input.held.block,false,'releasing the def-zone pointer must clear block');
    const off=tap(2,20);off.down();off.up();
    ok(Input.q.includes('light'),'a tap (no swipe) at x=20 must queue light when leftHanded')});
  Save.data.settings.leftHanded=false});
Test.add('leftHanded mirrors swipe direction: a swipe further right in the (now right-side) defense zone still queues dashBack, and further left in the (now left-side) offense zone still queues medium',()=>{
  Save.data=Meta.defaults();Save.data.settings.leftHanded=true;
  withFight(()=>{
    const r=canvas.getBoundingClientRect();
    const move=(id,x)=>canvas.dispatchEvent(new PointerEvent('pointermove',
      {pointerId:id,clientX:r.left+x*r.width/W,clientY:r.top+r.height/2,bubbles:true}));
    const def=tap(1,W-20);def.down();move(1,W-20+Input.SWIPE+5);
    ok(Input.q.includes('dashBack'),'swiping further right inside the mirrored defense zone must queue dashBack');
    ok(!Input.held.block,'the swipe must clear the hold-block it started with, like normal mode');
    def.up();Input.q.length=0;
    const off=tap(2,20);off.down();move(2,20-Input.SWIPE-5);
    ok(Input.q.includes('medium'),'swiping further left inside the mirrored offense zone must queue medium');
    off.up()});
  Save.data.settings.leftHanded=false});
Test.add('reduceMotion zeroes camera shake and screen flash but leaves popups untouched',()=>{
  Save.data=Meta.defaults();Save.data.settings.reduceMotion=true;
  FX.reset();
  FX.push({kind:'shake',amt:10});FX.push({kind:'flash',frames:6});
  FX.push({kind:'popup',x:0,y:0,text:'5',col:'#fff'});
  eq(FX.shake,0,'shake must stay 0 under reduceMotion');
  eq(FX.flash,0,'flash must stay 0 under reduceMotion');
  eq(FX.list.length,1,'a popup must still be queued under reduceMotion');
  Save.data.settings.reduceMotion=false;
  FX.reset();
  FX.push({kind:'shake',amt:10});FX.push({kind:'flash',frames:6});
  ok(FX.shake>0,'shake must accumulate normally once reduceMotion is off');
  ok(FX.flash>0,'flash must accumulate normally once reduceMotion is off')});
Test.add('settings.sfx===false makes G.playRecipe (every Audio.recipes.* call site) a no-op, even against a stubbed recipe',()=>{
  Save.data=Meta.defaults();Save.data.settings.sfx=false;
  let called=false;const stub=()=>{called=true};
  G.playRecipe(stub);
  eq(called,false,'a stubbed recipe must not be called when sfx is off');
  Save.data.settings.sfx=true;
  G.playRecipe(stub);
  eq(called,true,'the same stub must be called once sfx is back on')});
Test.add('a landed hit does not call Audio.recipes.light1 when settings.sfx is off',()=>{
  Save.data=Meta.defaults();Save.data.settings.sfx=false;
  const orig=Audio.recipes.light1;let called=false;
  Audio.recipes.light1=()=>{called=true};
  try{
    G.startFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.idle(),seed:1});
    closeIn(G.fight);G.sim=true;
    for(let i=0;i<8;i++)G.tick();
    eq(called,false,'Audio.recipes.light1 must not be called with sfx off')
  }finally{Audio.recipes.light1=orig;Save.data.settings.sfx=true;G.toTitle();G.sim=false}});
Test.add('settings.announcer===false makes G.say a no-op (the toast stays empty)',()=>{
  Save.data=Meta.defaults();Save.data.settings.announcer=false;
  const el=document.getElementById('toast');el.textContent='';
  G.fight=null;G.frameNow=1000;G._sayAt=-999; // clear the throttle so a call would otherwise definitely show
  G.say('should not appear');
  eq(el.textContent,'','the toast must stay empty when announcer is off');
  Save.data.settings.announcer=true;
  G.say('should appear');
  eq(el.textContent,'should appear');
  el.textContent=''});
Test.add('haptics: navigator.vibrate(12) fires when the PLAYER takes a hit, guarded by the setting and by vibrate existing',()=>{
  Save.data=Meta.defaults();
  const hadOwn=Object.prototype.hasOwnProperty.call(navigator,'vibrate'),orig=navigator.vibrate;
  let calls=[];
  navigator.vibrate=(...a)=>{calls.push(a)};
  try{
    G.startFight({ctrl1:Ctrl.idle(),ctrl2:Ctrl.script([L(0)]),seed:1}); // p2 (enemy) hits p1 (player)
    closeIn(G.fight);G.sim=true;
    for(let i=0;i<8;i++)G.tick();
    eq(calls.length,1,'exactly one vibrate call for the one hit the player took');
    eq(calls[0][0],12);
    G.toTitle();
    Save.data.settings.haptics=false;calls=[];
    G.startFight({ctrl1:Ctrl.idle(),ctrl2:Ctrl.script([L(0)]),seed:1});
    closeIn(G.fight);
    for(let i=0;i<8;i++)G.tick();
    eq(calls.length,0,'haptics off must suppress the vibrate call');
  }finally{
    if(hadOwn)navigator.vibrate=orig;else delete navigator.vibrate;
    G.toTitle();G.sim=false}});
Test.add('G.needsRotate is a pure function of (w,h,touch): portrait AND a touch device must both hold',()=>{
  eq(G.needsRotate(480,854,true),true,'portrait + touch must need rotate');
  eq(G.needsRotate(854,480,true),false,'landscape + touch must not need rotate');
  eq(G.needsRotate(480,854,false),false,'portrait on a non-touch device must not need rotate');
  eq(G.needsRotate(854,480,false),false,'landscape + non-touch must not need rotate');
  eq(G.needsRotate(480,480,true),false,'a square viewport (h not > w) must not need rotate')});
Test.add('G.checkOrientation shows/hides #rotate based on G.needsRotate\'s result',()=>{
  const origNeeds=G.needsRotate;
  try{
    G.needsRotate=()=>true;G.checkOrientation();
    ok(document.getElementById('rotate').classList.contains('show'),'#rotate must show when needsRotate is true');
    G.needsRotate=()=>false;G.checkOrientation();
    ok(!document.getElementById('rotate').classList.contains('show'),'#rotate must hide when needsRotate is false')
  }finally{G.needsRotate=origNeeds}});
Test.add('G.initTapLayer(true) shows #tap and hides it (unlocking audio) on the first pointerdown; initTapLayer(false) hides it immediately',()=>{
  const tap=document.getElementById('tap');
  tap.classList.remove('show');
  const origInit=Audio.init;let audioInitCalled=false;
  Audio.init=()=>{audioInitCalled=true};
  try{
    G.initTapLayer(true);
    ok(tap.classList.contains('show'),'a touch device must show #tap');
    tap.dispatchEvent(new Event('pointerdown'));
    ok(!tap.classList.contains('show'),'#tap must hide after a pointerdown');
    ok(audioInitCalled,'the first pointerdown must call Audio.init()')
  }finally{Audio.init=origInit}
  tap.classList.add('show');
  G.initTapLayer(false);
  ok(!tap.classList.contains('show'),'a non-touch device must hide #tap immediately, no gesture needed')});
Test.add('G.shareCard returns an 854x480 PNG data URL, decoded via the raw PNG IHDR bytes (no DOM/Image needed)',()=>{
  Save.data=Meta.defaults();
  G.startFight({p1:'carl',p2:'donut',ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle(),seed:1});
  const url=G.shareCard();
  ok(url.startsWith('data:image/png;base64,'),'must be a PNG data URL: '+url.slice(0,40));
  const bytes=atob(url.slice('data:image/png;base64,'.length));
  const byteAt=i=>bytes.charCodeAt(i);
  // PNG: an 8-byte signature, then the IHDR chunk (4-byte length, 'IHDR', 4-byte width, 4-byte
  // height, big-endian) starting at byte 12 -- decoded here by hand rather than via an async
  // Image-element load (Test.run() is async since Task 5.5, so a case COULD await one, but a raw
  // byte decode is simpler and needs no DOM element or load event at all); tests/harness.py's
  // --share does the equivalent decode in Python against the same bytes.
  eq(bytes.slice(12,16),'IHDR','bytes 12..16 must be the IHDR chunk tag');
  const u32=off=>(byteAt(off)<<24|byteAt(off+1)<<16|byteAt(off+2)<<8|byteAt(off+3))>>>0;
  eq(u32(16),854,'PNG width must be 854');
  eq(u32(20),480,'PNG height must be 480');
  G.toTitle()});
Test.add('G.shareCard works with no live fight (falls back to Save.data.active) and never throws',()=>{
  Save.data=Meta.defaults();G.toTitle();
  ok(!threw(()=>G.shareCard()),'shareCard must not throw with G.fight null')});
Test.add('a SHARE button exists on the result screen and calls G.share on click',()=>{
  ok(document.getElementById('shareBtn'),'#shareBtn must exist');
  const orig=G.share;let called=false;G.share=()=>{called=true};
  try{document.getElementById('shareBtn').click();eq(called,true,'clicking SHARE must call G.share')}
  finally{G.share=orig}});
// --- Task 5.3: Tutorial (Floor 0) and first-run flow ---------------------------------------------
Test.add('ENCOUNTERS.tutorial matches the frozen Phase 5 shape',()=>{
  const e=ENCOUNTERS.tutorial;
  ok(e,'ENCOUNTERS.tutorial must exist');
  eq(e.floor,0);eq(e.name,'THE WAITING ROOM');eq(e.enemy,'goblin');eq(e.tier,'dummy');
  eq(e.hpMul,.5);eq(e.atkMul,.3);ok(Array.isArray(e.buffs)&&e.buffs.length===0)});
Test.add('BUFFS.noKo clamps holder.hp to at least 1, and leaves hp above 1 alone',()=>{
  const b=BUFFS.noKo;ok(b,'BUFFS.noKo must exist');
  const holder={hp:0,maxHp:100};b.onFrame(null,holder,null);eq(holder.hp,1,'0 hp must clamp up to 1');
  holder.hp=-40;b.onFrame(null,holder,null);eq(holder.hp,1,'negative hp must clamp up to 1');
  holder.hp=55;b.onFrame(null,holder,null);eq(holder.hp,55,'hp above 1 must be left alone')});
Test.add('Meta.defaults().tutorialDone is false, and v2 migrate backfills it for an older save without discarding an already-true one',()=>{
  eq(Meta.defaults().tutorialDone,false);
  const d=Meta.migrate({v:2});
  eq(d.tutorialDone,false,'a pre-5.3 v2 save must backfill tutorialDone via the generic top-level loop');
  const kept=Meta.migrate({v:2,tutorialDone:true});
  eq(kept.tutorialDone,true,'an already-true tutorialDone must survive migration')});
Test.add('Tutorial.reset() starts at step 0 with the first prompt and every step undone',()=>{
  Tutorial.reset();
  eq(Tutorial.state.step,0);
  eq(Tutorial.state.done.length,4);
  ok(Tutorial.state.done.every(d=>d===false));
  eq(Tutorial.prompt,Tutorial.steps[0].prompt)});
Test.add('Tutorial.onEvent+tick advance step 0 (3 landed lights) to step 1',()=>{
  Tutorial.reset();
  const p1={moveName:'light1'};const f={p1};
  for(let i=0;i<2;i++){Tutorial.onEvent('hit',p1,{},10,f);Tutorial.tick(f)}
  eq(Tutorial.state.step,0,'2 landed lights must not be enough');
  Tutorial.onEvent('hit',p1,{},10,f);Tutorial.tick(f);
  eq(Tutorial.state.step,1,'the 3rd landed light must advance to step 1');
  eq(Tutorial.state.done[0],true)});
Test.add('Tutorial step 1 advances on a landed player medium; step 2 on a player parry',()=>{
  Tutorial.reset();Tutorial.state.step=1;
  const p1={};const f={p1};
  Tutorial.onEvent('hit',p1,{},10,f); // no moveName yet -- must not count as a medium
  p1.moveName='medium';Tutorial.onEvent('hit',p1,{},10,f);Tutorial.tick(f);
  eq(Tutorial.state.step,2,'a landed medium must advance step 1 to step 2');
  Tutorial.onEvent('parry',p1,{},0,f);Tutorial.tick(f);
  eq(Tutorial.state.step,3,'a player parry must advance step 2 to step 3')});
Test.add('Tutorial step 3 sets fight.p1.power to 100 exactly once, and advances the instant p1 fires a special',()=>{
  Tutorial.reset();Tutorial.state.step=3;
  const p1={power:0,state:'IDLE',moveName:null};const f={p1};
  Tutorial.tick(f);
  eq(p1.power,100,'entering step 3 must set the player\'s power to 100');
  p1.power=5; // a later frame must not re-arm it back to 100
  Tutorial.tick(f);
  eq(p1.power,5,'power must only be set once, at step 3\'s start');
  p1.state='ATTACK';p1.moveName='s1';
  Tutorial.tick(f);
  eq(Tutorial.state.step,4,'firing s1 must complete step 3');
  eq(Tutorial.prompt,'FINISH HIM')});
// Fix-wave item 6 (final review, Minor): the final review's first-play walkthrough flagged a player
// who never works out POWER as stuck, in silence, against a 1 hp immortal dummy until the fight's own
// 120s clock expires. Driven through the real G.tick loop (mirrors how STALL_FRAMES is actually
// counted in play) with an idle player so nothing ever completes step 3 on its own.
Test.add('an idle player stalled on the POWER step gets an extra hint and a pulsing #btnPower after STALL_FRAMES, both clearing once the step completes',()=>{
  Save.data=Meta.defaults();
  G.startTutorial({ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()});
  Tutorial.state.step=3;Tutorial.state.done=[true,true,true,false]; // first three steps already taught
  G.sim=true;
  for(let i=0;i<Tutorial.STALL_FRAMES-1;i++)G.tick();
  ok(!Tutorial.stalled,'must not stall before STALL_FRAMES sim frames have passed');
  eq(document.getElementById('btnPower').classList.contains('pulse'),false,'#btnPower must not pulse yet');
  ok(!Tutorial.prompt.includes('TAP THE GLOWING POWER BUTTON'));
  G.tick(); // the STALL_FRAMES-th frame on step 3
  ok(Tutorial.stalled,'must stall once STALL_FRAMES sim frames have passed with no special fired');
  ok(Tutorial.prompt.includes('TAP THE GLOWING POWER BUTTON'),'prompt: '+Tutorial.prompt);
  ok(document.getElementById('btnPower').classList.contains('pulse'),'#btnPower must pulse while stalled');
  // The player finally taps POWER -- firing the special must clear both the stall hint and the pulse.
  G.fight.p1.act(Object.assign(Ctrl.EMPTY(),{special:1}));
  G.tick();
  eq(Tutorial.state.step,4,'firing s1 must complete step 3');
  ok(!Tutorial.stalled,'stalled must clear once the step completes');
  eq(document.getElementById('btnPower').classList.contains('pulse'),false,'#btnPower pulse must clear once the step completes');
  G.toTitle();G.sim=false});
Test.add('G.startTutorial starts ENCOUNTERS.tutorial in mode tutorial with no energy spent and the goblin at half hp/30% atk',()=>{
  Save.data=Meta.defaults();
  const energyBefore=Save.data.energy.n;
  const started=G.startTutorial();
  ok(started!==false,'G.startTutorial must not be refused');
  eq(G.mode,'tutorial');
  eq(G.encounter.floor,0);eq(G.encounter.name,'THE WAITING ROOM');
  eq(G.fight.p2.def.hp,Math.round(DEFS.goblin.hp*.5));
  eq(G.fight.p2.def.atk,Math.round(DEFS.goblin.atk*.3));
  eq(Save.data.energy.n,energyBefore,'the tutorial must never spend energy');
  G.toTitle()});
Test.add('G.startTutorial applies the noKo buff to p1, and a realistic (atkMul .3) tutorial fight never meaningfully threatens the player\'s hp',()=>{
  Save.data=Meta.defaults();
  G.startTutorial({ctrl1:Ctrl.idle()});
  ok(G.fight.p1.buffs.some(bf=>bf.id==='noKo'),'the noKo buff must be applied to the live player Fighter');
  closeIn(G.fight);G.sim=true;
  for(let i=0;i<1200;i++)G.tick();
  ok(G.fight&&G.fight.p1.hp>G.fight.p1.maxHp*0.5,
    'the tutorial\'s own atkMul must keep the goblin\'s damage far too small to meaningfully threaten the player');
  G.toTitle();G.sim=false});
Test.add('Ctrl.tutorialDummy is deterministic (two fresh instances match exactly) and eventually throws a medium',()=>{
  const c1=Ctrl.tutorialDummy(),c2=Ctrl.tutorialDummy();
  const me={busy:()=>false,state:'IDLE',moveName:null};
  const seq1=[],seq2=[];
  for(let i=0;i<200;i++){seq1.push(JSON.stringify(c1.next(null,me,me)));seq2.push(JSON.stringify(c2.next(null,me,me)))}
  eq(JSON.stringify(seq1),JSON.stringify(seq2),'two fresh instances must be identical (deterministic, no rng)');
  ok(seq1.some(s=>JSON.parse(s).medium),'the dummy must throw a medium at some point')});
Test.add('BUFFS.tutorialGuard caps incoming damage so a defending holder can\'t drop below 1 hp while holder.guardActive is set, and stops capping once cleared',()=>{
  // Release pass: this buff now reads only holder.guardActive (plain Fighter state), not the global
  // Tutorial object -- see BUFFS.tutorialGuard's own comment (47_buffs.js) and the sim-purity scan
  // above, which now includes every BUFFS.* hook.
  const b=BUFFS.tutorialGuard,holder={hp:5,guardActive:true};
  let ref={dmg:20};b.onHit(null,{},holder,ref,holder);
  eq(ref.dmg,4,'dmg must be capped to leave exactly 1 hp while guardActive is true');
  holder.guardActive=false; // FINISH HIM: Tutorial.tick clears this once every step is done
  ref={dmg:20};b.onHit(null,{},holder,ref,holder);
  eq(ref.dmg,20,'dmg must pass through uncapped once guardActive is cleared');
  ref={dmg:20};b.onHit(null,{},{hp:5},ref,{hp:5,guardActive:true}); // holder !== def: never applies
  eq(ref.dmg,20,'must not cap when holder is not the defender of this exchange')});
Test.add('the tutorial dummy cannot be KO\'d by a light chain before every Tutorial step is done, but dies normally once they are',()=>{
  Save.data=Meta.defaults();
  G.startTutorial({ctrl1:Ctrl.script([L(0,600)]),ctrl2:Ctrl.idle()});
  closeIn(G.fight);G.sim=true;
  for(let i=0;i<300;i++)G.tick();
  eq(G.state,'FIGHT','a light chain alone must never finish the dummy before PARRY/POWER are taught');
  ok(G.fight.p2.hp>=1,'the dummy\'s hp must never have dropped below 1');
  Tutorial.state.step=Tutorial.steps.length;G.fight.p2.guardActive=false; // simulate every step having been completed (mirrors what Tutorial.tick itself would clear)
  for(let i=0;i<500&&G.state!=='RESULT';i++)G.tick();
  eq(G.state,'RESULT','the SAME light chain must now finish the dummy once every step is done');
  G.toTitle();G.sim=false});
Test.add('completing the tutorial sets tutorialDone and grants 300 gold exactly once, on a natural KO',()=>{
  Save.data=Meta.defaults();
  const goldBefore=Save.data.gold||0;
  G.startTutorial({ctrl1:Ctrl.script([L(0,600)]),ctrl2:Ctrl.idle()});
  Tutorial.state.step=Tutorial.steps.length;G.fight.p2.guardActive=false; // every step already taught -- the dummy is now killable
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT','the tutorial fight must reach a natural KO result');
  eq(Save.data.tutorialDone,true);
  eq(Save.data.gold,goldBefore+300,'a first completion must grant exactly 300 gold');
  const goldAfterFirst=Save.data.gold;
  G.toTitle();
  G.startTutorial({ctrl1:Ctrl.script([L(0,600)]),ctrl2:Ctrl.idle()});
  Tutorial.state.step=Tutorial.steps.length;G.fight.p2.guardActive=false;
  closeIn(G.fight);G.fight.p2.hp=1;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  eq(Save.data.gold,goldAfterFirst,'a second completion (replayed via the map\'s .node.tutorial row) must not grant gold again');
  G.toTitle();G.sim=false});
Test.add('Screens.renderMap always shows a .node.tutorial entry on floor 1 that starts G.startTutorial when clicked, and is never disabled',()=>{
  Save.data=Meta.defaults();Save.data.tutorialDone=true; // even once done, it must stay replayable
  Screens.map(1);
  const el=document.querySelector('#map .node.tutorial');
  ok(el,'.node.tutorial must exist on the floor 1 map');
  ok(!el.disabled,'.node.tutorial must always be enabled/clickable');
  el.click();
  eq(G.mode,'tutorial');
  G.toTitle()});
Test.add('a fresh save\'s CAMPAIGN button starts the tutorial instead of opening the map; CAMPAIGN opens the map once tutorialDone',()=>{
  Save.data=Meta.defaults();
  eq(Save.data.tutorialDone,false);
  Screens.title();
  document.getElementById('btnCampaign').click();
  eq(G.mode,'tutorial','CAMPAIGN on a fresh save must start the tutorial');
  G.toTitle();
  Save.data.tutorialDone=true;
  Screens.title();
  document.getElementById('btnCampaign').click();
  eq(Screens._current,'map','CAMPAIGN must open the map once tutorialDone is true');
  G.toTitle()});
Test.add('the result screen shows a TUTORIAL COMPLETE line on a tutorial win',()=>{
  Save.data=Meta.defaults();
  G.startTutorial({ctrl1:Ctrl.script([L(0,600)]),ctrl2:Ctrl.idle()});
  Tutorial.state.step=Tutorial.steps.length;G.fight.p2.guardActive=false; // every step already taught -- the dummy is now killable
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT');
  ok(document.getElementById('resultLine').textContent.includes('TUTORIAL COMPLETE'),
    'result line: '+document.getElementById('resultLine').textContent);
  G.toTitle();G.sim=false});
// Fix-wave item 2 (final review, Important): FIGHT AGAIN used to stay visible after a tutorial win and
// replay it via the plain startFight(lastFightOpts) path (G.init's 'again' handler), never
// Tutorial.reset() -- Tutorial.state was still at step===steps.length ("FINISH HIM" pinned on screen
// from frame one) and p2.guardActive already false on the replay. #again is now hidden for the
// duration of the RESULT screen whenever the fight that just ended was G.mode==='tutorial'; CONTINUE
// (#resultTitleBtn) still routes through G.backToOrigin(), which lands on the map (floor 1) since
// Screens._origin is set to {name:'map',args:[...]} by every path that starts the tutorial (a fresh
// save's CAMPAIGN button, and the map's own .node.tutorial row).
Test.add('after a scripted tutorial completion, FIGHT AGAIN is hidden and CONTINUE routes to the map',()=>{
  Save.data=Meta.defaults();
  Screens._origin={name:'map',args:[1]}; // mirrors CAMPAIGN's own origin-set-then-startTutorial pattern
  G.startTutorial({ctrl1:Ctrl.script([L(0,600)]),ctrl2:Ctrl.idle()});
  Tutorial.state.step=Tutorial.steps.length;G.fight.p2.guardActive=false; // every step already taught -- the dummy is now killable
  closeIn(G.fight);G.fight.p2.hp=1;G.sim=true;
  for(let i=0;i<400;i++)G.tick();
  eq(G.state,'RESULT','the tutorial fight must reach a natural KO result');
  eq(document.getElementById('again').style.display,'none','FIGHT AGAIN must be hidden after a tutorial win');
  document.getElementById('resultTitleBtn').click();
  eq(Screens._current,'map','CONTINUE must route to the map after a tutorial win');
  eq(Screens._floor,1);
  G.toTitle();G.sim=false});
Test.add('#tutorialPrompt shows the current step\'s prompt text during a tutorial fight, and hides once the tutorial ends',()=>{
  Save.data=Meta.defaults();
  G.startTutorial({ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()});
  G.sim=true;G.tick();
  const el=document.getElementById('tutorialPrompt');
  ok(el,'#tutorialPrompt must exist');
  eq(el.textContent,Tutorial.steps[0].prompt);
  ok(el.classList.contains('show'));
  G.toTitle();
  ok(!document.getElementById('tutorialPrompt').classList.contains('show'),
    '#tutorialPrompt must hide once the tutorial ends');
  G.sim=false});

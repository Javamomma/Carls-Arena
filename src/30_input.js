// Task 6.3: the whole canvas is one gesture surface -- no more left/right zones. Exactly one canvas
// pointer is tracked at a time (this._ptr): the first pointer down; any later pointer is ignored
// entirely (never even recorded) until the first lifts, per docs/design/mcoc-comparison-notes.md §2.
// Gesture -> intent (all frozen, Input.GESTURE below):
//   tap (down->up < TAP_FRAMES, drift < TAP_DRIFT)              -> 'light', pushed on release
//   hold in place (>= BLOCK_HOLD_FRAMES, drift < TAP_DRIFT)     -> held.block, until release
//   swipe right (>= SWIPE_PX within SWIPE_FRAMES, dx>|dy|)      -> 'medium', pushed the frame it fires
//   ...then still held HEAVY_HOLD_FRAMES after that             -> held.heavy, until release
//   Task 7.2: this same "swipe right, keep holding" gesture (and the plain L key) also serves the
//   combo grammar's in-combo heavy ender -- held.heavy just feeds intent.heavy every frame regardless
//   of Fighter state, and Fighter.act (50_fighter.js) is what decides what THAT means: a normal
//   22-frame heavy from IDLE, or, if this fighter is sitting in chainNode-4 recovery, the CHAIN.
//   enders.heavy 14-frame shortened ender (40_movedata.js). No gesture-detection code changed here.
//   swipe left  (>= SWIPE_PX within SWIPE_FRAMES, dx>|dy|)      -> 'dashBack', pushed the frame it fires
//   ...then still held DASH_BACK.frames SIM FRAMES after that  -> held.block, until release (counted
//     by tick(), called once per sim frame from Ctrl.player -- see its own comment below)
// Drift beyond TAP_DRIFT before a swipe threshold is reached just cancels the tap/hold outright (no
// light, no block) -- neither path fires. A hold that has already engaged block is never cancelled by
// further movement ("a hold that already engaged block stays block"): the drift check that would
// disqualify a fresh tap/hold is naturally moot once blockOn/dashDir is already set, since reaching
// SWIPE_PX(44) always implies drift already exceeded TAP_DRIFT(24) first.
// Left-handed (Save.data.settings.leftHanded) is now a button-PLACEMENT setting only (00_head.html's
// body.left-handed CSS, applied by G.applySettings) -- gestures read identically either way; the old
// zoneFor/swipeDx mirroring is gone along with the zones themselves.
// Fix-wave item 9 (final review, Minor): every hold/timing threshold is now measured in SIM frames
// (Input.now's default reads G.frameNow, the same fight-frame counter Broadcast/Tutorial's own tick
// cadence already relies on -- see G.tick's own comment) instead of wall-clock ms
// (performance.now()) -- the final review found Input.tick() (called from inside Fight.step via
// Ctrl.player) reading performance.now() meant the gesture grammar ran on wall-clock time while
// everything else in the sim runs on frame counts, so a real frame-rate dip (the sim's own
// accumulator catching up in a rapid burst of ticks) shifted gesture timing relative to the sim
// instead of staying in lockstep with it. TAP_MS(140)->TAP_FRAMES(8), BLOCK_HOLD_MS(140)->
// BLOCK_HOLD_FRAMES(8), HEAVY_HOLD_MS(200)->HEAVY_HOLD_FRAMES(12), SWIPE_MS(260)->SWIPE_FRAMES(16) --
// all at the same nominal 60fps-equivalent duration the old ms values targeted. Input.now itself stays
// injectable (tests override it with a manually-advanced counter instead of racing G.tick(); see
// withInputClock, 90_tests.js) -- only its default implementation and what its return value now means
// (frames, not ms) changed.
const Input={q:[],held:{block:false,heavy:false},_ptr:null,pointerLog:[],
  GESTURE:{TAP_FRAMES:8,TAP_DRIFT:24,SWIPE_PX:44,SWIPE_FRAMES:16,HEAVY_HOLD_FRAMES:12,BLOCK_HOLD_FRAMES:8},
  // Injectable clock (default G.frameNow, the sim's own frame counter) so tests can drive gesture
  // timing deterministically by overriding Input.now instead of racing the real sim. G is defined
  // later in the concatenated build (80_game.js) -- safe here since this arrow function's body only
  // runs when actually called, well after the whole script has parsed, the same later-file-from-
  // earlier-file pattern Crystal.open already uses for CHAMPS (12_meta.js).
  now:()=>(typeof G!=='undefined'?G.frameNow:0),
  // Fix-wave item 9: POWER_HOLD_MS(400)->POWER_HOLD_FRAMES(24) -- this.now() (just above) is shared by
  // the POWER button's own long-press-to-picker timing, not just the canvas gestures; once its default
  // switched from wall-clock ms to sim frames, this threshold had to move with it or a 400ms hold would
  // silently become a ~6.7s one.
  POWER_HOLD_FRAMES:24,_powerT0:0,_powerShown:false,
  // Appends to the last-8 gesture log (Input.pointerLog) tests and the tutorial read to see what a
  // player's thumb actually did: 'tap','hold','swipeR','swipeRHold','swipeL','swipeLHold'.
  _log(type){this.pointerLog.push({type,frame:(typeof G!=='undefined'&&G.frameNow)||0});
    if(this.pointerLog.length>8)this.pointerLog.shift()},
  init(canvas){
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
    canvas.addEventListener('pointerdown',e=>{Audio.init();const p=pos(e);
      // Pause glyph hit-test: a tap there toggles pause and must not also register as a gesture.
      if(G.state==='FIGHT'&&G.hitPause(p.x,p.y)){G.togglePause();return}
      if(G.state==='TITLE')return G.startFight();if(G.state!=='FIGHT')return;
      if(this._ptr)return; // one canvas pointer at a time -- later pointers are ignored until this lifts
      this._ptr={id:e.pointerId,x0:p.x,y0:p.y,t0:this.now(),drifted:false,dashDir:null,blockOn:false,heavyOn:false,dashFrames:0,actAt:0}});
    canvas.addEventListener('pointermove',e=>{const P=this._ptr;if(!P||P.id!==e.pointerId)return;
      const p=pos(e),dx=p.x-P.x0,dy=p.y-P.y0;
      if(Math.hypot(dx,dy)>=this.GESTURE.TAP_DRIFT)P.drifted=true;
      // Swipe fires once, the frame its threshold is crossed -- a hold that already engaged block
      // (P.blockOn) never re-evaluates as a swipe, and neither does a pointer that already swiped.
      if(!P.dashDir&&!P.blockOn&&this.now()-P.t0<=this.GESTURE.SWIPE_FRAMES&&
         Math.abs(dx)>=this.GESTURE.SWIPE_PX&&Math.abs(dx)>Math.abs(dy)){
        if(dx>0){P.dashDir='R';P.actAt=this.now();this.q.push('medium');this._log('swipeR')}
        else{P.dashDir='L';P.dashFrames=0;this.q.push('dashBack');this._log('swipeL')}}});
    const up=e=>{const P=this._ptr;if(!P||P.id!==e.pointerId)return;this._ptr=null;
      if(P.blockOn){this.held.block=false;return} // hold-block or dash-back-hold-block, either way
      if(P.dashDir==='R'){this.held.heavy=false;return} // clears whether or not heavy ever engaged
      if(P.dashDir==='L')return; // dashBack already fired on the swipe; nothing more on release
      if(!P.drifted&&this.now()-P.t0<this.GESTURE.TAP_FRAMES){this.q.push('light');this._log('tap')}};
    const cancel=e=>{const P=this._ptr;if(!P||P.id!==e.pointerId)return;this._ptr=null;
      if(P.blockOn)this.held.block=false;if(P.dashDir==='R')this.held.heavy=false};
    canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
    // Defensive cleanup: a lost blur (alt-tab, an OS gesture stealing the pointer) never fires
    // pointerup/pointercancel -- without this a thumb lifted off-window could leave block/heavy
    // stuck on forever. Never fires a tap; it only clears whatever was already engaged.
    addEventListener('blur',()=>{this._ptr=null;this.held.block=false;this.held.heavy=false;
      this._powerT0=0;this._powerShown=false});
    this.bindButtons();
    addEventListener('keydown',e=>{if(e.repeat)return;const k=e.key.toLowerCase();
      if(e.code==='Space'&&G.state==='TITLE'){e.preventDefault();return G.startFight()}
      if(k==='p')return G.togglePause();
      if(G.state!=='FIGHT')return;
      if(k==='j')this.q.push('light');
      if(k==='k'){this.q.push('medium');
        // Shift+K: a keyboard alias for swipe-right-then-hold -- dashes in with a medium AND arms
        // the follow-up heavy immediately (no hold delay; the keyboard has no timing to emulate).
        if(e.shiftKey){this.held.heavy=true;this._kHeavyDown=true}}
      if(k==='a'||k==='d')this.q.push('dashBack');
      if(k==='l')this.held.heavy=true;if(k==='s')this.held.block=true;
      if(k==='1'||k==='2'||k==='3')this.q.push('special'+k)});
    addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='s')this.held.block=false;
      if(k==='l')this.held.heavy=false;
      if(k==='k'&&this._kHeavyDown){this.held.heavy=false;this._kHeavyDown=false}})},
  // On-screen buttons: BLOCK is a hold (mirrors the canvas hold gesture); PUNCH/KICK fire on press.
  // POWER taps 'powerAuto' (drain() resolves it to the highest affordable special); held past
  // POWER_HOLD_FRAMES it shows the S1-S3 picker instead, and releasing over a chip fires that special.
  // Release point is read with elementFromPoint (not e.target) because touch pointers implicitly
  // capture to their pointerdown target, so e.target would still be #btnPower on release. POWER is
  // always shown; BLOCK/PUNCH/KICK are optional (Save.data.settings.showButtons or G.forceButtons,
  // see 00_head.html's .atkbtn/body.show-atk and G.applySettings) but keep these same handlers
  // whether or not they're currently visible.
  bindButtons(){
    const id=x=>document.getElementById(x);
    const block=id('btnBlock');
    block.addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.held.block=true});
    const blockOff=()=>{this.held.block=false};
    block.addEventListener('pointerup',blockOff);block.addEventListener('pointercancel',blockOff);
    id('btnPunch').addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.q.push('light')});
    id('btnKick').addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.q.push('medium')});
    const power=id('btnPower'),picker=id('powerPicker');
    power.addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this._powerT0=this.now();this._powerShown=false});
    const powerEnd=e=>{e.stopPropagation();
      if(this._powerShown){
        const el=document.elementFromPoint(e.clientX,e.clientY),m=el&&el.id&&el.id.match(/^pk([123])$/);
        if(m&&!el.disabled)this.q.push('special'+m[1]);
        picker.classList.remove('show')}
      else if(this._powerT0)this.q.push('powerAuto');
      this._powerT0=0;this._powerShown=false};
    power.addEventListener('pointerup',powerEnd);power.addEventListener('pointercancel',powerEnd)},
  // Called once per sim frame by Ctrl.player: promotes the active canvas pointer's hold to block (in
  // place) or to heavy/dash-back-block (after a swipe), and a long press on POWER to the S1-S3
  // picker. DASH_BACK.frames (40_movedata.js) is counted here as SIM FRAMES elapsed since a dashBack
  // fired, not wall time -- one increment per tick() call while that pointer is still down, matching
  // the real DASH state's own duration exactly.
  tick(){const P=this._ptr;
    if(P){
      if(!P.dashDir&&!P.blockOn&&!P.drifted&&this.now()-P.t0>=this.GESTURE.BLOCK_HOLD_FRAMES){
        P.blockOn=true;this.held.block=true;this._log('hold')}
      if(P.dashDir==='R'&&!P.heavyOn&&this.now()-P.actAt>=this.GESTURE.HEAVY_HOLD_FRAMES){
        P.heavyOn=true;this.held.heavy=true;this._log('swipeRHold')}
      if(P.dashDir==='L'&&!P.blockOn){
        P.dashFrames++;
        if(P.dashFrames>=DASH_BACK.frames){P.blockOn=true;this.held.block=true;this._log('swipeLHold')}}}
    if(this._powerT0&&!this._powerShown&&this.now()-this._powerT0>=this.POWER_HOLD_FRAMES){this._powerShown=true;document.getElementById('powerPicker').classList.add('show')}},
  drain(){const it={light:false,medium:false,heavy:this.held.heavy,block:this.held.block,dashBack:false,special:0};
    for(const a of this.q){
      if(a==='powerAuto'){const p=G.fight?G.fight.p1.power:0;let n=0;for(let k=3;k>=1;k--)if(p>=100*k){n=k;break}it.special=n}
      else if(a.startsWith('special'))it.special=+a[7];
      else it[a]=true}
    this.q.length=0;return it}};

const Ctrl={
  EMPTY:()=>({light:false,medium:false,heavy:false,block:false,dashBack:false,special:0}),
  idle:()=>({next:()=>Ctrl.EMPTY()}),
  player:()=>({next(){Input.tick();return Input.drain()}}),
  hold:intent=>({next:()=>Object.assign(Ctrl.EMPTY(),intent)}),
  // steps: [{f, until?, intent}] in controller frames (frames where next() was called)
  script:steps=>({f:0,next(){const it=Ctrl.EMPTY();for(const s of steps)if(this.f>=s.f&&this.f<=(s.until===undefined?s.f:s.until))Object.assign(it,s.intent);this.f++;return it}}),
  // seeded chaos monkey: picks a plan, holds block/heavy plans for a while, taps others once
  random:seed=>{const r=RNG(seed);let plan='',left=0;return{next(){
    if(left--<=0){plan=r.pick(['','','light','light','medium','dashBack','block','block','heavy','special']);left=plan==='block'?10+r.int(30):plan==='heavy'?30:1}
    const it=Ctrl.EMPTY();if(plan==='block')it.block=true;else if(plan==='heavy')it.heavy=true;else if(plan==='special')it.special=1;else if(plan)it[plan]=true;return it}}},
  // Ctrl.competent(seed): a scripted, fully deterministic "skilled human" bot for tests/batch.py's
  // win-rate table (--bot auto). Unlike Ctrl.random it never rolls dice — `seed` is accepted only for
  // signature symmetry with the other seeded controllers (Ctrl.random, AI.make); the exact same
  // (fight, me, foe) state always yields the exact same intent, for any seed, which is what the
  // batch tool's "Ctrl.competent is deterministic" test checks. Priority order per call:
  //   1. continue holding a heavy already armed by step 8 below (charge moves need intent.heavy held
  //      every frame — see Fighter.act's CHARGE branch — checked ahead of the busy() gate the same
  //      way AI.make's decideHeavy 'hold' phase does, since CHARGE itself counts as busy)
  //   2. finish a light chain already open (Fighter.act's own recovery+chain+landed window)
  //   3. otherwise, if busy, do nothing (can't act)
  //   4. react to a visible medium/heavy: block once its startup clock has run REACT frames (leaves
  //      the move's last couple of startup frames as a buffer, mirroring the AI tiers' 'react' field)
  //   5. bail out of a telegraphed heavy charge while low on hp
  //   6. fire the strongest special affordable
  //   7. chain lights whenever in light range
  //   8. Fix-wave item 8: every 5th time the foe enters blockstun (a mix-up, not spam — counted on
  //      the rising edge of BLOCKSTUN so one long blockstun window only counts once), arm a heavy
  //      instead of continuing the light chain
  //   9. Fix-wave item 8: close distance with a medium (its own startup dash covers real ground) when
  //      out of light range and the foe isn't mid-attack, on a 40-frame cooldown — the bot used to
  //      just stand there outside light range forever, which is why intercept/medium-punish never
  //      fired in the run that certified the tiers (final review, Important) and the monotone curve
  //      was driven almost entirely by `attack`.
  competent:seed=>{const REACT=6,LOW_HP=0.3,CLOSE_CD=40,MIXUP_EVERY=5;
    let closeCd=0,openings=0,wasBlockstun=false,heavyHold=0;
    return{next(fight,me,foe){
    const it=Ctrl.EMPTY();
    if(heavyHold>0){heavyHold--;it.heavy=true;return it}
    // Task 7.2: me.move.chain is gone (the fixed ladder no longer exists) -- me.chainNode>=1 &&
    // <CHAIN.nodes is the grammar's own "still inside an open chain window" check, same one AI.make's
    // decidePunish 'follow' phase uses. Ctrl.competent keeps the old flat all-light follow (not the
    // mixed M-L-L-L-M grammar AI.make's t3+ tiers learn) -- it's the fixed win-rate yardstick bot, so
    // minimizing its own behavior change keeps the tier-gate retune isolated to what the grammar/
    // damage changes themselves actually shift, not an unrelated bot-behavior change on top.
    if(me.state==='ATTACK'&&me.phase()==='recovery'&&me.landed&&me.chainNode>=1&&me.chainNode<CHAIN.nodes){it.light=true;return it}
    if(me.busy())return it;
    if(foe.state==='ATTACK'&&(foe.moveName==='medium'||foe.moveName==='heavy')&&foe.f>=REACT){it.block=true;return it}
    if(foe.state==='CHARGE'&&foe.moveName==='heavy'&&me.hp/me.maxHp<LOW_HP){it.dashBack=true;return it}
    if(me.power>=100){it.special=me.power>=300?3:me.power>=200?2:1;return it}
    if(closeCd>0)closeCd--;
    const foeBlockstun=foe.state==='BLOCKSTUN';
    if(foeBlockstun&&!wasBlockstun){
      wasBlockstun=true;openings++;
      if(openings%MIXUP_EVERY===0){heavyHold=me.moveDef('heavy').charge+1;it.heavy=true;return it}}
    else if(!foeBlockstun)wasBlockstun=false;
    const dist=Math.abs(foe.x-me.x)-me.width,lightRange=me.moveDef('light').range+20;
    if(dist<lightRange){it.light=true;return it}
    if(foe.state!=='ATTACK'&&closeCd===0){it.medium=true;closeCd=CLOSE_CD;return it}
    return it}}},
  // Task 5.3/6.4: the tutorial's own dummy AI -- stands in for AI.make(enc.tier,...) as ctrl2
  // (G.startTutorial passes this directly, bypassing AI.make/AI_TIERS entirely) so the goblin's one
  // scripted attack (lesson 3's "release just before the hit lands to PARRY" prompt needs a real
  // medium to react to) never depends on rng: a blind frame-countdown, not a probability roll, so two
  // fresh instances are byte-identical forever (see the determinism test in 90_tests.js). `seed` is
  // accepted only for signature symmetry with every other seeded controller (Ctrl.random/
  // Ctrl.competent/AI.make) -- never actually used.
  // Task 6.4 (frozen ruling, owner playtest note "the goblin didn't really die until it started to
  // beat me up"): completely inert -- reads Tutorial.state.step and returns Ctrl.EMPTY() outright --
  // until Tutorial.state.step reaches 2 (lesson 3, "HOLD to block... PARRY"); a first-time player is
  // never hit before being taught to block. Never approaches (no dash/movement intent anywhere in
  // this controller, at any step) -- G.startTutorial/Tutorial.tick own the dummy's position directly
  // (the lesson-1 spawn distance and the lesson-2 back-off), never this controller. From lesson 3 on,
  // throws a medium once every 90 frames of NOT being busy (holding the countdown rather than
  // spending it while mid-move/stunned, so a hit that interrupts a pending swing just delays it
  // instead of losing it) -- and, 30 frames before that medium fires (cd hitting 30), pushes a
  // 'windup' fx (72_fx.js: a red flash at the dummy's own position) directly onto fight.fx, the same
  // "a controller may reach into fight.fx" latitude Fight.checkCinematic itself uses for the S3 card
  // -- legitimate here because Ctrl.* lives outside the sim boundary (see this file's own header).
  // `windup` resets to false the instant the medium actually fires so the very next 90-frame cycle
  // gets its own fresh flash.
  tutorialDummy:seed=>{let cd=90,windup=false;
    return{next(fight,me,foe){
      const it=Ctrl.EMPTY();
      if(Tutorial.state.step<2)return it; // no attacks before lesson 3, no exceptions
      if(me.busy())return it;
      if(!windup&&cd<=30){windup=true;if(fight)fight.fx.push({kind:'windup',x:me.x,y:FLOOR-140})}
      if(cd>0){cd--;return it}
      it.medium=true;cd=90;windup=false;return it}}},
  // Task 5.3: tests/harness.py's --tutorial flag scripts this as p1 -- a deterministic bot that plays
  // the four tutorial steps in the order the prompts ask for (reading Tutorial.state.step, the same
  // live global G's own tick() reads), then finishes the dummy off with lights once every step is
  // done. Never rolls dice (Tutorial.state.step is the only thing branching its behavior), so it's
  // safe for the harness's exit-1-on-any-assertion-failure contract.
  tutorialBot:seed=>{let holding=false;
    // Shared with step 0's punch prompt and the post-step-4 finisher: continue an already-open light
    // chain through its own recovery+chain+landed window (mirrors Ctrl.competent's own priority
    // order), otherwise start a fresh light the moment `me` isn't busy.
    const chainLight=(it,me)=>{
      // Task 7.2: me.move.chain is gone -- see Ctrl.competent's own comment above for the chainNode
      // replacement check.
      if(me.state==='ATTACK'&&me.phase()==='recovery'&&me.landed&&me.chainNode>=1&&me.chainNode<CHAIN.nodes){it.light=true;return}
      if(me.busy())return;
      it.light=true};
    return{next(fight,me,foe){
      const it=Ctrl.EMPTY();
      const step=Tutorial.state.step;
      if(step===0){chainLight(it,me);return it}
      if(step===1){
        // Don't let a light chain window (left open by step 0's own last hit) steal this step's
        // medium -- SWIPE RIGHT / KICK asks for a medium specifically, not another light.
        if(me.state==='ATTACK'&&me.phase()==='recovery'&&me.landed&&me.chainNode>=1&&me.chainNode<CHAIN.nodes)return it;
        if(me.busy())return it;
        it.medium=true;return it}
      if(step===2){
        // Start holding the instant the dummy's own scripted medium is 2 frames from its active
        // window (Ctrl.tutorialDummy's only move), keep holding through the swing so the timed
        // block lands inside PARRY_WINDOW, then release once the dummy is done attacking.
        if(!holding&&foe.state==='ATTACK'&&foe.moveName==='medium'&&foe.f===foe.move.startup-2)holding=true;
        if(holding){it.block=true;if(!(foe.state==='ATTACK'&&foe.moveName==='medium'))holding=false}
        return it}
      if(step===3){
        if(me.busy())return it;
        if(me.power>=100)it.special=1;
        return it}
      chainLight(it,me);return it}}}};

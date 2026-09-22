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
//   enders.heavy 14-frame shortened ender (40_movedata.js).
//   Fix round 1 (verdict-7.2 C1): the ORIGINAL Task 7.2 pass left this line true for the L key/Shift+K
//   but not for the touch gesture itself -- a fresh swipe-right's own immediate `q.push('medium')`
//   (right at the SWIPE_PX crossing) always won the race against held.heavy arming HEAVY_HOLD_FRAMES
//   later, so the named gesture could never actually reach the heavy branch. pointermove now reads
//   this fighter's live chainNode/phase (read-only) and, ONLY while sitting in a chainNode-4 recovery,
//   defers the medium/heavy decision to release/hold-time instead of queuing medium immediately -- see
//   pointermove's own comment below for the exact mechanism. Every other swipe-right (not mid a node-4
//   recovery) is untouched.
//   Fix round 2 (verdict-7.2-fix1 I1): that deferred decision no longer arms on any fixed hold-frame
//   count for the chainNode-4 case specifically -- a short fixed threshold sat inside the natural human
//   flick-release band, misfiring intended mediums into heavies. It now decides at the node-4 recovery
//   window's own natural close (Fighter.recoveryLeft(), 50_fighter.js): swipe right and keep holding
//   through the fourth hit's own recovery -- release any time before that and it's a medium; still down
//   as that window closes and it's the heavy ender. See tick()'s own comment for the exact mechanism.
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
  // Fix-wave item 3 (final review I3): drain()'s own intent buffer -- {a,left,seq} entries, one per
  // still-alive queued action (a: the raw string this.q used to hold directly -- 'light'/'medium'/
  // 'dashBack'/'specialN'/'powerAuto'; left: presentations remaining, GESTURE.BUFFER_FRAMES at push,
  // decremented once per drain() call it's actually presented in; seq: this fighter's own moveSeq
  // (Fighter.moveSeq) at the moment it was queued). See drain()'s own comment for the full mechanism.
  _buf:[],
  // Fix-wave item 3 (final review I3): BUFFER_FRAMES is how many sim frames a queued action (this.q,
  // pushed by any of pointerdown/up/pointermove/keydown/bindButtons below) is held and re-presented
  // by drain() before being dropped -- see drain()'s own comment for the exact mechanism and the drop
  // rules. 4 frames (67ms at 60Hz) comfortably covers ordinary human press-2-frames-early jitter
  // without reaching into the next chain window over (a light's own shortest recovery is 8 frames).
  GESTURE:{TAP_FRAMES:8,TAP_DRIFT:24,SWIPE_PX:44,SWIPE_FRAMES:16,HEAVY_HOLD_FRAMES:12,BLOCK_HOLD_FRAMES:8,BUFFER_FRAMES:4},
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
      this._ptr={id:e.pointerId,x0:p.x,y0:p.y,t0:this.now(),drifted:false,dashDir:null,blockOn:false,heavyOn:false,dashFrames:0,actAt:0,pendingEnder:false}});
    canvas.addEventListener('pointermove',e=>{const P=this._ptr;if(!P||P.id!==e.pointerId)return;
      const p=pos(e),dx=p.x-P.x0,dy=p.y-P.y0;
      if(Math.hypot(dx,dy)>=this.GESTURE.TAP_DRIFT)P.drifted=true;
      // Swipe fires once, the frame its threshold is crossed -- a hold that already engaged block
      // (P.blockOn) never re-evaluates as a swipe, and neither does a pointer that already swiped.
      if(!P.dashDir&&!P.blockOn&&this.now()-P.t0<=this.GESTURE.SWIPE_FRAMES&&
         Math.abs(dx)>=this.GESTURE.SWIPE_PX&&Math.abs(dx)>Math.abs(dy)){
        if(dx>0){
          P.dashDir='R';P.actAt=this.now();
          // Fix round 1 (verdict-7.2 C1): a fresh swipe-right used to push 'medium' unconditionally,
          // right here, the instant SWIPE_PX crossed -- if this fighter is sitting in its own
          // chainNode-4 recovery (the in-combo heavy ender's own window, Fighter.act's cn===
          // CHAIN.nodes-1 branch), that immediate push committed to the medium ender well before
          // tick()'s own hold-timer (below) ever got a chance to arm held.heavy, making the brief's
          // named "swipe-right-and-hold" heavy-ender gesture unreachable. Read this fighter's live
          // chainNode/phase read-only (the same G.fight.p1 read Input.drain()'s own powerAuto
          // resolution already makes below -- Input never mutates sim state) and, only in that one
          // window, defer the decision: don't queue medium yet (P.pendingEnder), let `up` below queue
          // it on release if the recovery window closes with the pointer still up (medium), or let
          // tick()'s own recoveryLeft()===0 check (fix round 2 -- see tick()'s own comment) arm
          // held.heavy right as that window naturally closes if the pointer is still down (heavy).
          // Every OTHER swipe-right (not mid a node-4 recovery) keeps firing 'medium' immediately,
          // exactly as before.
          const f=typeof G!=='undefined'&&G.fight&&G.fight.p1;
          // Fix-wave item 5 (final review M4): derived from CHAIN.nodes-1 (40_movedata.js), not a
          // hardcoded 4 -- the sim side of this exact decision (Fighter.act's own node-4 branch,
          // 50_fighter.js) already reads cn===CHAIN.nodes-1; if CHAIN.nodes ever changes, the sim
          // moves and this gesture would otherwise silently not.
          const atNode4Recovery=!!(f&&f.state==='ATTACK'&&f.chainNode===CHAIN.nodes-1&&f.phase&&f.phase()==='recovery'&&f.landed);
          P.pendingEnder=atNode4Recovery;
          if(!atNode4Recovery)this.q.push('medium');
          this._log('swipeR')}
        else{P.dashDir='L';P.dashFrames=0;this.q.push('dashBack');this._log('swipeL')}}});
    const up=e=>{const P=this._ptr;if(!P||P.id!==e.pointerId)return;this._ptr=null;
      if(P.blockOn){this.held.block=false;return} // hold-block or dash-back-hold-block, either way
      if(P.dashDir==='R'){
        // Fix round 1/2: a pending ender (the swipe began mid a chainNode-4 recovery, see pointermove
        // above) that's released before the recovery window's own close resolves to the medium ender
        // HERE, on release -- the immediate push above was suppressed specifically so this frame's
        // chainNode/phase could decide, not the swipe-cross frame's. P.heavyOn true means tick() already
        // armed held.heavy (the pointer was still down as the window naturally closed, fix round 2's
        // recoveryLeft()===0 check); that's the heavy ender's own path, nothing to push here.
        if(P.pendingEnder&&!P.heavyOn)this.q.push('medium');
        this.held.heavy=false;return} // clears whether or not heavy ever engaged
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
      // Fix round 2 (verdict-7.2-fix1 I1): a pendingEnder swipe (see pointermove's own comment) no
      // longer arms on ANY fixed hold-frame count -- fix round 1's own GESTURE.ENDER_HOLD_FRAMES(4)
      // sat inside the natural human flick-release band (the controller's own estimate: an ordinary
      // flick releases 2-6 frames after crossing SWIPE_PX), so a real fraction of INTENDED mediums
      // misfired into heavies. Decided at the recovery window's own natural close instead: this
      // fighter's read-only Fighter.recoveryLeft() (50_fighter.js) reports 0 on the exact last frame
      // Fighter.act will still read this ATTACK as 'recovery' -- arm held.heavy only then, so the
      // player gets nearly the WHOLE window (8 frames for a light-reached node 4, 14 for a medium-
      // reached one) to simply release for medium; only a hold still down as the window itself expires
      // resolves to heavy. A plain (non-pendingEnder) swipe-into-a-fresh-full-heavy from neutral is
      // unaffected -- it still arms on the generic HEAVY_HOLD_FRAMES, unchanged.
      if(P.dashDir==='R'&&!P.heavyOn){
        if(P.pendingEnder){
          const f=typeof G!=='undefined'&&G.fight&&G.fight.p1;
          if(f&&f.recoveryLeft&&f.recoveryLeft()===0){P.heavyOn=true;this.held.heavy=true;this._log('swipeRHold')}
        }else if(this.now()-P.actAt>=this.GESTURE.HEAVY_HOLD_FRAMES){
          P.heavyOn=true;this.held.heavy=true;this._log('swipeRHold')}}
      if(P.dashDir==='L'&&!P.blockOn){
        P.dashFrames++;
        if(P.dashFrames>=DASH_BACK.frames){P.blockOn=true;this.held.block=true;this._log('swipeLHold')}}}
    if(this._powerT0&&!this._powerShown&&this.now()-this._powerT0>=this.POWER_HOLD_FRAMES){this._powerShown=true;document.getElementById('powerPicker').classList.add('show')}},
  // Fix-wave item 3 (final review I3): every sim frame is an 8-frame-or-shorter window to land a
  // chain continuation (a light's own recovery is 8 frames, 133ms at 60Hz) and drain() used to clear
  // this.q outright every call -- a press one frame early was both dropped AND unrecoverable, ending
  // the chain right there. Now: this.q's raw pushes are folded into this._buf (each wrapped in a
  // {a,left,seq} entry -- see _buf's own comment above) the instant they're seen, then this.q is
  // cleared immediately, same as always (Input.q.length===0 right after every drain() call is
  // unchanged -- see the "Input.drain folds..." test). Every surviving _buf entry is re-presented
  // into `it` THIS frame too, not just the frame it was pushed on, so a press that arrives up to
  // GESTURE.BUFFER_FRAMES sim frames before act() can actually use it still lands. An entry is
  // dropped (never presented again) the instant either drop rule fires -- f.moveSeq having ticked
  // past the value recorded when it was queued (Fighter.moveSeq, the read-only "a new move started"
  // signal; Input never mutates sim state, so this is the only way it can tell a frame's intent
  // actually got used) or f.state entering HITSTUN/KNOCKDOWN/STUNNED (taking a hit must kill a
  // buffered action outright, not let it resolve into whatever this fighter is doing once it
  // recovers) -- or once its own BUFFER_FRAMES presentations are spent, whichever comes first. The
  // intent contract itself (the shape of `it`, one frame's worth) is unchanged; only a buffered
  // action's own lifetime is new.
  drain(){const it={light:false,medium:false,heavy:this.held.heavy,block:this.held.block,dashBack:false,special:0};
    const f=typeof G!=='undefined'&&G.fight&&G.fight.p1;
    for(const a of this.q)this._buf.push({a,left:this.GESTURE.BUFFER_FRAMES,seq:f?f.moveSeq:-1});
    this.q.length=0;
    const kept=[];
    for(const e of this._buf){
      if(f&&(f.moveSeq!==e.seq||f.state==='HITSTUN'||f.state==='KNOCKDOWN'||f.state==='STUNNED'))continue;
      // Node-4 in-combo ender special case: pointermove's own atNode4Recovery check (above) only
      // defers medium/heavy to the release/hold decision (P.pendingEnder) when a swipe-right crosses
      // SWIPE_PX WHILE already sitting in chainNode-4 recovery -- a swipe that crosses a few frames
      // BEFORE that window opens takes the plain immediate-push path instead (this.q.push('medium')
      // above), same as any other swipe, since at cross-time the window genuinely isn't open yet.
      // Buffering now keeps that push alive long enough to actually reach the window; the instant it
      // does (checked fresh, live, every drain() call -- not decided once at queue time), hand it off
      // to the SAME release/hold mechanism an in-window swipe already uses (P.up()'s handler pushes
      // 'medium' on release; tick()'s own recoveryLeft()===0 check arms held.heavy if the pointer's
      // still down when the window naturally closes) instead of presenting a plain 'medium' outright,
      // as long as the live pointer that produced it is still an unresolved swipe-right (P.heavyOn
      // false -- if the pointer already released before the window opened, this._ptr is null and it
      // just falls through to the plain medium below, exactly the frozen ruling's "otherwise as a
      // medium"). Scoped to CHAIN.nodes-1 (not a hardcoded 4 -- see fix-wave item 4/M4) so this stays
      // correct if CHAIN.nodes ever changes.
      if(e.a==='medium'&&f&&f.state==='ATTACK'&&f.chainNode===CHAIN.nodes-1&&f.phase&&f.phase()==='recovery'&&f.landed&&
         this._ptr&&this._ptr.dashDir==='R'&&!this._ptr.heavyOn){
        this._ptr.pendingEnder=true;continue}
      if(e.a==='powerAuto'){const p=f?f.power:0;let n=0;for(let k=3;k>=1;k--)if(p>=100*k){n=k;break}it.special=n}
      else if(e.a.startsWith('special'))it.special=+e.a[7];
      else it[e.a]=true;
      e.left--;if(e.left>0)kept.push(e)}
    this._buf=kept;
    return it}};

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
  //   2. finish a light chain already open (Fighter.act's own recovery+chain+landed window) --
  //      Task 7.5: `openedMedium` (armed by step 9's own medium opener, cleared by step 8's light
  //      opener) makes this the mixed M-L-L-L-M grammar the controller ruling asks for, not a flat
  //      all-light follow: nodes 1-3 still press light (three L's), but the node-4->5 transition
  //      (me.chainNode===CHAIN.nodes-1, the chain's last regular continuation) presses medium instead
  //      when the chain was opened by one, landing CHAIN.enders.medium's push/knockdown same as a
  //      player-thrown M-L-L-L-M. A light-opened chain (openedMedium false) keeps the old flat
  //      all-light follow through node 5, unchanged from before this task.
  //   3. otherwise, if busy, do nothing (can't act)
  //   4. Task 7.5 (dash-back read): read a foe's medium dash-in DASH_READ_LEAD frames before its
  //      hitbox goes active and dash back through it instead of blocking -- DASH_BACK's own 8 frames
  //      of i-frames (50_fighter.js) comfortably cover the foe's active window at this lead, at any
  //      gap (effStartup 10..14, see 40_movedata.js's own dash-in cap comment), so this always lands a
  //      real dexterity dodge (Task 7.3) rather than merely eating chip damage -- verified empirically
  //      (see the task report) across the full close/far effStartup range, not a single seed pick.
  //      Only ever a SINGLE exact-frame trigger (foe.f steps through every integer, never skipping
  //      DASH_READ_LEAD frames-before-active), so this can't re-fire or stack with itself. Checked
  //      ahead of the plain block-react below so it wins that frame's decision outright; block may
  //      still have fired on earlier frames of the same startup (BLOCK doesn't count as busy() --
  //      Fighter.busy() only excludes IDLE/BLOCK -- so switching from holding block into DASH here is
  //      a normal act() transition, not an interruption) -- riding out the early, harmless part of the
  //      startup in block and finishing with the timed dodge is strictly better than either alone.
  //      Scoped to 'medium' only (never heavy/specials), the same scope decideIntercept (55_ai.js)
  //      uses for the offensive read this dodge mirrors -- mediums are the grammar's own dash-in/
  //      approach tool, the move type this read is meant to punish.
  //   5. react to a visible medium/heavy: block once its startup clock has run REACT frames (leaves
  //      the move's last couple of startup frames as a buffer, mirroring the AI tiers' 'react' field)
  //   6. bail out of a telegraphed heavy charge while low on hp
  //   7. fire the strongest special affordable
  //   8. chain lights whenever in light range -- also where `openedMedium` clears to false (a
  //      light-range opener always starts the plain all-light plan, whether or not the foe was just
  //      mixed off a previous medium-opened chain)
  //   9. Fix-wave item 8: every 5th time the foe enters blockstun (a mix-up, not spam — counted on
  //      the rising edge of BLOCKSTUN so one long blockstun window only counts once), arm a heavy
  //      instead of continuing the light chain
  //   10. Fix-wave item 8: close distance with a medium (its own startup dash covers real ground) when
  //      out of light range and the foe isn't mid-attack, on a 40-frame cooldown — the bot used to
  //      just stand there outside light range forever, which is why intercept/medium-punish never
  //      fired in the run that certified the tiers (final review, Important) and the monotone curve
  //      was driven almost entirely by `attack`. Task 7.5: this is also the M-L-L-L-M chain's own
  //      opener -- arms `openedMedium=true` so step 2's own chain-continuation read presses the mixed
  //      pattern once this medium actually lands and the chain opens.
  competent:seed=>{const REACT=6,LOW_HP=0.3,CLOSE_CD=40,MIXUP_EVERY=5,DASH_READ_LEAD=2;
    let closeCd=0,openings=0,wasBlockstun=false,heavyHold=0,openedMedium=false;
    return{next(fight,me,foe){
    const it=Ctrl.EMPTY();
    if(heavyHold>0){heavyHold--;it.heavy=true;return it}
    // Task 7.2: me.move.chain is gone (the fixed ladder no longer exists) -- me.chainNode>=1 &&
    // <CHAIN.nodes is the grammar's own "still inside an open chain window" check, same one AI.make's
    // decidePunish 'follow' phase uses. Task 7.5: Ctrl.competent now learns the same mixed M-L-L-L-M
    // grammar AI.make's comboMix tiers (t3+) learn -- see comboPlanFor's own comment in 55_ai.js for
    // the frozen shape this mirrors -- rather than the old flat all-light follow every node, so the
    // yardstick bot the tier gate is measured against actually exercises the grammar it's gating.
    // me.chainNode===CHAIN.nodes-1 is the chain's last regular continuation (the node-4->5 transition,
    // Fighter.act's own boundary for offering the ender) -- only THAT node swaps to medium, and only
    // when the chain now in progress was opened by one (openedMedium, armed/cleared by steps 8/10
    // below); nodes 1..CHAIN.nodes-2 always press light regardless, and a light-opened chain
    // (openedMedium false) keeps the old flat all-light follow through node 5, unchanged.
    if(me.state==='ATTACK'&&me.phase()==='recovery'&&me.landed&&me.chainNode>=1&&me.chainNode<CHAIN.nodes){
      if(openedMedium&&me.chainNode===CHAIN.nodes-1){it.medium=true;return it}
      it.light=true;return it}
    if(me.busy())return it;
    // Task 7.5 (dash-back read): see this controller's own numbered comment above for the full
    // reasoning -- foe.effStartup is always set once foe.state==='ATTACK' (setupDash runs inside the
    // same startMove() call that sets it), the || fallback only guards a hand-built ATTACK state that
    // skipped startMove entirely, same fallback decideBlock (55_ai.js) already uses for the same field.
    if(foe.state==='ATTACK'&&foe.moveName==='medium'&&foe.f===(foe.effStartup||foe.move.startup)-DASH_READ_LEAD){it.dashBack=true;return it}
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
    if(dist<lightRange){openedMedium=false;it.light=true;return it}
    if(foe.state!=='ATTACK'&&closeCd===0){openedMedium=true;it.medium=true;closeCd=CLOSE_CD;return it}
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

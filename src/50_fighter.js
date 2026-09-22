class Fighter{
  constructor(def,side,ctrl){this.def=def;this.side=side;this.face=side;this.ctrl=ctrl;
    this.x=side===1?STAGE_W/2-160:STAGE_W/2+160;this.width=48;this.hp=def.hp;this.maxHp=def.hp;this.power=0;
    this.state='IDLE';this.f=0;this.move=null;this.moveName=null;this.hits=null;this.landed=false;
    this.combo=0;this.stun=0;this.inv=0;this.blockAge=0;this.dx=0; // last tick's x delta; Rig.poseFor reads it to pick idle vs walk
    // Task 7.2: chainNode is the frozen CHAIN grammar's own live state -- 0 when not chaining, 1..5
    // while a light/medium opener/continuation is in flight (set by startMove's own node argument),
    // never touched by any move outside the grammar (heavy from neutral, s1/s2/s3 always leave it at
    // whatever it already was, which is 0 unless something is badly wrong -- see startMove/act below).
    // Reset to 0 in exactly two places: tick()'s own ATTACK 'done' transition (covers a whiff, a
    // player simply not continuing, and the ender's own post-recovery reset -- all three are "this
    // fighter's ATTACK sequence just ended without a further continuation") and Fight.resolve's hit/
    // parry branches (covers "taking a hit resets it" -- an interrupted mid-chain recovery never gets
    // to end on its own).
    this.chainNode=0;
    this.parryLock=0;this.blockPressedAt=0;this.pressTick=0;this._parried=false;this._mdCache=null;
    // Task 5.2: parryBonus widens PARRY_WINDOW by this many frames (Sponsor perk "Parry Insurance",
    // set by G.startFight from Sponsors.apply's parryWindow) -- 0 for every fighter that isn't the
    // live player Fighter a fight actually started with an owned insurance perk. secondWindSpent:
    // see BUFFS.secondWind's own comment (47_buffs.js) for why this one-shot flag lives on the
    // Fighter itself rather than as buff-local state. guardActive (release pass): plain Fighter state
    // BUFFS.tutorialGuard reads instead of the global Tutorial object -- see that buff's own comment
    // (47_buffs.js) for why; defaults false for every fighter, set/cleared only by G.startTutorial/
    // Tutorial.tick on the tutorial's own dummy p2.
    this.parryBonus=0;this._secondWindSpent=false;this.guardActive=false;
    // foeDist (Task 6.2): the live hurtbox-edge gap to the opponent, written by Fight.step just
    // before act() runs each frame -- null until the first real step() (a bare `new Fighter()` in a
    // unit test, or a manual startMove() call before any step()), which setupDash below treats as
    // "no distance info" and resolves to the old fixed-dash behavior rather than ever guessing.
    // dashLeft/dashRate/effStartup are the per-instance dash plan setupDash computes once, at
    // startMove time, from the move's track/stepIn/dash fields and this snapshot -- see setupDash's
    // own comment for the three shapes and why only the track (medium) shape can ever push
    // effStartup past the move's own m.startup.
    this.foeDist=null;this.dashLeft=0;this.dashRate=0;this.effStartup=0;
    this.buffs=[]; // resolved BUFFS objects (Buffs.apply sets this once; Fight never re-resolves ids per frame)
    // Task 7.1: live timed-effect instances ({id,left,stacks,potency,source}), owned and mutated only
    // by Effects.apply/tick/clear (48_effects.js) -- presentation (70_render.js/72_fx.js) reads this
    // array for HUD badges but never writes it, same read-only boundary fighter.buffs already gets.
    this.effects=[];
    // wasKnockedDown (Task 3.6 refactor): set true the instant this fighter enters KNOCKDOWN
    // (setState below), stays true through the knockdown timer and the post-getup invulnerable
    // window, then self-clears in tick() the frame after inv actually reaches 0 — giving AI.make's
    // 'punish' behavior a one-frame window to catch "just got up" that's scoped to real knockdowns
    // only. Previously that same one-frame window was inferred from a plain inv 1->0 edge, which
    // happened to also work for KNOCKDOWN's own get-up i-frames (10) only because they outlast
    // DASH_BACK's own i-frames (8) relative to its 12-frame duration — a coincidence of those two
    // constants, not a real invariant, so nothing stopped a future DASH_BACK retune from making a
    // plain dash-back misread as a knockdown get-up. This flag is scoped to KNOCKDOWN specifically
    // and never touches DASH at all.
    this.wasKnockedDown=false;
    // _kdCounter (fix-wave item 9): drives wasKnockedDown's self-clear, armed to KNOCKDOWN.frames+
    // KNOCKDOWN.inv the instant KNOCKDOWN starts (setState below) and decremented once per tick()
    // regardless of state — see tick()'s own comment for why this replaced the old state==='IDLE'
    // gate (a controller, AI.make's decidePunish, used to reach into the OPPONENT Fighter it doesn't
    // own and clear wasKnockedDown itself the moment it acted on the window, exactly to paper over
    // that gate's one real gap: if the foe's OWN controller made it act this same frame, its state
    // could read something other than IDLE right when tick()'s old check ran, leaving the flag stuck
    // true until some later, unrelated IDLE frame). _kdCounter never looks at .state at all, so it
    // can't be defeated the same way; AI.make now only ever reads wasKnockedDown.
    this._kdCounter=0;
    // interceptedThisMove (Task 7.5, 7.3 review follow-up): set true the instant THIS move instance
    // has already been credited an intercept (Fight.resolve, 60_fight.js) -- reset in startMove below,
    // alongside every other per-instance field (hits/landed/chainNode). Guards the same "once per
    // move, not once per sub-hit" property hitstop's own `!m.hits||last` gate already gives hitstop,
    // for a case that gate can't cover: an intercept's own eligibility is read off the DEFENDER's
    // live state (def.state==='ATTACK'&&startup&&dash/track), not the attacker's sub-hit index, so a
    // multi-hit special (s1/s2/s3) whose early sub-hit intercepts a dash-in, knocks the defender into
    // HITSTUN, but leaves enough of its own active window for the defender to recover and throw a
    // FRESH vulnerable dash-in before the special's later sub-hits land, would otherwise re-credit the
    // x1.5 dmg/+15 power/INTERCEPT! event a second time off what is, from the attacker's side, still
    // one single move activation. See Fight.resolve's own comment for exactly where this is read/set.
    this.interceptedThisMove=false}
  get front(){return this.x+this.face*this.width/2}
  busy(){return this.state!=='IDLE'&&this.state!=='BLOCK'}
  setState(s,f=0){if(s==='KNOCKDOWN'){this.wasKnockedDown=true;this._kdCounter=KNOCKDOWN.frames+KNOCKDOWN.inv}this.state=s;this.f=f}
  // MOVES[name] shallow-merged with this.def.moves?.[name]; cached per fighter instance (no per-frame alloc).
  moveDef(name){let c=this._mdCache;if(!c)c=this._mdCache=new Map();let d=c.get(name);
    if(!d){d=Object.assign({},MOVES[name],this.def.moves&&this.def.moves[name]);c.set(name,d)}
    return d}
  // Task 7.2: `node` (1..5) is the CHAIN grammar's own node number for this move instance -- passed
  // explicitly by every call site that's part of a chain (the IDLE/BLOCK opener branch and the
  // ATTACK-recovery continuation branch in act(), below); omitted (0) for every move outside the
  // grammar (heavy from neutral, s1/s2/s3), so this.chainNode stays the "0 when not chaining"
  // invariant the frozen interface asks for. `overrides`, when given, is shallow-merged on top of the
  // cached moveDef (used only by the in-combo heavy ender, CHAIN.enders.heavy -- see act()'s own
  // node-4 branch) so the per-fighter moveDef cache itself is never mutated or duplicated per-variant.
  startMove(name,node,overrides){
    this.move=overrides?Object.assign({},this.moveDef(name),overrides):this.moveDef(name);
    this.moveName=name;this.hits=new Set();this.landed=false;this.chainNode=node===undefined?0:node;
    this.interceptedThisMove=false;
    if(this.move.cost)this.power-=this.move.cost;this.setupDash();this.setState(this.move.charge?'CHARGE':'ATTACK')}
  // Movement inside moves (Task 6.2): computes dashLeft/dashRate/effStartup once, from the move's own
  // track/stepIn/dash fields and the this.foeDist snapshot Fight.step wrote before this frame's act()
  // (or null, see the constructor's own comment). Three shapes, checked in this order:
  //  - m.track (medium): a range-tracking dash-in -- up to m.track px at DASH_TRACK_SPEED px/frame,
  //    stopping the instant the gap closes to moveDef('light').range so the move's own (longer)
  //    reach lands without ever overshooting into the foe (separate() would fight it every frame if
  //    it did). This is the only shape whose travel can outlast the move's own m.startup, since a far
  //    foe can need more frames than the swing's base startup to close -- effStartup grows to fit.
  //  - m.stepIn (light1 only, and only when foeDist is known and beyond light range at the moment the
  //    move starts): a shorter lunge, up to m.stepIn px at DASH_STEPIN_SPEED px/frame. stepIn/
  //    DASH_STEPIN_SPEED always equals light1's own m.startup (110/22=5), so effStartup never needs
  //    to grow for this shape -- it either closes the gap inside its own swing or it whiffs.
  //  - m.dash (every other move, and light1 when it's already within range): the original mechanic,
  //    bit-for-bit unchanged -- m.dash px smoothly divided over the move's own m.startup frames.
  // No move data at all (e.g. heavy, the specials) leaves dashLeft 0 and effStartup at m.startup.
  setupDash(){
    const m=this.move,lightRange=this.moveDef('light').range;
    if(m.track){
      const need=this.foeDist==null?0:Math.max(0,this.foeDist-lightRange);
      this.dashLeft=Math.min(need,m.track);
      // Task 7.3 (frozen ruling): DASH_TRACK_SPEED is the floor, not a fixed rate -- the per-frame
      // speed scales up to max(DASH_TRACK_SPEED, dashLeft/14) so effStartup never needs to grow past
      // 14 frames, however far the gap. The 1e-9 epsilon on the ceil below guards a floating divide-
      // then-multiply roundtrip at dashLeft===m.track (300/(300/14) can land a hair over 14.0 in
      // float64) from ever reporting 15 -- see the "far medium effective startup <=14, at any gap"
      // test, which sweeps gaps right up to and past m.track.
      this.dashRate=this.dashLeft>0?Math.max(DASH_TRACK_SPEED,this.dashLeft/14):DASH_TRACK_SPEED;
      this.effStartup=Math.max(m.startup,this.dashLeft>0?Math.ceil(this.dashLeft/this.dashRate-1e-9):0)}
    else if(m.stepIn&&this.foeDist!=null&&this.foeDist>lightRange){
      this.dashLeft=Math.min(this.foeDist-lightRange,m.stepIn);this.dashRate=DASH_STEPIN_SPEED;
      this.effStartup=m.startup} // stepIn/DASH_STEPIN_SPEED===m.startup by construction; never grows
    else if(m.dash){this.dashLeft=m.dash;this.dashRate=m.dash/m.startup;this.effStartup=m.startup}
    else{this.dashLeft=0;this.dashRate=0;this.effStartup=m.startup}}
  // Task 6.2 fix round 1: dashLeft/dashRate/effStartup are only meaningful while a move (or its
  // charge) is actually in flight -- clear them alongside move/moveName at every site a move ends
  // or is cancelled (CHARGE cancelled, a move completes, a hit lands on this fighter, a parry stuns
  // the attacker), so a stale plan from a finished/interrupted move can never leak into a later
  // frame's checks (e.g. AI.make's decideBlock reading foe.effStartup on a fighter that's back to
  // IDLE would otherwise see the last move's now-meaningless value instead of 0).
  clearMove(){this.move=null;this.moveName=null;this.dashLeft=0;this.dashRate=0;this.effStartup=0}
  activeSpan(){const m=this.move,n=m.hits||1;return n*m.active+(n-1)*(m.gap||0)}
  phase(){const m=this.move;if(!m||this.state!=='ATTACK')return null;const su=this.effStartup,act=this.activeSpan();
    return this.f<su?'startup':this.f<su+act?'active':this.f<su+act+m.recovery?'recovery':'done'}
  // Fix round 2 (verdict-7.2-fix1 I1): a read-only helper Input's pointermove/tick use (never mutating
  // sim state -- same boundary as everything else Input reads off G.fight.p1) to decide the in-combo
  // heavy ender's own gesture at the chainNode-4 recovery window's NATURAL close instead of a fixed
  // hold-frame count (fix round 1's own GESTURE.ENDER_HOLD_FRAMES, deleted -- it sat inside the
  // natural human flick-release band and misfired intended mediums into heavies). Returns null outside
  // an ATTACK's own recovery phase; otherwise the count of FURTHER recovery frames after this one --
  // 0 means THIS is the last frame phase() will still report 'recovery' (the very next tick() call
  // flips it to 'done' and resets chainNode to 0), which is exactly the frame Input arms held.heavy on
  // so this same frame's act() call (already past, this tick -- Input.tick() runs before Fighter.act in
  // Fight.step's own ordering) still reads intent.heavy while chainNode is still 4.
  recoveryLeft(){const m=this.move;if(!m||this.state!=='ATTACK')return null;
    const su=this.effStartup,act=this.activeSpan();if(this.f<su+act)return null;
    const left=su+act+m.recovery-1-this.f;return left>=0?left:null}
  hitIndex(){const m=this.move,k=this.f-this.effStartup,span=m.active+(m.gap||0);if(k<0)return-1;const i=Math.floor(k/span);return(k%span)<m.active&&i<(m.hits||1)?i:-1}
  hitbox(){if(this.phase()!=='active')return null;const a=this.front,b=this.front+this.face*this.move.range;return{x0:Math.min(a,b),x1:Math.max(a,b)}}
  hurtbox(){return{x0:this.x-this.width/2,x1:this.x+this.width/2}}
  // Consume one frame of intent. Called before tick().
  act(intent){this.pressTick++; // monotonic frame counter (Fighter has no fight-frame ref of its own); stamps blockPressedAt
    const prevAge=this.blockAge;this.blockAge=intent.block?this.blockAge+1:0;
    // Parry lockout bookkeeping: a block press that closes its (possibly widened, see parryBonus
    // above) PARRY_WINDOW without a parry arms a PARRY_LOCKOUT-frame lock; a successful parry
    // (flagged by Fight.resolve) clears it. Both bounds below add this.parryBonus so a fighter
    // holding Parry Insurance gets the lockout armed exactly when THEIR widened window closes, not
    // the base PARRY_WINDOW -- Fight.detect's own parry check (60_fight.js) widens by the same
    // parryBonus, and these two must stay in lockstep or a widened-window parry attempt would find
    // parryLock already armed from a lockout that fired too early against the un-widened window.
    if(prevAge===0&&this.blockAge===1){this.blockPressedAt=this.pressTick;this._parried=false}
    if(intent.block&&this.blockAge===PARRY_WINDOW+this.parryBonus+1&&!this._parried)this.parryLock=PARRY_LOCKOUT;
    if(!intent.block&&prevAge>0&&prevAge<=PARRY_WINDOW+this.parryBonus&&!this._parried)this.parryLock=PARRY_LOCKOUT;
    const S=this.state;
    if(S==='IDLE'||S==='BLOCK'){
      if(intent.special&&this.power>=this.moveDef('s'+intent.special).cost)return this.startMove('s'+intent.special);
      if(intent.dashBack){this.inv=DASH_BACK.inv;return this.setState('DASH')}
      // Task 7.2: openers (CHAIN.openers) always start a brand-new chain at node 1, regardless of
      // whatever chainNode a previous, already-finished chain left behind (it's already been reset to
      // 0 by tick()'s own 'done' transition or Fight.resolve's hit-taken reset by the time IDLE/BLOCK
      // can be acted on again -- this just makes the opener's own node explicit rather than relying on
      // that).
      if(intent.medium)return this.startMove('medium',1);
      if(intent.light)return this.startMove('light',1);
      if(intent.heavy)return this.startMove('heavy');
      const want=intent.block?'BLOCK':'IDLE';if(want!==S)this.setState(want)}
    // Task 7.2: the five-node combo grammar (CHAIN, 40_movedata.js) replaces the old fixed
    // light1->light5/medium->light1 `chain` pointers. Gated on this.chainNode (0 for every move
    // outside the grammar -- heavy from neutral, s1/s2/s3 -- so neither branch below ever fires for
    // them, exactly like the old `this.move.chain` falsy check did) instead of a per-move field.
    // Nodes 1-3 (chainNode<4): either opener continues the chain one node further. Node 4: the last
    // regular continuation (light or medium, becoming node 5 -- the chain's real ender, CHAIN.enders
    // read by Fight.resolve at hit-resolve time) OR the shortened heavy ender (CHAIN.enders.heavy --
    // a 14-frame charge instead of MOVES.heavy's normal 22, applying the attacker's own def.sigEffect
    // once it lands). Node 5 offers no further continuation ("no sixth node") -- chainNode stays 5
    // until the ender's own recovery ends and resets it to 0.
    else if(S==='ATTACK'&&this.phase()==='recovery'&&this.landed){
      const cn=this.chainNode;
      if(cn>=1&&cn<CHAIN.nodes-1){
        if(intent.light)return this.startMove('light',cn+1);
        if(intent.medium)return this.startMove('medium',cn+1)}
      else if(cn===CHAIN.nodes-1){
        // Fix round 1 (verdict-7.2 C1): intent.heavy is checked FIRST here, ahead of light/medium.
        // The keyboard alias Shift+K (30_input.js) sets intent.medium (queued) and intent.heavy (held)
        // in the very same keydown event, so both can legitimately be true on the same frame here --
        // heavy must win that tie, or the in-combo heavy ender is unreachable from that key combo. The
        // touch gesture's own race (a fresh swipe-right pushing 'medium' immediately, long before
        // held.heavy ever arms) is fixed at the source instead, in Input's own pointermove handler --
        // see its comment for why this reordering alone can't fix that one (intent.heavy simply isn't
        // true yet on the frame intent.medium is read there).
        if(intent.heavy)return this.startMove('heavy',CHAIN.nodes,CHAIN.enders.heavy);
        if(intent.light)return this.startMove('light',CHAIN.nodes);
        if(intent.medium)return this.startMove('medium',CHAIN.nodes)}}
    // Fix-wave item 5 (final review, Important): releasing heavy early used to always cancel to IDLE
    // outright (clearMove, no swing) -- the README (and the swipe-and-hold gesture's own naming)
    // promised "release after a short charge to swing", which this branch never actually did; only a
    // FULL hold (tick()'s own CHARGE case, this.f>=this.move.charge) ever fired the swing. Now: once
    // this.f (frames already spent charging, same counter setupDash/tick's own CHARGE case reads) has
    // reached HEAVY_MIN_CHARGE, releasing transitions straight to ATTACK (the swing fires from
    // whatever startup/active/recovery the move already has -- setState's own f=0 default restarts
    // that timing fresh, exactly like the full-charge auto-fire already does) instead of cancelling;
    // below HEAVY_MIN_CHARGE it still cancels to IDLE exactly as before (a too-early tap/twitch is
    // still a no-op, not a free swing). A full hold through this.move.charge frames still auto-fires
    // via tick()'s own CHARGE case, untouched by this branch. Gesture layer (30_input.js) and keyboard
    // (L key) are both unaffected -- both already just toggle intent.heavy true/false; this is the only
    // place that reads what releasing it actually does.
    else if(S==='CHARGE'&&!intent.heavy){
      if(this.f>=HEAVY_MIN_CHARGE)this.setState('ATTACK');
      // Fix round 1 (found while testing verdict-7.2 C1's fix): a too-early release cancels straight
      // to IDLE without ever reaching tick()'s own phase==='done' reset -- for the in-combo heavy
      // ender specifically (chainNode was set to CHAIN.nodes by startMove's own node argument) this
      // used to leave chainNode stuck at 5 while genuinely back at IDLE, violating "0 when not
      // chaining". Harmless no-op for a plain neutral heavy cancel, whose chainNode is already 0.
      else{this.clearMove();this.chainNode=0;this.setState('IDLE')}}}
  // Advance one frame of the state machine.
  tick(){
    // Self-clear wasKnockedDown the tick after _kdCounter (armed to KNOCKDOWN.frames+KNOCKDOWN.inv
    // the instant KNOCKDOWN starts — setState above) counts all the way down, checked here before
    // this tick's own decrement, against the value left over from the END of the previous tick —
    // exactly what a controller's next() call for THIS step already read. That one-tick delay is
    // what gives AI.make's 'punish' behavior its single-frame "just got up" window: the frame
    // wasKnockedDown&&inv===0 is visible to next() is the same frame this check clears it for next
    // time (inv and _kdCounter count down in lockstep from the moment KNOCKDOWN ends, since nothing
    // else touches _kdCounter — see setState's own comment for why inv alone, or gating on
    // state==='IDLE', both used to leave a real gap here).
    if(this.wasKnockedDown&&this._kdCounter===0)this.wasKnockedDown=false;
    const prevX=this.x;this.f++;if(this.inv>0)this.inv--;if(this.parryLock>0)this.parryLock--;
    if(this._kdCounter>0)this._kdCounter--;
    switch(this.state){
      case'CHARGE':if(this.f>=this.move.charge)this.setState('ATTACK');break;
      // Dash-in movement (Task 6.2): consumes this.dashLeft (set once by setupDash) at up to
      // this.dashRate px/frame, through this.effStartup -- same '<=' boundary the old flat-dash check
      // used (this.f<=m.startup), so a move's last dash increment still lands on the same frame its
      // hitbox first goes active (see 'medium as a combo ender' test's own comment on this overlap).
      // min() caps the final increment to whatever's left so the total travelled is always exactly
      // dashLeft's original value -- never overshoots past the foe, whatever DASH_TRACK_SPEED/
      // DASH_STEPIN_SPEED divides unevenly.
      case'ATTACK':{const m=this.move;
        if(this.dashLeft>0&&this.f<=this.effStartup){const step=Math.min(this.dashRate,this.dashLeft);this.x+=this.face*step;this.dashLeft-=step}
        // Task 7.2: chainNode resets to 0 here whenever an ATTACK sequence ends on its own (a whiff --
        // landed stayed false the whole active window; the player simply not pressing a continuation
        // during a landed move's recovery; or the chain's own ender finishing its recovery) -- the
        // single site that covers every "stopped chaining" case the frozen ruling lists, since act()'s
        // own continuation branches above already require chainNode to still be in [1,CHAIN.nodes) to
        // offer anything, so a fighter that reaches here with a non-zero chainNode is, by construction,
        // one whose chain window just closed for good. Fight.resolve's own hit/parry branches cover the
        // other reset case ("taking a hit resets it"), where this natural 'done' transition never runs.
        if(this.phase()==='done'){this.clearMove();this.landed=false;this.chainNode=0;this.setState('IDLE')}break}
      case'DASH':this.x-=this.face*DASH_BACK.dist/DASH_BACK.frames;if(this.f>=DASH_BACK.frames)this.setState('IDLE');break;
      case'HITSTUN':case'BLOCKSTUN':case'STUNNED':if(this.f>=this.stun)this.setState('IDLE');break;
      case'KNOCKDOWN':if(this.f>=KNOCKDOWN.frames){this.inv=KNOCKDOWN.inv;this.setState('IDLE')}break}
    this.x=clamp(this.x,EDGE_PAD,STAGE_W-EDGE_PAD);
    this.dx=this.x-prevX}}

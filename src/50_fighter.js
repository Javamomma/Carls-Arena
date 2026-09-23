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
    // Task 12.1: chainLights/chainMediums are the live per-type counts CHAIN.rule (40_movedata.js)
    // checks against -- how many lights/mediums THIS chain instance has actually thrown so far, reset
    // to {1,0}/{0,1} the instant a fresh opener starts (act()'s IDLE/BLOCK branch, below) and read (and
    // incremented) by act()'s own continuation branch to decide whether a light/medium continuation is
    // still legal. Never touched by anything outside a chain opener/continuation -- heavy from neutral,
    // s1/s2/s3, and the in-combo heavy ender (moveName 'heavy') all leave these alone, same "0 unless
    // something is badly wrong" invariant chainNode itself already keeps for non-grammar moves.
    this.chainLights=0;this.chainMediums=0;
    // Task 12.1 fix round 2 (frozen ruling, from the Phase 9 final review): lastChainExitFrame --
    // stamped with fight.frame at every site a chain that was actually open (chainNode>0) closes:
    // the natural end-of-recovery reset (tick()'s own 'done' transition), the in-combo heavy ender's
    // own early-release cancel (act()'s CHARGE branch), a hit landing on this fighter mid-chain and a
    // parry landing on this fighter's own attack (both Fight.resolve, 60_fight.js), and a deliberate
    // dash-back pressed during an open chain continuation window (act()'s own ATTACK-recovery branch,
    // below -- MCoC's own named backdraft setup, "swipe back after your third light..."). -999 (never
    // a real frame number) is the untouched default -- Task 12.2's own BACKDRAFT reads this to gate a
    // 30-frame window after the exit, so a fight that never actually opened a chain must never read as
    // "just exited one 999 frames ago" by coincidence.
    this.lastChainExitFrame=-999;
    // Task 12.1 (frozen interface): bufferedSpecial -- set (sim-side, from live intent, never Input's
    // own buffer) the instant an S1/S2 press arrives during the medium ender's own recovery (chainNode
    // ===CHAIN.nodes, moveName==='medium'); consumed on the first frame act() can actually start a new
    // move (the very next frame after recovery ends, when state has already flipped to IDLE) -- see
    // act()'s own IDLE/BLOCK branch and IDLE-recovery capture branch, below, and Fight.resolve's hit
    // branch (60_fight.js) for the one place it's cleared early (this fighter got hit before ever
    // reaching IDLE, interrupting the buffered press). 0 means "nothing buffered", matching intent.
    // special's own 0='none' convention (30_input.js) rather than null.
    this.bufferedSpecial=0;
    // Task 12.1 (frozen interface): parryStunned -- true only while this fighter is STUNNED specifically
    // because THEY were the one whose attack got parried (Fight.resolve's own parry branch, 60_fight.js
    // sets it alongside the existing stun/setState('STUNNED') arming), as opposed to a plain STUNNED
    // from EFFECTS.stun (mongo's kit, carl's s3, etc.) which never touches this flag. Fight.resolve's
    // hit branch reads it (before clearing it, win or lose) to decide whether a landed heavy earns the
    // PUNISH_MUL bonus; Fighter.tick's own STUNNED->IDLE natural-timeout transition also clears it, so a
    // parry stun that times out unpunished never leaves a stale flag for some later, unrelated heavy to
    // cash in on.
    this.parryStunned=false;
    // Fix-wave item 3 (final review I3): a read-only move-instance counter, incremented once per
    // startMove call (below) -- Input's own intent buffer (30_input.js) reads this to detect "this
    // fighter started a new move since I queued my buffered action" without needing any write access
    // into Fighter/Fight at all (Input only ever reads sim state). Never reset, never read by
    // anything sim-side; purely an outward signal.
    this.moveSeq=0;
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
    this.interceptedThisMove=false;
    // refundedThisMove (Task 9.1): mirrors interceptedThisMove's own per-move-instance flag pattern --
    // set true the first time THIS move instance's m.refundOnBlock actually refunds power (Fight.
    // resolve's block branch, 60_fight.js), so a multi-hit move (e.g. carl's S2 Boot Party, 5 hits)
    // refunds once per blocked MOVE, not once per blocked sub-hit. Reset in resetPerMove() below,
    // alongside interceptedThisMove.
    this.refundedThisMove=false
    // _mods (Task 8.0 pre-art seam): Effects.mods' own pooled result object for this fighter --
    // allocated lazily on first use (Effects.mods, 48_effects.js) and overwritten in place on every
    // call rather than a fresh {atkMul,armorDelta,critDelta} literal each time. Callers (Fight.resolve)
    // must read it immediately and never retain it across frames -- the next Effects.mods(this) call,
    // for either side of an exchange, mutates the same object.
    this._mods=null}
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
  // Task 9.2: `fight`, when given, is only ever read for Passives.onSpecial (49_passives.js) below --
  // optional (every pre-existing call site, including every direct unit-test F.startMove(...) call
  // with no 5th arg, still works unchanged, just skipping that one hook). act() (below) is the only
  // real call site that ever passes it, threaded in from Fight.step's own act(i,this) call.
  startMove(name,node,overrides,fight){
    this.moveSeq++; // fix-wave item 3 (final review I3): once per move instance, see its own comment above
    this.move=overrides?Object.assign({},this.moveDef(name),overrides):this.moveDef(name);
    this.moveName=name;this.chainNode=node===undefined?0:node;
    this.resetPerMove();
    if(this.move.cost)this.power-=this.move.cost;this.setupDash();this.setState(this.move.charge?'CHARGE':'ATTACK');
    // Task 9.2: Passives.onSpecial fires for a real special activation only (s1/s2/s3 -- name is
    // never anything else at this exact 2-char shape; a chain continuation is 'light'/'medium', the
    // in-combo heavy ender is 'heavy', neither of which matches). Gated internally (Donut's Royal
    // Disdain only) -- a no-op call for every other fighter's s1/s2/s3, and for every fight this was
    // started without a live `fight` reference (every direct unit test that calls startMove/act with
    // no fight arg).
    if(fight&&/^s[123]$/.test(name))Passives.onSpecial(fight,this,this.move)}
  // Task 8.0 (pre-art seam): the exact by-hand reset startMove used to do inline, pulled into its own
  // named method -- these three fields are unconditional resets to the same fixed value on every move
  // (a fresh empty hits Set, landed false, interceptedThisMove false), unlike everything else
  // startMove touches (move/moveName/chainNode carry the call's own arguments, not a fixed reset
  // value; setupDash() is already its own separate per-instance computation). Deliberately does NOT
  // touch: chainNode (the CHAIN grammar owns it -- startMove sets it explicitly from `node`, not a
  // reset, and resetting it here would stomp the grammar's own in-progress count); guardActive/
  // parryBonus (startMove never touched either -- they're tutorial/sponsor-perk state with their own
  // owners, see the constructor's own comments); dashLeft/dashRate/effStartup (already owned and
  // computed by setupDash(), called right after this, never by a fixed reset).
  resetPerMove(){this.hits=new Set();this.landed=false;this.interceptedThisMove=false;this.refundedThisMove=false}
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
  // Consume one frame of intent. Called before tick(). Task 9.2: `fight`, when given (Fight.step's
  // own act(i,this) call -- see its comment), rides through to the one startMove call below that can
  // ever start a real special (s1/s2/s3), purely so Passives.onSpecial has a live fight to hook into.
  // Every other startMove call site here (openers, chain continuations, the in-combo heavy ender)
  // passes no `fight` at all -- startMove's own regex guard (`/^s[123]$/`) would skip them anyway,
  // since none of those names ever matches, but there's no reason to thread it through call sites
  // that can never need it.
  act(intent,fight){this.pressTick++; // monotonic frame counter (Fighter has no fight-frame ref of its own); stamps blockPressedAt
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
      // Task 12.1 (frozen interface): a buffered S1/S2 (armed below, during the medium ender's own
      // recovery) is consumed on the very first frame act() can start a new move -- ahead of every
      // other IDLE/BLOCK branch below, including a live intent.special this same frame (the buffered
      // press already won the race; whatever the player's thumb is doing THIS frame doesn't get to
      // cut in front of it). Dropped silently (no move started) if power was spent elsewhere in the
      // meantime -- a buffered press is a courtesy, not a guarantee.
      if(this.bufferedSpecial){
        const sp=this.bufferedSpecial;this.bufferedSpecial=0;
        if(this.power>=this.moveDef('s'+sp).cost)return this.startMove('s'+sp,undefined,undefined,fight)}
      if(intent.special&&this.power>=this.moveDef('s'+intent.special).cost)return this.startMove('s'+intent.special,undefined,undefined,fight);
      if(intent.dashBack){this.inv=DASH_BACK.inv;return this.setState('DASH')}
      // Task 7.2: openers (CHAIN.openers) always start a brand-new chain at node 1, regardless of
      // whatever chainNode a previous, already-finished chain left behind (it's already been reset to
      // 0 by tick()'s own 'done' transition or Fight.resolve's hit-taken reset by the time IDLE/BLOCK
      // can be acted on again -- this just makes the opener's own node explicit rather than relying on
      // that). Task 12.1: chainLights/chainMediums are (re)armed here too, to the fresh opener's own
      // {1,0}/{0,1} counts -- CHAIN.rule's caps (below) are read against THIS chain instance only, so a
      // brand-new opener must never inherit a previous, already-finished chain's own tally.
      if(intent.medium){this.chainLights=0;this.chainMediums=1;return this.startMove('medium',1)}
      if(intent.light){this.chainLights=1;this.chainMediums=0;return this.startMove('light',1)}
      if(intent.heavy)return this.startMove('heavy');
      const want=intent.block?'BLOCK':'IDLE';if(want!==S)this.setState(want)}
    // Task 7.2: the five-node combo grammar (CHAIN, 40_movedata.js) replaces the old fixed
    // light1->light5/medium->light1 `chain` pointers. Gated on this.chainNode (0 for every move
    // outside the grammar -- heavy from neutral, s1/s2/s3 -- so neither branch below ever fires for
    // them, exactly like the old `this.move.chain` falsy check did) instead of a per-move field.
    // Task 12.1 (frozen interface, exact ruling): light/medium continuation is now gated by
    // CHAIN.rule's own per-type caps (maxMediums:2, maxLights:4), checked and incremented fresh at
    // EVERY node from 1 up to CHAIN.nodes-1, not just offered unconditionally through node 4 the way
    // the old fixed-node-index grammar did -- a light is only offered while chainLights is still under
    // its cap, a medium only while chainMediums is still under its own (mediumCount capping closes the
    // WHOLE chain, light included; lightCount capping only closes off further lights -- see CHAIN.
    // rule's own comment, 40_movedata.js, for the asymmetry and why it's exactly what produces M-M
    // (ends at 2 hits) vs L-L-L-L-M (still reaches node 5)). The in-combo heavy ender stays exactly
    // where it always was -- offered ONLY at cn===CHAIN.nodes-1 (node 4), unconditional on either cap,
    // per the controller's own "stays, deliberate deviation" ruling -- and keeps its original priority
    // (checked ahead of light/medium; see Fix round 1's own comment just below on why heavy must win
    // that tie). Node 5 (chainNode===CHAIN.nodes) offers no further continuation ("no sixth node") --
    // chainNode stays there until the ender's own recovery ends and resets it to 0.
    else if(S==='ATTACK'&&this.phase()==='recovery'){
      if(this.landed&&this.chainNode>=1&&this.chainNode<CHAIN.nodes){
        const cn=this.chainNode;
        // Task 12.1 fix round 2 (frozen ruling): a dash-back pressed during an OPEN chain
        // continuation window abandons the chain deliberately, same as a real dash-back anywhere
        // else -- MCoC's own named "backdraft" setup ("swipe back after your third light, then throw
        // a medium as they dash at you") depends on this being possible; before this fix, a dash-back
        // intent read here simply fell through and did nothing (the chain window silently ignored
        // it). Checked ahead of the heavy/light/medium continuation offers below so a dash-back wins
        // any same-frame tie. Input's own dashBack intent is presented once and never buffered (see
        // 30_input.js's drain()), so this can only ever fire on the exact frame it's pressed, same as
        // the IDLE/BLOCK dashBack branch above.
        if(intent.dashBack){
          this.lastChainExitFrame=fight?fight.frame:this.lastChainExitFrame;
          this.inv=DASH_BACK.inv;this.chainNode=0;return this.setState('DASH')}
        // Fix round 1 (verdict-7.2 C1): intent.heavy is checked FIRST here, ahead of light/medium.
        // The keyboard alias Shift+K (30_input.js) sets intent.medium (queued) and intent.heavy (held)
        // in the very same keydown event, so both can legitimately be true on the same frame here --
        // heavy must win that tie, or the in-combo heavy ender is unreachable from that key combo. The
        // touch gesture's own race (a fresh swipe-right pushing 'medium' immediately, long before
        // held.heavy ever arms) is fixed at the source instead, in Input's own pointermove handler --
        // see its comment for why this reordering alone can't fix that one (intent.heavy simply isn't
        // true yet on the frame intent.medium is read there).
        if(cn===CHAIN.nodes-1&&intent.heavy)return this.startMove('heavy',CHAIN.nodes,CHAIN.enders.heavy);
        if(intent.light&&this.chainLights<CHAIN.rule.maxLights&&this.chainMediums<CHAIN.rule.maxMediums){
          this.chainLights++;return this.startMove('light',cn+1)}
        if(intent.medium&&this.chainMediums<CHAIN.rule.maxMediums){
          this.chainMediums++;return this.startMove('medium',cn+1)}}
      // Task 12.1 (frozen interface): Fighter.bufferedSpecial -- an S1/S2 press arriving during the
      // MEDIUM ender's own recovery (chainNode already at CHAIN.nodes, i.e. this move instance WAS the
      // chain's node-5 finisher) is remembered here rather than acted on immediately; consumed by the
      // IDLE/BLOCK branch above, the first frame act() can actually start it. Scoped to moveName===
      // 'medium' specifically -- the in-combo heavy ender also reaches chainNode===CHAIN.nodes, but the
      // ruling is explicit ("during the MEDIUM ender's recovery"), and a neutral heavy/s1/s2/s3's own
      // recovery never has chainNode>=1 at all, so this branch is a no-op for every other move. Gated
      // to 1/2 only (S3 is out of scope per the ruling); a 3 arriving here is simply dropped, same as
      // pressing it anywhere else without enough runway.
      else if(this.moveName==='medium'&&this.chainNode===CHAIN.nodes&&(intent.special===1||intent.special===2)){
        this.bufferedSpecial=intent.special}}
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
      else{
        // Task 12.1 fix round 2 (frozen ruling): stamp lastChainExitFrame here too -- this is the
        // in-combo heavy ender's own early-release cancel, and chainNode is CHAIN.nodes (a real,
        // open chain) whenever this branch is actually cancelling that specific ender (a plain
        // neutral heavy cancel has chainNode already 0, so the gate below is a no-op for it).
        if(this.chainNode>0)this.lastChainExitFrame=fight?fight.frame:this.lastChainExitFrame;
        this.clearMove();this.chainNode=0;this.setState('IDLE')}}}
  // Advance one frame of the state machine. Task 12.1 fix round 2: `fight`, when given (Fight.step's
  // own tick(this) call, below), is read only for its own .frame -- the natural end-of-recovery
  // chain-exit stamp (the ATTACK 'done' case below) needs a fight-frame number and tick() is the only
  // place that transition happens, but Fighter itself keeps no global frame counter of its own (see
  // pressTick's own comment). Every existing bare F.tick() call (the vast majority of this file's own
  // unit tests) still works unchanged -- fight is simply undefined and the stamp is skipped, same
  // "optional, gracefully skipped" shape act()'s own `fight` param already has.
  tick(fight){
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
        if(this.phase()==='done'){
          // Task 12.1 fix round 2 (frozen ruling): stamp lastChainExitFrame here too, gated on
          // chainNode>0 so a plain neutral heavy/special ending its own recovery (chainNode already 0)
          // never overwrites the field as though a chain had just closed.
          if(this.chainNode>0)this.lastChainExitFrame=fight?fight.frame:this.lastChainExitFrame;
          this.clearMove();this.landed=false;this.chainNode=0;this.setState('IDLE')}break}
      case'DASH':this.x-=this.face*DASH_BACK.dist/DASH_BACK.frames;if(this.f>=DASH_BACK.frames)this.setState('IDLE');break;
      // Task 12.1: parryStunned self-clears here too, on a parry stun's own natural timeout (never
      // punished) -- so a fighter who simply rode out the stun and reached IDLE on their own doesn't
      // leave a stale flag for some later, unrelated heavy to cash the PUNISH_MUL bonus against.
      // Harmless on the HITSTUN branch (parryStunned is never true there in the first place).
      case'HITSTUN':case'STUNNED':if(this.f>=this.stun){this.parryStunned=false;this.setState('IDLE')}break;
      // Task 9.1b (controller ruling, verdict-9.1's "Block-through-specials" section): a held block
      // must absorb EVERY sub-hit of a multi-hit special, not just the first. Fight.step runs act()
      // (previous frame's state) then tick() (this switch) then detect()/resolve(), all in the same
      // frame -- so a plain BLOCKSTUN->IDLE transition here left a one-frame gap whenever a move's own
      // sub-hit cadence (active+gap) was >= its blockstun: the very frame BLOCKSTUN cleared to IDLE was
      // also the frame the next sub-hit's hitbox went active, and act() (the only place that re-reads
      // intent.block to re-enter BLOCK) wouldn't run again until the NEXT step, one frame too late --
      // detect() saw IDLE, the hit landed clean, and the resulting HITSTUN outlasted the move's own
      // cadence so every later sub-hit landed too. Fix: re-enter BLOCK on this same frame, ahead of
      // detect(), whenever the last-read intent still held block -- reusing this.blockAge (set fresh by
      // act(), which always runs before tick() each step; >0 iff intent.block was true THIS frame, 0
      // otherwise, since act() unconditionally resets it every call regardless of state) rather than
      // adding any new field, per the frozen intent contract (read the flag the controller already
      // produced this frame, don't add one). Falls back to the old IDLE transition the instant block is
      // released, so a genuine release still lets the next sub-hit through (see 90_tests.js's own
      // "releasing block mid-special" regression lock). HITSTUN/STUNNED above are untouched -- this is
      // only ever a defender-side, block-specific correction.
      case'BLOCKSTUN':if(this.f>=this.stun)this.setState(this.blockAge>0?'BLOCK':'IDLE');break;
      case'KNOCKDOWN':if(this.f>=KNOCKDOWN.frames){this.inv=KNOCKDOWN.inv;this.setState('IDLE')}break}
    this.x=clamp(this.x,EDGE_PAD,STAGE_W-EDGE_PAD);
    this.dx=this.x-prevX}}

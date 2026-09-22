// AI.TIERS: the five difficulty tiers (t1..t5) — see the Phase 3 plan's frozen interfaces.
// `attack` was retuned for Task 3.6's balance pass (see docs/ARENA.md's "AI numbers changed" table):
// t3 .09->.25, t4 .12->.35, t5 .15->.65 (fix-wave item 8 corrected this comment — the shipped value,
// and the one docs/ARENA.md/the 3.6 commit message both already agreed on, has always been .65; this
// comment alone still said .5). t1/t2's `attack` left at their frozen values. t5.react is also not
// at its frozen value (2 here, frozen at 3 — untouched by this comment fix, just noted so "everything
// else is unchanged" isn't taken to include it). Before the 3.6 pass, t3-t5 rolled an attack so rarely
// (once every ~7-30 idle frames even at cd===0) that tests/batch.py's scripted --bot auto opponent —
// which reacts to every visible medium/heavy and chains every light it lands — beat every tier at a
// nearly flat 77-100% win rate with no real difficulty curve; see 55_ai.js's `comboFollow` for the
// paired behavior change (a landed attack now chases its own chain) that makes the higher attack
// rate actually punishing instead of just spammier.
// Fix-wave item 8: Ctrl.competent (the bot every tier here is measured against) learned to close
// distance with a medium and occasionally mix in a heavy (30_input.js) — re-checked the tier gate
// afterward and the curve held (monotone non-increasing, t1 100% >=80%, t5 23.3% <=30%) without
// retuning any AI_TIERS field; see docs/ARENA.md's fix-wave batch tables for the exact numbers.
// approach (Task 6.2): frames between approach presses at neutral -- see decideApproach's own
// comment below for the full mechanism. t1's 90 down to t5's 30 mirrors every other field's curve
// (higher tier = shorter interval = closes distance faster). Fix-wave item 3 (final review):
// decideApproach's own 60-frame neutral debounce is lowered to 12 below -- the review measured the
// longest real run of consecutive non-busy, out-of-range frames at 10 (t3) and 6 (t4) against the old
// 60-frame bar, so `approach` never actually fired in a real fight; see decideApproach's own comment.
// Fix-wave item 3 (final review, Important): `hold` is a NEW per-tier field -- the frames an AI holds
// block after a reactive block roll lands (decideBlock's 'react' phase below). It used to reuse
// `react` for this (`st.hold=p.react+r.int(10)`), which double-duties `react` as both the shared
// action cooldown AND the block-hold length. The final review found this is what actually broke the
// tier gate's monotonicity after Task 6.2's medium became an 18-22-frame tracking dash-in: holding
// block longer is what beats that move, so the "faster" (lower `react`) tiers held block LESS and ate
// the very move the phase added, not `approach` (measured provably inert -- see the review's issue 3).
// `hold` now decouples the two: t1 26 down to t5 8 (still monotone, mirrors every other field's
// curve), t3/t4 both at 10 rather than sharing `react`'s flattened-at-8 curve. `react` itself is
// UNCHANGED here as the shared action cooldown (st.cd=p.react, every decideX 'trigger' phase) --
// see docs/ARENA.md's fix-wave tier-gate section for the measured n=30/60/seed-base tables this
// change (plus the review's own measured fallback) was checked against.
const AI_TIERS={
  t1:{react:24,attack:.03,block:.25,parry:.02,dash:.01,special:.3, heavy:0,  intercept:0,  bait:0,  punish:0, approach:90,hold:26},
  t2:{react:14,attack:.04,block:.5, parry:.1, dash:.02,special:.6, heavy:0,  intercept:.1, bait:0,  punish:.2,approach:70,hold:16},
  t3:{react:8, attack:.25,block:.65,parry:.3, dash:.04,special:.9, heavy:.2, intercept:.3, bait:.1, punish:.5,approach:50,hold:10},
  // Fix-wave item 3 (measured fallback -- see docs/ARENA.md's fix-wave tier-gate table): the `hold`
  // decoupling alone (react/dash unchanged) passed n=30 but still broke t5<=30 at n=60 (31.7%). The
  // final review's own measured retune -- react 5->8 here (still the shared action cooldown, not
  // block-hold; hold above already carries that meaning) -- restores it.
  t4:{react:8, attack:.35,block:.75,parry:.45,dash:.06,special:1,  heavy:.3, intercept:.5, bait:.25,punish:.8,approach:40,hold:10},
  // Fix-wave item 3 (measured fallback): dash .08->.04, same reasoning/source as t4.react above.
  t5:{react:2, attack:.65,block:.85,parry:.6, dash:.04,special:1,  heavy:.35,intercept:.7, bait:.4, punish:1, approach:30,hold:8}};
const AI={
  TIERS:AI_TIERS,
  // profiles IS the alias table (not a copy of it) so old direct reads like AI.profiles.brute and
  // AI.profiles.brawl keep resolving to the right objects. basic->t2 and brawl->t3 reuse the exact
  // tier objects (not clones) so AI.resolveProfile('basic')===AI.TIERS.t2.
  profiles:{
    // Fix-wave item 3: hold:0 added for completeness (p.block:0 already means decideBlock's react
    // roll can never fire for the dummy, so p.hold is never actually read) -- matches AI_TIERS' own
    // new field so every AI_TIERS-shaped profile carries it.
    dummy:{react:0,attack:0,block:0,parry:0,dash:0,special:0,heavy:0,intercept:0,bait:0,punish:0,approach:0,hold:0},
    basic:AI_TIERS.t2,
    brawl:AI_TIERS.t3,
    // brute keeps its Task 2.8 identity (a heavy-happy brawler) as a t3 clone with a higher heavy
    // bias (.6, same value as before) layered over t3's other numbers.
    brute:Object.assign({},AI_TIERS.t3,{heavy:.6})},
  resolveProfile(name){
    if(AI_TIERS[name])return AI_TIERS[name];
    if(AI.profiles[name])return AI.profiles[name];
    throw new Error('unknown AI profile: '+name)},
  // Task 3.6 refactor: next()'s single linear if-chain regrouped into six named per-behaviour
  // functions sharing one `st` state object, called from the orchestrator in `next()` below in
  // EXACTLY the same relative order the original if-chain attempted them — that order is what
  // determines which r.next()/r.int() call happens on a given frame (JS's && short-circuits before
  // touching r unless a check's own non-rng pre-conditions already hold), so preserving it is what
  // keeps this refactor rng-for-rng identical to the pre-refactor next() (compare the determinism
  // test and --matrix table before/after this commit — both are unchanged). Two of the six
  // (decideHeavy, decideBait) cover a "continuation" check that has to run ahead of the busy() gate
  // (mirrors hHold's own comment below) and a separate "trigger" check that runs much later once
  // dist is known — always the SAME original call sites, just named and grouped by behaviour rather
  // than left as bare inline ifs. A `phase` string selects which of a function's own call sites is
  // active; every phase argument below is a literal, so which branch runs is fixed at the call site,
  // not data-dependent.
  make(profile,seed){
    const p=AI.resolveProfile(profile),r=RNG(seed);
    // st: every closure local the six functions below read or write, grouped into one object instead
    // of one local per behaviour (same fields, same meanings, as the pre-refactor next()): hold
    // (block-hold countdown), cd (shared action cooldown), plan (parry timing state machine), hHold
    // (heavy-charge hold countdown), baitHold/baitDashPending (bait feint state), comboFollow (combo
    // follow-through countdown — Task 3.6 balance pass, chases either a punish medium or a landed
    // spontaneous attack; see decidePunish/decideAttack).
    // farFrames/approachCd (Task 6.2): decideApproach's own state -- see its comment below. Kept
    // separate from the shared cd/react cooldown every other behaviour reuses, so a guaranteed
    // approach press never blocks (or gets blocked by) an unrelated reactive block/attack/heavy roll
    // -- ruling (fix round 1): approach must never starve the AI's own offense/defense, only fill in
    // when nothing else already claimed the frame (decideApproach is called last in the waterfall,
    // below, and its own approachCd only gates itself, not st.cd).
    const st={hold:0,cd:0,plan:null,hHold:0,baitHold:0,baitDashPending:false,comboFollow:0,farFrames:0,approachCd:0};

    // Heavy: charge-hold continuation (phase:'hold') has to run before the busy() gate in next()
    // below — once startMove('heavy') has put `me` into CHARGE, Fighter.busy() reports true (it only
    // excludes IDLE/BLOCK), so returning an empty intent while charging would read intent.heavy as
    // false on Fighter.act's CHARGE branch and cancel the charge. The hold is blind to interruption:
    // once armed it decrements and keeps pressing heavy for its full charge+1 span even if `me` gets
    // hit, parried, or knocked down mid-charge and never actually reaches CHARGE/ATTACK — fine today
    // since Fighter.act only reads intent.heavy in IDLE/BLOCK/CHARGE, so a stale hold just wastes a
    // few frames of "would-be" input.
    // The trigger (phase:'trigger') is brute-style profiles' slow, telegraphed swing at
    // close-but-not-point-blank range, held for moveDef('heavy').charge+2 frames total (this frame
    // plus the hold's own decrements). p.heavy>0 short-circuits before touching rng for profiles that
    // don't use it. The dist>=lightRange floor keeps a punish-capable tier from blindly committing a
    // slow charge point-blank against an already-swinging foe.
    function decideHeavy(it,me,dist,lightRange,heavyRange,phase){
      if(phase==='hold'){
        if(st.hHold>0){st.hHold--;it.heavy=true;return true}
        return false}
      if(p.heavy>0&&st.cd===0&&dist>=lightRange&&dist<heavyRange&&r.next()<p.heavy){
        st.hHold=me.moveDef('heavy').charge+1;it.heavy=true;st.cd=p.react;return true}
      return false}

    // Bait: a feint — hold heavy (the telegraphed swing) at mid-range just long enough to look
    // committed (phase:'trigger' arms it, phase:'hold' is the same blind-countdown shape as heavy's
    // hold above), then cancel and dash back (phase:'dash', fired the next frame `me` isn't busy —
    // baitDashPending survives the one busy() frame the charge-cancel needs, since Fighter.act only
    // cancels CHARGE on a frame it reads intent.heavy===false, and that same frame can't also start a
    // DASH). p.bait>0 short-circuits before touching rng for profiles that don't use it.
    function decideBait(it,me,dist,phase){
      if(phase==='hold'){
        if(st.baitHold>0){st.baitHold--;it.heavy=true;if(st.baitHold===0)st.baitDashPending=true;return true}
        return false}
      if(phase==='dash'){
        if(st.baitDashPending){st.baitDashPending=false;it.dashBack=true;return true}
        return false}
      if(p.bait>0&&me.state==='IDLE'&&st.cd===0&&dist>=140&&dist<=220&&r.next()<p.bait){
        st.baitHold=5;it.heavy=true;st.cd=p.react;return true}
      return false}

    // Punish: comboFollow continuation (phase:'follow') chases ANY of this fighter's own landed
    // moves through a chain window — a punish medium (below) or, since Task 3.6's balance pass, an
    // ordinary spontaneous attack (see decideAttack) — cleared the moment `me` goes non-busy without
    // ever seeing that window again, so a mid-combo hit/knockdown can't leave this stuck waiting on a
    // window that will never come. Deliberately a blind countdown (no rng draw), so arming it from
    // decideAttack too never shifts the rng sequence a tier already drew there.
    // The trigger (phase:'trigger') capitalizes when the foe is stunned (parried), just cleared its
    // KNOCKDOWN get-up i-frames (justGotUp — see Fighter.wasKnockedDown), or is still locked out from
    // a missed parry (parryLock>0), with a medium that arms comboFollow=3. p.punish>0 short-circuits
    // before touching rng for profiles that don't use it (dummy, t1).
    // Fix-wave item 9: this used to also write foe.wasKnockedDown=false the instant it acted on the
    // justGotUp window — a controller reaching into the OPPONENT Fighter's own sim state, which it
    // doesn't own (only Fight/Fighter mutate Fighter fields; controllers only ever read foe). Fighter.
    // tick's own _kdCounter-driven self-clear (50_fighter.js) now handles this unconditionally and
    // correctly on its own — see that file's comments for why the old state==='IDLE' gate needed this
    // belt-and-suspenders write in the first place, and why _kdCounter doesn't. AI.make only reads
    // foe.wasKnockedDown now, same as everything else it reads off foe.
    function decidePunish(it,me,foe,justGotUp,phase){
      if(phase==='follow'){
        if(st.comboFollow>0){
          if(me.state==='ATTACK'&&me.phase()==='recovery'&&me.move.chain&&me.landed){st.comboFollow--;it.light=true;return true}
          if(me.busy())return true; // still mid-move (startup/active, or a recovery that isn't a chain window yet) — keep waiting
          st.comboFollow=0} // fully back to IDLE/BLOCK without ever seeing a chain window: the combo is over
        return false}
      if(p.punish>0&&st.cd===0&&(foe.state==='STUNNED'||justGotUp||foe.parryLock>0)&&r.next()<p.punish){
        it.medium=true;st.cd=p.react;st.comboFollow=3;return true}
      return false}

    // Intercept: read the dash-in medium's startup and punish it with a light before it lands,
    // checked ahead of the slower reactive-block check (decideBlock's 'react' phase) so it gets first
    // crack at the same frame's rng roll instead of that check eating it and holding block. p.intercept>0
    // short-circuits before touching rng for profiles that don't use it (dummy, t1).
    function decideIntercept(it,foe){
      if(p.intercept>0&&foe.state==='ATTACK'&&foe.moveName==='medium'&&foe.f<=2&&r.next()<p.intercept){
        it.light=true;st.cd=p.react;return true}
      return false}

    // Block/parry: hold continuation (phase:'hold') takes priority over firing a pending bait dash.
    // Timed-parry continuation (phase:'plan') waits until the foe's hit is 2 frames out, then presses
    // block. The reactive roll (phase:'react') fires on a visible startup — normally only moves slow
    // enough that an immediate hold is a block, not an accidental parry; punish-capable tiers
    // (p.punish>0 — t2 and up) also react to fast moves (lights included), since catching one of
    // those in the parry window is exactly what their punish behavior exists to capitalize on.
    // Task 6.2 fix round 1: both reads below use foe.effStartup, not foe.move.startup -- a medium
    // dash-in from far away runs its startup longer than the move's own base m.startup (see
    // Fighter.setupDash, 50_fighter.js), and the AI must reason about when the hitbox actually goes
    // active, not the move's static data. effStartup is always set once foe.state==='ATTACK' (it's
    // computed by setupDash inside the same startMove() call that sets the state), so the ||
    // fallback only matters for a hand-built ATTACK state that skipped startMove entirely.
    function decideBlock(it,foe,phase){
      if(phase==='hold'){
        if(st.hold>0){st.hold--;it.block=true;return true}
        return false}
      if(phase==='plan'){
        if(st.plan!=='parry')return false;
        if(foe.state!=='ATTACK'){st.plan=null;return false}
        const su=foe.effStartup||foe.move.startup;
        if(foe.f>=su-2){st.plan=null;st.hold=8+r.int(8);it.block=true;return true}
        return true} // still waiting for the foe's hit to close to 2 frames out — 'handled' (do nothing)
      const su=foe.state==='ATTACK'?(foe.effStartup||foe.move.startup):0;
      if(foe.state==='ATTACK'&&foe.f===1&&(su>PARRY_WINDOW+2||p.punish>0)&&r.next()<p.block){
        if(r.next()<p.parry){st.plan='parry';return true}
        // Fix-wave item 3 (final review, Important): p.hold (block-hold length), not p.react (the
        // shared action cooldown) -- see AI_TIERS' own comment for why the two were conflated and what
        // decoupling them fixes.
        st.hold=p.hold+r.int(10);it.block=true;return true}
      return false}

    // Attack: a spontaneous swing (phase:'attack') when nothing else applies, arming comboFollow
    // (gated on p.punish>0 — the same "capitalizes on an opening" knob decidePunish's trigger uses)
    // so a landed hit gets to chase its own chain. The fallback dash-away (phase:'dash') backs off
    // when caught at point-blank range without anything better to do.
    function decideAttack(it,dist,lightRange,phase){
      if(phase==='dash'){
        if(dist<lightRange&&r.next()<p.dash){it.dashBack=true;return true}
        return false}
      if(st.cd===0&&r.next()<p.attack){
        if(dist<lightRange)it.light=true;else it.medium=true;
        st.cd=p.react;if(p.punish>0)st.comboFollow=3;return true}
      return false}

    // Approach (Task 6.2 -- playtest note: "the dummy never approaches", the goblin's own 320px spawn
    // gap left every light whiffing): a guaranteed, non-random distance-closer, last in the waterfall
    // so it only ever fires when nothing else (heavy/bait/punish/block/special/the spontaneous attack
    // roll above) already claimed the frame. Blind on purpose -- closing distance shouldn't hinge on
    // a probability roll the way a real attack does, and gating the whole function on p.approach>0
    // before it ever touches farFrames/approachCd makes it a total no-op for the tutorial dummy
    // (approach 0): no rng draw (there was never going to be one), no state touched that anything else
    // reads, so Ctrl.tutorialDummy and every dummy-profile test stay bit-identical to before this
    // task. For everyone else: dist>lightRange has to hold for more than 12 CONSECUTIVE frames (a
    // debounce against a foe that's merely drifting in and out of range) before the first press, then
    // its own approachCd (set to p.approach, t1's 90 down to t5's 30) paces the repeats -- "at neutral
    // distance" in the ruling means from a stand-still, which is exactly what farFrames measures.
    // Fix-wave item 3 (final review, Important): the debounce was 60 frames -- the review measured the
    // longest real run of consecutive non-busy, out-of-range frames at 10 (t3) and 6 (t4) against that
    // bar in an actual fight against Ctrl.competent, so `approach` never fired at all: a dead knob.
    // Lowered to 12 so it can actually clear those real runs (still a real debounce against a foe
    // that's merely drifting in and out of range for a couple of frames, not an instant trigger).
    function decideApproach(it,dist,lightRange){
      if(p.approach<=0)return false;
      if(dist<=lightRange){st.farFrames=0;return false}
      st.farFrames++;
      if(st.farFrames>12&&st.approachCd<=0){it.medium=true;st.approachCd=p.approach;st.farFrames=0;return true}
      return false}

    return{next(fight,me,foe){
      const it=Ctrl.EMPTY();
      // justGotUp: the single frame the foe's real KNOCKDOWN get-up i-frames end (Fighter.wasKnockedDown
      // is scoped to KNOCKDOWN specifically — see its own comment in 50_fighter.js — so this can never
      // misfire off a plain dash-back's unrelated i-frames the way an inv-edge check alone could).
      const justGotUp=foe.state==='IDLE'&&foe.inv===0&&foe.wasKnockedDown;
      if(decideHeavy(it,me,0,0,0,'hold'))return it;
      if(decideBait(it,me,0,'hold'))return it;
      if(decidePunish(it,me,foe,justGotUp,'follow'))return it;
      // Task 6.2 fix round 1: farFrames resets (not just pauses) the instant `me` is busy -- covers
      // every way that can happen (this fighter starting its own attack, taking a hit/block-stun/
      // knockdown, or charging a heavy), so decideApproach never fires off a stale count carried over
      // from before an interruption; a fresh 60-frame "stuck at range" window is required afterward.
      if(me.busy()){st.farFrames=0;return it}
      // An established block hold takes priority over firing a pending bait dash.
      if(decideBlock(it,foe,'hold'))return it;
      if(decideBait(it,me,0,'dash'))return it;
      const dist=Math.abs(foe.x-me.x)-me.width;
      // Derived from move data instead of hard-coded: light1.range(70)+20=90 and heavy.range(130)+10
      // =140 reproduce the old flat thresholds for the stock movesets while tracking per-move/per-
      // character overrides (none currently touch .range, but moveDef merges them if one ever does).
      const lightRange=me.moveDef('light1').range+20,heavyRange=me.moveDef('heavy').range+10;
      if(st.cd>0)st.cd--;
      if(st.approachCd>0)st.approachCd--;
      if(decideBlock(it,foe,'plan'))return it;
      if(decideIntercept(it,foe))return it;
      if(decideBlock(it,foe,'react'))return it;
      if(decidePunish(it,me,foe,justGotUp,'trigger'))return it;
      // Fix wave item 1: p.special is a per-frame probability, same scale as p.attack just below (and
      // every other AI_TIERS roll) — the frozen plan table put it on a per-second scale without saying
      // so (a plan defect: see the final review), and multiplying by STEP here silently made it ~39:1
      // less likely to fire than attack once 3.6 raised attack to .35/.65, so a t4+ boss's S3 override
      // almost never shipped (1 special in 8806 held-power frames over 10 Grull fights). Checked ahead
      // of decideHeavy/decideAttack (both below) so a boss with power banked always gets first crack at
      // its signature special before spending the same cd window on a lesser move.
      if(st.cd===0&&me.power>=100&&r.next()<p.special){it.special=me.power>=300?3:me.power>=200?2:1;st.cd=20;return it}
      if(decideHeavy(it,me,dist,lightRange,heavyRange,'trigger'))return it;
      if(decideBait(it,me,dist,'trigger'))return it;
      if(decideAttack(it,dist,lightRange,'attack'))return it;
      if(decideAttack(it,dist,lightRange,'dash'))return it;
      if(decideApproach(it,dist,lightRange))return it;
      return it}}}};

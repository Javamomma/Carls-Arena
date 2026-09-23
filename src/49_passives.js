// Task 9.2: champion/boss passive abilities -- deterministic, RNG-free, sim-side hooks that trigger
// off fight/frame, hp, block-state and special/parry events, laid out parallel to Effects (48_effects.js)
// but driven by these hooks instead of a move's own applies:[] list. tools/build.py concatenates
// src/NN_* in filename order, so this file lands after 48_effects.js and before 50_fighter.js --
// it may reference EFFECTS/Effects (already defined) at definition time, but never the Fighter class
// (which loads after this file); every function below only ever touches a live Fighter INSTANCE
// handed in as `fighter`/`holder` by Fight.step/Fight.resolve/Fighter.startMove at CALL time (once a
// real fight exists), the same "load-order-safe forward touch" BUFFS.thorns already relies on from a
// file that loads before 60_fight.js defines Fight.
//
// PASSIVES[id] holds the frozen params for one champion/boss's def.passive={id} (40_movedata.js just
// carries the bare id; every actual number lives here, in one place, same "table separate from the
// def" split CHAMPS/MOBS/BOSSES already keep for EFFECTS/BUFFS ids). Six entries, one per Phase 9
// champion/boss signature -- see the task brief's own frozen table for the exact source of every
// number below (nothing here was invented independent of that ruling).
const PASSIVES={
  spite:{hpBelow:.40,every:180,apply:{id:'fury',stacks:1,uncapped:true},ceiling:10},
  royalDisdain:{onSpecial:{id:'weakness',stacks:1,doubleIfDebuffed:true}},
  understudy:{onParry:{id:'critDmg',stacks:1}},
  immovable:{whileBlocking:{every:120,apply:{id:'fury',stacks:1},max:5}},
  // Task 9.4 (9.2/9.3 review carry-over, controller ruling): every 1200 -> 600 frames -- measured
  // real boss fights (tests/batch.py's f1_grull/f2_mother rows) average roughly 300-620 frames long,
  // so the frozen interface's own 1200f cadence meant Grull's own signature ability -- a full
  // purify plus +3 fury -- almost never actually fired within a real fight's length (it needed to
  // survive past frame 1200 first). Halving it to 600 lets a fight that runs the boss's own typical
  // length actually see the mechanic at least once.
  // Fix-wave item 4 (I4, final review): 600 -> 360 frames. The 600f cadence still measured 4/40 real
  // Grull fights (10%) ever reaching the beat at all -- a 475-frame average real fight (final review's
  // own measurement) leaves only one 600f beat inside a typical fight's length, and most fights end
  // before frame 600 entirely. 360f (6s) gives a typical ~475-frame fight a comfortable shot at the
  // first beat with margin to spare, while still well inside "every kit effect must be visible."
  // kitText's own "every 10s" line (40_movedata.js) is updated alongside this to "every 6s"
  // (360f/60fps).
  championOfTheFloor:{every:360,purify:true,apply:{id:'fury',stacks:3}},
  brood:{hpBelow:.50,apply:{id:'powerGain',stacks:1}}};

const Passives={
  // Task 9.2 (controller ruling): a bare 1 until Phase 10 wires real sig levels -- every apply below
  // routes through this so a later potency-scaled passive needs no new plumbing, exactly like a
  // move's own applies:[{id,potency}] already does via Effects.apply's own `potency` option.
  potency(champ){return 1},
  // Shared apply path every trigger below uses: Effects.apply the real effect, then the plumbing a
  // real passive trigger needs that a plain Effects.apply call doesn't already give it -- a
  // {type:'passive',who,id} log/onEvent entry (Fight.emitPassive, 60_fight.js, mirrors Effects.apply's
  // own emitEffect) and a bare {kind:'passiveBanner'} fx descriptor (presentation-only; 72_fx.js is
  // the only place that turns it into the actual 22px gold-italic/class-gem banner -- same "sim
  // pushes plain data, FX styles it" split Effects.apply's own effectPopup push already uses).
  // Task 9.3 (carry-over from the 9.2 review): `target` (optional) is who Effects.apply actually
  // lands the effect on -- defaults to `holder` (every pre-9.3 call site: spite/immovable/
  // championOfTheFloor/brood all buff their own owner) so every existing call keeps working
  // unchanged. Royal Disdain's own onSpecial hook (below) is the one passive whose effect lands on
  // the FOE, not its owner -- it used to duplicate this whole method inline for exactly that reason;
  // now it just passes its own foe reference through as the 7th arg instead. emitPassive/
  // passiveBanner still always credit `holder` (the passive's OWNER, unchanged -- see emitPassive's
  // own frozen-shape comment, 60_fight.js).
  _fire(fight,holder,pid,id,stacks,uncapped,target){
    Effects.apply(fight,target||holder,id,{stacks,potency:this.potency(holder.def),uncapped});
    fight.emitPassive(holder,pid);
    // Fix-wave item M9 (final review, Minor): FLOOR-200 -> FLOOR-230. The game object's own event
    // handler (80_game.js) pushes Broadcast's own ratings-multiplier popup (Broadcast.state.lastPop)
    // at the SAME y, FLOOR-200 -- a signature firing during an active multiplier window would draw
    // its banner directly on top of that popup. FLOOR-230 sits clear of every other fx y in use
    // (effectPopup FLOOR-160, PARRY!/damage/INTERCEPT! popups FLOOR-120/-150, lastPop FLOOR-200).
    fight.fx.push({kind:'passiveBanner',x:holder.x,y:FLOOR-230,id:pid,cls:holder.def.cls})},
  // Once per step per fighter, called from Fight.step right after Effects.tick (same slot). RNG-free;
  // reads only hp/maxHp/state/power off `fighter` and fight.frame -- never fight.rng/presRng.
  // Task 9.2 (controller ruling): fight.spar (set only for a tutorial-mode fight, G.startFight,
  // 80_game.js) short-circuits every passive here before any condition is even read -- the ruling's
  // own "Spite/Brood never fire in spar" ask, applied centrally so every future passive gets the same
  // guard with no per-id opt-in (the tutorial's own dummy goblin never holds a def.passive anyway, so
  // this is a no-op cost for every fight that isn't a tutorial).
  tick(fight,fighter){
    if(fight.spar)return;
    const pd=fighter.def.passive;if(!pd)return;
    const t=fighter._passiveT||(fighter._passiveT={});
    switch(pd.id){
      // Carl's Spite: below 40% hp, +1 uncapped fury stack every 180 frames spent below that
      // threshold (the timer resets the instant hp climbs back to/above 40%, so it only ever counts
      // continuous time spent low, never banks progress made on an earlier dip). Task 9.1 review
      // ruling: a passive-level ceiling stops it from actually applying once the holder already holds
      // >=10 fury stacks -- the timer itself keeps running (still resets every 180 frames) so a later
      // purify/clear that drops the holder back under 10 lets it resume on its own next tick, with no
      // extra bookkeeping needed here.
      case'spite':{
        const cfg=PASSIVES.spite;
        if(fighter.hp/fighter.maxHp<cfg.hpBelow){
          t.spite=(t.spite||0)+1;
          if(t.spite>=cfg.every){
            t.spite=0;
            if(Effects.stacks(fighter,cfg.apply.id)<cfg.ceiling)
              this._fire(fight,fighter,'spite',cfg.apply.id,cfg.apply.stacks,cfg.apply.uncapped)}}
        else t.spite=0;
        break}
      // Mongo's Immovable: +1 fury stack every 120 frames spent in BLOCK or BLOCKSTUN (controller
      // ruling: both states count -- a mid-block hit landing on him still counts those frames, a
      // held guard doesn't have to go totally unhit to build stacks), capped at 5. fury's own
      // EFFECTS.maxStacks is already 5, so the cap is enforced twice over (belt and suspenders, not a
      // second real ceiling) -- the explicit `<cfg.max` guard still skips the apply call (and its
      // event/banner) once capped, rather than firing a no-op Effects.apply every 120 frames forever.
      // Fix-wave item 4 (I4, final review): the counter is CUMULATIVE across the whole fight, not
      // consecutive -- this reverses the Task 9.3 ruling below. Measured (final review, 40 AI-Mongo
      // fights across four tiers): a CONSECUTIVE 120-frame requirement produced 0/160 real fights with
      // Immovable ever firing -- a scripted bot's own react/hold/block-plan cycling (55_ai.js) almost
      // never holds BLOCK/BLOCKSTUN for 120 unbroken frames against a live opponent that keeps forcing
      // brief gaps (a landed hit, a parry window, a busy() frame elsewhere), even though a real fight
      // spends far more than 120 TOTAL frames blocking over its whole length. The kit table's own
      // wording ("while blocking, +1 fury every 2s") reads as accumulated blocking time, not an
      // unbroken streak, and ruling 3 of the Phase 9 plan ("every kit effect must be visible") is the
      // standard a mechanic that fires in 0/160 real fights fails outright. A held guard producing
      // exactly 5 Immovable stacks in a synthetic all-BLOCK run (the pre-fix test below) proves the
      // math was always correct -- only the reset-on-leave was wrong for how the mechanic is actually
      // used in play.
      case'immovable':{
        const cfg=PASSIVES.immovable.whileBlocking;
        if(fighter.state==='BLOCK'||fighter.state==='BLOCKSTUN'){
          t.immovable=(t.immovable||0)+1;
          if(t.immovable>=cfg.every){
            t.immovable=0;
            if(Effects.stacks(fighter,cfg.apply.id)<cfg.max)
              this._fire(fight,fighter,'immovable',cfg.apply.id,cfg.apply.stacks,false)}}
        break}
      // Grull's Champion of the Floor: every cfg.every frames (fight.frame%cfg.every===0, controller
      // ruling -- a stateless clock, no per-fighter timer needed; Task 9.4 halved this from 1200 to
      // 600, fix-wave item 4 (I4) halved it again to 360 -- see PASSIVES.championOfTheFloor's own
      // comment), purify every debuff he's currently holding then grant +3 fury. Purify runs
      // unconditionally on the beat (not gated by whether he actually holds any debuff) -- Effects.
      // purify is already a silent no-op when there's nothing to strip.
      case'championOfTheFloor':{
        const cfg=PASSIVES.championOfTheFloor;
        if(fight.frame>0&&fight.frame%cfg.every===0){
          Effects.purify(fighter);
          this._fire(fight,fighter,'championOfTheFloor',cfg.apply.id,cfg.apply.stacks,false)}
        break}
      // Mother Rat's Brood: the instant hp crosses below 50% (edge-triggered -- fires once per
      // crossing, not once per frame spent under it; re-arms the moment hp climbs back to/above 50%
      // so a later dip fires again), grants one powerGain stack. The regen-tripling half of Brood
      // lives in BUFFS.regen's own onFrame (47_buffs.js) -- it checks holder.def.passive.id itself,
      // live, rather than reading anything off this module (see that buff's own comment for why it
      // needs no reference to PASSIVES/Passives at all).
      case'brood':{
        const cfg=PASSIVES.brood;
        const below=fighter.hp/fighter.maxHp<cfg.hpBelow;
        if(below&&!t.broodCrossed){
          t.broodCrossed=true;
          this._fire(fight,fighter,'brood',cfg.apply.id,cfg.apply.stacks,false)}
        else if(!below)t.broodCrossed=false;
        break}}},
  // Hook from Fight.resolve's parry branch (60_fight.js), called with the fighter who just landed the
  // parry (the exchange's `def` -- the one who was holding block and caught the attack inside the
  // parry window). Katia's Understudy: +1 critDmg stack (EFFECTS.critDmg's own frozen dur:180,
  // maxStacks:1 -- no per-call override exists, same "no per-call duration override" pattern every
  // other Phase 9 effect apply already follows).
  onParry(fight,fighter){
    if(fight.spar)return;
    const pd=fighter.def.passive;if(!pd||pd.id!=='understudy')return;
    const cfg=PASSIVES.understudy.onParry;
    this._fire(fight,fighter,'understudy',cfg.id,cfg.stacks,false)},
  // Hook from Fighter.startMove (50_fighter.js), called for every s1/s2/s3 activation (any fighter's,
  // not just Donut's -- gated internally here, same as onParry). Donut's Royal Disdain: +1 weakness
  // stack on the foe every time she throws a special, doubled to +2 when the foe already holds any
  // other debuff (checked against PURIFIABLE, 48_effects.js's own frozen debuff set -- already defined,
  // this file loads after it).
  // Task 9.3 (carry-over from the 9.2 review): reuses _fire with its own `target` (foe, the 7th
  // arg) instead of duplicating _fire's own Effects.apply/emitPassive/fx.push body inline -- the
  // only behavior difference from before this refactor is none: potency/emitPassive/passiveBanner
  // are computed exactly the same way _fire already did them for every other passive.
  onSpecial(fight,fighter,move){
    if(fight.spar)return;
    const pd=fighter.def.passive;if(!pd||pd.id!=='royalDisdain')return;
    const cfg=PASSIVES.royalDisdain.onSpecial;
    const foe=fighter.side===1?fight.p2:fight.p1;
    const debuffed=PURIFIABLE.some(id=>Effects.has(foe,id));
    const stacks=cfg.stacks*(debuffed&&cfg.doubleIfDebuffed?2:1);
    this._fire(fight,fighter,'royalDisdain',cfg.id,stacks,false,foe)}};

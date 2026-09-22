// Node buffs: pure hooks on Fight/Fighter, never presentation. See Phase 3 plan Ruling #3 and the
// frozen interfaces list. BUFFS[id] = {id, onFrame?(fight,holder,foe), onHit?(fight,att,def,ref,holder),
// onBlock?(fight,att,def,ref,holder)}. `holder` is the fighter whose buffs list this call came from
// (Fight.buffHook passes it as the 5th arg); att/def are always the exchange's absolute attacker/
// defender, so a buff on the "wrong" side of an exchange (e.g. armorUp on an attacking holder) can
// tell it doesn't apply this call by comparing holder against att/def.
const BUFFS={
  regen:{id:'regen',
    // +0.017% maxHp per frame to the holder (~1%/s at 60Hz), capped at maxHp. Fix-wave item 2:
    // the frozen plan's spec (0.05%/frame) is actually 3%/s — 360% of max hp over Mother Rat's own
    // 120s fight clock — which the plan's own 600-frame (10s) regen test never surfaced since 10s of
    // healing reads as reasonable in isolation. Retuned down ~3x as part of making the boss winnable
    // (see docs/ARENA.md's boss balance notes); the interface's rate itself was the plan defect, not
    // this buff's implementation.
    onFrame(fight,holder,foe){holder.hp=Math.min(holder.maxHp,holder.hp+holder.maxHp*0.00017)}},
  armorUp:{id:'armorUp',
    // Incoming damage x.7 when the holder is the one defending this exchange.
    onHit(fight,att,def,ref,holder){if(holder===def)ref.dmg=Math.round(ref.dmg*0.7)}},
  powerGain:{id:'powerGain',
    // The holder's own power delta (from landing a hit, or from being hit) x1.5. Fix-wave item 6:
    // reads ref.move (Fight.resolve sets it fresh from its own local `m` every call), not att.move —
    // on a true mutual trade (both sides' hits detected before either resolves) resolve(c1) nulls
    // def.move where that same fighter is c2's attacker, so att.move for THAT call had already gone
    // null by the time it ran; ref is never touched by the other side's resolve call, so ref.move
    // always carries both powHit/powTaken for exactly the move this call is resolving.
    onHit(fight,att,def,ref,holder){
      const m=ref.move;if(!m)return;
      if(holder===att)ref.powHit=Math.round(m.powHit*1.5);
      else if(holder===def)ref.powTaken=Math.round(m.powTaken*1.5)}},
  // Flag-only: no hook of its own. Fight.detect reads `att.buffs` directly (alongside `m.cost`) to
  // decide whether the attacker's special ignores block, right where m.unblockable is checked.
  unblockableSpecials:{id:'unblockableSpecials'},
  degen:{id:'degen',
    // The foe loses 0.03% maxHp per frame while the holder is alive. Once the holder's hp hits 0 the
    // fight ends on that same step() (Fight.finish), so no further onFrame calls happen; the hp<=0
    // guard here is just defensive, not load-bearing.
    onFrame(fight,holder,foe){if(!foe||holder.hp<=0)return;foe.hp=Math.max(0,foe.hp-foe.maxHp*0.0003)}},
  thorns:{id:'thorns',
    // On block, the attacker takes 20% of the chip damage back. Only ever wired to the defender's
    // (the blocker's) onBlock call — see Fight.resolve's 'block' branch. Fix-wave item 10: thorns
    // damage used to have no log entry and no FX (silent, unlike every other source of damage in the
    // sim) — now emits a 'thorns' fight event (fight.emit, the same log/onEvent path every other hit
    // uses) and a small red popup, skipped when the chip itself rounds to 0 so a near-zero-atk
    // matchup doesn't spam empty-looking popups.
    onBlock(fight,att,def,ref,holder){
      const dmg=Math.round(ref.chip*0.2);if(dmg<=0)return;
      att.hp=Math.max(0,att.hp-dmg);
      fight.emit('thorns',holder,att,dmg);
      fight.fx.push({kind:'popup',x:att.x,y:FLOOR-100,text:String(dmg),col:'#ff4444',big:false})}},
  secondWind:{id:'secondWind',
    // Sponsor perk 'Second Wind' (Task 5.2, Phase 5 ruling #2: "one regen tick at 20% hp per
    // fight"): the first frame the holder's hp is at or under 20% of maxHp, heal +15% of maxHp
    // (capped at maxHp), then never fire again for the rest of the fight. holder._secondWindSpent is
    // per-Fighter one-shot state this buff needs and no other buff does -- Fighter's own constructor
    // (50_fighter.js) declares the field (defaulting false) so every fighter starts unspent, not just
    // ones actually holding this buff; Buffs.apply never re-resolves per frame, so there's nothing
    // else to reset it mid-fight.
    onFrame(fight,holder,foe){
      if(holder._secondWindSpent||holder.hp<=0)return;
      if(holder.hp<=holder.maxHp*0.2){
        holder._secondWindSpent=true;
        holder.hp=Math.min(holder.maxHp,holder.hp+Math.round(holder.maxHp*0.15))}}},
  noKo:{id:'noKo',
    // Task 5.3 (Tutorial, Floor 0): "the goblin cannot KO the player during the tutorial" -- kept as
    // a plain buff (the sim's own framework), not a special case in Fight/Fighter and not a
    // presentation-side write of fight.p1.hp from Tutorial.tick, so the sim boundary stays exactly
    // as pure as every other buff leaves it. Applied to p1 via G.startTutorial's playerBuffs (the
    // same path fix-wave item 5 already wired for a node's own player-side buffs).
    // Frame-ordering note (see the Task 5.3 report): Fight.step() runs buffFrame BEFORE detect/
    // resolve, so this clamp only ever restores hp *after* it's already read <1 by a PRIOR frame's
    // resolve -- it cannot rescue a single frame that drops hp from >0 straight past 0 (finish()
    // fires that same frame, before the next buffFrame call would run). In practice this never
    // matters here: ENCOUNTERS.tutorial's atkMul:.3 keeps every one of the dummy's hits tiny (well
    // under 20 dmg) against any champion's multi-hundred hp pool, so hp never approaches 0 to begin
    // with over the tutorial's short run -- this buff is the belt-and-suspenders backstop the frozen
    // interface asked for, not the only thing standing between the player and a real KO.
    onFrame(fight,holder,foe){if(holder.hp<1)holder.hp=1}},
  tutorialGuard:{id:'tutorialGuard',
    // Task 5.3: keeps the tutorial's dummy goblin alive through every step so the player can't
    // accidentally one/two-shot a 150hp (hpMul:.5) dummy with a single light chain before ever
    // reaching KICK/PARRY/POWER -- "the fight ends on the natural KO" (the ruling behind noKo's own
    // design) only actually reads as intended once Tutorial's own "FINISH HIM" prompt (step 4 done)
    // has fired. Unlike noKo (an onFrame clamp, timed to run before the NEXT frame's damage -- fine
    // there since atkMul:.3 keeps every hit tiny relative to a champion's hp pool), this has to be an
    // onHit cap: it runs INSIDE resolve(), before dmg is subtracted from hp, the same point armorUp
    // already adjusts ref.dmg from -- an onFrame clamp here would be one frame too late (Fight.finish
    // already runs, over=true, within the SAME step() call that applied a lethal hit, before any next
    // frame's onFrame could ever run). Deliberately NOT part of ENCOUNTERS.tutorial's own frozen
    // `buffs:[]` (kept empty exactly as specified) -- G.startTutorial layers this onto the live p2
    // Fighter directly after construction, the same "G sets extra live-Fighter state outside the
    // buffIds pipeline" pattern G.startFight already uses for a sponsor perk's parryBonus.
    onHit(fight,att,def,ref,holder){
      if(holder!==def)return; // only ever meaningful for the dummy defending, never attacking
      if(typeof Tutorial==='undefined'||Tutorial.state.step>=Tutorial.steps.length)return; // FINISH HIM: no cap
      if(ref.dmg>=holder.hp)ref.dmg=Math.max(0,holder.hp-1)}}};
const Buffs={
  // Resolves ids[] to BUFFS objects and sets holder.buffs (replacing whatever was there). Called
  // once at fight/encounter setup, never per frame, so there's no per-frame allocation on the hot
  // path — Fight.step/resolve only ever iterate the already-resolved holder.buffs array.
  apply(fight,holder,ids){
    holder.buffs=(ids||[]).map(id=>{
      const b=BUFFS[id];
      if(!b)throw new Error('unknown buff: '+id);
      return b})}};

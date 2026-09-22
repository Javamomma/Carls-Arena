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
      fight.fx.push({kind:'popup',x:att.x,y:FLOOR-100,text:String(dmg),col:'#ff4444',big:false})}}};
const Buffs={
  // Resolves ids[] to BUFFS objects and sets holder.buffs (replacing whatever was there). Called
  // once at fight/encounter setup, never per frame, so there's no per-frame allocation on the hot
  // path — Fight.step/resolve only ever iterate the already-resolved holder.buffs array.
  apply(fight,holder,ids){
    holder.buffs=(ids||[]).map(id=>{
      const b=BUFFS[id];
      if(!b)throw new Error('unknown buff: '+id);
      return b})}};

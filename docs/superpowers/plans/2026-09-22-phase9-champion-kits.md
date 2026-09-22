# Phase 9: Champion Kits — Signatures, Heavies, Specials, Passives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every champion and boss a real kit on top of the Phase 7 effects and grammar — a signature passive, a heavy with a purpose, three specials with distinct effects, and a class identity — so that picking Carl, Donut, Katia or Mongo changes how a fight is played, and the two bosses have mechanics to learn. This is the owner's "more complicated attacks", finished.

**Inputs:** `docs/design/mcoc-comparison-notes.md` §3 "Champion kits" table (the authority for every number below); Phase 7's frozen surfaces (`EFFECTS`, `Effects.apply`, move-data `applies:[{id, stacks, potency, on, target}]`, `def.sigEffect`, `'effect'` events, the `unblockable` flag, `HITFEEL`/`IMPACTS` on the presentation side); the seams list archived in `docs/ARENA.md` (Phase 7 final review: `impact` registry now keyed by id, `Fighter.resetPerMove`, pooled mods).

**Architecture:** Kits are data plus a small `Passives` module. Move data carries `applies` and per-move flags (`unblockable`, `refundOnBlock`, `healPct`, `purify`); `src/49_passives.js` (sim, between effects and fighter) ticks per-champion passives from a `def.passive` descriptor with the same purity rules as Effects; `Fight.resolve` reads the new flags at the existing hook points. AI gets a per-tier `kit` field so t3+ uses specials when their effect matters. Presentation adds per-effect impact tints and a signature banner. No new input; the gesture layer is at capacity (Phase 7 review), so kit choices happen in move data and the POWER picker.

**Rulings (2026-09-22):**
1. Numbers come from the comparison table verbatim; where the table is silent (durations, potencies) the defaults in the interface block below are frozen.
2. Passives are sim-side, deterministic, RNG-free, ticked once per `Fight.step` after `Effects.tick`; they read hp/power/state and call `Effects.apply`.
3. Every kit effect must be visible: an applied effect shows its HUD icon and popup (Phase 7), a passive trigger shows a short banner (`SPITE!`, `ROYAL DISDAIN`), and the S3 card names the special.
4. Balance bands stay: tier sweep monotone with t5 ≤ 30% at n=30/60 on seed bases 1 and 101; floor-1 doors 1-3 ≥ 85%; f1_hob 40-70%; bosses 10-35%. Kits will move the numbers; retune by stats, never seeds; the t4/t5 thinness noted in Phase 7 is fixed here (target ≥ 10 pp separation at n=60 on both bases).
5. The champion matrix (`--matrix`) gains a kit-usage check: each champion's S1/S2/S3 applies its listed effect in at least one matrix cell.

## Global Constraints
Everything from Phases 1-8 (single built file, sim boundary, determinism incl. per-field RNG gating, gate before every commit, exact Fable 5.1 trailer, no controller commits while an implementer runs, intent contract frozen, no new asset files). Plus: `--perf 600` < 6 ms; `--tutorial` green (the spar dummy must survive passives — Carl's Spite must not fire in spar mode below 40% because the dummy never damages; assert it).

## Interfaces (frozen for Phase 9)
```
// 40_movedata.js — per-move flags read by Fight.resolve
move.applies = [{id, stacks=1, potency=1, on:'hit'|'crit'|'block'|'last', target:'foe'|'self'}]   // 'last' = final sub-hit only
move.unblockable = true            // block branch treated as hit (no chip path); shows UNBLOCKABLE popup
move.refundOnBlock = 20            // attacker regains N power if the move is blocked (S2 Boot Party)
move.healPct = 0.30                // attacker heals this fraction of damage dealt per landed sub-hit (Bear Hug)
move.ignoreBlock = 'knockdown'     // heavy Ground Slam: blocked → still knockdown, damage chipped
move.critChance = 1.0              // Misdirection: forces crit on every sub-hit (still consumes one rng draw)
def.passive = {id, ...params}      // one per champion/boss (see PASSIVES)

// 49_passives.js
PASSIVES = {
  spite:      {hpBelow:.40, every:180, apply:{id:'fury', stacks:1, uncapped:true}},                  // Carl
  royalDisdain:{onSpecial:{id:'weakness', stacks:1, doubleIfDebuffed:true}},                          // Donut
  understudy: {onParry:{id:'critDmg', stacks:1, dur:180}},                                            // Katia (new effect critDmg: critMul +0.4 per stack, maxStacks 1)
  immovable:  {whileBlocking:{every:120, apply:{id:'fury', stacks:1}, max:5}},                        // Mongo
  championOfTheFloor:{every:1200, purify:true, apply:{id:'fury', stacks:3}},                          // Grull
  brood:      {hpBelow:.50, regenMul:3, apply:{id:'powerGain', stacks:1}} }                           // Mother Rat
Passives.tick(fight, fighter)            // once per step per fighter after Effects.tick; RNG-free
Passives.onParry(fight, fighter)         // hook from Fight.resolve's parry branch
Passives.onSpecial(fight, fighter, move) // hook from Fighter.startMove for s1/s2/s3
fight events: {type:'passive', who, id}  // presentation shows the banner
EFFECTS additions: critDmg {dur:180, maxStacks:1, mod: critMul += .4*stack}; poison {dur:300, maxStacks:3, tick: 0.3% maxHp/s per stack, ignores armor}
Effects.apply(..., {uncapped:true}) bypasses maxStacks for that call (Spite)
Effects.purify(holder) removes all debuffs (bleed, stun, armorBreak, weakness, poison, powerBurn)

// Kits (from the comparison table; durations in frames)
carl:  sig Spite; heavy 2 armorBreak (480f); s1 Two-Fisted 3 hits, last→bleed 1; s2 Boot Party 5 hits, refundOnBlock 20; s3 Doorway Drop 4 hits, last→stun 120f (guaranteed)
donut: sig Royal Disdain; heavy powerBurn 30; s1 Hairball 5 hits, each→poison 1; s2 Regal Pounce 5 hits, last unblockable; s3 Sponsor Meltdown 6 hits, each→weakness 1
katia: sig Understudy; heavy refreshes every bleed stack's duration; s1 Knife Work 5 hits, each→bleed 1; s2 Misdirection 5 hits, critChance 1.0; s3 Curtain Call 4 hits, last→bleed 3 + armorBreak 1
mongo: sig Immovable; heavy Ground Slam ignoreBlock knockdown; s1 Backhand 3 hits, last→stun 60f; s2 Bear Hug 5 hits, healPct .30; s3 Doorway Denial 4 hits, self armorUp effect (+60% armor, 600f — new effect armorUp {dur:600, maxStacks:1, mod: armor += .6})
grull: sig Champion of the Floor; heavy Pillar Swing (longer reach: dash 40) → armorBreak 1; s3 Floor Wipe 3 hits, last→weakness 1 (600f); keeps armorUp buff
mother_rat: sig Brood; heavy Tail Sweep → bleed 3; s3 Swarm 6 hits, each healPct .02; keeps regen buff

// AI (55_ai.js)
tier.kit (0..1): probability a t3+ AI holds power for the special whose effect matters (s3 when the foe has ≥2 debuffs, s2 otherwise); t1/t2 kit=0 (bit-identical draws)

// Presentation
Banner for 'passive' events (72_fx.js): 22 px gold italic, 40 frames, class gem color; per-effect impact tint (bleed red, poison green, weakness violet) via IMPACTS opts
Roster card (85_screens.js): kit summary lines (SIG / HEAVY / S1 / S2 / S3) from a `def.kitText` block
```

---

### Task 9.1: Move flags and new effects
Files: `src/40_movedata.js` (flags on the moves listed), `src/60_fight.js` (unblockable, refundOnBlock, healPct, ignoreBlock, critChance, `on:'last'`), `src/48_effects.js` (critDmg, poison, armorUp, uncapped, purify), `src/90_tests.js`.
- Tests (each with exact numbers): unblockable S2 final hit lands through block with UNBLOCKABLE popup; Boot Party blocked refunds 20 power; Bear Hug heals 30% of each sub-hit; Ground Slam blocked → knockdown with chip; Misdirection crits every hit and consumes one draw per hit; `on:'last'` applies once; critDmg raises critMul by .4; poison ticks 0.3%/s per stack ignoring armor; armorUp +.6 armor for 600f; uncapped fury exceeds 5; purify removes debuffs only. Matrix and batch will change — record the tables; tier gate must still pass or be retuned in 9.4.
- Commit `feat: kit move flags and the critDmg/poison/armorUp effects`.

### Task 9.2: Passives module and champion signatures
Files: create `src/49_passives.js`; `src/60_fight.js` (hooks), `src/50_fighter.js` (onSpecial hook), `src/40_movedata.js` (def.passive for six defs), `src/72_fx.js`/`src/70_render.js` (banner), `src/90_tests.js`, `tools/build.py` order check.
- Tests: Spite fires every 180f below 40% and never above; Royal Disdain applies weakness on every special, doubled when the foe already has a debuff; Understudy on parry; Immovable +1 fury per 120f while blocking, cap 5; Champion of the Floor purifies and +3 fury every 1200f; Brood triples regen and grants powerGain below 50%; passives are RNG-free (draw count unchanged); spar mode never fires Spite; banner fx descriptor emitted per trigger; purity scan covers 49_passives.js.
- Commit `feat: champion and boss passives`.

### Task 9.3: Heavies, specials, and kit text
Files: `src/40_movedata.js` (heavy/S1/S2/S3 applies per kit; `def.kitText`), `src/68_rig.js` (any pose tweaks for new hit counts — sub-hit timing only), `src/85_screens.js` (roster kit lines), `src/13_broadcast.js` (commentary lines for signatures), `src/90_tests.js`.
- Tests: every kit line in the table is asserted by a scripted fight (e.g. Carl S3 → stun 120 on the last hit; Katia heavy refreshes bleed durations; Donut heavy burns 30 power and deals that damage; Grull heavy reach; Mother Rat Swarm heals 2%/hit); roster shows five kit lines per champion; `--screens-smoke` and `--phone-check` green; matrix kit-usage check (ruling 5).
- Commit `feat: champion heavies and specials`.

### Task 9.4: AI kit usage and balance
Files: `src/55_ai.js` (tier.kit, special selection by foe debuffs), `tests/batch.py`, `src/40_movedata.js`/`45_encounter.js` (retune), `docs/ARENA.md`.
- Tests: t3+ holds power for s3 when the foe has ≥2 debuffs (scripted); t1/t2 draw sequences bit-identical to the base; tier gate n=30/60 on seed bases 1 and 101 monotone with ≥10 pp between t4 and t5; doors/bosses in band; before/after tables in the report.
- Commit `feat: AI uses kits; Phase 9 balance`.

### Task 9.5: Close-out
Files: `docs/ARENA.md` (Phase 9 exit table, kit table, balance tables), `README.md` (Champions section with each kit), `tools/shots.sh` (`p9-{carl-s3,donut-s2,katia-s2,mongo-s2}.png`), the program file.
- Full gate; shots reviewed by the controller; commit `docs: Phase 9 close-out`.

**Phase 9 exit criteria:** six kits live and visible; passives deterministic; AI uses them; bands hold with the t4/t5 gap restored; docs and shots; final whole-branch review clean; pushed.

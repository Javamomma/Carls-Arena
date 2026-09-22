# Phase 7: Combat Depth — Effects, Combo Grammar, Intercept, Dexterity, Hit Feel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the fights the depth that makes Marvel Contest of Champions worth learning: timed, stacking status effects; a five-node combo grammar where light and medium mix and the ender matters; intercept and dexterity as rewarded reads; and a hit-feel pass with directional shake, per-class camera punch-in, and per-class impact art. This is the owner's "more complicated attacks".

**Inputs:** `docs/design/mcoc-comparison-notes.md` §3 (combat depth) and the hit-feel table; the Phase 6 final review's "what Phase 7 must undo" list (fixed `light1→light5` chain ladder, `medium.chain='light1'`, `Fighter.act`'s chain branch accepting only light/medium, the `combo>=3` medium push special case, one-to-one swipe-right→medium mapping, the long-telegraph far dash-in).

**Architecture:** The sim grows one module, `src/48_effects.js` (`Effects`: per-fighter timed stacking effects ticked in `Fight.step`, hooked at the same points as `Buffs`), and a data-driven combo grammar in `40_movedata.js`/`50_fighter.js` (`CHAIN` rules replace the `chain` field). Intercept and dexterity are `Fight.resolve` outcomes with their own events. Presentation grows directional shake, a punch-in term composed with the zoom cap, and per-class impact fx. Every change keeps the intent contract and the bots.

**Rulings (2026-09-22):**
1. Effects are the only timed mechanic; `Buffs` stay permanent per-fight hooks. Effect ids: `bleed stun armorBreak fury powerGain powerBurn regen weakness`; durations in sim frames; stacks capped per id; potency per stack; source recorded.
2. Combo grammar: five nodes; node 1 opens with light or dash-in medium; nodes 2-4 accept light or medium; node 5 is the ender: light (fast, stay close), medium (push 90 + knockdown), or a shortened in-combo heavy (charge 14) that triggers the champion's signature effect (a placeholder `sigEffect` per def, filled by Phase 9). The canonical M-L-L-L-M works. Chains are cancellable in recovery as today.
3. Intercept: a hit landing on a foe whose current move has `dash>0 || track>0`, still in startup, moving toward you → ×1.5 damage, +15 power, `INTERCEPT!` popup, hitstop 10, camera punch 5%. Dexterity: a `miss` because the defender is in DASH with i-frames → 3 s Dexterity effect (+20% crit chance), popup, blue afterimage.
4. Far dash-in telegraph: `track` capped so the medium's effective startup never exceeds 14 frames (speed rises for longer gaps); intercept makes dashing into a ready opponent a real risk.
5. Hit feel per class per the notes' table (light 3f/none/none; medium 5f/4px dir/2% punch; heavy 9f/8px/4% hold 10f; intercept 10f/10px/5% + 6f half-speed; S1/S2 final-hit 6-8f/6px/3% creep; S3 14f + card + dolly). Shake becomes a vector; punch-in is an additive zoom term composed under the per-frame cap.
6. Status effects get HUD icons in the buff-badge slot with stack counts and a shrinking duration ring; effect popups on apply.

## Global Constraints
Everything from Phases 1-6 (single built file, sim boundary, determinism incl. warmed RNG and per-field gating, gate before every commit, exact Fable 5.1 trailer, no controller commits while an implementer runs, intent contract frozen, bots unchanged in signature). Plus: the tier gate (n=30 and n=60) stays monotone after every balance-affecting task; `--matrix`, `--e2e`, `--tutorial` stay green; `--perf` < 6 ms.

## Interfaces (frozen for Phase 7)
```
// 48_effects.js
EFFECTS = { bleed:{dur:180, maxStacks:5, tick:(f,holder,stack)=>holder.hp -= holder.maxHp*0.004*stack /60 per frame? → potency: 0.4% maxHp per second per stack, ignores armor},
            stun:{dur:60, maxStacks:1, onApply: holder → STUNNED state for dur (reuses the existing STUNNED handling)},
            armorBreak:{dur:480, maxStacks:3, mod: armor -= 0.15*stack},
            fury:{dur:420, maxStacks:5, mod: atk *= 1+0.12*stack},
            powerGain:{dur:300, maxStacks:1, tick: +0.5 power per frame},
            powerBurn:{dur:1, instant: drain N power from the foe and deal damage equal to the burned amount},
            regen:{dur:300, maxStacks:3, tick: +0.15% maxHp per second per stack},
            weakness:{dur:480, maxStacks:3, mod: atk *= 1-0.12*stack} }
Effects.apply(fight, holder, id, {stacks=1, potency=1, source}) → refreshes duration, adds stacks up to max; Effects.has(holder,id); Effects.stacks(holder,id); Effects.tick(fight, holder) called once per step per fighter; Effects.mods(holder) → {atkMul, armorDelta, critDelta} read by Fight.resolve; Effects.clear(holder, id?)
fighter.effects = [] (array of {id, left, stacks, potency, source}); Fight emits 'effect' events {type:'effect', who, id, stacks, applied|expired}
Move data may carry `applies:[{id, stacks?, potency?, on:'hit'|'crit'|'block'}]` and `unblockable`; Fight.resolve applies them after damage

// Combo grammar (40_movedata.js / 50_fighter.js)
CHAIN = { openers:['light','medium'], nodes:5, enders:{light:{}, medium:{push:90, knockdown:true}, heavy:{charge:14, sig:true}} }
Fighter.chainNode (1..5, 0 when not chaining); startMove(name) sets the node; act() accepts in recovery: light or medium when chainNode<4; light, medium or heavy (as the shortened ender) when chainNode===4; chains reset when a move whiffs (no landed/blocked) or on hit taken. MOVES.light1..5 collapse into MOVES.light with per-node dmg multipliers [1,1,1.05,1.1,1.4]; MOVES.medium likewise per-node [1.6,1.6,1.7,1.8,2.0]; the `chain` fields and the `combo>=3` push special case are deleted. Pose keys light1..5 stay (Rig.poseFor maps node→pose).
def.sigEffect = {id, stacks} placeholder per champion (Carl fury 1, Donut weakness 1, Katia bleed 1, Mongo armorBreak 1, mobs none)

// Intercept / dexterity (60_fight.js)
Fight.resolve: intercept when def.state==='ATTACK' && def.phase()==='startup' && (def.move.dash||def.move.track) → dmg×1.5, att.power+15, event 'intercept', hitstop 10, fx {kind:'punch', pct:.05}, fx popup INTERCEPT!
detect miss with def.state==='DASH' && def.inv>0 → Effects.apply(def,'dexterity'...) — add dexterity to EFFECTS {dur:180, maxStacks:1, mod: crit += .2}; event 'dexterity'; fx afterimage
MOVES.medium.track: speed scales so effective startup ≤ 14 frames (speedPerFrame = max(14, gap/14))

// Hit feel (72_fx.js / 65_stage.js / 70_render.js)
FX.shake = {x,y} vector decaying; FX.punch = additive zoom term (target, hold, ease) composed as cam.zoom = min(base*(1+punch), capNow); per-class impact fx: 'impactBlunt' (dust ring), 'impactBlade' (arc slash: skeleton/goblin/katia), 'impactEnergy' (caster ring: shaman/donut); per-move class from def.impact ('blunt'|'blade'|'energy'); time dilation for intercept: G.tick runs the sim every other tick for 6 ticks
HUD: effect icons (12 px) with stack count and a duration ring in the badge slot; effect popups (BLEED, STUN, FURY...)

// Gestures: unchanged (swipe right = medium node; heavy ender = swipe-right-and-hold during node 4 recovery, or L key)
```

---

### Task 7.1: Effects system
Files: create `src/48_effects.js`; modify `src/60_fight.js`, `src/50_fighter.js`, `src/70_render.js` (icons), `src/72_fx.js` (popups), `src/90_tests.js`.
- Tests: each effect's numbers (bleed 5 stacks over 180 frames → expected hp loss; stun → STUNNED for 60; armorBreak/fury/weakness mods; powerGain; powerBurn instant; regen; dexterity); refresh/stack cap semantics; expiry events; determinism (effects consume no rng); purity scan covers 48_effects.js; HUD icon cache; `--matrix` unchanged (no move applies anything yet).
- Commit `feat: timed stacking status effects`.

### Task 7.2: Combo grammar
Files: `src/40_movedata.js`, `src/50_fighter.js`, `src/60_fight.js`, `src/68_rig.js` (poseFor node mapping), `src/55_ai.js` (AI uses the grammar: M-L-L-L-M for t3+), `src/30_input.js` (heavy ender gesture), `src/90_tests.js` (amend Phase 1 chain tests to the grammar), `tests/batch.py`.
- Tests: M-L-L-L-M lands five hits with the medium ender push/knockdown; L-L-L-L-L; L-M-L-M-L; a whiff resets the chain; hit taken resets; in-combo heavy at node 4 charges 14 and applies the def's sigEffect; no sixth node; damage multipliers per node; AI t3+ uses mixed chains (log shows medium at node 5); tier gate re-measured.
- Commit `feat: five-node combo grammar with three enders`.

### Task 7.3: Intercept, dexterity, tracked dash telegraph
Files: `src/60_fight.js`, `src/40_movedata.js`, `src/48_effects.js`, `src/55_ai.js` (AI intercepts real dash-ins now; punish window), `src/72_fx.js`, `src/90_tests.js`, `tests/batch.py`.
- Tests: a light landing on a dashing foe in startup → ×1.5, +15 power, 'intercept' event; a dash-back through an active hitbox → dexterity effect and 'dexterity' event; far medium effective startup ≤ 14; tier gate; doors/bosses in band.
- Commit `feat: intercept and dexterity; capped dash-in telegraph`.

### Task 7.4: Hit-feel pass
Files: `src/72_fx.js`, `src/65_stage.js`, `src/70_render.js`, `src/80_game.js` (time dilation), `src/40_movedata.js` (def.impact), `src/90_tests.js`; shots `docs/shots/p7-{intercept,heavy,s3}.png`.
- Tests: shake vector direction follows the attacker's facing; punch-in composes under the cap (never exceeds capNow); per-class impact fx kind selection; time dilation exactly 6 ticks at half rate; determinism in sim mode; `--perf` < 6 ms.
- Commit `art: directional shake, camera punch-in, per-class impacts`.

### Task 7.5: Balance and close-out
Files: `src/55_ai.js`/`40_movedata.js` (tuning), `tests/batch.py`, `docs/ARENA.md` (Phase 7 exit table, tier/door/boss tables), `README.md` (combo section: how to chain, enders, intercept, dodge), `tools/shots.sh`, the program file.
- Tier gate n=30/60 monotone; doors 1-3 ≥ 85%, bosses 10-35%; `Ctrl.competent` learns the M-L-L-L-M chain and a dash-back read (so the gate reflects the grammar); full gate; shots; README; commit `docs: Phase 7 close-out`.

**Phase 7 exit criteria:** effects, grammar, intercept/dexterity, hit feel shipped with tests; gates green; final whole-branch review clean; pushed.

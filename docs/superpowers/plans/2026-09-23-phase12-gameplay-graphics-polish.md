# Phase 12: Gameplay and Graphics Polish — Closing the MCoC Feel Gap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner's standing instruction is "keep improving; graphics and gameplay can be better; understand how Marvel Contest of Champions plays." This phase applies the mechanics and presentation findings of `docs/design/mcoc-gameplay-study.md` (§4 gap tables, §5 graphics list) to make a fight *play* like MCoC — readable AI dash-ins you can intercept, the parry→heavy punish, mediums that end a chain without a knockdown, specials that launch from range and chain off a medium, a visible opponent power bar — and *look* like a drawn fighting game: anticipation and settle frames, dash smears, dust, a real reflection, spark smears, variable-weight outlines, bloom on specials, per-floor color grade, legible damage numbers.

**Inputs:** `docs/design/mcoc-gameplay-study.md` (authority: §1 mechanics, §2 feel, §4.2/§4.3 gap rows tagged Phase 12, §5 graphics ranking); the Phase 7 combat surfaces (CHAIN, HITFEEL, Effects, intercept/dexterity) and the Phase 8 rigs (BodyStyle, POSES, Stage.lightAt, Render.reflection, vignette).

**Architecture:** Gameplay changes are sim data and small state-machine edits (CHAIN rule, ender knockback, buffered special after a medium ender, parry window/stun, dexterity expiry rule, intercept payouts by class, AI approach telegraph + react floor + bait). Presentation changes live in POSES (pre/settle keyframes), 72_fx.js (smears, dust, spark smear, bloom, damage-number styles), 70_render.js (opponent power bar, ghost health trail, reflection, vignette pulse), 65_stage.js (per-floor grade), 68_rig.js (variable-weight outline, idle sway). Every gameplay task re-runs the balance battery; every presentation task is bit-identical in sim.

**Rulings (2026-09-23):**
1. Grammar: a chain ends on its 2nd medium or 4th light (whichever first); M-L-L-L-M is the canonical five; the in-combo heavy ender at node 4 stays (our signature delivery) and is documented as a deliberate deviation.
2. Medium ender: keep the 90 px push, drop the knockdown; the foe lands standing and can act. A special (S1/S2) may be buffered during the medium ender's recovery and fires immediately after it.
3. Parry: window 8 f (was 6), lockout 20 f unchanged, stun 66 f (was 50); a heavy landing on a parry-stunned foe deals ×1.25 and pops PUNISH!; the tutorial's parry lesson teaches parry→heavy.
4. Dexterity: the crit buff expires 12 f after the next landed hit, capped at 180 f.
5. Intercept payouts by class: light ×1.3, medium ×1.8 (was a flat ×1.5); +15 power unchanged; BACKDRAFT! popup when an intercept lands within 30 f of a dash-back out of a chain.
6. AI: every approach dash-in gets a visible 6-frame wind-up (weight-shift pose + dust puff) before movement; `react` floored at 4 f for every tier with a 6-f post-decision cooldown; `bait` wired to a real M-L cut-and-wait; t5 rebalanced through attack/parry/hold, never react.
7. Specials: S1/S2 get a tracked dash-in so they travel from neutral; S2/S3 sub-hit gaps +2 f and a dash-back mid-special dodges the remaining hits (dexterity if the final sub-hit is dodged); S3 becomes blockable at 2× chip instead of unblockable.
8. Presentation: opponent power bar under their health bar with a gold 3-bar pulse; 12-f ghost trail on health bars; damage numbers colored by kind (white normal, gold crit larger, grey chip, red bleed, green heal); KO slow-mo 20 f at 0.4×; S3 cinematic becomes a real sequence (dolly, desaturated background, hits at 0.5×, snap back on the last hit).
9. Graphics (§5 order, all zero-asset, all under the 6 ms gate; bloom gated by reduceMotion): anticipation/settle keyframes; reflection 0.22 with gradient fade + wobble; dash smears; spark smear quad; foot dust; idle sway; variable-weight outline; bloom on specials/crits; per-floor color grade; animated vignette.
10. Balance battery after every gameplay task: tier sweep monotone with t5 ≤ 30% and t4−t5 ≥ 10 pp at n=60 on seed bases 1 and 101; floor-1 doors 1-3 ≥ 85%; f1_hob 40-70%; bosses 10-35%; retune by stats/AI fields only.

## Global Constraints
Everything from Phases 1-9 (single built file, sim boundary, determinism incl. per-field RNG gating, gate before every commit, exact Fable 5.1 trailer, no controller commits while an implementer runs, intent contract frozen, no asset files, `--perf 600` < 6 ms, `--tutorial` green).

## Interfaces (frozen for Phase 12)
```
// 40_movedata.js / 50_fighter.js — grammar
CHAIN.rule = {maxMediums:2, maxLights:4}   // chain ends when either count is reached; node 5 unreachable except M-L-L-L-M and L-L-L-L-M
CHAIN.enders.medium = {push:90, knockdown:false}; a fighter hit by the medium ender enters HITSTUN (not KNOCKDOWN)
Fighter.bufferedSpecial: set when intent.special arrives during the medium ender's recovery; consumed on the first frame act() can start it
PARRY_WINDOW = 8; PARRY_LOCKOUT = 20; PARRY_STUN = 66; PUNISH_MUL = 1.25 (heavy on a parry-stunned foe; event 'punish')
EFFECTS.dexterity = {dur:180, expiresAfterHit:12}   // Effects.tick clears it 12 f after the holder's next landed hit
INTERCEPT_MUL = {light:1.3, medium:1.8}; event 'backdraft' when intercept lands ≤30 f after a dash-back that left a chain (fighter.lastChainExitFrame)
MOVES.s1/s2 gain track like medium (effective startup ≤ 14 f); MOVES.s2/s3 gap +2; MOVES.s3.unblockable = false, s3.chipMul = 2
Fight.resolve: a defender in DASH with i-frames during a multi-hit special skips the remaining sub-hits of that move instance; dexterity granted only if the skipped set includes the final sub-hit

// 55_ai.js
AI_TIERS[t].react = max(react, 4); AI decision cooldown 6 f after any block/parry/dash decision; approach → state 'WINDUP' (6 f, pose 'windup', fx dust) then the dash; bait → after node 3 of a chain, stop and hold for 20-40 f (rng gated on the bait field)
Ctrl.competent learns: intercept the AI wind-up with a medium (reads state==='WINDUP'), parry→heavy

// 70_render.js / 72_fx.js / 65_stage.js / 68_rig.js — presentation
HUD.powerBar(side) for both fighters; 3-bar gold pulse; HUD.healthGhost (12 f trail)
FX.popup kinds: normal | crit | chip | bleed | heal | punish | backdraft (colors as ruled)
FX.smear(x,y,angle) (3 f quad); FX.dust(x) (6 particles, 14 f); FX.ghosts(fighter) ring buffer of 3 during DASH
POSES[key].pre and .settle keyframes (5-keyframe arrays; Rig.solve interpolates over the longer t)
BodyStyle outline: outer parts stroked at lineWidth+2 in a champion-tinted dark tone
Render.reflection alpha .22, gradient fade, 2 px wobble; Render.bloom (half-res 'lighter' pass during specials/crits, off under reduceMotion); Stage.grade(themeId) multiply pass; Render.vignette animated (tighten 15% on special/KO, red pulse < 25% hp)
G.slowmo on KO: 20 f at 0.4×; S3 sequence: 72 f = dolly 18 f → hits at 0.5× → snap back 6 f
```

---

### Task 12.1: Grammar, ender, buffered special, parry numbers, dexterity expiry
Files: `src/40_movedata.js`, `src/50_fighter.js`, `src/60_fight.js`, `src/48_effects.js`, `src/30_input.js` (buffered special through Input's existing buffer), `src/80_game.js` (tutorial parry lesson teaches parry→heavy), `src/90_tests.js`, `tests/batch.py` tables.
- Tests: chain ends on 2nd medium / 4th light; M-L-L-L-M and L-L-L-L-M reach node 5, M-M does not continue; medium ender leaves the foe in HITSTUN at ~90 px, no knockdown; a special pressed during the ender's recovery fires on the first possible frame; parry window 8 / stun 66; PUNISH ×1.25 with event; dexterity expires 12 f after the next landed hit; tutorial passes with the new lesson text; balance battery recorded (retune allowed within this task).
- Commit `feat: MCoC chain rule, standing medium ender, buffered special, parry punish, dexterity expiry`.

### Task 12.2: Intercept classes, specials from range, dexable specials, S3 blockable
Files: `src/60_fight.js`, `src/40_movedata.js`, `src/50_fighter.js`, `src/72_fx.js` (BACKDRAFT popup), `src/90_tests.js`.
- Tests: light intercept ×1.3, medium ×1.8; backdraft event within 30 f of a chain-exit dash-back and not otherwise; S1/S2 from 250 px reach the foe; S2/S3 gaps +2; dash-back mid-S2 skips the remaining sub-hits and grants dexterity only when the final sub-hit was among them; S3 blocked → 2× chip, no unblockable popup; balance battery.
- Commit `feat: intercept classes, specials that travel, dexable specials, blockable S3`.

### Task 12.3: Readable AI — wind-up, react floor, cooldown, bait; competent bot upgrades
Files: `src/55_ai.js`, `src/50_fighter.js` (WINDUP state, pose key 'windup'), `src/68_rig.js` (windup pose per rig: weight shift), `src/72_fx.js` (dust), `src/30_input.js` (Ctrl.competent), `tests/batch.py`, `src/90_tests.js`.
- Tests: every AI approach passes through 6 WINDUP frames before moving; a medium thrown during the foe's WINDUP intercepts (event + ×1.8); react ≥ 4 on every tier; decision cooldown 6 f; bait produces an M-L stop-and-hold at node 3 with the rng draw gated on the field (t1/t2 bit-identical); competent bot intercepts wind-ups and punishes parries; balance battery retuned to the rulings (t4−t5 ≥ 10 pp).
- Commit `feat: readable AI dash-ins, human-like reaction floor, baiting`.

### Task 12.4: Fight HUD and feedback — opponent power, ghost bars, damage numbers, KO slow-mo, S3 sequence
Files: `src/70_render.js`, `src/72_fx.js`, `src/80_game.js` (slowmo, S3 sequence), `src/65_stage.js` (dolly), `src/90_tests.js`; shots `docs/shots/p12-{hud,s3}.png`.
- Tests: opponent power bar geometry and 3-bar pulse; ghost trail 12 f; popup style per kind; KO slow-mo exactly 20 ticks at 0.4× (headless no-op); S3 sequence timeline (dolly 18 → 0.5× hits → 6 f snap) deterministic in sim; batch/matrix bit-identical.
- Commit `art: opponent power bar, ghost health, damage-number kinds, KO slow-mo, S3 camera sequence`.

### Task 12.5: Animation — anticipation/settle keyframes, idle sway, wind-up pose, dash smears, dust, spark smear
Files: `src/68_rig.js` (POSES pre/settle for every move in all three rigs; idle sway; windup pose), `src/72_fx.js`, `src/70_render.js`, `src/90_tests.js`; shots `docs/shots/p12-anim-{medium-pre,heavy-settle,dash}.png`.
- Tests: every POSES entry has pre/settle keyframes and Rig.extent snapshots stay within ±0.5 px; idle sway phase differs per fighter; ghosts only during DASH, ring buffer bounded; dust on dash start/landing/knockdown; smear oriented along the hit vector; perf; batch bit-identical.
- Commit `art: anticipation and settle frames, idle sway, dash smears, dust, spark smears`.

### Task 12.6: Rendering — outline, reflection, bloom, per-floor grade, animated vignette, close-out
Files: `src/68_rig.js` (outline), `src/70_render.js` (reflection, bloom, vignette), `src/65_stage.js` (grade), `src/45_encounter.js` (per-floor grade color), `src/90_tests.js`, `tools/shots.sh`, `docs/ARENA.md` (Phase 12 exit table + balance tables + rulings), `README.md` (Combat section updated for the chain rule, punish, backdraft, dexable specials; gallery), the program file.
- Tests: outline drawn on outer parts only; reflection alpha/gradient; bloom off under reduceMotion and only during specials/crits; grade color per floor; vignette tightens/pulses on the ruled triggers; perf < 6 ms with everything on; full gate; shots; commit `docs: Phase 12 close-out`.

**Phase 12 exit criteria:** every §4 row tagged Phase 12 is shipped or explicitly deferred with a ruling; balance battery green; the ten §5 graphics items shipped; shots reviewed by the controller; final whole-branch review clean; pushed; owner hand-play requested.

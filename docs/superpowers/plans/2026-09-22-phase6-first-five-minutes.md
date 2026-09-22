# Phase 6: Redesign 1 — The First Five Minutes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first five minutes of Carl's Doorway Brawl feel like a fighter: a player can always reach the opponent, the owner's one-thumb gestures drive every move, the tutorial is a visible sparring session that ends in a real kill, punches and kicks look different, a defeat can always be exited, and floor 1 is winnable at level 1 with a clear signal when a door is above your level.

**Inputs:** `docs/design/playtest-notes-2026-09-22.md` (owner + controller play), `docs/design/mcoc-comparison-notes.md` (reviewer, §2 controls, §6 tutorial, roadmap items 1-3). Reference art: `docs/reference/rendition.jpg`.

**Architecture:** The sim keeps its six-field intent contract (`light medium heavy block dashBack special`); the gesture layer is rewritten to produce the same intents from whole-canvas gestures, so every bot, test and screen keeps working. Movement is solved inside existing moves (a range-tracking dash-in, a step-in light) plus AI approach, not a new WALK state. The tutorial becomes a visible spar mode driven by the existing `Tutorial` state machine with new presentation. Kick art is new pose data for all three rig kinds.

**Rulings (2026-09-22):**
1. Controls default to gestures on the whole canvas plus the POWER button; the BLOCK/PUNCH/KICK buttons become an optional "show attack buttons" setting (default off after the tutorial, on during the tutorial's first two lessons so the prompts can point at them).
2. No WALK state. Dash-in (KICK/swipe-right) tracks to striking range (up to 300 px); a tap when out of light range performs a step-in light (advance up to 110 px then jab); AI closes distance within a second at neutral.
3. Floor 1 order becomes goblin → skeleton → goblin2 → shaman → hobgoblin, each door shows `REC. LVL n`, and floor-1 mob stats are tuned so a level-1 human wins doors 1-3 with two-chain fights; the hobgoblin at door 5 recommends level 4.
4. KICK is a leg strike in every rig (human/big/quad) with its own poses; PUNCH stays the arm strike.
5. The result screen always offers CONTINUE (to the originating screen) and TITLE, win or lose, in every mode.

## Global Constraints

Everything from Phases 1-5 (single built file, sim boundary, determinism, gate before every commit incl. `--e2e --seed 1` and `--tutorial` when touched, exact Fable 5.1 trailer, no controller commits while an implementer runs, screenshots via `tools/shots.sh`). Plus: the intent contract is frozen; bots (`Ctrl.competent`, `Ctrl.tutorialBot`, `Ctrl.random`) keep working unchanged; all 304 tests keep passing except where a task explicitly amends an assertion.

## Interfaces (frozen for Phase 6)

```
// 30_input.js — gesture layer (one canvas pointer at a time)
Input.GESTURE = {TAP_MS:140, TAP_DRIFT:24, SWIPE_PX:44, SWIPE_MS:260, HEAVY_HOLD_MS:200, BLOCK_HOLD_MS:140}
Gestures: tap → 'light' (on release); hold in place ≥140 ms → held.block (release → parry if in window); swipe → ≥44 px in ≤260 ms → 'medium' (fires when crossed); swipe → then still held 200 ms after firing → held.heavy (heavy replaces the medium's follow-up: medium lands/whiffs, then heavy charges while held, swings on release); swipe ← → 'dashBack'; swipe ← then still held when DASH_BACK.frames expire → held.block; a second canvas pointer while one is down is ignored; DOM buttons unchanged (POWER always; BLOCK/PUNCH/KICK when Save.data.settings.showButtons)
Input.pointerLog (last 8 gestures with type+frame) for tests and the tutorial
Keyboard: J light, K medium, L hold heavy, A/D dash back, S hold block, Shift+K dash-in heavy, 1/2/3 specials, P pause

// 40_movedata.js / 50_fighter.js — movement inside moves
MOVES.medium.track = 300  // dash-in advances each startup frame until within light range or 300 px travelled (replaces fixed dash 140)
MOVES.light1.stepIn = 110 // if the foe is beyond light range at startMove, light1 advances up to 110 px during startup (a lunge); other lights keep dash 18-20
Fighter.startMove computes this.dashLeft from track/stepIn and the foe distance (Fight passes foe distance via fighter.foeDist updated in step before act)

// 55_ai.js — approach
AI closes: at neutral with dist > lightRange for > 60 frames, every profile (incl. dummy? no: dummy stays inert) presses medium (t1 every 90 frames, t5 every 30) — gated on a new field approach (0 for dummy)

// Tutorial spar mode (80_game.js / 85_screens.js / 70_render.js / 00_head.html)
Tutorial.steps = [tap PUNCH ×3, swipe RIGHT (kick) ×1, hold to BLOCK then release to PARRY ×1, POWER ×1]; the dummy is passive (no swings) until step 3; at step 3 it winds up with a red flash 30 frames before each medium
HUD during tutorial: enemy bar replaced by a SPAR plate with a shield glyph and 'TRAINING DUMMY — CANNOT BE KO'D'; capped popups drawn grey; a 'LESSON n / 4' banner above the prompt; on step 4 done: 'SHIELD DOWN' flash, HP bar restored, guard cleared, FINISH HIM
Tutorial end: result shows TUTORIAL COMPLETE, +300 gold, and auto-opens one free basic crystal (Crystal.open('basic', {free:true})) so the roster has two champions; CONTINUE → map with DOOR 1 highlighted
Buttons: showButtons forced on during lessons 1-2, then the game's setting applies

// 45_encounter.js / 85_screens.js — floor 1 gate
FLOORS[0].nodes = ['f1_goblin','f1_skel','f1_goblin2','f1_shaman','f1_hob']; ENCOUNTERS[id].recLevel = 1,1,2,3,4; boss recLevel 4; map doors show 'REC. LVL n' (red when Save.data.roster[active].level < recLevel, still enterable)
Floor-1 mob tuning: goblin hp 300→360 atk 38→30; skeleton hp 260→320 atk 34→28; shaman hp 240→300 atk 44→32; hobgoblin hp 700→640 atk 55→46 (the batch tool must show the competent bot at ≥ 85% on doors 1-3 and 40-70% on doors 4-5)

// 68_rig.js — kick poses
POSES.medium (human), POSES_BIG.medium, POSES_QUAD.medium become leg strikes (human: rear leg snaps forward at hip height with the torso leaning back; big: a stomping front kick; quad: a hind-leg buck); 'kick' hit spark is a dust arc; light stays the arm jab; a new pose test asserts the medium's foot joint travels forward ≥ 60 px while the lead hand stays within 20 px of idle

// result screen
Screens.result(rewards, won): CONTINUE always (→ originating screen; map for quest/tutorial, arena panel for arena, title for exhibition), TITLE always, FIGHT AGAIN only for exhibition and arena wins
```

---

### Task 6.1: Result-screen exits, floor-1 order and level gate, mob tuning
**Files:** `src/85_screens.js`, `src/80_game.js`, `src/45_encounter.js`, `src/40_movedata.js`, `src/90_tests.js`, `tests/batch.py` (door table), `docs/ARENA.md`.
- [ ] Tests: after a scripted LOSS in quest, exhibition, arena and tutorial modes the result overlay shows CONTINUE and TITLE with working handlers (CONTINUE → the right screen, TITLE → title) and no FIGHT AGAIN in quest/tutorial; FLOORS[0] order and `recLevel` per node; map doors render `REC. LVL n` and the red class when under-levelled; new mob stats; `python3 tests/batch.py --n 20 --p1 carl --encounter f1_goblin|f1_skel|f1_goblin2` ≥ 85% and `f1_shaman|f1_hob` in 40-70% (paste).
- [ ] Commit `fix: exits after defeat; floor 1 order, level hints and tuning`.

### Task 6.2: Movement inside moves and AI approach
**Files:** `src/40_movedata.js`, `src/50_fighter.js`, `src/60_fight.js` (foeDist), `src/55_ai.js`, `src/90_tests.js`.
- [ ] Tests: a light from 250 px lands within 12 frames (step-in); a medium from 320 px lands (tracks to range) and from 60 px does not overshoot past the foe; the dash stops at light range; determinism test unchanged for profiles with `approach:0`; t1 AI presses medium within 90 frames at neutral distance; the tutorial dummy never approaches.
- [ ] Commit `feat: step-in lights, range-tracking dash-in, AI approach`.

### Task 6.3: Gesture control rewrite
**Files:** `src/30_input.js`, `src/00_head.html` (buttons optional), `src/85_screens.js` (settings toggle), `src/12_meta.js` (settings.showButtons default false), `src/80_game.js` (tutorial forces buttons), `src/90_tests.js`, `README.md`.
- [ ] Tests (synthetic PointerEvents with timestamps via an injectable `Input.now`): tap → light on release; hold 200 ms → block, release → block off; swipe right 60 px in 100 ms → medium; swipe right then hold 250 ms → heavy held then released; swipe left → dashBack; swipe left and hold past the dash → block; second pointer ignored; drift > 24 px cancels a tap; keyboard aliases; buttons hidden when showButtons is false and the canvas gesture surface covers the full canvas; the Phase 1 two-thumb tests are replaced by the one-pointer rule tests (amend allowed).
- [ ] Commit `feat: one-thumb gesture controls (tap, swipe right, swipe left, hold)`.

### Task 6.4: Tutorial spar mode
**Files:** `src/80_game.js` (Tutorial), `src/30_input.js` (tutorialDummy passive until step 3, wind-up flash), `src/70_render.js` (SPAR plate, grey popups, lesson banner, SHIELD DOWN), `src/85_screens.js` (result + free crystal), `src/12_meta.js` (`Crystal.open(kind,{free:true})`), `src/00_head.html`, `src/90_tests.js`, `tests/harness.py` (`--tutorial` bot uses gestures via intents, unchanged), shots `docs/shots/p6-tutorial-{1,3,shield}.png`.
- [ ] Tests: dummy makes no attack before step 3 (600 frames of idle player → no enemy hits); at step 3 a wind-up flash fx precedes each medium by 30 frames; SPAR plate rendered while guardActive and the HP bar after; SHIELD DOWN fx on step 4; free crystal opened once on first completion (roster size 2) and not on replay; `--tutorial` green.
- [ ] Commit `feat: tutorial spar mode with visible shield, lesson banner, shield-down kill, free crystal`.

### Task 6.5: Kick poses and impact art
**Files:** `src/68_rig.js`, `src/72_fx.js`, `src/60_fight.js` (kick spark kind), `src/90_tests.js`, shots via `tools/shots.sh` (`p6-kick-{carl,mongo,donut}.png`).
- [ ] Tests: the pose test in the interfaces block for all three rigs; every look renders the new poses (existing all-looks test); the HUD-line and reach tests still pass (the kick's foot extent counted).
- [ ] Commit `art: kicks are leg strikes in every rig; kick impact art`.

### Task 6.6: Close-out
**Files:** `docs/ARENA.md` (Phase 6 exit table, batch tables, rubric rows updated), `README.md` (controls section rewritten for gestures), `docs/superpowers/plans/2026-09-22-carls-arena-redesign-program.md` (program file listing Phases 6-11 with status), `tools/shots.sh`.
- [ ] Full gate incl. `--e2e` 3 seeds, `--tutorial`, `--screens-smoke`, `--phone-check`, `--perf`, batch tables; shots regenerated; commit `docs: Phase 6 close-out`.

**Phase 6 exit criteria:** owner-reported issues all closed (defeat exit, kick art, hobgoblin gate, invincible-goblin confusion, gestures); a level-1 competent bot clears doors 1-3; final whole-branch review clean; pushed; Pages serving it.

## Program outline (Phases 7-11, each gets its own plan file)
- **Phase 7 — Combat depth:** timed stacking `Effects` (bleed, stun, armor break, fury, power gain, power burn, regen, weakness); 5-node combo grammar with three enders; intercept and dexterity; hit-feel pass (directional shake, punch-in per class, per-class impact art).
- **Phase 8 — Art upgrade:** richer procedural vector bodies (layered shapes, gradients, outlines, faces, cloth) for all eleven looks; stage depth and lighting; HUD chevrons and portrait frames; door and roster art.
- **Phase 9 — Champion kits:** signature, heavy effect, S1/S2/S3 and a passive for Carl, Donut, Katia, Mongo, Grull, Mother Rat per the comparison notes §3.
- **Phase 10 — Progression:** 6 stars, catalyst tiers, new ISO curve and income, signature levels from dupes, masteries tree (40 points), ISO and catalyst crystals, the daily loop.
- **Phase 11 — Sprite content:** core-9 sprite sheets per look through the atlas hook (owner-generated art with the spec and prompt in the notes), hybrid FX.

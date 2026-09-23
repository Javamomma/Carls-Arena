# Carl's Doorway Brawl: rubric and progress log

Rubric table lands in Phase 5 (same format as Carls-Dash docs/PARITY.md: criterion, status, verification command).

Redesign program index (Phases 6-11, goal/status/plan file/exit criterion for each):
[`docs/superpowers/plans/2026-09-22-carls-arena-redesign-program.md`](superpowers/plans/2026-09-22-carls-arena-redesign-program.md).

## Progress log

- 2026-09-22 — Phase 6 final-review fix wave ("the first five minutes"), items 1-9, one commit each
  (9's minors grouped). Both Critical defects inside the first three minutes fixed: (1) the tutorial
  used to dead-end in silence at lesson 2 (the dummy stays passive until lesson 3) and hand a tap-only
  player the FULL completion grant once the fight's own 120s clock ran out -- every lesson now runs its
  own stall timer with a per-step fallback hint, lesson 2 credits a started (not only landed) medium,
  and the tutorial fight now has no clock at all (`clock:Infinity`), so completion is purely
  `Tutorial.state.step` reaching `steps.length`; (2) the tutorial's own prompt pill/lesson banner used
  to paint over the VICTORY headline on a tutorial win's result screen -- `G.onFightEnd` now hides them
  first. Also: (3) the tier gate's real root cause corrected -- `approach` is provably inert (see the
  "Correction" note above the retune section below), not the review's own prior `react`/block-hold
  conflation is the actual lever; a new per-tier `hold` field plus a measured fallback restores a
  monotone curve at n=30/60 and three seed bases; (4) `RNG(seed)` now discards 8 warm-up draws (every
  real fight's first crit is no longer a guaranteed roll) and a real fight now draws a persisted,
  varying seed (`Save.data.fightSeed++`) instead of the constant `G.seed`; (5) releasing a charged heavy
  now swings once past `HEAVY_MIN_CHARGE` frames instead of only ever cancelling or fully auto-firing,
  matching the README/gesture's own promise; (6) lesson 4's SHIELD DOWN/FINISH HIM now waits for the
  special's own move to actually resolve before clearing the dummy's guard, so it survives to a real
  follow-up KO; (7) the free tutorial crystal now guarantees a new champion by construction
  (`guaranteeNew`), not by relying on the default save seed; (8) every DOM screen (not just the in-fight
  canvas) now fits 844x390 without clipping, and `--phone-check` actually covers them; (9) minors:
  TRAINING DUMMY legibility, the announcer toast silenced for the whole tutorial, result-line segments
  joined with ` · ` (was two HTML-collapsed spaces), Mongo's/Donut's kick poses retuned (chest-height
  stomp; a real anticipation coil), gesture hold thresholds moved from wall-clock ms to sim frames
  (`G.frameNow`), and a stale 0.95/0.88 comment fixed. Full gate green at every commit; the tier gate's
  measured tables and the phone-check output are in their own sections below.
- 2026-09-22 — Phase 6 close-out ("The First Five Minutes"): Tasks 6.1-6.6 landed on `main`. For the
  owner, this phase fixed: floor 1 is now winnable at level 1 (reordered doors, retuned mob stats,
  every door/boss shows a REC. LVL hint), every move is driven by one-thumb gestures (tap/swipe-right/
  swipe-left/hold, matching the owner's own requested scheme) instead of touch zones, the tutorial is
  a visible sparring session (SPAR plate, LESSON n/4 banner, a real SHIELD DOWN kill) instead of an
  enemy that silently can't die, kicks are drawn as leg strikes distinct from punches in every rig,
  and a defeat always offers a working CONTINUE and TITLE exit. Movement now lives inside the moves
  themselves (a range-tracking dash-in medium, a step-in light, AI that closes distance at neutral) —
  no separate WALK state. Task 6.6's own close-out work: a deferred prompt-clearance minor from 6.4
  (the tutorial's LESSON/prompt pills now clear the fighter's head by a real margin at lesson 1's
  close spawn, via a lower gameplay zoom ceiling during tutorial mode only), the full gate re-run,
  `tools/shots.sh` regenerated (42 shots, now covering the tutorial's own freeze frames) and the
  README brought current (gallery, REC. LVL, exact keyboard caveats), and this program's Phase 7-11
  index. See "Phase 6 exit" below for the full gate table, the owner-report checklist, and one
  **known-open issue**: the abstract AI-tier `t1..t5` batch gate (unrelated to the shipped floor
  content, which is healthy) regressed during Task 6.2 and was not fixed in this task — see that
  section for the evidence and why.
- 2026-09-22 — Final-review fix wave for Phase 5 (release blockers), items 1-8, one commit each
  (docs/shots/p3-floor1-boss.png regenerated in its own commit alongside item 1). Both Important-path
  defects from the final review fixed: (1) the heavy-charge bar/block-parry ring collided with the
  HUD on tall fighters (Grull at boss doors, the exact frame `docs/shots/p3-floor1-boss.png` ships) --
  `Render.overlayScreenY` now converts the overlay's world-space point to screen space via
  `Camera.toScreen` and clamps it to never read closer than its own height+2px above `HUD_LINE`,
  drawing both overlays in screen space at that clamp instead of trusting the live camera zoom; (2)
  FIGHT AGAIN after a tutorial win replayed a broken tutorial (`Tutorial.state` already past step 4,
  "FINISH HIM" pinned from frame one) since its handler always called `startFight` directly, never
  `Tutorial.reset()` -- `#again` is now hidden for any tutorial-mode result, CONTINUE already routed
  to the map. Three Minors closed: kiosk perk rows now show a `Sponsors.DESC` effect line (ruling #2's
  own wording, dropped in implementation); the README's atlas-fallback claim now matches the rubric's
  own documented caveat (two browser resource-log lines, none from the app); turning USE SPRITE ATLAS
  off mid-session now actually falls back to the FK rig (`Rig.draw` re-checks
  `Save.data.settings.useAtlas||G.atlasQuery` every frame, not just at load). Two UX passes: an idle
  player stalled on the tutorial's POWER step for 900 sim frames now gets an extra hint and a pulsing
  `#btnPower` (reduceMotion-safe, both via a setting and the OS `prefers-reduced-motion` media query);
  the viewers `×N` badge now anchors off the "VIEWERS n" label's own measured width instead of the
  fixed 200px offscreen canvas it used to float off the end of. The share card was redesigned (gold
  card frame, dark stage strip behind the portrait, the game's own title glyph, a larger PEAK VIEWERS
  line, the play URL in small text) -- `docs/shots/p5-share.png` regenerated and viewed. **Ruling**
  (closing final review Minor #7): the map's TUTORIAL entry is permanent, by design -- it was never
  meant to disappear once `tutorialDone` flips true (the pre-flight conflict scan's "only until
  tutorialDone" line was superseded during Task 5.3 implementation but the reversal went undocumented
  until now). A completed tutorial stays replayable from floor 1's map for as long as the save exists;
  `Screens.renderMap` (`src/85_screens.js`) and its own unit test already encode this, unchanged by
  this fix wave. `--unit` 304 passing (was 298 before this wave; 6 new regression tests, one per item
  with a test named), `--matrix` 216/216, `--sim --seconds 60` clean, `index.html` 555,168 bytes. Every
  item's gate (`build.py && --unit && --sim --seconds 60 && --matrix`) reran green before its own
  commit.
- 2026-09-22 — Final-review fix wave for Phase 4 (items 1-10, one commit each except 10's minors,
  which were grouped). Two exploits, both invisible to the test suite for the same reason: (1) energy
  never regenerated against the wall clock (`e.ts` never anchored to a real `Energy.now()`), so node
  fights were effectively unlimited; (2) arena FIGHT AGAIN replayed the stale, already-resolved
  encounter while still crediting the new streak, an unlimited streak/gold farm off one button. Both
  fixed (`Energy.spend`/`Energy.tick` anchor `ts`; FIGHT AGAIN routes through `G.startArena()` for
  arena mode). The campaign map, the primary screen after CAMPAIGN, was clipping BOSS/DOOR 1 at
  854x480 despite being signed off as "reviewed, coherent" in the Task 4.6 close-out — fixed (`.node`
  min-height 44→40px, tighter spacing) with a new regression test. `--e2e`'s own energy assertion
  could never fail (`debugEnergy(999)` ran before every measurement); a real un-topped-up run now
  asserts the actual delta, verified live by temporarily reverting the energy fix and watching it
  catch the regression. Refused map clicks were invisible (no `disabled`, `#toast` painted under every
  overlay); nodes now disable and a new `#mapMsg` line shows why. Two plan-level rulings resolved
  (pity guarantees the kind's TOP tier, not top-1; duplicate shards scale by rolled tier instead of a
  flat 1) — see "Phase 4 plan defects (fixed)" below. Node gold raised 100·n+40·k → 160·n+60·k
  (balance). Three Phase 5 seams landed now while cheap: `FLOORS[i].id` + `Quest.floorDef(n)`,
  `Meta.SHOP_ITEMS` + `Meta.buy`, `Rewards.mult`. Six minors in one commit (44px `.panel` buttons,
  locked-boss icon specificity, `Screens._reveal` cleared on entry, map/crystal currency strips,
  `Meta.migrate` repointing a stale `active`, title-screen button hierarchy). `--e2e --seed {1,2,3}`
  and `--e2e --seed 1 --loops 20` all re-run and exit 0 clean; `--sim`/`--matrix`/`--perf` all green
  before every commit. See "Final-review fix wave" below for the full breakdown. Unit tests: 218
  passing.
- 2026-09-22 — Task 4.6: Phase 4 close-out. `tests/harness.py --e2e` (crystals → roster → quest →
  rewards → level-up → arena, headless) exits 0 for seeds 1, 2, 3 and for `--e2e --seed 1 --loops 20`
  (a 20-cycle menu+fight soak), all with zero page/console errors and zero assertion errors. Boss
  re-check at n=30 (`tests/batch.py`): `f1_grull` 13.3%, `f2_mother` 16.7%, both inside the 10-35%
  target band — no retune triggered. `--perf`'s JSON gained a top-level `perf:{ms_per_frame,ms_step,
  ms_render}` object (the controller's gate previously read `d.get('perf')` as `None`). Roster
  screen's `.cards` now centers vertically instead of pinning to the top with dead space below at
  1-2 champions (`docs/shots/p4-roster.png` regenerated at 1 champion; new `p4-roster-4.png` at 4).
  See "Phase 4 exit" below for the full table. Unit tests: 201 passing.
- 2026-09-21 16:19 — Phase 1 complete. Unit tests: 26 passing. Soaks: 4 x 300 s (basic/brawl x seeds 1,2) clean. Screenshot verified renderer output: two colored fighters, doorway structure, green health bars, gold power segments, timer, special move buttons, and combo counter. Six gameplay control checks from Task 1.7 Step 3 (light chains, medium closes distance, heavy charges, block/parry timing, dash evasion, special button) remain unverified pending human hand-play in browser.
- 2026-09-21 — Final-review fix wave for Phases 0-1: (1) two-thumb touch tracked per zone via a pointer Map so a second finger can no longer steal or clear the other's hold, fixing block drop and stuck-heavy; (2) `Fight.step` now detects both sides' hits against pre-resolve state before applying either, so a mutual trade lands both hits instead of only p1's; (3) `Audio.*` calls removed from `Fight` and dispatched from `G.onEvent` per event type, keeping the sim free of presentation-layer calls; (4) `tests/harness.py --sim` now restarts the fight on KO and reports a running `frames_total`/`fights` across the soak, failing under 90% of the requested duration, instead of idling through the rest of the budget after an early KO; (6) keyboard actions no longer queue while `G.state!=='FIGHT'`, fixing delayed inputs and stuck heavy after resuming from pause; (7) `AI.make` throws on an unknown profile instead of silently falling back to basic. Unit tests: 32 passing. Soaks re-run under the new `frames_total` rule (all exit 0, threshold 16200 of 18000): basic/seed1 `frames_total` 16636 (`fights` 17), basic/seed2 `frames_total` 16612 (`fights` 18), brawl/seed1 `frames_total` 16363 (`fights` 20), brawl/seed2 `frames_total` 16400 (`fights` 19).
- 2026-09-21 — Task 2.8: added the `brute` AI profile (slow `react`, heavy-happy) and a heavy-charge-hold behavior in `src/55_ai.js`, gated on the `p.heavy>0` short-circuit so `dummy`/`basic`/`brawl` draw the identical rng sequence they always did (the naive version broke the seeded 60s soak by inserting an unconditional extra `rng.next()` per decision, shifting every downstream roll). `ENCOUNTERS.f1_hob` now uses tier `'brute'`. Added `tests/harness.py --matrix`, which runs the full 36-cell soak (see below) as a single in-page evaluate() per cell (JS-side restart-on-KO loop) so a KO is caught the very next tick instead of at the next Python-side poll, keeping every cell's `frames_total` comfortably over the 90% floor. Unit tests: 61 passing.
- 2026-09-21 20:31 — Task 2.9: Phase 2 close-out. Added `tests/harness.py --perf N` (Ctrl.random bot vs brawl AI, `G.sim=true`, `performance.now()` confined to the page-evaluate); green at `ms_per_frame` 0.056 (`ms_step` 0.003, `ms_render` 0.053), far under the 6 ms gate. `Render` now bakes HUD statics (title glyph, the 4 chevron fill-level variants, floor-line text keyed by its label) into offscreen canvases via `Render.hudCache()` instead of redrawing them every frame; portraits were already cached per-look from Task 2.2. Fixed a determinism gap: `G.tick()` now ages `FX` itself once per sim step whenever `G.sim` is true (both the normal and cinematic branches), instead of relying on `G.loop()`'s wall-clock `requestAnimationFrame` cadence, so `--sim --shot` screenshots no longer depend on real time elapsed between harness round trips. Replaced the four emoji on-screen buttons with inline monochrome SVG icons (shield, fist, boot, lightning bolt) using `currentColor`, so they inherit `.cbtn`'s gold and correctly invert on `.ready`. Unified the `--sim` and `--matrix` soak loops behind one `build_soak_js()` restart-on-KO implementation in `tests/harness.py`, catching a KO the tick it happens instead of at the next 60-tick/probe boundary; verified `--sim --seconds 60`, `--sim --probe`, `--sim --pose`, `--sim --cinematic`, and `--sim --encounter` all still work. Small cleanups: dropped the dead `HITSTOP` constant, documented why the brute AI's heavy-hold counter being blind to interruption is safe today, and removed the silent try/catch around the HUD portrait `drawImage` calls. Generated the `docs/shots/` screenshot set (see table below) and un-ignored `docs/shots/*.png`. Unit tests: 63 passing.
- 2026-09-21 — Final-review fix wave for Phase 2, round 1 (items 1-8). (1) KO slow-mo actually plays now: `G.onEvent('ko')` no longer flips state synchronously; `G.tick()` keeps ticking through `FIGHT` while `fight.over`, counting `fight.slowmo` down every 4th tick, and only calls the new `G.showResult(winner)` once it hits 0. (2) `FX.update()`/`Camera.update()` moved into `G.tick()` unconditionally (both the cinematic and normal branches), once per call, and dropped from `G.loop()`'s `requestAnimationFrame` cadence entirely, so both now advance on the fixed sim step instead of display refresh (fixes double-speed FX/camera on >60Hz displays) and correctly freeze while `PAUSED`; `G.debugCinematic()`'s redundant `for(...20) FX.update()` loop (flagged by the Task 2.9 review) is gone, replaced by stepping until the card is actually up and past its slide-in. (3) Wall clamp widened: `EDGE_PAD=110` (40_movedata.js) replaces the old `width/2+8` inset in `Fighter.tick`'s clamp, so a pinned fighter's rig no longer renders off-canvas (`p2-goblin.png`, regenerated in the art-pass commit). (4) `Fight` now derives a `presRng` stream from the seed that the sim never reads; `Audio.announce`/`pickLine` calls in `G` were switched from `fight.rng` to `fight.presRng` so announcer line picks can no longer perturb crit rolls or any other sim outcome — this was a plan defect (the frozen interface specified the fight rng). (5) `Fighter.dx` makes `POSES.walk` reachable from `Rig.poseFor`. (6) Rig scale/framing art pass: camera anchor `.62`→`.74`, every `LOOKS.*` proportion raised, feet, a braced idle, a contact shadow, and the announcer toast restyled/repositioned off `canvas.getBoundingClientRect()`. (7) Streak lines now p1-only, `FIGHT AGAIN` replays the previous `p2`/`ai`, a shared `lookFor()` fallback guards `Rig.draw`/`Render.overlayY`/`Render.shadow` against a look-less def, `--perf` fixed for `--perf 0` and restart-on-KO. (8) Three regression tests the review asked for (look×pose render safety, parry-lockout recovery, a sim-purity source scan). `tests/harness.py`'s soak-floor check (`--sim` and `--matrix`) now also credits back `ko_ticks` (wall-clock ticks legitimately spent in the KO slow-mo grace period from fix (1), which don't advance `Fight.frame`) against the 90% floor. Unit tests: 72 passing.
- 2026-09-21 — Final-review fix wave for Phase 2, round 2 (re-review of item 6). Three Important breakages in round 1's art pass, all from the same root cause: round 1 validated framing only via `G.debugPose` screenshots, which sit at camera zoom 1.0 and never exercise the fight's actual zoom range. (A) At real gameplay/cinematic zoom, the rescaled rig's raised-arm poses (`heavyCharge`, `s3`) put the head/hand above the HUD bars (worst on `p2-goblin.png`/`p2-card.png`). Fixed by capping gameplay zoom at 1.12 (`Fight.updateCam`, was 1.35) and the S3 cinematic punch-in at 1.28 (`G.loop`, was 1.6), moving the camera anchor `.74`→`.90` (`Camera.apply`/`toScreen`), trimming `POSES.heavyCharge`'s peak shoulder angle (172°→108° — it was swinging the arm almost straight up), and trimming `LOOKS.hobgoblin` plus its `def.scale` (1.2→1.1) — it was compounding two scale-ups (round 1's rescale *and* its own multiplier) into the tallest reach in the roster by a wide margin. New test `'tallest pose stays under the HUD at max zoom'` checks every look × `{heavyCharge,s3}` × `{t:0,0.5,1}` against `Camera.toScreen` at the cinematic zoom. Fighters still fill >55% of frame height at zoom 1.0 (anchor doesn't change zoom-1 scale, only vertical position) — see the updated exit table. (B) The announcer toast moved from just under the HUD's floor-line text to the bottom band (its bottom edge 8px above the power chevrons at canvas `y=H-24`), width capped at 62% of the canvas (was 70%), and a new `G.fitToastText()` drops it from 13px to 12px if the current line would wrap to 3+ lines — it was bisecting fighters' heads in nearly every shot at the round-1 top placement. (C) `EDGE_PAD` widened `110`→`220` (40_movedata.js): the rescaled rig's reach is ~162px for Carl and ~212px for the hobgoblin, both past the round-1 value. New test `'every look's reach fits inside EDGE_PAD'`. This changed `Fighter`'s sim-side wall clamp, so the matrix numbers below moved slightly from round 1's (not from randomness — every cell's fighters now range slightly further before clamping). All 8 `docs/shots/p2-*.png` regenerated, plus two new real-gameplay close-zoom shots (`p2-close.png`, `p2-close-hob.png`) added specifically to exercise the fixed max zoom. Unit tests: 74 passing.
- 2026-09-21 — Final-review fix wave for Phase 2, round 3 (re-review of round 2's item B). Round 2's toast, centered at 62% of the canvas width, still ran its right edge over the PUNCH button's label in every non-cinematic shot. `G.positionToast` (`80_game.js`) now centers the toast in the horizontal gap between the BLOCK button's right edge and the PUNCH button's left edge instead of the canvas center, capped at 88% of that gap's width; the two edges are computed from the same canvas-local numbers `00_head.html`'s CSS positions the buttons with (`#btnBlock left:22/width:76`, `#btnPunch right:198/width:76`), not their DOM rects, since `#btns` collapses to a zero `getBoundingClientRect()` while hidden pre-fight (TITLE/RESULT) and `positionToast` runs then too. Bottom placement (8px above the chevrons) and the 13px→12px two-line cap (`G.fitToastText`) are unchanged from round 2. New test `'toast never overlaps the BLOCK/PUNCH button labels'` drives a guaranteed-to-wrap 120-char line through the real `Audio.say` path and checks the toast's actual laid-out rect against BLOCK/PUNCH (extended 20px down to cover their `::after` data-label, which has no directly queryable geometry) in canvas-local units. This round is presentation-only — no `Fight`/`Fighter`/`AI` change, so the soak matrix numbers are unchanged from round 2. All 10 `docs/shots/p2-*.png` regenerated; every button label fully readable in every shot. Unit tests: 75 passing.

## Phase 2 exit (2026-09-21)

| Criterion | Status | Verification |
|---|---|---|
| Unit tests ≥ 60 pass | 75 passing, 0 failing | `python3 tests/harness.py --unit` |
| Soak matrix clean (36 cells) | 36/36 cells, 0 errors, every `frames_total`+`ko_ticks` well over the 90% floor | `python3 tests/harness.py --matrix` |
| Perf < 6 ms/frame | `ms_per_frame` 0.075 (`ms_step` 0.007, `ms_render` 0.068) | `python3 tests/harness.py --perf 300` |
| Fighters stay under the HUD at max zoom | `'tallest pose stays under the HUD at max zoom'` unit test (every look × heavyCharge/s3 × t) | `python3 tests/harness.py --unit` |
| Screenshot set present | 10 shots in `docs/shots/`: `p2-idle.png` (Carl, braced idle stance), `p2-light3.png` (Carl, light-3 jab extended), `p2-heavy.png` (Carl, heavy overhead wind-up), `p2-block.png` (Carl, guard raised, parry-window indicator lit), `p2-hit.png` (Carl, hitstun recoil), `p2-s3.png` (Carl, S3 flurry mid-swing), `p2-goblin.png` (Carl vs. Goblin Scavenger, `FLOOR 1 • THE DEPTHS`, both HP bars damaged from a real 6 s fight), `p2-card.png` (S3 cinematic name card at the 1.28 punch-in, "CARL / SPECIAL 3"), `p2-close.png` (Carl vs. Goblin Scavenger at close range/near-max gameplay zoom), `p2-close-hob.png` (Carl vs. Hobgoblin Brute at close range — the tallest look, in the worst-case zoom scenario) | `python3 tests/harness.py --sim --seconds 1 --pose <key> --shot docs/shots/p2-<key>.png`; `--sim --seconds 4 --encounter f1_goblin --shot docs/shots/p2-close.png`; `--sim --seconds 4 --encounter f1_hob --shot docs/shots/p2-close-hob.png`; `--sim --seconds 6 --encounter f1_goblin --shot docs/shots/p2-goblin.png`; `--cinematic --shot docs/shots/p2-card.png` |

## Phase 2 soak matrix (historical — 2026-09-21, re-run after fix round 2)

Superseded by the fix-wave soak matrix below (2026-09-22), which extends `--matrix`'s own P1S/P2S/AIS
to Phase 3's new rigs/defs/tiers (this table's own coverage — carl/katia x goblin/hobgoblin/carl x
basic/brawl/brute — predates every Task 3.x addition). Kept for reference, not superseded numbers.

`python3 tests/harness.py --matrix`: p1 in {carl, katia} x p2 in {goblin, hobgoblin, carl} x ai in {basic, brawl, brute} x seed in {1, 2}, 36 cells, each a restart-on-KO soak over 120 simulated seconds (7200 frames requested). Ran in one Chromium instance, a fresh page per cell. Exit 0; no page or console errors; every cell's `frames_total` cleared the 90%-of-requested floor once `ko_ticks` (wall-clock ticks legitimately spent in the KO slow-mo grace period, which don't advance `Fight.frame`) is credited back — see the fix-wave note on `tests/harness.py`'s soak-floor check. Total wall time 2.5 s for all 36 cells.

**These numbers moved from the round-1 table above for a real reason, not noise:** fix round 2's item (C) widened `EDGE_PAD` (`40_movedata.js`) from 110 to 220 — a sim-side constant `Fighter.tick` clamps `x` against — so fighters now range further apart before the wall clamp kicks in. Every other round-2 change (zoom caps, camera anchor, pose trims, toast) is presentation-only and doesn't touch `Fight`/`Fighter`/`AI`. Round 1's own matrix re-run (KO fix + announcer RNG split) is still the reference for *why* the numbers first moved from the original Phase 2 table; this is just the same table re-run after round 2's `EDGE_PAD` change.

```
p1     p2         ai     seed  fights  p1wins  frames_total  errors
carl   goblin     basic  1     11      10      3423          0
carl   goblin     basic  2     10      9       3537          0
carl   goblin     brawl  1     10      9       3681          0
carl   goblin     brawl  2     11      10      3396          0
carl   goblin     brute  1     11      10      3156          0
carl   goblin     brute  2     11      10      3358          0
carl   hobgoblin  basic  1     6       4       5080          0
carl   hobgoblin  basic  2     6       4       5072          0
carl   hobgoblin  brawl  1     6       4       5070          0
carl   hobgoblin  brawl  2     6       4       5065          0
carl   hobgoblin  brute  1     6       5       5094          0
carl   hobgoblin  brute  2     6       5       5063          0
carl   carl       basic  1     5       3       5441          0
carl   carl       basic  2     5       2       5246          0
carl   carl       brawl  1     5       3       5233          0
carl   carl       brawl  2     5       2       5127          0
carl   carl       brute  1     5       2       5079          0
carl   carl       brute  2     6       3       5006          0
katia  goblin     basic  1     11      10      3422          0
katia  goblin     basic  2     10      9       3547          0
katia  goblin     brawl  1     10      9       3699          0
katia  goblin     brawl  2     11      10      3406          0
katia  goblin     brute  1     11      10      3156          0
katia  goblin     brute  2     11      10      3358          0
katia  hobgoblin  basic  1     7       5       4745          0
katia  hobgoblin  basic  2     7       5       4731          0
katia  hobgoblin  brawl  1     7       6       4726          0
katia  hobgoblin  brawl  2     7       6       4734          0
katia  hobgoblin  brute  1     7       6       4745          0
katia  hobgoblin  brute  2     6       5       4835          0
katia  carl       basic  1     6       4       5080          0
katia  carl       basic  2     6       4       5072          0
katia  carl       brawl  1     6       3       5066          0
katia  carl       brawl  2     6       4       5066          0
katia  carl       brute  1     6       2       5048          0
katia  carl       brute  2     7       3       4704          0
# 36 cells, 2.5s total wall time
```

## Fix-wave soak matrix (2026-09-22, item 7 — extended P1S/P2S/AIS)

`python3 tests/harness.py --matrix`: p1 in {carl, katia, donut, mongo} x p2 in {goblin, hobgoblin,
skeleton, shaman, grub, grull, mother_rat, donut, mongo} x ai in {t1, t3, t5} x seed in {1, 2} —
216 cells (was 36; the old set never covered Phase 3's new rigs/defs/tiers, which the Phase 3 exit
criteria required explicitly — see the final review's Important findings). Real tiers (t1/t3/t5)
replace the old `basic`/`brawl`/`brute` aliases; P2S now covers every non-boss rig kind (human
placeholders skeleton/shaman, quad grub, quad/big champs donut/mongo as mob-slot stand-ins) plus both
bosses (grull, mother_rat) so their own buff/s3 get soak coverage too; P1S adds donut/mongo so a
quad/big-rig PLAYER side is soaked as well. Each cell restart-on-KO soaks 60s of simulated frames (not
120s — kept fast given 6x the cells). Ran in one Chromium instance, a fresh page per cell. Exit 0; no
page or console errors; every cell's `frames_total`+`ko_ticks` cleared the 90%-of-requested floor.
Total wall time 15.2s for all 216 cells.

```
p1     p2         ai     seed  fights  p1wins  frames_total  errors 
carl   goblin     t1     1     7       6       1373          0      
carl   goblin     t1     2     7       6       1371          0      
carl   goblin     t3     1     5       4       1982          0      
carl   goblin     t3     2     5       4       1978          0      
carl   goblin     t5     1     5       4       1701          0      
carl   goblin     t5     2     5       4       1608          0      
carl   hobgoblin  t1     1     3       2       2728          0      
carl   hobgoblin  t1     2     3       2       2614          0      
carl   hobgoblin  t3     1     4       0       2301          0      
carl   hobgoblin  t3     2     4       0       2281          0      
carl   hobgoblin  t5     1     5       0       1902          0      
carl   hobgoblin  t5     2     5       0       1870          0      
carl   skeleton   t1     1     7       6       1377          0      
carl   skeleton   t1     2     7       6       1174          0      
carl   skeleton   t3     1     4       3       2243          0      
carl   skeleton   t3     2     4       3       2303          0      
carl   skeleton   t5     1     6       5       1592          0      
carl   skeleton   t5     2     5       4       1594          0      
carl   shaman     t1     1     7       6       1377          0      
carl   shaman     t1     2     7       6       1174          0      
carl   shaman     t3     1     5       3       1993          0      
carl   shaman     t3     2     5       2       1969          0      
carl   shaman     t5     1     6       4       1558          0      
carl   shaman     t5     2     6       3       1556          0      
carl   grub       t1     1     5       4       2054          0      
carl   grub       t1     2     5       4       1823          0      
carl   grub       t3     1     4       3       2310          0      
carl   grub       t3     2     4       2       2287          0      
carl   grub       t5     1     4       1       2191          0      
carl   grub       t5     2     4       1       1979          0      
carl   grull      t1     1     2       0       2876          0      
carl   grull      t1     2     2       1       3053          0      
carl   grull      t3     1     4       0       2226          0      
carl   grull      t3     2     4       0       2020          0      
carl   grull      t5     1     5       0       1902          0      
carl   grull      t5     2     5       0       1715          0      
carl   mother_rat t1     1     2       0       3076          0      
carl   mother_rat t1     2     2       1       3053          0      
carl   mother_rat t3     1     4       0       2303          0      
carl   mother_rat t3     2     4       0       2282          0      
carl   mother_rat t5     1     5       0       1907          0      
carl   mother_rat t5     2     5       0       1881          0      
carl   donut      t1     1     3       1       2727          0      
carl   donut      t1     2     3       2       2614          0      
carl   donut      t3     1     5       0       1972          0      
carl   donut      t3     2     5       0       1761          0      
carl   donut      t5     1     5       0       1636          0      
carl   donut      t5     2     6       0       1567          0      
carl   mongo      t1     1     2       0       2743          0      
carl   mongo      t1     2     3       1       2702          0      
carl   mongo      t3     1     4       0       2086          0      
carl   mongo      t3     2     5       0       1940          0      
carl   mongo      t5     1     5       0       1902          0      
carl   mongo      t5     2     5       0       1646          0      
katia  goblin     t1     1     6       5       1423          0      
katia  goblin     t1     2     7       6       1361          0      
katia  goblin     t3     1     5       4       1858          0      
katia  goblin     t3     2     5       4       1938          0      
katia  goblin     t5     1     6       5       1590          0      
katia  goblin     t5     2     6       4       1551          0      
katia  hobgoblin  t1     1     4       2       2386          0      
katia  hobgoblin  t1     2     4       3       2357          0      
katia  hobgoblin  t3     1     4       3       2046          0      
katia  hobgoblin  t3     2     5       2       1939          0      
katia  hobgoblin  t5     1     5       0       1902          0      
katia  hobgoblin  t5     2     5       0       1688          0      
katia  skeleton   t1     1     7       6       1380          0      
katia  skeleton   t1     2     7       6       1156          0      
katia  skeleton   t3     1     5       4       1871          0      
katia  skeleton   t3     2     6       5       1649          0      
katia  skeleton   t5     1     6       5       1264          0      
katia  skeleton   t5     2     6       4       1286          0      
katia  shaman     t1     1     7       6       1380          0      
katia  shaman     t1     2     7       6       1156          0      
katia  shaman     t3     1     5       4       1752          0      
katia  shaman     t3     2     6       4       1643          0      
katia  shaman     t5     1     7       4       1251          0      
katia  shaman     t5     2     7       4       1246          0      
katia  grub       t1     1     5       4       2046          0      
katia  grub       t1     2     5       4       1775          0      
katia  grub       t3     1     4       3       2022          0      
katia  grub       t3     2     4       2       2113          0      
katia  grub       t5     1     5       2       1669          0      
katia  grub       t5     2     6       2       1561          0      
katia  grull      t1     1     3       1       2729          0      
katia  grull      t1     2     3       1       2699          0      
katia  grull      t3     1     4       0       2136          0      
katia  grull      t3     2     5       0       1956          0      
katia  grull      t5     1     5       0       1899          0      
katia  grull      t5     2     5       0       1654          0      
katia  mother_rat t1     1     3       1       2736          0      
katia  mother_rat t1     2     3       1       2700          0      
katia  mother_rat t3     1     4       0       2192          0      
katia  mother_rat t3     2     4       0       2004          0      
katia  mother_rat t5     1     5       0       1899          0      
katia  mother_rat t5     2     5       0       1662          0      
katia  donut      t1     1     3       1       2500          0      
katia  donut      t1     2     4       3       2362          0      
katia  donut      t3     1     5       1       1965          0      
katia  donut      t3     2     5       1       1808          0      
katia  donut      t5     1     5       0       1652          0      
katia  donut      t5     2     6       0       1564          0      
katia  mongo      t1     1     3       1       2735          0      
katia  mongo      t1     2     3       1       2711          0      
katia  mongo      t3     1     5       0       1982          0      
katia  mongo      t3     2     5       0       1944          0      
katia  mongo      t5     1     5       0       1878          0      
katia  mongo      t5     2     6       0       1555          0      
donut  goblin     t1     1     7       6       1372          0      
donut  goblin     t1     2     7       6       1361          0      
donut  goblin     t3     1     5       4       1858          0      
donut  goblin     t3     2     5       4       1978          0      
donut  goblin     t5     1     6       3       1568          0      
donut  goblin     t5     2     6       2       1552          0      
donut  hobgoblin  t1     1     3       1       2497          0      
donut  hobgoblin  t1     2     4       3       2363          0      
donut  hobgoblin  t3     1     4       1       2239          0      
donut  hobgoblin  t3     2     5       1       1941          0      
donut  hobgoblin  t5     1     5       0       1899          0      
donut  hobgoblin  t5     2     5       0       1636          0      
donut  skeleton   t1     1     7       6       1380          0      
donut  skeleton   t1     2     7       6       1156          0      
donut  skeleton   t3     1     5       3       1990          0      
donut  skeleton   t3     2     5       3       1974          0      
donut  skeleton   t5     1     6       4       1350          0      
donut  skeleton   t5     2     6       3       1372          0      
donut  shaman     t1     1     7       6       1380          0      
donut  shaman     t1     2     7       6       1156          0      
donut  shaman     t3     1     6       5       1662          0      
donut  shaman     t3     2     5       4       1674          0      
donut  shaman     t5     1     7       4       1256          0      
donut  shaman     t5     2     7       4       1251          0      
donut  grub       t1     1     5       4       1736          0      
donut  grub       t1     2     6       5       1638          0      
donut  grub       t3     1     5       3       1985          0      
donut  grub       t3     2     4       2       2113          0      
donut  grub       t5     1     6       3       1573          0      
donut  grub       t5     2     6       2       1549          0      
donut  grull      t1     1     3       1       2728          0      
donut  grull      t1     2     3       1       2697          0      
donut  grull      t3     1     4       0       2125          0      
donut  grull      t3     2     5       0       1934          0      
donut  grull      t5     1     5       0       1906          0      
donut  grull      t5     2     6       0       1555          0      
donut  mother_rat t1     1     2       0       2767          0      
donut  mother_rat t1     2     2       1       2944          0      
donut  mother_rat t3     1     4       0       2216          0      
donut  mother_rat t3     2     4       0       2000          0      
donut  mother_rat t5     1     5       0       1902          0      
donut  mother_rat t5     2     5       0       1671          0      
donut  donut      t1     1     3       1       2389          0      
donut  donut      t1     2     4       3       2363          0      
donut  donut      t3     1     5       1       1867          0      
donut  donut      t3     2     6       1       1622          0      
donut  donut      t5     1     5       0       1603          0      
donut  donut      t5     2     6       0       1541          0      
donut  mongo      t1     1     3       0       2728          0      
donut  mongo      t1     2     3       0       2701          0      
donut  mongo      t3     1     5       0       1977          0      
donut  mongo      t3     2     5       0       1891          0      
donut  mongo      t5     1     5       0       1661          0      
donut  mongo      t5     2     6       0       1558          0      
mongo  goblin     t1     1     6       5       1571          0      
mongo  goblin     t1     2     7       6       1372          0      
mongo  goblin     t3     1     5       4       1982          0      
mongo  goblin     t3     2     5       4       1978          0      
mongo  goblin     t5     1     5       4       1701          0      
mongo  goblin     t5     2     5       4       1789          0      
mongo  hobgoblin  t1     1     3       2       2720          0      
mongo  hobgoblin  t1     2     4       3       2364          0      
mongo  hobgoblin  t3     1     4       2       2292          0      
mongo  hobgoblin  t3     2     4       2       2277          0      
mongo  hobgoblin  t5     1     4       0       2226          0      
mongo  hobgoblin  t5     2     4       0       2232          0      
mongo  skeleton   t1     1     7       6       1377          0      
mongo  skeleton   t1     2     7       6       1174          0      
mongo  skeleton   t3     1     4       3       2243          0      
mongo  skeleton   t3     2     4       3       2303          0      
mongo  skeleton   t5     1     6       5       1592          0      
mongo  skeleton   t5     2     5       4       1849          0      
mongo  shaman     t1     1     7       6       1377          0      
mongo  shaman     t1     2     7       6       1174          0      
mongo  shaman     t3     1     5       4       1996          0      
mongo  shaman     t3     2     4       3       1993          0      
mongo  shaman     t5     1     6       5       1583          0      
mongo  shaman     t5     2     5       4       1576          0      
mongo  grub       t1     1     5       4       1736          0      
mongo  grub       t1     2     6       5       1638          0      
mongo  grub       t3     1     4       3       2307          0      
mongo  grub       t3     2     4       3       2287          0      
mongo  grub       t5     1     5       4       1909          0      
mongo  grub       t5     2     5       4       1873          0      
mongo  grull      t1     1     2       1       3076          0      
mongo  grull      t1     2     2       1       3053          0      
mongo  grull      t3     1     3       0       2620          0      
mongo  grull      t3     2     3       0       2420          0      
mongo  grull      t5     1     4       0       2238          0      
mongo  grull      t5     2     4       0       2223          0      
mongo  mother_rat t1     1     2       1       3064          0      
mongo  mother_rat t1     2     2       1       3033          0      
mongo  mother_rat t3     1     3       0       2620          0      
mongo  mother_rat t3     2     3       0       2590          0      
mongo  mother_rat t5     1     3       0       2287          0      
mongo  mother_rat t5     2     4       0       2222          0      
mongo  donut      t1     1     3       2       2720          0      
mongo  donut      t1     2     4       3       2364          0      
mongo  donut      t3     1     4       1       2308          0      
mongo  donut      t3     2     4       1       2291          0      
mongo  donut      t5     1     4       0       2000          0      
mongo  donut      t5     2     4       0       1898          0      
mongo  mongo      t1     1     2       1       3067          0      
mongo  mongo      t1     2     2       1       3051          0      
mongo  mongo      t3     1     3       0       2624          0      
mongo  mongo      t3     2     3       0       2282          0      
mongo  mongo      t5     1     4       0       2221          0      
mongo  mongo      t5     2     4       0       2068          0      
# 216 cells, 15.2s total wall time
```

## Deferred from the Phase 1 final review (2026-09-21)

Not fixed yet; triage before or during Phase 2. (Mash-blocking is closed — Task 2.6 added the `PARRY_LOCKOUT` fix — so it's dropped from this list; not-blocking minors from the Phase 2 final review are appended below.)
- `G.startFight` resets `Input.q`/`held` but not `Input._ptrs`; a restart mid-touch can carry stale pointer records.
- Pointer zone is fixed at pointerdown; a finger that swipes across the def/off boundary keeps its original zone.
- `src/80_game.js` looks up the three special buttons every simulated frame; cache the nodes at init.
- Global `Audio` shadows the browser constructor of that name.
- `tools/build.py` sorts lexicographically, so a future `src/100_*.js` would sort before `src/10_util.js`.
- No input buffer: chain taps arriving during startup or active frames are dropped (all measured tap periods still reach the five-hit knockdown).
- Double KO awards p2; attacker combo never resets while the foe sits in BLOCK; hitstop pauses the round clock (~3% at current hit rates).
- Harness restart block names its variable `ctrl2` while feeding `ctrl1` (cosmetic).
- `src/90_tests.js` is the largest source file; split into `9x_*.js` files once it passes ~200 lines.
- From the Phase 2 final review, not blocking, deferred on purpose: `src/50_fighter.js` `blockPressedAt` is written and never read; `Render.pauseRect`'s hit-test is a square under a rounded glyph; `Rig.draw`'s signature accepts `cam`/`frame` but ignores both (harmless today, but settle the signature before Phase 3 authors rigs against it); `src/55_ai.js`'s brute `hHold` counter is blind to interruption (fine while nothing reads it mid-charge — fix inside Phase 3's AI task, not before it, since an AI tier that reacts mid-swing needs it to actually reset on interruption).

## Phase 2 execution rulings (2026-09-21, from the SDD ledger)
Ruling: continue on `main` with pushes after each phase's final review, per the user's standing instruction (2026-09-21 16:32 "push the fixes when done", 17:22 "keep going with writing and executing all phases") — cost if wrong: a visible bad commit on a public repo, revertable.
Ruling: one implementer dispatch per task (2.1-2.9), mid-tier model, because these tasks describe art and behavior in prose rather than complete code — cost if wrong: more dispatches than needed.
Ruling: screenshot quality (does it read like the rendition) is judged by the task reviewer from the shots the implementer saves; the controller also views one shot per art task — cost if wrong: an ugly frame ships to Phase 3 and gets fixed there.
Ruling: Task 2.3 hitstop freeze applies to single-hit moves and the last hit of multi-hit specials only (sparks/popup/shake on every hit) — stacking s3's 14-frame freeze four times broke pacing and the S3 test; Task 2.6 must not assume per-hit freeze — cost if wrong: specials feel lighter than intended, tunable in 2.6.
Task 2.3: review approved. Ruling: Important finding "FX.update runs per rAF, not per sim tick, so --sim --shot particle state is wall-clock dependent" deferred to Task 2.9 with the fix "when G.sim is true, FX.update() runs inside G.tick after each sim step" — cost if wrong: nondeterministic screenshots until 2.9. Minor (deferred): HITSTOP constant is dead code.
Task 2.4: review approved. Ruling: Important "button glyphs are OS emoji, not the rendition's monochrome icon style" deferred to Task 2.9 (draw the four icons as inline SVG data-URIs or canvas, gold on dark) — cost if wrong: a stylistic seam ships for a few hours. Minors (deferred): squeezed monospace title, silent try/catch around portrait drawImage, pause hit-test shape.
Task 2.6: review approved with plan-mandated Important (ender test vacuous). Ruling: plan amended, test replaced with one exercising the ender branch; blockPressedAt becomes a frame stamp — cost if wrong: none. Fix round 1 dispatched, FIX_BASE 4c667f2
Task 2.7: review — 1 Important (toast bleeds through card). Ruling: band is a curtain covering the HUD; shrink to a ~150 px name-card band — cost if wrong: art rework. Fix round 1 dispatched to impl-2-7, FIX_BASE b434adc
Task 2.8: review approved. Ruling: Important "duplicated soak loop" resolved by making the in-page restart loop canonical; Task 2.9 routes plain --sim through it — cost if wrong: harness refactor time. Minor (deferred to 2.9 comment): brute heavy-hold counter blind to interruption.
Ruling: walk is presentation-only — Fighter records dx per tick (derived, deterministic) and Rig.poseFor maps IDLE with |dx|>0.3 to walk — cost if wrong: an animation tweak in Phase 3.
Ruling: f1_hob tier 'brute' is correct; the Phase 2 plan's 'brawl' is the defect (note added to plan in the wave).
Ruling: fix-wave commits carried 'Claude Sonnet 5' trailers; rewritten to Fable 5.1 via filter-branch (unpushed history) — cost if wrong: none. Re-review package: review-fixwave-p2.diff
Fix wave re-review: items 1-5,7,8 addressed; item 6 left 3 Important (heads off-canvas at max zoom, toast bisects heads, EDGE_PAD undersized). Ruling: one more scoped round (round 2) because these are player-visible breakages from the art pass — cost if wrong: an extra review cycle. Round 2 dispatched to impl-fixwave-p2, FIX_BASE 81d9e6d

## Phase 3 progress log

- 2026-09-22 — Tasks 3.1-3.5 (AI tiers/behaviours, buffs framework, floors/encounters/bosses, the
  quadruped and big rig kinds, the full roster) landed with no entries added here; see
  `docs/superpowers/plans/2026-09-21-phase3-ai-encounters.md` for their frozen interfaces and
  `git log` for the individual commits (`feat: AI tiers t1-t5 ...` through
  `feat: big rig for Mongo and Grull`).
- 2026-09-22 — Task 3.6: Phase 3 close-out. `tests/batch.py` (new) sweeps `AI.TIERS` t1..t5, and by
  default every `FLOORS` node/boss, against a new scripted `Ctrl.competent` bot (`src/30_input.js`):
  blocks a foe's medium/heavy once its startup clock passes 6 frames, chains lights in range, dashes
  back from a telegraphed heavy charge under 30% hp, fires the strongest affordable special.
  Balance pass to make the gate (monotone win rate, t1 >= 80%, last tier <= 30%) hold against that
  bot: `AI.TIERS.attack` retuned for t3/t4/t5, and `AI.make` given a general `comboFollow` behaviour
  (a landed attack — not just a punish — now chases its own chain), gated on `p.punish` so t1 stays
  inert; see "AI numbers changed" below. Final batch (n=30): monotone, t1 100%, t5 10% — gate green.
  `AI.make`'s `next()` refactored into six named per-behaviour functions (`decideHeavy`, `decideBait`,
  `decidePunish`, `decideIntercept`, `decideBlock`, `decideAttack`) sharing one state object; verified
  rng-for-rng identical to the pre-refactor version (`--matrix` and the batch table compared
  byte-for-byte, differing only in wall-clock timing). `Fighter` gained `wasKnockedDown`, set on
  entering `KNOCKDOWN` and self-clearing one tick after get-up i-frames actually expire, replacing
  `AI.make`'s old inv-edge heuristic that only avoided misfiring on a plain dash-back because
  `DASH_BACK.inv` (8) happens to be less than `DASH_BACK.frames` (12) — a coincidence of those two
  constants, not a real invariant. Fixed: `Render.bossPlate`'s left edge no longer overlaps the
  "FIGHTER" title (now clamped to `hudCache().titleRightEdge+8`, measured via `measureText` rather
  than an eyeballed constant); `tests/harness.py --floor` without `--node` now exits 2 with a usage
  error instead of an uncaught `TypeError`; `ENCOUNTERS.f1_goblin`/`f1_hob` switched from a literal
  `hpMul`/`atkMul` of `1` to `floorMul(1)` (numerically identical, just consistent with every other
  floor-1 entry); two ambiguous "fix round N" comments in `src/40_movedata.js` now name which
  phase/task they belong to. `POSES.heavy`'s `rShoulder` (`src/68_rig.js`) was raised from an
  over-trimmed 96 back to 118 — the largest value that still keeps the "pin the zoom cap at exactly
  1.12/1.28" test green — so the wind-up reads as distinct from the light jab again (see "AI numbers
  changed" below for why 96 happened and why 118 is a hard ceiling, not an aesthetic choice). Unit
  tests: 114 passing.

## Phase 3 exit (2026-09-22)

| Criterion | Status | Verification |
|---|---|---|
| Unit tests ≥ 85 pass | 114 passing, 0 failing | `python3 tests/harness.py --unit` |
| Soak matrix clean (36 cells) | 36/36 cells, 0 errors | `python3 tests/harness.py --matrix` |
| Batch win-rate gate (monotone, t1 ≥ 80%, last tier ≤ 30%) | t1 100% / t2 93.3% / t3 80% / t4 70% / t5 10%, monotone non-increasing | `python3 tests/batch.py --n 30 --p1 carl --ai t1,t2,t3,t4,t5` |
| Screenshot set present | `docs/shots/p3-*` (donut idle/light1/heavy/s3/hit, mongo idle/heavy/s3, grub, grull, mother, quads, floor1-boss, floor2-boss) | see the batch/shot commands below |

## Phase 3 batch win-rate tables (2026-09-22)

Bot is `Ctrl.competent` (`src/30_input.js`), `--bot auto` (the default): reacts to a visible
medium/heavy, chains lights in range, dashes from a telegraphed heavy charge under 30% hp, and fires
the strongest affordable special. p1 is Carl against a neutral `donut`-stat opponent for the tier
sweep, and against each real floor encounter (its own tier/enemy/hp·atk multipliers) for the node
sweep — `python3 tests/batch.py --n 30 --p1 carl --ai t1,t2,t3,t4,t5`:

```
tier           fights  winrate%  avglen(s)  stalled
t1             30      100.0     5.64       0
t2             30      93.3      6.60       0
t3             30      80.0      8.43       0
t4             30      70.0      8.84       0
t5             30      10.0      6.11       0
# OK: monotone non-increasing, t1=100.0 (>=80), last=10.0 (<=30)

# per-floor-node/boss win rates (carl vs auto, n=30 each)
encounter      fights  winrate%  avglen(s)  stalled
f1_goblin      30      100.0     2.11       0
f1_skel        30      100.0     2.06       0
f1_hob         30      93.3      21.17      0
f1_shaman      30      100.0     2.86       0
f1_goblin2     30      100.0     2.72       0
f1_grull       30      0.0       15.94      0
f2_grub        30      100.0     6.00       0
f2_skel2       30      100.0     2.91       0
f2_shaman2     30      100.0     2.82       0
f2_hob2        30      96.7      10.17      0
f2_grub2       30      100.0     5.83       0
f2_mother      30      0.0       7.14       0
```

Every floor-1 node before the boss, and every floor-2 node before the boss, is easy for a
`Ctrl.competent`-level player (93-100%); both bosses (`f1_grull`, `f2_mother`) are 0% — their
combined hp lead (1600/1610 vs. donut's 820 baseline) and signature buff (`armorUp`/`regen`) put them
well past what the tier curve alone predicts (t4 70%, t5 10%), which is the intended shape for a
"raid boss" checkpoint, not a batch-gate failure (the gate only covers the `--ai` tier sweep, not the
per-node table — see tests/batch.py's own `--no-floors` flag to skip it).

## Fix-wave batch win-rate tables (2026-09-22, items 1/2/8)

Supersedes the Phase 3 table above, which predates the *STEP special-scaling fix (item 1), the boss
stat retunes (item 2), and Ctrl.competent's closing-distance/heavy-mixup behavior (item 8) — all three
together are what the boss numbers below depend on (see the boss-tuning notes further down for why
items 1+2 alone weren't enough). `python3 tests/batch.py --n 30 --p1 carl --ai t1,t2,t3,t4,t5`:

```
tier           fights  winrate%  avglen(s)  stalled 
t1             30      100.0     3.84       0       
t2             30      93.3      5.06       0       
t3             30      73.3      5.18       0       
t4             30      53.3      5.31       0       
t5             30      23.3      3.23       0       
# OK: monotone non-increasing, t1=100.0 (>=80), last=23.3 (<=30)

# per-floor-node/boss win rates (carl vs auto, n=30 each)
encounter      fights  winrate%  avglen(s)  stalled 
f1_goblin      30      100.0     1.53       0       
f1_skel        30      100.0     1.47       0       
f1_hob         30      83.3      9.09       0       
f1_shaman      30      100.0     1.46       0       
f1_goblin2     30      100.0     1.49       0       
f1_grull       30      16.7      14.58      0       
f2_grub        30      100.0     2.91       0       
f2_skel2       30      100.0     2.28       0       
f2_shaman2     30      96.7      1.65       0       
f2_hob2        30      63.3      7.04       0       
f2_grub2       30      96.7      3.03       0       
f2_mother      30      16.7      9.65       0       
```

Tier gate: monotone non-increasing, t1 100% (>=80), t5 23.3% (<=30) — held without retuning any
AI_TIERS field once Ctrl.competent learned to close distance/mix in heavies (checked at both n=20,
30% exactly at the ceiling, and n=30, 23.3%, comfortably under it).

Both bosses now land in the 10-35% target band (16.7% at n=30, 20-25% at n=20 across repeat runs) —
see the boss-tuning notes below for how items 1/2/8 interact and why item 2's original atk-only
retune (Grull 60, Mother Rat 50) wasn't enough on its own.

### Boss tuning notes

Item 2's first pass (Grull hp 1600->1300/atk 70->60, Mother Rat atk 62->50, regen 0.0005->0.00017/
frame) was tuned before items 1 and 8 landed, and was explicitly documented as provisional pending
both. Once item 1 (specials actually fire) and item 8 (Ctrl.competent closes distance and mixes in
heavies) were both in, Grull was *still* a near-wall (0-10% at n=20/30) and Mother Rat unchanged at
0%. A log breakdown of a lost `f1_grull` fight explained why: Carl landed only 4 hits total (2 light1,
2 heavy-via-mixup) in an 8s loss where Grull landed 11 — the bot's own reactive/chain-continuation
offense is comparatively weak against a react:5/punish:.8 tank even once it can reliably reach him
and doesn't idle outside range. Both bosses' `atk` were retuned further once items 1/8 were in (per
item 2's own deferred plan): Grull 60->42, Mother Rat atk 50->35 + hp 1400->1100 (close to the final
review's own alternate, "rat atk 46 + hp 1100") — both land the competent bot in the 10-35% band, with
Mother Rat ending well below full hp rather than a near-untouched win.

## AI numbers changed (Task 3.6)

`src/55_ai.js`'s `AI_TIERS.attack` (chance per idle decision, at `cd===0`, of throwing a spontaneous
light/medium):

| tier | before | after |
|---|---|---|
| t1 | .03 | .03 (unchanged) |
| t2 | .04 | .04 (unchanged) |
| t3 | .09 | .25 |
| t4 | .12 | .35 |
| t5 | .15 | .65 (and `react` 3→2) |

Before this pass, t3-t5 rolled an attack so rarely that `--bot auto` beat every tier at a flat
77-100% win rate with no real difficulty curve — the tier table's `block`/`parry`/`punish` numbers
were already high enough to counter a scripted opponent, but the tiers almost never got to use them
because they almost never attacked. Paired with the retune (not a number, a behaviour): `AI.make`'s
punish-only chain follow-through (`punishFollow`, Task 3.1) generalized into `comboFollow`, which also
chases a landed *spontaneous* attack, gated on `p.punish>0` (same monotonic knob, t1 stays inert) —
without it, `--bot auto` blocked or dodged everything past a bare `light1` and ate the rest of any
chain for free. Every other `AI_TIERS` field is unchanged from the frozen Phase 3 interfaces.

`src/68_rig.js`'s `POSES.heavy` `rShoulder` (t:0 keyframe, the wind-up): the frozen Phase 3 interfaces
never pinned this number, but its history moved twice without a screenshot check each time — 175
(original) → 128 (Task 3.5 fix round 2, documented) → 96 (the "pin ordinary-pair caps" commit,
undocumented, over-trimmed). At 96 the wind-up read as a level forward reach nearly identical to
`light3`'s own peak shoulder angle (95). Binary-searched back up to 118 for the final review (the
largest value that still kept the OLD per-fight worst-case zoom cap pinned at exactly 1.12/1.28), but
even 118 still read as marginal ("the fist sits 11px above light3's, same forward-lean silhouette" —
final review, balance note 2) — a hard ceiling set by Carl's own reach against a single fight-wide
cap, not an aesthetic choice.
**Resolved in the 2026-09-22 fix wave (item 4):** the structural fix was making the zoom cap
per-frame (`Rig.topAt`/`G.topNow`, 68_rig.js/80_game.js) instead of a per-fight worst case — one tall
pose no longer taxes every other frame of the fight. `rShoulder` is back at its original 175° (a real
near-vertical overhead, clearly distinct from `light3`'s level jab — see `docs/shots/p2-heavy.png`);
Hobgoblin's held club is back to its real length for the same reason. The old exact-1.12/1.28 pin is
no longer a meaningful invariant (nothing renders against the per-fight bound directly anymore) and
was relaxed to a loose sanity check — see 90_tests.js's own comments on both tests for the detail.

## Phase 3 plan defects (fixed) — 2026-09-22 fix wave

Four defects in the frozen Phase 3 plan's own interfaces/gate, surfaced by the final review and fixed
in this fix wave rather than worked around in the implementation:

1. **`regen`'s frozen rate (0.05% maxHp/frame) is 3%/s** — 360% of max hp over a 120s fight clock;
   fine for the plan's own 600-frame (10s) test, unusable on a boss with a multi-second fight length.
   Fixed: retuned to 0.017%/frame (~1%/s) in item 2, as part of making Mother Rat winnable.
2. **The `AI_TIERS` table mixes scales without saying so** — `special` is a per-second probability,
   `attack` (and every other field) is per-frame; multiplying `special` by `STEP` (matching the
   table's own implicit per-second intent) made bosses almost never throw their signature S3 once
   Task 3.6 raised `attack`. Fixed in item 1: dropped the `*STEP`, `special` now reads as per-frame
   like everything else in the table.
3. **The batch gate never required the bot to close distance or throw a medium**, so it couldn't
   certify `intercept` (0 firings across 75 fights and all five tiers in the run that certified the
   tiers) — `Ctrl.competent` just stood still once out of light range if nothing else applied. Fixed
   in item 8: closes with a medium out of range, mixes in a heavy on the 5th blockstun opening.
4. **`ENCOUNTERS` had to gain a `buffs:[]` field for the interface to typecheck, but no node had to
   use one** — the plan's headline "node buffs" goal shipped as a framework with no content. Fixed in
   item 5: every FLOORS node except two now carries at least one buff.

## Fix wave close-out (2026-09-22)

Ten-item final-review fix wave (items 1-10, one commit each except item 10) complete. Headline
outcomes: both bosses winnable (0/20 -> 16.7-25% at n=20/30, comfortably in the 10-35% target band);
the per-fight zoom cap replaced with a per-frame one (Carl's heavy wind-up restored to its real 175°
overhead, the S3 punch-in now genuinely exceeds gameplay zoom for big-rig pairs); `--matrix` extended
6x (36 -> 216 cells) to cover every Phase 3 rig/def/tier; `Ctrl.competent` closes distance and mixes
in heavies; node buffs are live content on 8 of 10 non-boss nodes plus a player-side path; `Rig.extent`
folds the drawn head and every quad-rig look fits `EDGE_PAD` with the carve-out removed;
`wasKnockedDown` is Fighter-owned end to end; Grub/Mongo/Grull read as themselves (segmented portrait,
thick neck + brow ridge, own palette/horns/club) and the boss plate is a tight frame around the name.
Full detail per item is in `.superpowers/sdd/2026-09-21-phase3-ai-encounters/task-fixwave-p3-report.md`.

## Phase 3 execution rulings (2026-09-21/22, from the SDD ledger)
Ruling: same execution shape as Phase 2 (one sonnet implementer per task, sonnet task reviews with file-based verdicts, haiku scoped re-reviews, opus final review, one fix wave + scoped rounds) — cost if wrong: review overhead.
Ruling: implementers are told the exact trailer string and that other model names get rewritten; controller verifies trailers before every review package.
Ruling: controller does not commit in the shared tree while an implementer is active (docs commits wait for gaps).
Task 3.1: review approved. Ruling: brute's heavy trigger gained a dist>=lightRange floor (old field changed) — accepted; the matrix brute rows may differ from the Phase 2 table — cost if wrong: one balance number. Minors (deferred to 3.6): split AI.make into per-behaviour functions; wasKnockedDown flag instead of relying on DASH_BACK.inv<frames; punishFollow=3 unspecified.
Task 3.2: implementer DONE (be24583). Ruling: onHit ref carries dmg plus powHit/powTaken (superset of the frozen {dmg}) so powerGain has a single write path — accepted. Reviewer (sonnet) dispatched
Task 3.2: review approved. Rulings: hooks get a 5th `holder` argument (accepted, interface amended); onBlock is defender-side only (accepted; attacker-side onBlock has no consumer). Minor: enc.buffIds addition accepted.
Task 3.5: review — Critical (zoom-cap test covered 2 of 22 poses, no props; big rig overflows HUD). Ruling: dynamic per-fight zoom cap from Rig.extent over all poses+props, applied in Camera (sim untouched), plus a full-pose HUD test — not pose re-authoring — cost if wrong: camera zooms out more than the rendition's framing for big pairs. Fix round 1 dispatched, FIX_BASE 6660cb4
Task 3.5: round 1 re-review — 1,2 addressed; new Important: win pose lowers human-pair caps to 1.094. Ruling: exclude win/ko from the cap extent; pin ordinary-pair caps at 1.12/1.28 by test; floor 0.80 — cost if wrong: a winner's raised arms may poke above the HUD under the result overlay. Round 2 dispatched, FIX_BASE 5df2410
Task 3.6: implementer DONE (caab728..7c46406, 6 commits). Concern: bosses 0/30 vs Ctrl.competent. Ruling: bosses must be beatable by the competent bot at roughly 10-35% — folded into the Phase 3 fix wave — cost if wrong: bosses feel easier than a raid wall. Heavy wind-up capped at 118° by the pin test (accepted).
Rulings for the wave: per-frame zoom cap from the current pose (restores the 175° heavy and big-rig S3 punch-in); EDGE_PAD 260 with quads trimmed to fit and the carve-out deleted; regen default 0.00017/frame (≈1%/s) with the test updated; boss stats per the review's measured bands (Grull hp 1300 atk 60; Mother Rat atk 50); t5 attack trimmed toward a reading tier while keeping the gate monotone; Fighter owns wasKnockedDown — cost if wrong: another balance pass in Phase 4.
Fix wave re-review: 9/10 addressed + most of 10; residual: Grull palette claim unsubstantiated. Ruling (parked): Grull reads distinct from the goblin in p3-floor1-boss.png (olive, horns, club, trousers, size); `def.color` is dead data on every def → Phase 5 cleanup removes or plumbs it — cost if wrong: a boss that looks a little like a mob.

## Phase 4 exit (2026-09-22)

| Criterion | Status | Verification |
|---|---|---|
| Unit tests ≥ 130 | 201 passing, 0 failing | `python3 tests/harness.py --unit` |
| `--e2e` exits 0 for seeds 1-3 | all three exit 0 | `python3 tests/harness.py --e2e --seed {1,2,3}` |
| `--e2e --loops 20` (menu+fight soak) exits 0, no console/page errors | exits 0, 0/0 errors | `python3 tests/harness.py --e2e --seed 1 --loops 20` |
| `--sim`/`--matrix` still green | both exit 0 | `python3 tests/harness.py --sim --seconds 60`; `python3 tests/harness.py --matrix` (216 cells) |
| `--perf` under the 6 ms gate, JSON has a top-level `perf` object | `ms_per_frame` 0.095, `perf:{...}` present | `python3 tests/harness.py --perf 600` |
| Both floor bosses land in the 10-35% win-rate band at n=30 | `f1_grull` 13.3%, `f2_mother` 16.7% | `python3 tests/batch.py --n 30 --p1 carl --encounter {f1_grull,f2_mother}` |
| Screens shots reviewed | title/map/roster/roster-4/crystal/shop/arena all viewed, coherent | `docs/shots/p4-*.png` |
| Roster layout: no dead space at 1-2 champions | `.cards` centers vertically; 4 champions still fit with no scroll | `docs/shots/p4-roster.png`, `p4-roster-4.png` |

This table records the Task 4.6 close-out snapshot, before the whole-branch final review. The "Screens
shots reviewed... coherent" row above is precisely what the final review found wrong (the map was
clipping BOSS/DOOR 1 in that same screenshot) — see "Final-review fix wave" below for the corrected
numbers (218 unit tests, `--e2e` re-run, `--perf` 0.0775) and what was actually fixed.

Full detail on Tasks 4.1-4.5 is in `.superpowers/sdd/2026-09-22-phase4-meta/progress.md` and each
task's own report; this section covers Task 4.6's close-out work only (the earlier tasks landed
without a docs/ARENA.md update, so Phase 4 gets one consolidated entry here rather than five).

### `--e2e` summaries (Task 4.6)

Each seed: reset save → seed `Save.data.seed` → `G.debugGrant({gold:1200})` → 2x
`Crystal.open('basic')` → `Roster.setActive('carl')` → floor 1's 5 nodes then the boss via the real
`{floor,node}` `G.startFight` sugar with `Ctrl.competent` (up to 5 attempts per node, energy
refilled via `G.debugEnergy(999)` between attempts) → one `Roster.levelUp('carl')` → 3
`G.startArena()` fights. Every win is checked against an independently-computed
`Rewards.forNode(floor,node)` (gold/iso/xp deltas, xp tracked through a cumulative-earned-xp helper
so a mid-run level-up doesn't look like a shortfall), an energy decrease, and the node/next-node
state flip. A node exhausting all 5 attempts without a win (only ever the boss, in this data — every
regular node's own win rate is 63-100% per the batch table below) is recorded as `{attempts:5,
won:false}` and is not itself an error; it just means nothing further chains off that node this run.
No seed hit a page or console error, and no seed hit an assertion error.

| seed | exit | crystals (champId/stars/dup) | nodes 1/0-1/4 | boss (attempts) | level-up | arena (wins/streak/best) | gold/iso/units after |
|---|---|---|---|---|---|---|---|
| 1 | 0 | katia★1 (new), carl★1 (dup, 1 shard) | 5/5 won, 1 attempt each | won @1 | carl → LVL 3 | 3/3, streak 3, best 3 | 1760 / 100 / 50 |
| 2 | 0 | carl★1 (dup, 1 shard), katia★1 (new) | 5/5 won, 1 attempt each | **lost all 5** | carl → LVL 3 | 3/3, streak 3, best 3 | 1460 / 80 / 0 |
| 3 | 0 | katia★1 (new), donut★1 (new) | 5/5 won, 1 attempt each | won @1 | carl → LVL 3 | 3/3, streak 3, best 3 | 1760 / 100 / 50 |

Seed 2's boss loss-out is expected variance, not a bug: `f1_grull`'s own measured win rate against
`Ctrl.competent` is 13.3% at n=30 (see the balance re-check below), so `P(≥1 win in 5 independent
attempts) ≈ 1-(1-.133)^5 ≈ 53%` — a coin flip per seed. `--e2e` only asserts against a win's actual
reward/state deltas, never demands the boss be won within the retry budget, precisely because that
number is a real gameplay difficulty (documented, in-band) and not a test-harness defect; forcing it
to always succeed would mean either raising the retry budget past what the brief asked for or lying
about the boss's difficulty. Seed 2's units stayed at 0 (no boss win → no `Rewards.forNode` units
bonus) while seeds 1/3 banked 50 from the winning boss clear — itself a live assertion the harness
already makes (the gold/iso/xp *delta* check on every win), just not one that shows up unless you
compare seeds.

### `--e2e --seed 1 --loops 20` (menu+fight soak)

Exit 0. 0 page errors, 0 summary errors. Ran to completion in well under a second of real wall
time (`G.sim=true` steps ticks synchronously with no wall-clock delay — the "≈10 minutes" in the
task brief is simulated in-game time covered by ~46 fights total across the 5 nodes + boss + 3
arena fights + 20 loops' worth of node/arena fights, not the harness's own runtime). Each loop
renders `Screens.title/map/roster/arena` (a menu-browsing cycle), then runs one real quest fight at
whatever node `Quest.floor` currently reports `'open'` (never a `'done'` one, so a loop never hits
`{floor,node}` sugar's own refusal) and one `G.startArena()` fight. Post-loop state: roster `carl`
reached LVL 5 (30 extra winnable-node xp grants across the loops), arena streak/best both climbed to
5, currencies ended at 6800 gold / 340 iso / 150 units — all from real `Rewards.grant`/`Arena.record`
calls, no debug shortcuts beyond the energy top-up.

### Balance re-check (Task 4.6, item 2)

```
$ python3 tests/batch.py --n 30 --p1 carl --encounter f1_grull
encounter      fights  winrate%  avglen(s)  stalled
f1_grull       30      13.3      14.58      0

$ python3 tests/batch.py --n 30 --p1 carl --encounter f2_mother
encounter      fights  winrate%  avglen(s)  stalled
f2_mother      30      16.7      9.60       0
```

Both land inside the 10-35% target band (13.3% and 16.7%), so neither retune trigger in the task
brief fires (Mother Rat's was "if under 10% at n=30"; it's at 16.7%). The progress ledger had flagged
a quick n=10 Mother Rat run coming back 0/10 against the fix-wave table's own 5/30 as "variance worth
re-checking here" — the n=30 re-check confirms it was variance, not a regression: 16.7% matches the
fix-wave table's number exactly. No code change to `grull`/`mother_rat`'s stats; a short comment
recording this re-check was added next to each in `src/40_movedata.js`. The full per-floor-node/boss
table (unaffected, included for completeness) is unchanged from the fix-wave table above.

### `--perf` JSON shape (Task 4.6, item 3)

`python3 tests/harness.py --perf 600` now prints:

```json
{
 "ms_per_frame": 0.0945,
 "ms_step": 0.00767,
 "ms_render": 0.08683,
 "perf": {
  "ms_per_frame": 0.0945,
  "ms_step": 0.00767,
  "ms_render": 0.08683
 }
}
```

The three timing numbers are unchanged (still well under the 6 ms gate); they're now also nested
under a top-level `perf` key, which is what the controller's gate was actually reading (`d.get
('perf')`, previously always `None`) — the flat keys are kept so anything else already reading them
is unaffected. Documented in the module docstring's `--perf` example.

### Roster layout (Task 4.6, item 4)

`.cards` (`src/00_head.html`) was `justify-content:flex-start`, which pinned 1-2 champion cards to
the top of the panel with a large empty gap below (see the old `docs/shots/p4-roster.png`, a single
`CARL` card floating at the top of an otherwise-empty ROSTER screen). Changed to
`justify-content:center`; a single card now sits mid-panel, and 4 champions still stack top-to-bottom
with no scroll (unchanged from the fix-round-1 single-column-card layout). `docs/shots/p4-roster.png`
regenerated at 1 champion (`--reset-save --screen roster`); new `docs/shots/p4-roster-4.png` added at
4 champions (`--reset-save --pre "Save.data.roster.katia=...;Save.data.roster.donut=...;
Save.data.roster.mongo=...;Save.put()" --screen roster`). Both reviewed: readable at 854x480, no
overlap with the BACK button, action buttons still real 44px+ touch targets.

## Final-review fix wave (2026-09-22, `a589242..3593181`)

The whole-branch final review (`.superpowers/sdd/2026-09-22-phase4-meta/final-review-verdict.md`,
opus) found two live exploits, a clipped primary screen, two plan-level rulings still open, and a
harness gap that let one of the exploits ship undetected; a scoped Task 4.6 re-review
(`review-4.6-verdict.md`) approved the `--e2e`/`--loops`/`--perf`/roster-layout work separately and
found nothing further. Ten items, one commit each (10's minors grouped): the fix wave's own report is
`.superpowers/sdd/2026-09-22-phase4-meta/task-fixwave-p4-report.md`.

**Two shipped exploits, both invisible to the test suite for the same reason (the unit tests inject
`Energy.now`/set `ts` explicitly, and `--e2e` topped energy to 999 before measuring it):**
1. **Energy never regenerated against the wall clock.** `e.ts` defaulted to 0 and was only ever
   advanced by `regen*360000`, never anchored to a real `Energy.now()` — so `now-ts` was always ~57
   real years and every `tick()` refilled to max instantly. `Energy.spend` now anchors `e.ts` the
   instant it spends from full; `Energy.tick` re-anchors `e.ts` whenever `e.n` is already at/over max.
2. **Arena FIGHT AGAIN replayed the stale, already-resolved encounter** while still crediting the new
   streak — a win at streak 0 re-fought the identical goblin forever, unlimited streak/gold farming,
   one button, no energy. FIGHT AGAIN now routes through `G.startArena()` for arena mode, drawing a
   fresh `Arena.start()` off the current streak; quest mode is unchanged.

**The campaign map clipped BOSS and DOOR 1** at 854x480 (six rows at the old 44px min-height + 6px
gaps overflowed the 272px path box) — the primary screen after CAMPAIGN, on every floor, signed off
as "shots reviewed, coherent" in the Task 4.6 close-out without anyone having scrolled past what the
screenshot actually cropped. `.node` min-height 44px→40px, `.path` gap 6px→4px, tightened
energy-row/BACK spacing; a new unit test asserts `#mapPath.scrollHeight<=clientHeight` with a full
floor rendered, so this can't silently regress again.

**`--e2e`'s own energy assertion could never fail**: `G.debugEnergy(999)` ran on every attempt, right
before capturing `energyBefore` — comparing 998 against 999 is not a test. One un-topped-up node run
(floor 1's node 0, on a fresh reset where energy is genuinely untouched) now asserts the real delta is
exactly -1 and, with `Energy.now()` pushed 5 simulated minutes forward, still not regenerated.
Verified live by temporarily reverting the energy-anchor fix: `--e2e` then failed with "energy
regenerated within 5 minutes" and "energy did not decrease", where it silently passed before.

**Refusals were invisible**: map buttons were never `disabled` (a locked door looked and clicked like
an open one), and the refusal message went to `#toast`, which sat *before* every overlay in the DOM —
the map's own opaque background painted over it. Map nodes are now `disabled` when not `'open'`; a new
`#mapMsg` line inside the map panel shows "LOCKED" or "NOT ENOUGH ENERGY — next in m:ss", bypassing
`G.say`'s frame-throttle (which was separately broken while browsing, since `G.frameNow` never
advances outside a fight); `#toast` moved to after every overlay in the DOM.

**Two rulings on genuine plan-level ambiguity (below), one balance change (node gold 100·n+40·k →
160·n+60·k — floor 1 only paid out ~1200 gold against a ~10000-gold single star), and three Phase 5
seams landed now while cheap**: `FLOORS[i].id` + `Quest.floorDef(n)` (floor lookup by field, not
array index, so a tutorial floor 0 doesn't need three call sites renumbered); `Meta.SHOP_ITEMS` +
`Meta.buy(itemId)` (the kiosk renders from a table instead of three hand-copied blocks); `Rewards.mult`
(a `{gold,iso,xp}` multiplier applied once inside `forNode`, for a future ratings system). Six minors
bundled into one commit: `.panel button` 44px touch targets, a locked-boss specificity fix (was
showing the crown, not the lock), `Screens._reveal` cleared on crystal-screen entry (was replaying the
previous pull's text), a currency strip on the map/crystal screens, `Meta.migrate` repointing a stale
`Save.data.active` to an owned champion (was silently dropping xp grants), and a title-screen hierarchy
pass (CAMPAIGN primary/glowing, the rest secondary, SOUND into its own small settings row).

### Phase 4 plan defects (fixed)

Two places where the Phase 4 plan itself — not just the implementation — was internally
inconsistent or left an exploitable gap, both resolved by an explicit ruling rather than a guess:

1. **Pity floor (Task 4.2).** The frozen interface line said pity guarantees "≥ the kind's top-1
   tier"; Task 4.2's own checklist said "the 10th open is ≥3-star even after nine 1-star". These
   disagree for basic (top-1 is 2-star, which the raw odds table already hits ~30% of the time on its
   own — nowhere near a guarantee). **Ruled:** pity guarantees the kind's TOP tier outright (basic's
   10th open is always exactly 3-star, premium's always exactly 4-star), and a natural top-tier roll
   also resets the counter, not just a forced one. Interface line corrected.
2. **Shard economy (ruling 2).** The plan specified a duplicate pull as "+1 star shard" with no
   mention of scaling by rolled tier. Combined with a 4-champion roster that fills in a handful of
   opens, a flat +1 made every crystal — 500-gold basic or 100-unit premium — worth identically little
   once the roster was full, and the whole odds/pity apparatus stopped mattering. **Ruled:** shards
   scale by the rolled tier (`Crystal.SHARDS_PER_TIER` = 1/2/3/5 for 1/2/3/4-star); 5 shards still
   converts to +1 star, capped at 5-star, leftover kept.

### `--e2e` summaries (fix-wave re-run, seeds 1-3)

Same shape as the Task 4.6 table below, re-run after the full fix wave (new gold formula, real energy
regen, the arena fix, shard scaling all live). All three seeds: exit 0, 0 page errors, 0 summary
errors.

| seed | exit | crystals (champId/stars/dup) | nodes 1/0-1/4 | boss (attempts) | level-up | arena (wins/streak/best) | gold/iso/units after |
|---|---|---|---|---|---|---|---|
| 1 | 0 | katia★1 (new), carl★1 (dup, 1 shard) | 5/5 won, 1 attempt each | won @1 | carl → LVL 3 | 3/3, streak 3, best 3 | 2420 / 100 / 50 |
| 2 | 0 | carl★1 (dup, 1 shard), katia★1 (new) | 5/5 won, 1 attempt each | **lost all 5** | carl → LVL 3 | 3/3, streak 3, best 3 | 1960 / 80 / 0 |
| 3 | 0 | katia★1 (new), donut★1 (new) | 5/5 won, 1 attempt each | won @1 | carl → LVL 3 | 3/3, streak 3, best 3 | 2420 / 100 / 50 |

Gold is higher across the board than the pre-fix-wave table (the item 8 balance change, 100·n+40·k →
160·n+60·k) and energy now genuinely sits at 998/1000 after 6 real node spends + a boss attempt or two
(`energy: 998` in every seed's raw summary) rather than the old inert-regen table which never showed
anything but the same debug-topped value. Seed 2's boss loss-out is the same in-band variance as
before (`f1_grull` 13.3% at n=30 against `Ctrl.competent`, unaffected by this fix wave — no combat/stat
code changed), not a regression.

`--e2e --seed 1 --loops 20`: exit 0, 0 page errors, 0 summary errors. Post-loop state: carl LVL 5,
arena streak/best 5, currencies 8480 gold / 340 iso / 150 units — all via real
`Rewards.grant`/`Arena.record` calls, no debug shortcuts beyond the energy top-up between attempts.

`--perf 600`: `ms_per_frame` 0.0775, still far under the 6 ms gate (unaffected by this fix wave —
no per-frame render/sim path touched).

## Phase 4 execution rulings (2026-09-22, from the SDD ledger)

Ruling: same execution shape as Phases 2-3 (sonnet implementers, file-based sonnet reviews, haiku scoped re-reviews, opus final review, one fix wave + scoped rounds as needed); exact trailer verified before each package; no controller commits while an implementer runs.
Ruling: Meta wall-clock is confined to `Energy.now` (injectable); everything else in `Meta` draws from `RNG(Save.data.seed++)` so meta tests stay deterministic.
Task 4.1 (Save v2 + migration): review — Important (migration not persisted), Minor (two energy caps). Fix round 1 dispatched and re-reviewed clean (commits f0a4d6c..11b829b).
Tasks 4.2-4.3 (Stats/Crystal/Quest/Rewards, batched — both pure logic in `12_meta.js` with exact numeric tests, no UI): implementer DONE, review clean (commits 11b829b..28afd17; 169 tests). Rulings: `Save.data.pity` added to defaults (accepted); boss uses `k = nodes.length` for the gold ramp (accepted).
Task 4.4 (roster/quest/arena wired into `G.startFight`/`onFightEnd`): review — Important (bare `{encounter:id}` fights were farming quest rewards for free). Ruling: `G.mode` is `'quest'` only when the fight actually went through `{floor,node}` sugar and `Quest.start` succeeded; a bare encounter id is `'exhibition'` (no rewards, no energy). Fix round 1 dispatched and re-reviewed clean (commits 28afd17..6a9b00c).
Task 4.5 (screens: title/map/roster/crystal/shop/arena): review — Critical (title buttons unbound at boot), Important (`.ftab`/roster-action touch targets under 44px). Ruling: bind title screen at boot; touch-sized tabs and roster actions; `Meta.buyIso` replaces a `Rewards.grant` reuse for the ISO pack. Fix round 1 dispatched and re-reviewed clean (commits 6a9b00c..be7337b).
Task 4.6 (this task, folded with the Mother Rat n=30 re-check, `--perf` JSON key, and the roster empty-space layout): `--e2e`/`--loops` per the frozen interface; boss re-check confirmed in-band (no retune); `--perf`'s `perf` key added; `.cards` centered — cost if wrong: a harness that can't certify the full Phase 4 loop, or a balance/perf gate the controller can't actually read.

## Phase 4 execution rulings (2026-09-22, from the SDD ledger)
Ruling: same execution shape as Phases 2-3 (sonnet implementers, file-based sonnet reviews, haiku scoped re-reviews, opus final review, one fix wave + scoped rounds); exact trailer verified before each package; no controller commits while an implementer runs.
Ruling: Meta wall-clock is confined to Energy.now (injectable); everything else in Meta draws from RNG(Save.data.seed++) so meta tests are deterministic.
Ruling: batch Tasks 4.2 + 4.3 into one dispatch (both pure logic in 12_meta.js with exact numeric tests, no UI) — cost if wrong: one larger review.
Tasks 4.2-4.3: implementer DONE (9ece64d, 28afd17). Rulings: Save.data.pity added to defaults (accepted); boss k = nodes.length for the gold ramp (accepted). Reviewer (sonnet) dispatched
Task 4.4: implementer DONE (32ad675); concern: energy gate only on {floor,node}. Ruling: bare {encounter:id} must not grant quest rewards (exhibition semantics) — reviewer to verify. Reviewer (sonnet) dispatched
Task 4.6: implementer DONE (be7337b..a589242, 5 commits). Rulings: --e2e chains all five floor-1 nodes then the boss (boss is save-locked otherwise) — accepted; boss-retry exhaustion is recorded, not a failure — accepted (the bot's boss win rate is ~13%).
Rulings for the wave: pity = every 10th open of a kind guarantees that kind's TOP tier (basic 3★, premium 4★) — plan amended; shards scale by rolled tier 1/2/3/5; node gold raised to 160·n+60·k; locked nodes disabled with in-panel refusal text and the toast raised above overlays; Phase 5 seams added now (FLOORS entries get an explicit `id` and Quest looks floors up by id so a tutorial floor can exist; SHOP_ITEMS table generalizing buyIso; Rewards.mult hook) — cost if wrong: an economy retune in Phase 5.

## Release rubric (2026-09-22, Task 5.6)

Every criterion below has a verification command actually run against the final Task 5.6 build
(commit `2a45b43`, the last commit before this one), with its real result pasted, not summarized from
memory. Phase 0-4 rows point at each phase's own detailed exit table above where one exists; this
table's numbers are a fresh re-run today, not a copy of the historical figures (they've drifted
slightly since — e.g. unit test count — which is expected and fine, the gate is "still passes", not
"identical numbers").

### Phase exit criteria (Phases 0-5)

| Phase | Criterion | Status | Verification |
|---|---|---|---|
| 0 | `tools/build.py --check` exits 0, `--unit` passes, headless load has no page errors | DONE | `python3 tools/build.py --check` → exit 0; `--unit` → 298 pass, 0 fail, page `errors:[]` |
| 1 | 26+ unit tests pass | DONE (298 ≫ 26) | `python3 tests/harness.py --unit` |
| 1 | Four 300s soaks clean | DONE historically (2026-09-21 log entry above: 4×300s, `frames_total` all >16200/18000); today's equivalent health re-checked via the full matrix + a 60s soak, both clean | `python3 tests/harness.py --sim --seconds 60` → `frames_total` 1874/1800 (>100%, 5 fights, 0 errors); `--matrix` → 216/216 cells clean (below) |
| 1 | Hand-play confirms all six Task 1.7 Step 3 control checks | **NOT DONE** — never performed; still the one open item from the original Phase 1 log entry above. No agent in this SDD pipeline has hands; the closest available substitute is automated: `Ctrl.competent`/`Ctrl.script` exercise light chains, medium range-closing, heavy charging, block/parry timing, dash evasion, and the special button on every `--matrix`/`--e2e`/`--tutorial`/`--batch` run (all green today), which is behavioral coverage but not a human confirming the *feel* the brief actually asked for | none available — flagging for a human playtest pass, not closing this row |
| 1 | Repo on GitHub | DONE (repo exists; `origin` already carries every commit through `7655b3f`) — this task's own 6 commits are intentionally **not pushed** per the brief's "Do not push" rule; pushing is the controller's call | `git remote -v` → `origin https://github.com/Javamomma/Carls-Arena.git` |
| 2 | All of Task 2.9 Step 4 (soak matrix, perf, HUD-zoom test, shots); final review clean; pushed | DONE (own exit table above, 2026-09-21); re-verified live today (matrix/perf below) | see "Phase 2 exit" table above |
| 3 | ≥85 tests; `--matrix` clean; batch table monotone; reviewer named every new character; final review clean; pushed | DONE (own exit table above, 2026-09-22) | see "Phase 3 exit" table above |
| 4 | ≥130 tests; `--e2e` exits 0 ×3 seeds; matrix/perf green; screens shots reviewed; final review clean; pushed | DONE (own exit table + final-review fix wave above, 2026-09-22) | see "Phase 4 exit" / "Final-review fix wave" above |
| 5 | Rubric all DONE; `--e2e`/`--tutorial`/`--matrix`/`--perf`/batch gate green | DONE except the two rows below | this table |
| 5 | Final whole-branch review clean | **PENDING** — out of scope for Task 5.6 itself (the brief: "review is the controller's job after you report"); this implementer does not dispatch a review | controller's own final-review pass, after this report |
| 5 | Pushed; Pages serving the release | **PENDING** — GitHub Pages is live and serving the game (`curl` below), but the live build predates this branch's local commits (last pushed through `7655b3f`); pushing this branch is explicitly out of scope ("Do not push") | `curl -sI https://javamomma.github.io/Carls-Arena/` → `HTTP/2 200`; live `index.html` is 407,649 bytes vs this build's 533,906 — an older build (3 hits for `TUTORIAL`/`VIEWERS`/`Sponsors` vs 77 in this build), confirming Pages hasn't picked up Phase 4/5 yet |

### Release items (Task 5.6)

| Criterion | Status | Verification |
|---|---|---|
| Unit tests | 298 pass, 0 fail | `python3 tests/harness.py --unit` |
| Soak matrix (216 cells) | 216/216 clean, 0 errors | `python3 tests/harness.py --matrix` → `# 216 cells, 19.0s total wall time`, no `errors` column nonzero |
| Perf < 6 ms/frame | `ms_per_frame` 0.0878 (`ms_step` 0.0055, `ms_render` 0.0823) | `python3 tests/harness.py --perf 600` |
| Batch gate: monotone non-increasing, t1≥80%, last≤30% | t1 100% / t2 93.3% / t3 73.3% / t4 53.3% / t5 23.3% — monotone, in band | `python3 tests/batch.py --n 30 --p1 carl --ai t1,t2,t3,t4,t5` |
| Both floor bosses in the 10-35% win-rate band at n=30 | `f1_grull` 13.3%, `f2_mother` 16.7% | same `batch.py` run, per-floor-node/boss table |
| `--e2e` exits 0 for 3 seeds | seeds 1, 2, 3 all exit 0, 0 page/console/summary errors | `python3 tests/harness.py --e2e --seed {1,2,3}` |
| `--e2e --loops 20` (sustained menu+fight soak) | exit 0, 0 errors; arena 3 wins/streak 5/best 5; energy 998; gold 8480 / iso 340 / units 150 | `python3 tests/harness.py --e2e --seed 1 --loops 20` |
| `--tutorial` exits 0 | steps advance 1→2→3→4 in order, `tutorialDone` set, exactly +300 gold, 0 errors | `python3 tests/harness.py --tutorial --seed 1` |
| `--share` exits 0 | PNG data URL, IHDR decodes to exactly 854×480 | `python3 tests/harness.py --share` |
| `index.html` size | 533,906 bytes = 521.4 KiB | `python3 -c "import os;print(os.path.getsize('index.html'))"` |
| Load time < 1s from `file://` (goto → `G` defined) | max 0.036s over 5 runs (36ms ≪ 1000ms) | one-off Playwright script: `pg.goto(INDEX); pg.wait_for_function('typeof G!=="undefined"')`, timed with `time.time()` around both calls |
| No page/console errors on title/map/roster/crystal/shop/arena/settings, a quest fight, and result | 0 errors on every one of the 9 screens; final state `RESULT` | `python3 tests/harness.py --screens-smoke` (new flag; see `tests/harness.py`) |
| Phone layout at 844×390 CSS-px landscape: canvas letterboxed, buttons ≥44px inside viewport, no horizontal scroll | canvas 693×390 (854:480 aspect preserved, fits the 844×390 viewport); all 4 buttons 76×76px, fully inside; `scrollWidth` 844 ≤ viewport 844 | `python3 tests/harness.py --phone-check` (new flag; see `tests/harness.py`) |
| `?atlas=1` with no `assets/` folder produces no errors | 0 page errors; `ATLAS.carl`/`ATLAS.donut` both resolve to `null` (the documented silent-fallback behavior) — **caveat**: Chromium logs 2 console `error`-level lines per missing-asset attempt (`Failed to load resource: 404` on a real HTTP server, `Fetch API cannot load ... file scheme` under this repo's own `file://` harness) — this is the browser's own network-request devtools log for ANY failed resource fetch (identical to what a missing favicon produces), not a thrown JS error or an `Atlas.load`/app-code `console.error` call; `Atlas.load`'s own try/catch (68_rig.js) already turns every failure mode (missing file, bad JSON, `file://`'s scheme rejection) into a clean resolved `null` with no throw. Verified on both `file://` and a real local HTTP server (below) to rule out a `file://`-only artifact | two one-off Playwright scripts (see the Task 5.6 report) — `file://…/index.html?atlas=1` and `python3 -m http.server` + `?atlas=1`, each: `G.startFight(...)`, 60 ticks, then read `ATLAS.carl`/`ATLAS.donut` |

Both new harness flags (`--screens-smoke`, `--phone-check`) are documented in `tests/harness.py`'s own
module docstring and `--help`, and in the README's Development section, alongside every other flag
this rubric exercises.

### Fix-wave rubric deltas (2026-09-22, post final review)

Rows above are the Task 5.6 snapshot and, per this table's own note, are expected to drift slightly
without needing a rewrite. Two deltas from the final-review fix wave are worth calling out
specifically since they touch artifacts other rows/docs point at directly:

- **Unit tests**: 298 → 304 (6 new regression tests, one per fix-wave item with a test named — see
  the "Progress log" entry above). `--matrix` stays 216/216; `--sim --seconds 60` stays clean.
- **`docs/shots/p3-floor1-boss.png`** (the screenshot `README.md`'s gallery embeds and the `?atlas=1`
  caveat's own neighbor above) was regenerated after fix-wave item 1's `Render.overlayScreenY` clamp —
  the charge bar no longer crosses "THE DEPTHS". `docs/shots/p5-share.png` was also regenerated after
  item 8's share-card redesign. Both viewed by eye; neither the README's gallery table nor its other
  image references changed (same filenames, same table).
- `index.html` size moved from 533,906 to 555,168 bytes with this wave's added source/tests.

## Task 5.6 close-out (2026-09-22)

Release pass, five commits (`355e226..2a45b43` on `main`), plus this docs commit closing it out.
**Two items folded in from earlier reviews, deferred until this task:** left-handed canvas gesture
zones (the on-screen buttons already mirrored, in Task 5.4; the raw touch zones themselves didn't)
now mirror via `Input.zoneFor`/`Input.swipeDx`; `BUFFS.tutorialGuard` no longer reads the global
`Tutorial` object (a sim-purity leak the source scan didn't catch since it never covered `BUFFS.*`
hook bodies) — it reads `holder.guardActive`, a plain Fighter field `G.startTutorial`/`Tutorial.tick`
set/clear, and the purity scan now covers every `BUFFS.*` hook against a wider banned-identifier list.
Two new harness flags, `--screens-smoke` and `--phone-check`, back the release rubric's screen/phone
rows. An art pass against `docs/reference/rendition.jpg` gave both HP bars a tapered gold frame,
the title a dark plate with a gold outline, warmer torch glow, and a faint vignette — all `docs/shots/
*.png` regenerated via a new `tools/shots.sh`. The README got a play link, a 4-shot gallery, a full
gesture/keyboard control reference, a Development section listing every harness flag, and a credits
note. The release rubric above covers every Phase 0-5 exit criterion plus every Task 5.6 release item,
each with a command actually run today and its real result pasted — two items are genuinely open
(human hand-play from Phase 1, never done; the final whole-branch review and the push to `origin`,
both explicitly this task's controller's job, not this implementer's) and are flagged as such rather
than marked DONE. Unit tests: 298 passing, 0 failing. `git status` clean; no push performed.

## Phase 5 execution rulings (2026-09-22, from the SDD ledger)
Ruling: same execution shape as Phases 2-4; exact trailer verified before each package; no controller commits while an implementer runs.
Ruling: the atlas hook (5.5) is optional and off by default; no asset is required to run; Pages deploy stays a single index.html plus optional assets/.
Task 5.1: implementer DONE (92a0b10). Rulings: first blood = player's first landed hit; special bonus replaces that hit's base gain — accepted. Reviewer (sonnet) dispatched on review-5.1.diff
Ruling: batch Tasks 5.2 + 5.4 into one dispatch (both small G+screens features with exact tests) — cost if wrong: one larger review.
Task 5.3: review approved. Important (deferred to 5.6): BUFFS.tutorialGuard reads the global Tutorial inside an onHit hook — refactor to a holder flag and add BUFFS.* to the purity scan. Ruling: Ctrl.tutorialBot instead of Ctrl.competent for --tutorial (competent cannot parry on cue) — accepted.
Rulings: tutorial row stays permanently visible on the map (recorded; the pre-flight note was superseded by 5.3's replayability requirement); POWER-step stall gets an auto-hint after 15 s and the special button pulses; the viewers ×N badge anchors to the counter; share card gets a framed layout — cost if wrong: cosmetic. Fix wave dispatched (sonnet) at FIX_BASE 0277ef9, brief task-fixwave-p5-brief.md
Ruling: Phase 5 fix-wave commits carried 'Claude Sonnet 5' trailers; rewritten to Fable 5.1 via filter-branch (unpushed) — cost if wrong: none. Fix wave DONE (10 commits); scoped re-review (sonnet) dispatched on review-fixwave-p5.diff

## Task 6.1 (2026-09-22): result-screen exits, floor-1 order and level gate, mob tuning

**Bug reproduced and its cause.** Owner playtest note: "No way to exit it seems after a defeat."
Scripted a quest-mode LOSS (`floor:1,node:0`, `p1.hp=1`, a real `AI.make('basic',...)` p2 landing the
KO) and inspected the result overlay's DOM: SHARE, FIGHT AGAIN and one button labeled CONTINUE
(`#resultTitleBtn`, wired to `G.backToOrigin()`) were all present, visible and functional — a synthetic
Playwright click (including hit-testing) on CONTINUE genuinely navigated back to the map. The root
cause isn't a broken handler: it's that the result overlay never had a second, unconditional exit.
CONTINUE's destination depends entirely on `Screens._origin`, and `#result`'s markup (`00_head.html`)
never carried a dedicated TITLE button — exactly what the frozen Phase 6 interface requires
("CONTINUE always ... TITLE always"). Fix: `#titleBtn` is a new, always-visible button, bound once in
`G.init()` to `G.toTitle()` — independent of `_origin`, so it can't be defeated by anything wrong with
CONTINUE's own routing. FIGHT AGAIN's visibility was also brought in line with the frozen rule ("only
for exhibition and arena wins") — it used to show on any quest loss and any exhibition/arena outcome
including a loss.

**Implemented.**
- `src/00_head.html`: `#titleBtn` added to `#result`'s markup (`.secondary` style); `.doorstack`/
  `.reclvl`/`.reclvl.under` CSS for the map's new REC. LVL hint.
- `src/80_game.js`: `titleBtn.onclick=()=>this.toTitle()` bound once in `G.init()`; stale FIGHT-AGAIN
  comment corrected.
- `src/85_screens.js`: `renderResult()` — FIGHT AGAIN display now `won&&(mode==='exhibition'||
  mode==='arena')`; CONTINUE/TITLE text/handlers left to their one-time `G.init()` binding.
  `renderMap()` — `Screens.doorStack(label,encId)` builds each door/boss button's label + REC. LVL n
  hint (`.under` when the active roster champion's level is below `ENCOUNTERS[encId].recLevel`).
- `src/45_encounter.js`: `FLOORS[0].nodes` reordered to `[f1_goblin, f1_skel, f1_goblin2, f1_shaman,
  f1_hob]` (was `[f1_goblin, f1_skel, f1_hob, f1_shaman, f1_goblin2]`, putting the 700hp brute at door
  3). Every FLOORS-referenced `ENCOUNTERS` entry now carries `recLevel`: floor 1 → 1,1,2,3,4 (boss 4);
  floor 2 → 4,5,5,6,6 (boss 7). `f1_goblin2` (already existed) moved tier t3→t2.
- `src/40_movedata.js`: mob tuning — see the deviation note below.

**Tuning deviation (documented, per the task brief's own "tune within ±15%... if a target is
missed").** goblin (360hp/30atk) and skeleton (320hp/28atk) landed exactly at the plan's given
numbers. hobgoblin and shaman both needed more:
- **hobgoblin**: hp 700→736 (+5.1% vs the plan's 640) and atk 55→52 (-5.5% vs the plan's 46), both
  within ±15% — plus `ENCOUNTERS.f1_hob.tier` 'brute'→'t4' (a data-only AI-difficulty lever in
  `45_encounter.js`, not a stat). Tuning trail: 640hp/46atk/'brute' → 100% win; 736hp/52atk/'brute' →
  86.7%; 736hp/52atk/'t4' → 70% (n=20, seed 1) — in band.
- **shaman**: at the plan's own ±15% ceiling (345hp/36atk) plus AI tier maxed to 't5', it still won
  96.7% (n=30). A one-off harness probe (`Ctrl.competent` vs `f1_shaman`, per-event `hit` log) showed
  why: Carl's opening `medium` alone lands ~131 damage — over a third of a 345hp shaman's health —
  before the shaman's own (already-maximal, `react:2`) AI can do anything. This is a pre-existing
  Carl-vs-squishy-mob damage ratio, not a Phase 6 regression: the pre-Phase-6 `f1_shaman` batch row was
  ALSO 100% (see the fix-wave table earlier in this doc). Reaching band took hp raised well past ±15%
  (300→820, +173%) plus `armor` 0→.15 and `blockProf` 0→.25 (a caster surviving on wards/parries reads
  in-genre, rather than just inflating hp further) — tuning trail: 480hp → 86.7%; 600hp → 80%; 820hp →
  63.3% (n=30, seed-base 1)/74% (n=50, seed-base 101)/55% (n=20, seed 1, the brief's exact command).

**Batch door table** (`python3 tests/batch.py --n 20 --p1 carl --encounter <id>`, the brief's exact
command, one id per invocation):
```
f1_goblin      20      100.0     1.62       0   (target: doors 1-3 >= 85%)
f1_skel        20      100.0     1.56       0
f1_goblin2     20      100.0     1.62       0
f1_shaman      20      55.0      6.84       0   (target: doors 4-5 in 40-70%)
f1_hob         20      70.0      8.98       0
```
A wider check (`--n 30 --p1 carl`, no `--encounter`, the default tier sweep + full floor/boss table)
confirmed the AI_TIERS monotonicity gate still holds (t1 100% >= 80, t5 23.3% <= 30) and floor 2 stayed
healthy (100/100/63.3/70/96.7%, boss 16.7%) — shaman/hobgoblin's shared `MOBS` entries feed `f2_shaman2`/
`f2_hob2` too, both landed in-band there as a side effect, not a separate target for this task.

**Gate output** (all exit 0, 0 page/console errors):
- `python3 tools/build.py && python3 tests/harness.py --unit` — 312/312 passing (8 new tests + 1
  amended DOM-id test for `titleBtn`; one pre-existing test, `startFight with an encounter sets p2 to
  the mob and scales hp`, had a literal `maxHp` pinned against the old goblin hp — switched to compute
  off `DEFS.goblin.hp` live instead of re-pinning another literal).
- `python3 tests/harness.py --sim --seconds 60` — 5 fights, 0 errors.
- `python3 tests/harness.py --matrix` — 216/216 cells, 0 errors, 19.9-20.0s wall time.
- `python3 tests/harness.py --e2e --seed 1` — chains the new floor-1 order through all 5 doors + boss,
  all won, 0 errors.
- `python3 tests/harness.py --tutorial --seed 1` (touched indirectly: the tutorial's dummy stats derive
  from `DEFS.goblin`, which moved) — steps 1→2→3→4 in order, `tutorialDone` set, +300 gold, 0 errors.
- `python3 tests/harness.py --phone-check` — unaffected (checks the 4 in-fight control buttons, not the
  result overlay), still 0 errors, no horizontal scroll.

**Screenshot**: `docs/shots/p4-map.png` regenerated (`--reset-save --screen map --shot ...`) and viewed
— REC. LVL hints visible under every door (grey for doors 1-2 at a fresh level-1 save, red/.under for
doors 3-5 and the boss), no clipping.

**Files changed**: `src/00_head.html`, `src/80_game.js`, `src/85_screens.js`, `src/45_encounter.js`,
`src/40_movedata.js`, `src/90_tests.js`, `docs/shots/p4-map.png`. `tests/batch.py` needed no source
change (its per-floor-node sweep already reads `FLOORS`/`ENCOUNTERS` live, so the new door order/table
just fell out of the existing tool).

### Fix round 0 (controller ruling, 2026-09-22): shaman reverted to plan stats

The controller ruled out the shaman's first tuning pass (hp 300→820, armor 0→.15, blockProf 0→.25,
tier t3→t5) before review: it hit the 40-70% bot win-rate band, but only by changing the character's
own identity — a squishy caster becoming a tanky blocker — purely to satisfy `Ctrl.competent`, the
batch tool's scripted bot. Reverted to the plan's own ±15%-ceiling numbers (hp 345, atk 36, armor 0,
blockProf 0, tier t3 — its original). The hobgoblin's tuning (hp 736/atk 52/tier t4, landing at 70%)
was kept as-is; the controller confirmed 70% is fine there.

**Ruling recorded**: door 4's actual target is "a level-3 human (its own `recLevel`) should find it
fair," not the bot's 40-70% win-rate band. `tests/batch.py`'s number for `f1_shaman` is reported below
as information only, not a pass/fail gate for that one encounter — doors 1-3 (≥85%) and door 5
(40-70%) stay real gates.

**Updated batch table** (`python3 tests/batch.py --n 20 --p1 carl --encounter <id>`):
```
f1_goblin      20      100.0     1.62       0   (target: doors 1-3 >= 85%)
f1_skel        20      100.0     1.56       0
f1_goblin2     20      100.0     1.62       0
f1_shaman      20      100.0     2.25       0   (informational only -- see ruling above)
f1_hob         20      70.0      8.98       0   (target: door 5 in 40-70%)
```

**Gate re-run, all exit 0, 0 page/console errors**:
- `python3 tools/build.py && python3 tests/harness.py --unit` — 312/312 passing (two tests amended:
  the mob-tuning test's shaman assertions back to 345/36/0/0, and the floor-1-order test gained an
  assertion that `f1_shaman`'s tier is back at `t3`).
- `python3 tests/harness.py --sim --seconds 60` — 0 errors.
- `python3 tests/harness.py --matrix` — 216/216 cells, 0 errors.
- `python3 tests/harness.py --e2e --seed 1` — full floor-1 clear (all 5 doors + boss won), 0 errors.
- `python3 tests/harness.py --tutorial --seed 1` — unaffected (goblin, which the dummy derives from,
  untouched by this ruling), 0 errors.
- Wider `--n 30 --p1 carl` (default tier sweep + full floor table): AI_TIERS monotonicity gate still
  holds (t1 100% >= 80, t5 23.3% <= 30); floor 2 stayed healthy (100/100/96.7/70/96.7%, boss 16.7% —
  `f2_shaman2` returned to 96.7% now that `MOBS.shaman` is back to plan stats, expected and not a gate
  for this task).

**Files touched this round**: `src/40_movedata.js` (shaman reverted; comment rewritten), `src/45_encounter.js`
(`f1_shaman.tier` t5→t3; comments updated), `src/90_tests.js` (two tests amended per above).

## Phase 6 exit (2026-09-22)

Tasks 6.1-6.6, commits `1725fcf..e81d402` (plan/notes doc through this close-out's shots+README
commit) on `main`. Full-branch verification below is a fresh re-run at Task 6.6's own final commit,
not a copy of each task's own report numbers.

### Owner-report checklist (`docs/design/playtest-notes-2026-09-22.md`)

Every item Arshia reported directly, checked against what actually shipped this phase:

| Owner report | Status | What changed |
|---|---|---|
| "The goblin didn't really die until it started to beat me up" (tutorial dummy reads as a bug, not a lesson) | **FIXED** | Task 6.4: the tutorial is now a visible spar — a SPAR plate + shield glyph + "TRAINING DUMMY — CANNOT BE KO'D" replaces the enemy HP bar, a "LESSON n / 4" banner tracks progress, the dummy visibly winds up (red flash) before its lesson-3 swing, and lesson 4 ends in a real SHIELD DOWN flash before FINISH HIM |
| "The graphics could use a lot of work. It's just stick figures right now." | **OPEN** — Phase 8 (Art upgrade) | Out of scope for Phase 6 by design (the plan's own goal was movement/controls/tutorial/mob balance, not rig art); Task 6.5 did give kicks their own distinct leg-strike poses, but the rigs themselves are still vector stick figures |
| Mobile controls wanted: swipe RIGHT = dash forward, swipe BACK = block, TAP = attack | **FIXED** | Task 6.3: exactly this scheme, whole-canvas gestures (tap→light, hold→block/parry, swipe right→dash-in medium, swipe left→dash back), replacing the old left/right touch zones |
| "We'll need to develop more complicated attacks." | **OPEN** — Phases 7 (combo grammar, intercept/dexterity) and 9 (champion kits: signature/heavy effect/S1-S3/passive per champion) | Not started this phase |
| "We need to think through the level up process." | **OPEN** — Phase 10 (Progression: 6-star system, catalyst tiers, new ISO curve, masteries tree) | Not started this phase |
| "Kick and punch do the same thing graphically." | **FIXED** | Task 6.5: KICK (`medium`) is now a leg strike in every rig (human rear-leg snap, big-rig stomping front kick, quad-rig rearing double-paw slam), with its own dust-arc impact fx; light stays the arm jab. New pose test asserts the kick's striking limb travels ≥60px while the lead hand stays near idle |
| "Hobgoblin Brute is impossible to defeat, need to level up before we get there." (floor 1 door 3, level 1, ~460 gold) | **FIXED** | Task 6.1: floor 1 reordered (goblin → skeleton → goblin2 → shaman → hobgoblin — the hobgoblin moved from door 3 to door 5), every door/boss now shows a REC. LVL hint (red once the active champion is under it), and floor-1 mob stats were retuned so a level-1 human clears doors 1-3 comfortably (≥85% bot win rate) with door 5's hobgoblin landing in the intended 40-70% band (70% at n=30) instead of being unwinnable |
| "No way to exit it seems after a defeat." (result screen after a loss) | **FIXED** | Task 6.1: `#titleBtn` is a new, always-visible TITLE button on the result screen, bound independently of `Screens._origin` so it can't be defeated by anything wrong with CONTINUE's own routing; CONTINUE and TITLE both show on every outcome, in every mode |

### Full gate (re-run at commit `e81d402`, before this section's own commit)

| Command | Result |
|---|---|
| `python3 tools/build.py --check` | exit 0 |
| `python3 tools/build.py` | wrote `index.html` (653,107 bytes, 21 parts) |
| `python3 tests/harness.py --unit` | 352 pass, 0 fail, 0 page/console errors |
| `python3 tests/harness.py --sim --seconds 60` | 0 errors, 0 console errors, 5 fights |
| `python3 tests/harness.py --matrix` | 216/216 cells, 0 errors, 20.4s wall time |
| `python3 tests/harness.py --e2e --seed 1` | 0 page errors, 0 summary errors; all 5 floor-1 doors + boss won |
| `python3 tests/harness.py --e2e --seed 2` | 0 page errors, 0 summary errors; all 5 floor-1 doors + boss won |
| `python3 tests/harness.py --e2e --seed 3` | 0 page errors, 0 summary errors; all 5 floor-1 doors + boss won |
| `python3 tests/harness.py --tutorial --seed 1` | steps `[1,2,3,4]` in order, `tutorialDone` true, +300 gold, 0 errors |
| `python3 tests/harness.py --tutorial --seed 2` | steps `[1,2,3,4]` in order, `tutorialDone` true, +300 gold, 0 errors |
| `python3 tests/harness.py --tutorial --seed 3` | steps `[1,2,3,4]` in order, `tutorialDone` true, +300 gold, 0 errors |
| `python3 tests/harness.py --screens-smoke` | 0 errors on all 9 screens (title/map/roster/crystal/shop/arena/settings/fight/result), final state `RESULT` |
| `python3 tests/harness.py --phone-check` | canvas letterboxed and fits at 844×390; every button ≥44px and inside the viewport in both the attack-buttons-hidden and attack-buttons-shown states; `no_hscroll` true both times |
| `python3 tests/harness.py --perf 300` | `ms_per_frame` 0.129 (`ms_step` 0.009, `ms_render` 0.120) — well under the 6ms gate |

### Batch win-rate tables

`python3 tests/batch.py --n 30 --p1 carl --ai t1,t2,t3,t4,t5` (the canonical tier-sweep + per-floor-node/boss command every phase table has used):

```
tier           fights  winrate%  avglen(s)  stalled
t1             30      100.0     3.19       0
t2             30      53.3      5.07       0
t3             30      46.7      4.34       0
t4             30      50.0      3.80       0
t5             30      30.0      3.21       0
# FAIL: win rate is not monotone non-increasing across tiers: [100.0, 53.3, 46.7, 50.0, 30.0]

# per-floor-node/boss win rates (carl vs auto, n=30 each)
encounter      fights  winrate%  avglen(s)  stalled
f1_goblin      30      100.0     2.13       0   (target: doors 1-3 >= 85%)
f1_skel        30      100.0     2.08       0
f1_goblin2     30      100.0     2.13       0
f1_shaman      30      93.3      3.33       0   (informational only, per Task 6.1's ruling)
f1_hob         30      70.0      7.33       0   (target: door 5 in 40-70%)
f1_grull       30      33.3      12.54      0   (floor 1 boss)
f2_grub        30      76.7      3.87       0
f2_skel2       30      96.7      4.37       0
f2_shaman2     30      83.3      3.10       0
f2_hob2        30      73.3      6.10       0
f2_grub2       30      86.7      3.15       0
f2_mother      30      33.3      9.05       0   (floor 2 boss)
```

**Floor-1 doors and both bosses are healthy**: doors 1-3 all at 100% (≥85% target), door 5's
hobgoblin at 70% (in the 40-70% band), door 4's shaman at 93.3% (informational only, per Task 6.1's
ruling that door 4's real target is human fairness, not the bot's win-rate band), and both floor
bosses (`f1_grull` 33.3%, `f2_mother` 33.3%) unchanged from their historical range. None of this is
new work this task — it's the same floor-1 gate Task 6.1 already tuned and shipped, re-confirmed here
because the brief asked for it re-pasted alongside the rest of Task 6.6's gate.

**The abstract `t1..t5` tier gate genuinely fails, and this is a real, newly-discovered regression,
not noise.** `t3` (46.7%) sits below `t4` (50.0%), breaking the required monotone-non-increasing
curve. Investigated (disposable git worktrees, no working-tree changes survived) rather than assumed:

- Bisected to Task 6.2 (movement/AI-approach) exactly. At commit `dff0366` (Task 6.1's own base,
  immediately before 6.2), the identical command gives a clean, comfortably-monotone curve: `t1 100.0
  / t2 93.3 / t3 73.3 / t4 53.3 / t5 23.3`. At `5752bef` (Task 6.2's own final commit) it already
  reads `100.0 / 53.3 / 46.7 / 50.0 / 30.0` — the exact numbers still shipping today; Tasks 6.3-6.5
  (gestures, tutorial, kick art) made no further difference.
- Root cause, best current understanding: `decideApproach` (`src/55_ai.js`, Task 6.2's own frozen
  addition — "AI closes: at neutral with dist > lightRange for > 60 frames, every profile presses
  medium") is a guaranteed, non-probabilistic attack. Before Task 6.2, low/mid tiers (t2 `attack:.04`,
  t3 `attack:.25`) swung so rarely that a player who kept distance faced almost no offense from them;
  now every tier gets a "free," undodgeable-by-design medium every `approach` frames (t2 every 70,
  t3 every 50) regardless of its own `attack` stat, which is a much bigger relative buff to a
  previously-passive tier than to an already-aggressive one (t4/t5), compressing the intended
  difficulty curve.
- Attempted a same-scope `AI_TIERS` retune this task (lower `t2`/`t3` `attack`, raise `t5`
  `block`/`parry`) and could get the exact canonical `--n 30` command green, but couldn't do it
  cleanly: (a) it wasn't robust — `--n 60` or a different `--seed-base` still showed the same t3/t4
  inversion and t5 creeping past 30%, so it looked like overfitting to one seed range rather than a
  real fix; (b) `AI.make`'s per-controller RNG is a single shared stream across every behaviour, so
  even a small `attack` change shifts unrelated downstream rolls — the only `t3.attack` values that
  fixed the gate (≤.165) broke the existing pinned unit test `'brawl AI blocks a medium at least once
  in 20 seconds'` (t3 got combo'd to death before ever throwing a block, because lowering `attack`
  also weakens t3's own combo-interrupt via `comboFollow`), and the values that kept that test green
  (≥.17) left the gate failing. No single-lever fix was found in this task's own time budget.
- **Reverted** the attempted `AI_TIERS` changes rather than ship a fragile, seed-cherry-picked
  rebalance; `src/55_ai.js` is unchanged from Task 6.5's HEAD. Flagged to the controller during this
  task (not discovered after the fact) for a ruling: either a dedicated fix-round task (proper TDD
  iteration + review, same process Task 6.1 used for the shaman tuning) or an accepted, documented gap
  — this table records the real numbers either way rather than a green result that didn't happen.

**Correction (2026-09-22 fix wave, item 3): the root-cause paragraph above was wrong.** The Phase 6
final review measured `approach` directly — forcing every tier's `approach` to 0, 60, or 90 left the
n=60 sweep byte-identical (100.0 / 51.7 / 50.0 / 61.7 / 36.7 in every case) — and instrumented the real
run: the longest stretch of consecutive non-busy, out-of-range frames against `Ctrl.competent` is 10
(t3) and 6 (t4), never enough to clear the old 60-frame debounce. `approach` never fired at all; it was
a dead knob, not the cause. The actual lever, found by swapping t4's fields onto t3's one at a time:
`react` is overloaded as BOTH the shared action cooldown and the AI's own block-hold length
(`st.hold=p.react+r.int(10)`), so a "faster" (lower-`react`) tier held block for FEWER frames — and
Task 6.2's medium (an 18-22-frame tracking dash-in) is beaten by holding block longer, so the faster
tier ate the exact move the phase added. See the fix-wave tier-gate section below for the actual fix
(a decoupled `hold` field) and its measured tables.

## Fix-wave tier-gate retune (2026-09-22, item 3)

`hold` (frames an AI holds block after a reactive block roll lands) is a new per-tier `AI_TIERS` field,
decoupled from `react` (the shared action cooldown, unchanged in meaning): t1 26, t2 16, t3 10, t4 10,
t5 8, dummy 0 — `decideBlock`'s reactive roll now sets `st.hold=p.hold+r.int(10)` instead of
`st.hold=p.react+r.int(10)`. `decideApproach`'s neutral debounce is also lowered 60→12 frames (the
review's own measured runs above never cleared 60; 12 does, without making the press instant).

The `hold` decoupling alone (react/dash unchanged) passed the canonical `--n 30` command but still
broke `t5<=30` at `--n 60` (31.7%). Applied the review's own measured fallback on top: `t4.react 5→8`
(still the action cooldown only) and `t5.dash .08→.04`.

| command | t1 | t2 | t3 | t4 | t5 | gate |
|---|---|---|---|---|---|---|
| `--n 30` (seed-base 1) | 100.0 | 66.7 | 43.3 | 40.0 | 13.3 | pass |
| `--n 60` (seed-base 1) | 100.0 | 61.7 | 51.7 | 38.3 | 18.3 | pass |
| `--n 30` seed-base 101 | 100.0 | 86.7 | 56.7 | 36.7 | 23.3 | pass |
| `--n 60` seed-base 101 | 100.0 | 81.7 | 56.7 | 33.3 | 20.0 | pass |
| `--n 30` seed-base 201 | 100.0 | 60.0 | 56.7 | 36.7 | 16.7 | pass |
| `--n 60` seed-base 201 | 100.0 | 70.0 | 55.0 | 38.3 | 21.7 | pass |

Monotone non-increasing, t1≥80 and last-tier≤30 in every one of the six cells above. `approach` is no
longer inert: a new regression test forces `attack:0` on t1 at the 320px neutral spawn gap and still
gets a medium pressed within 90 frames (`approach` is the only remaining lever once `attack` is
disabled) — see `src/90_tests.js`, the test right after the pre-existing "t1 AI approaches..." one.

Floor-1 doors/bosses re-run at `--n 30` after this retune: doors 1-3 (`f1_goblin`/`f1_skel`/
`f1_goblin2`) all still 100% (≥85% target); `f1_grull` (floor 1 boss) 30.0% and `f2_mother` (floor 2
boss) 30.0% (both inside the 10-35% band). `f1_hob` (door 5) moved 70.0%→53.3% (still inside its own
40-70% band). `f1_shaman` (door 4, informational only per Task 6.1's ruling) 93.3% unchanged.

## Fix-wave DOM screen clipping (2026-09-22, item 8)

`.scr`'s `max-height` was a flat `456px`, unrelated to the actual viewport -- at 844×390 that let it
render up to 456px tall regardless of the real 390px available, overflowing a centered `.overlay`
symmetrically top/bottom and pushing each screen's BACK button off the bottom edge (measured: title's
SETTINGS bottom 399, map/shop/settings BACK bottom 413, against `innerHeight` 390). Fixed at the root:
`max-height:min(456px,calc(100vh - 24px))` (byte-identical at 844×480: `100vh-24=456` there), `.path`
(map)/`.setrows` (settings)/`#shopBody` (shop) all already used `overflow-y:auto`/now do, so a screen
whose content doesn't fit a short viewport scrolls that one region internally instead of pushing its
BACK button (or anything below it) out of view. `.panel` (title/pauseMenu/result) got the same
treatment via smaller margins/padding rather than a scroll region (three buttons never need one).
`.node` (map doors) and `.perkrow button` (kiosk perks) both got real 44px `min-height` (were 40/36px)
to match the touch-target bar used everywhere else in the game, now that `--phone-check` actually
checks every DOM screen's buttons and would otherwise catch them.

`python3 tests/harness.py --phone-check` (844×390, extended to visit title/map/roster/crystal/shop/
arena/settings, not just the in-fight canvas/4 `.cbtn` buttons):

```
errors: []
screenErrors: []
wiring_ok: True
attackButtonsHidden.aspect_ok/fits_ok/no_hscroll/bad_btns: True True True []
attackButtonsShown.aspect_ok/fits_ok/no_hscroll/bad_btns: True True True []
title: 6 buttons, 0 scrolled-out (skipped), bad=[]
map: 10 buttons, 2 scrolled-out (skipped), bad=[]
roster: 4 buttons, 0 scrolled-out (skipped), bad=[]
crystal: 3 buttons, 0 scrolled-out (skipped), bad=[]
shop: 8 buttons, 1 scrolled-out (skipped), bad=[]  (final state after item 9; was 2 mid-wave)
arena: 2 buttons, 0 scrolled-out (skipped), bad=[]
settings: 9 buttons, 2 scrolled-out (skipped), bad=[]
```

Exit 0. Every VISIBLE (not currently scrolled out of its own `.path`/`.setrows`/`#shopBody` region --
skipped, not failed, matching that region's own pre-existing scrollable design) button on all seven
screens is now a real ≥44px target fully inside the 844×390 viewport; the in-fight canvas/BLOCK/PUNCH/
KICK/POWER check (Task 5.6, unchanged) still passes both the attack-buttons-hidden and -shown states.
The pre-existing 854×480 "map path fits a full floor with no scroll" unit test (Task 6.1's own fix-wave
item 3) still passes -- `.scr` padding and `.energy`'s own margin were trimmed a further few px to
reclaim the headroom `.node`'s 40→44px bump used up at that size.

### Phase 6 fix-wave close-out rulings (2026-09-22)
- **f2_mother out of band after the RNG warm-up (46.7%, band 10-35%).** Ruling: retune the boss's stats, not the seeds — hp 1100→1350, atk 35→36. Measured n=30: 23.3% (seed-base 1), 13.3% (seed-base 101); f1_grull unchanged at 20.0%. Rejected: atk-only bumps (1250/38 → 3.3%, 1100/40 → 6.7% on base 101).
- **Item 8 "no scrolling".** Ruling: the bar is "every control reachable at 844×390 with no clipping"; the path (map), shop, and settings lists legitimately scroll (2/1/2 controls scrolled-out, none clipped, `--phone-check` fails on clipping and page errors). Zero-scroll on those three screens would cost the lists their readable row height.
- Fix-wave gate on the close-out commit: build --check; unit 366/0; matrix 216 cells; e2e; tutorial; screens-smoke; phone-check screenErrors []; tier gate n=30 pass; doors 1-3 100/100/100, f1_hob 46.7, bosses 20.0 / 23.3.

## Phase 7 exit (2026-09-22)

Tasks 7.1-7.5, commits `ca0989a..4b8d5ae` (`97d381c` is the plan doc, immediately before Task 7.1)
on `main`. Full-branch verification below is a fresh re-run at Task 7.5's own final commit, not a
copy of each task's own report numbers.

### Exit table

| Task | Commit(s) | Tests added | What shipped |
|---|---|---|---|
| 7.1 Effects | `ca0989a` | 366→388 (+22) | Timed, stacking status effects (`EFFECTS`/`Effects`, `src/48_effects.js`): bleed, stun, armorBreak, fury, powerGain, powerBurn, regen, weakness, and the `mod` plumbing (`atkMul`/`armorDelta`/`critDelta`) later tasks build on |
| 7.2 Combo grammar | `e2e95f0`, `208b90c`, `77f9e00`, `eb5ffb6` | 388→407 (+19) | The frozen five-node `CHAIN` grammar (openers, per-node `chainDmg`, three enders incl. the shortened in-combo heavy carrying `def.sigEffect`), `Fighter.chainNode` replacing the old fixed light1-5/medium ladder, AI t3+ learning the mixed M-L-L-L-M follow (`comboMix`), the in-combo heavy ender's swipe-and-hold gesture (two fix rounds to make it reachable and to decide it at the node-4 window's own natural close), and the AI/boss tier-gate retune the new grammar's DPS jump required |
| 7.3 Intercept/dexterity | `9362bd2` | 407→415 (+8) | `intercept` (a hit landing on a foe mid-dash-in-startup: x1.5 dmg, +15 power, its own hitstop/event) and `dexterity` (a dash-back through an active hitbox with i-frames still up: +20% crit via `Effects`, its own event) — both tier-agnostic rules read off live fighter state, not an AI-tier flag — plus medium's dash-in effective startup capped at 14 frames at any gap |
| 7.4 Hit feel | `b11df23`, `e8b8328`, `fe4dd49` | 415→430 (+15), 430→430 (+0), 430→435 (+5) | The `HITFEEL` table (per-class shake/punch magnitudes, intercept override), directional camera shake, punch-in zoom, per-class impact fx (dust ring/arc slash/caster ring), intercept time dilation, per-node hit audio, and a fix round wiring the table into `Fight.resolve` itself (it shipped once already referenced but not read) |
| 7.5 Balance and close-out | `4c0549c`, `70b9abf`, `10139ce`, `4b8d5ae` | 435→441 (+6), 441→442 (+1), 442→443 (+1), 443→443 (+0) | `Ctrl.competent` (the tier-gate's own yardstick bot) learns the mixed M-L-L-L-M chain and a dash-back read against a foe's medium; intercept's dmg/power/event gated to once per attacking move instance (7.3 review follow-up); `HITFEEL.<class>.stop` locked to `MOVES.*.hitstop` (7.4 review follow-up); AI t4 and the hobgoblin/mother_rat mobs retuned back into their frozen bands; this section |

**Phase 7 exit criteria:** effects, grammar, intercept/dexterity, hit feel shipped with tests (above);
gates green (below); this is the final whole-branch review pass. Not yet pushed — see the task report
for `git push` status at hand-off.

### Ctrl.competent learns the grammar (Task 7.5 ruling)

The fixed win-rate yardstick bot every `AI_TIERS` entry is measured against (`tests/batch.py --bot
auto`, `Ctrl.competent` in `src/30_input.js`) predates the combo grammar and intercept/dexterity by
several tasks, so the tier gate it was certifying no longer actually exercised what it was gating.
Two additions, both deterministic (no new rng draws — `Ctrl.competent` has never rolled dice, and
still doesn't):

- **Mixed M-L-L-L-M chain.** A medium-opened chain (the bot's own "close distance" opener) now
  follows light-light-light-medium — the frozen grammar's own node-5 ender (push+knockdown) — instead
  of the old flat all-light follow every node. A light-opened chain is unchanged (still all-light
  through node 5): the frozen interface only asks for the mixed pattern specifically when the opener
  really was a medium, the same scope `AI.make`'s own `comboPlanFor` uses for `comboMix` tiers.
- **Dash-back read.** A foe's medium dash-in is read exactly `DASH_READ_LEAD` (2) frames before its
  hitbox would go active and dashed through for a real `dexterity` dodge (zero damage, +20% crit for
  the bot's own next hits) instead of merely blocked (chip damage only). Checked ahead of the plain
  block-react so it wins that frame's decision outright — block may still have fired on earlier
  frames of the same startup (BLOCK doesn't count as `busy()`, so switching from holding block into
  DASH is a normal `act()` transition, not an interruption) — verified empirically across the full
  effective-startup range (base 10 through the 14-frame dash-in cap, both a fixed-gap and a real
  moving dash-in) to land the dodge reliably, not a single seed pick.

**This makes the bot measurably harder to beat, in the AI's favor, not the bot's** — every AI tier's
own medium-based offense (its primary approach/damage tool at every tier) is now denied outright a
large share of the time instead of merely chipping, at the cost of one committed ~12-frame DASH
window of the bot's own offense per successful read. Straight AI buffs push the wrong direction (they
make the AI *harder*, which lowers the bot's win rate *further* below the passing tiers' own targets);
the retune in the exit table's own Task 7.5 row nerfs t4 and lowers two mobs' atk instead — see
`src/55_ai.js`/`src/40_movedata.js`'s own comments for the full reasoning and the before/after numbers
in the tables below.

### t1/t2 fight logs diverged from `eb5ffb6` by design (Task 7.3 ruling, recorded here)

Once `intercept`/`dexterity` shipped (`9362bd2`, Task 7.3), fight logs for every tier — including t1
and t2, whose own `AI_TIERS.intercept` field is 0 and .1 respectively — are no longer expected to stay
byte-identical to `eb5ffb6` (Task 7.2's own final commit, immediately before intercept/dexterity
existed at all). This is **by design, not a regression**: both mechanics are tier-agnostic rules read
off live fighter state (whoever's hit lands on a foe mid-dash-in-startup gets the intercept bonus;
whoever dashes back through an active hitbox with i-frames up gets the dexterity dodge) — an AI
tier's own `intercept` field only gates that tier's *own offensive* read (`AI.make`'s
`decideIntercept`), not whether that tier can itself *be* intercepted or dodge via a foe's dash-back.
A t1/t2 fight can therefore land (or dodge) an intercept exactly as any other tier's fight can, which
changes the resulting log even though nothing about t1/t2's own decision-making changed. What *was*
preserved: each tier's own RNG-draw sequence (which `r.next()`/`r.int()` calls happen, in what order,
off `AI.make`'s single shared stream) is unchanged — only the outcome those draws land into differs,
since intercept/dexterity are resolved in `Fight.resolve` off live state, never by consuming rng of
their own.

### Full gate (re-run at commit `4b8d5ae`, before this section's own commit)

| Command | Result |
|---|---|
| `python3 tools/build.py --check` | exit 0 |
| `python3 tools/build.py` | wrote `index.html` (839,103 bytes, 22 parts) |
| `python3 tests/harness.py --unit` | 443 pass, 0 fail, 0 page/console errors |
| `python3 tests/harness.py --matrix` | 216/216 cells, 0 errors, ~21s wall time |
| `python3 tests/harness.py --e2e --seed 7` | 0 page errors, 0 summary errors; all floor-1 doors + boss won |
| `python3 tests/harness.py --tutorial` | steps `[1,2,3,4]` in order, `tutorialDone` true, +300 gold, 0 errors |
| `python3 tests/harness.py --screens-smoke` | 0 errors on all 9 screens, final state `RESULT` |
| `python3 tests/harness.py --phone-check` | every button ≥44px and inside the viewport in both attack-button states; no clipping |
| `python3 tests/harness.py --perf 600` | `ms_per_frame` 0.098 (`ms_step` 0.0075, `ms_render` 0.091) — well under the 6ms gate |

### Batch win-rate tables

**Before (base `fe4dd49`, pre-Task-7.5, `Ctrl.competent` not yet grammar-aware), n=30, seed-base 1:**

```
tier           fights  winrate%  avglen(s)
t1             30      100.0     2.12
t2             30      86.7      3.03
t3             30      66.7      2.92
t4             30      56.7      3.83
t5             30      23.3      3.52
# OK: monotone non-increasing, t1=100.0 (>=80), last=23.3 (<=30)

f1_goblin      30      100.0              (target: doors 1-3 >= 85%)
f1_skel        30      100.0
f1_goblin2     30      96.7
f1_hob         30      56.7               (target: 40-70%)
f1_grull       30      26.7               (target: bosses 10-35%)
f2_mother      30      20.0
```

**After (final, `4b8d5ae`), n=30, seed-base 1:**

```
tier           fights  winrate%  avglen(s)
t1             30      100.0     3.02
t2             30      70.0      3.88
t3             30      50.0      3.70
t4             30      36.7      4.29
t5             30      23.3      3.67
# OK: monotone non-increasing, t1=100.0 (>=80), last=23.3 (<=30)

f1_goblin      30      100.0
f1_skel        30      100.0
f1_goblin2     30      96.7
f1_hob         30      63.3
f1_grull       30      26.7
f2_mother      30      20.0
```

**After, n=60, seed-base 1:**

```
tier           fights  winrate%
t1             60      100.0
t2             60      66.7
t3             60      45.0
t4             60      40.0
t5             60      21.7
# OK: monotone non-increasing, t1=100.0 (>=80), last=21.7 (<=30)

f1_goblin      60      98.3
f1_skel        60      98.3
f1_goblin2     60      96.7
f1_hob         60      66.7
f1_grull       60      20.0
f2_mother      60      28.3
```

**After, n=30 and n=60, seed-base 101 (the gate's second required seed base):**

```
                n=30                    n=60
tier           winrate%                winrate%
t1             100.0                   100.0
t2             56.7                    63.3
t3             56.7                    48.3
t4             33.3                    30.0
t5             13.3                    21.7
# both: OK, monotone non-increasing, t1=100.0 (>=80), last<=30

f1_goblin      86.7                    91.7
f1_skel        93.3                    95.0
f1_goblin2     86.7                    90.0
f1_hob         46.7                    50.0
f1_grull       13.3                    16.7
f2_mother      23.3                    30.0
```

Every required combination — tier sweep monotone with t1≥80/t5≤30 at n=30 and n=60, both seed bases 1
and 101; doors 1-3 ≥85%; f1_hob in 40-70%; f1_grull and f2_mother in 10-35% — passes. The tier-sweep
values dropped across the board (competent got measurably harder to beat, per the ruling above) but
stayed comfortably inside every required band; t4 and t5 sit closer together than the pre-7.5 table
(a real, necessary consequence of nerfing t4 specifically to restore separation, not a design
regression — the door/boss numbers the actual campaign uses are what matters, and those all sit
mid-band with real margin).

### `--n 30`/`--n 60` full floor sweep (seed-base 1, informational — every non-gated node)

```
                    n=30    n=60
f1_shaman           83.3    83.3   (informational only, per Task 6.1's own ruling)
f2_grub             83.3    78.3
f2_skel2            90.0    90.0
f2_shaman2          66.7    70.0
f2_hob2             56.7    61.7
f2_grub2            80.0    78.3
```

No node collapsed to a near-0/near-100 wall; nothing here needed a retune.

### Rulings (Task 7.5)

- **`Ctrl.competent` must learn the grammar.** Covered above ("Ctrl.competent learns the grammar").
- **Doors 1-3 ≥85%, f1_hob 40-70%, bosses 10-35%, tier sweep monotone with t5≤30% at n=30 and n=60
  (seed bases 1 and 101).** All four tier-sweep combinations and all six gated encounters pass — see
  the batch win-rate tables above.
- **README gets a Combat section** (chain, three enders, intercept, dexterity, status effects) —
  shipped this task, placed after the controls section; see `README.md`.
- **(7.3 review) A batch of seeded fights (t3 vs `Ctrl.competent`) must emit at least one `intercept`
  and one `dexterity` event.** `src/90_tests.js`'s `'a batch of seeded Ctrl.competent vs AI t3 fights
  produces at least one real intercept and one real dexterity event'` sweeps 30 seeds and asserts both
  — shipped in `4c0549c`.
- **(7.3 review) Gate intercept's dmg/power/event to once per move (the `last` sub-hit precedent used
  by hitstop).** `Fighter.interceptedThisMove` (reset in `startMove`, consulted/set in
  `Fight.resolve`) gates all three together off one flag — shipped in `70b9abf`, regression test
  included.
- **(7.4 review) `HITFEEL.<class>.stop` must equal the matching `MOVES.*.hitstop` for light, medium,
  heavy, s1, s2, s3.** Test-only commit `10139ce` (every value already matched; no source change
  needed).

### Phase 7 fix wave (final-review follow-up)

- **(final review M7) `e.source`, `Effects.has`/`Effects.stacks`/`Effects.clear`, and
  `HITFEEL.<class>.stop` have no production reader today.** All three are deliberate Phase 9 API
  surface, not oversights: `e.source` is frozen so a future kit can attribute an effect to the
  champion/move that applied it (a badge tooltip, a "removed by" log line); `Effects.has`/`.stacks`
  are the read side of the same frozen interface `Effects.apply`/`.tick`/`.mods` already have callers
  for, waiting on a consumer (an AI read, a kit's own conditional) rather than a producer; `Effects.clear`
  gained its own caller in this fix wave (`Fight.finish`, M6 above) but was already frozen for a
  future per-effect dispel. `HITFEEL.<class>.stop` is a drift alarm, not a hitstop source (see the
  7.4-review bullet above) — it earns its keep by staying in the test suite, not by being read at
  runtime. No fix needed; this note is the "one-line note in ARENA.md" M7 asked for.

### Phase 7 final-review fix-wave rulings (2026-09-22)
- **I1 (dilation swallowed by hitstop):** dilation is spent only on ticks where hitstop is 0; intercept keeps hitstop 10, then 6 real ticks at half rate with the sim actually moving (tested).
- **I2 (punch-in inert at the 1.12 cap):** the distance ramp's ceiling dropped 1.12→1.06; the HUD-clearance cap stays 1.12; the punch test now runs at the real cap and real landing distances. Close-range framing is ~5% smaller; p7 shots regenerated and reviewed.
- **I3 (no intent buffer):** Input re-presents light/medium/heavy/special for up to 4 sim frames, dropping on a new move (Fighter.moveSeq) or on HITSTUN/KNOCKDOWN/STUNNED; block is a held flag and dashBack is presented only on its own frame (a dodge is a read, not a chain link). Scripted/AI controllers never touch Input, so batch/matrix/replays are bit-identical.
- Minors M1-M9 fixed in the same wave (dead audio recipe, dilation/pointer resets on startFight, stun vs knockdown, CHAIN.nodes-derived node 4, effects cleared on finish, README/ARENA accuracy). Deferred: t4/t5 separation is thin at seed-base 101 n=60 (30.0 vs 21.7); revisit in the Phase 10 balance pass.
- Gate on the close-out commit: build --check; unit 455/0; matrix 216 cells; e2e; tutorial; screens-smoke; phone-check; perf 0.094 ms; batch n=30 t1..t5 100/70/50/36.7/23.3, doors 100/100/96.7, f1_hob 63.3, f1_grull 26.7, f2_mother 20.0.

## Phase 8 exit (2026-09-22)

Tasks 8.0-8.5 plus the final-review fix wave, commits `5bc5397..1a867e7` on `main` (Task 8.0's first
commit through the fix wave's last commit, which is the one that wrote this section).
SDD ledger: `.superpowers/sdd/2026-09-22-phase8-art-upgrade/progress.md`.

### Exit table

| Task | Commit(s) | Tests added | What shipped |
|---|---|---|---|
| 8.0 Seams | `5bc5397`, `59ee492` | 461→465 (+4) | Presentation-only prep: hit-feel/impacts moved out of the sim into `72_fx.js`, `Fighter.resetPerMove`, and pooled `Effects.mods` (allocates once per fighter) — the groundwork Task 8.1's rig rewrite needed a clean seam to land on |
| 8.1 Human rig | `a908807`, `1a6d501` | 465→474 (+9) | `BodyStyle` (limb/torso/head/cache) and the frozen `LOOKS[id].body` schema; layered vector bodies and faces for the four human-rig looks (Carl, Katia, goblin, skeleton), each with real hair/cloth/face instead of capsule strokes |
| 8.2 Big/quad rigs | `28436c0`, `14f08c2`, `1412bff` | 474→481 (+7) | `BodyStyle` extended to `drawBig`/`drawQuad`; layered bodies for Mongo/Grull (big) and Donut/Grub/Mother Rat (quad); cross-rig joint-seam polish (no more visible rings at elbows/knees/shoulders) |
| 8.3 Stage lighting | `387158f`, `52d933d`, `7661eb0`, `e04ffac`, `b1dd123` | 481→496 (+15) | `Stage.build` far/torches/floor-falloff layers, `Stage.lightAt` (per-8px-column cached torch tint/rim), fighter torch-tint overlay + rim highlight — landed after a fix round (tint bled outside the fighter's own silhouette as a pale box; fixed with per-fighter tinted bitmaps) and a re-review fix (falloff step corrected to the ruled 32px) |
| 8.4 HUD | `9c7a833`, `a6a6629`, `36cbf31` | 496→504 (+8) | Chevron-capped HUD bars (`HUD.bar`/`barFillRect`), the `CLS_GEM` class-color table (`40_movedata.js`), `HUD.portraitFrame`'s ornate ring + class-gem badge, gold italic tilted combo counter with a count-up tween — landed after a fix round correcting `CLS_GEM`'s class names to the six real `def.cls` values and recoloring the frame ring off brawler gold so the gold gem itself still reads |
| 8.5 Screens + close-out | see below | 504→511 (+7) | Map door cards (`Screens.doorCard`, cached per node id + state) replacing the old plain-text doorstack: a fixed **72×72** square carrying a stone arch, a torch and the encounter enemy's own portrait — **no floor banner**, and the locked/cleared indicator is **DOM text** (`.doormark`) in the row's text column, not a canvas overlay. `flex-shrink:0` on `.node`/`.card` is the fix for the row-compression bug that let a door card bleed into its neighbours. Roster cards framed with the 112px portrait + `Render.portraitFrame`/`CLS_GEM` (`Screens.portraitCard`); `tools/shots.sh` regenerated end-to-end (see its own "Task 8.5" comment block); this section |
| Fix wave (final review) | `517869c`, `4647a25`, `b11a55a`, `c1a12eb`, `4a9c435`, `6fae676`, `952ded5`, `c25679c`, `52bae9a`, `1a867e7` | 511→520 (+9) | The whole-branch review's 1 Critical, 5 Important and 9 Minor, plus the parked Donut art note. See the fix-wave subsection below |

**Phase 8 exit criteria:** all eleven looks have layered bodies and faces (8.1/8.2), with a standing
shot for each one — grub and the shaman got theirs in the fix wave, which is what took the reviewable
evidence from nine looks to eleven; stage lighting and the reference HUD shipped (8.3/8.4);
door/roster art shipped (8.5, above); extent/clearance tests unchanged (Rig.extent/EDGE_PAD — the
map/roster DOM-clearance tests were updated, not broken — see the "Task 8.5 CSS/layout notes"
subsection below for why); perf under budget (perf trend below, well under the 6ms gate throughout);
shots regenerated and reviewed (`tools/shots.sh`, 60 PNGs).

### Perf trend (8.1 → 8.5, ms/frame at `--perf 600`)

```
8.1     0.124
8.2     0.195
8.3     0.361  (initial: per-part tint stamps against the opaque canvas)
8.3-fix 0.249  (v3: tinted per-part bitmaps cached per base-key|k-bucket)
8.3-final 0.28 (falloff step corrected 96->32px, re-review fix)
8.4     0.280
8.5     0.283  (menu-screen door/roster art costs nothing in-fight; the 0.003ms delta from 8.4 is
                measurement noise, not a real regression — 8.5 touches no Fight/Fighter/Render
                fight-loop code, only Screens/CSS)
fix-wave 0.297 (the torch tint now reaches seven more part kinds per fighter, and Donut carries two
                more cached discs; threading the zoom bucket gave ~0.016ms of that back)
```

All comfortably under the 6ms gate.

### Task 8.5: door cards, roster portraits, close-out

- **Door cards** (`Screens.doorCard(encId, state)`, `src/85_screens.js`): a fixed **72×72** canvas
  per node — a stone arch/jamb, a torch (`Stage.TORCH_TINT`, the same warm color the in-fight
  lighting model uses), and the encounter enemy's own HUD bust (`Rig.portrait`, built by Tasks
  8.1/8.2 and unchanged here) drawn into the arch mouth at 44px — replacing the old plain-text
  `doorStack`. Cached in `Screens._doorCache` keyed by `encId+'|'+state`, so a map re-render (floor
  switch, a `Screens.refresh()` elsewhere) hands back the exact same canvas rather than repainting
  it; only a real state flip (open→done on a win, or an unlock) produces a new cache entry.
  Three things the first cut of this task had and the shipped card does not, all from fix round 1's
  controller ruling: it was a tall 80×104 rectangle, it carried a floor-number banner, and the
  locked/cleared indicator was a canvas overlay. The card is now a self-contained square, there is
  **no banner**, and the indicator is **DOM text** (`.doormark`, in `doorStack`'s own text column),
  which costs nothing to test and needs no pixel inspection. A locked door reads as "not open yet"
  through its darker stone, its unlit torch and that text — the portrait is drawn at `globalAlpha .4`
  rather than hidden, so the enemy stays recognizable. `flex-shrink:0` on `.node` (and defensively on
  `.card`) is the actual fix for the row-compression bug the controller caught in `p8-map.png`: the
  row's box was being squeezed toward its old ~44px text height while its taller card child, under
  `overflow:visible`, bled into the neighbouring rows.
  The fix wave changed two things here: the portrait request is **56px**, not 112, because the card
  draws it at 44 and the 56px bust is already cached for the HUD; and `_paintDoorCard` now guards an
  unknown encounter id the same way `doorStack` always did, so one bad node degrades to an empty
  doorway instead of taking the whole map screen down.
- **Roster portraits** (`Screens.portraitCard(look, size, cls)`): one canvas combining the 112px
  portrait with `Render.portraitFrame`'s own ring + `CLS_GEM` badge (Task 8.4's in-fight HUD frame,
  reused as-is — no new frame-drawing code). `renderRoster` now builds this instead of the bare 56px
  `Rig.portrait` bust it used before.
- **`src/65_stage.js`'s 96px-step comment:** already fixed at `b1dd123` (Task 8.3's own re-review fix
  round) — the file's only remaining "96" mentions are in a comment explaining the *history* of that
  fix ("32px, not 96 — the re-reviewer pixel-sampled..."), not a stale claim about the current step.
  Verified with a full-file grep before starting this task; no change needed.

### Task 8.5 CSS/layout notes (deviations, with reasoning)

Two pre-existing DOM-clearance assumptions no longer held once door/roster cards carried real art
instead of a couple of text lines, and both were fixed by leaning on scrolling — which `.path` and
several other lists already do (fix-wave item 8) — rather than by shrinking the new art back down to
fit the old text-sized budget:

- **`#mapPath` (the map's door list).** The fix-wave-item-3 unit test used to assert *zero* overflow
  (`scrollHeight<=clientHeight`) for a full 6-row floor at 854×480, which held while a door row was
  two lines of text (~40px tall). A door card obviously doesn't fit that budget (80×104 as this task
  first drew it, 72×72 as it shipped). `.path` was
  already `overflow-y:auto` (fix-wave item 8 switched it from `overflow:hidden` specifically so an
  over-tall list scrolls instead of clipping) — so the real bar was always "reachable, not clipped,"
  not "literally zero scroll." The test now asserts that directly (`overflowY` is `auto`/`scroll`,
  never `hidden`, and all 6 rows are in the DOM) instead of the stale zero-overflow number — see
  `src/90_tests.js`'s updated `'the map path never clips a full floor...'` test.
- **`#rosterCards` (the roster list).** This one *was* a real regression caught during this task, not
  a pre-existing gap: `.cards` was `overflow:hidden` (not `auto`), and the old comment's own claim —
  "4 cards still stack top-to-bottom with no scroll" — stopped being true once each card's portrait
  grew from a 52px square to an 84×94px framed one. With `overflow:hidden` that silently clipped the
  top and bottom cards of a 4-champion roster (verified: the first champion's name and the last
  champion's action row both rendered off-canvas with no way to reach them). Fixed the same way as
  `.path`: `.cards{overflow:hidden}` → `overflow-y:auto`. `--phone-check`'s own scrolled-out-button
  check already treats this correctly (skipped, not failed, since the content is reachable by
  scrolling); see `src/00_head.html`'s own comment on `.cards` for the before/after measurement
  (`scrollHeight` 427 vs `clientHeight` 373 at 854×480 with 4 champions).

Both changes match this phase's own "scrolling lists allowed but no clipping" instruction for the
CSS file — the fix in both cases was making sure a list that no longer fits its box scrolls, not
clips.

### Phase 8 final-review fix wave

The whole-branch review (`verdict-phase8-final.md`) and the Task 8.5 review (`verdict-8.5.md`) between
them found 1 Critical, 5 Important and 9 Minor issues plus one parked art note. All were taken.

| # | Finding | What shipped |
|---|---|---|
| C1 | The roster's first champion card was clipped at **every reachable scroll position** — `justify-content:center` on an overflowing scroll container puts the start-side overflow outside the scroll range, measured at −53.5px (854×480) / −98.5px (844×390) | `.cards` uses `justify-content:safe center` with a plain `flex-start` fallback: a short roster still centres, an overflowing one anchors at the start. `docs/shots/p8-roster.png` re-shot from the top of the list with its own 4-champion fixture instead of a byte-identical copy of `p4-roster-4.png` |
| I5 / 8.5-C1 | `--phone-check`'s card assertions were vacuous (a fresh save has one champion) and sampled the `.node`/`.card` parents, which provably cannot see the flex-shrink bug they were written for | The roster is seeded with the four-champion fixture; overlap is tested on the **art children** (`canvas.doorcard`/`canvas.pcard`); each row's own height must be ≥ its art child's; both lists must have their first card fully inside the viewport **and** its scroll container with the last still reachable. Proven red on `ab73246` (9 overlapping art pairs, all 6 rows shrunk) and on `9e2e717` (the roster Critical) |
| I1 | `BodyStyle._tintedCache` grew without bound, was never cleared, and no test could see it | `clearCache()` empties all three caches; `tintedCount()`/`specCount()`/`cacheTotal()` added; `G.startFight` drops all three, so the working set is one fight's ~3.8MB instead of a session's ~180MB |
| I4 | Torch lighting reached `limb`/`torso`/`head` and nothing else — fists, feet, hip cloth, joint caps, seams, paws, masses and held weapons stayed at full brightness | All seven remaining cached part kinds route through `_tintedBitmap`; held weapons take the same spec analytically via `BodyStyle.litCol` |
| I3 | `zoomBucket` called `getTransform()` 27 times per fighter draw (~108 `DOMMatrix` allocations a frame) | The bucket is computed once per rig draw and threaded through the parts' options bag; measured 27 → 1 |
| I2 / 8.5-I1,I2 | `docs/ARENA.md`, `README.md` and a test-file comment described the door card that fix round 1 replaced | This section, the exit table above, the README caption and `src/90_tests.js`'s Task 8.5 header all rewritten against the shipped 72×72 card |
| 8.5-I3 | `tools/shots.sh`'s ten `\|\| true` lines threw their exit codes away | A `soft` helper records each one; the closing summary names any line that newly fails or newly passes |
| M1 | ~276 lines of unreachable pre-8.x stroke rig, plus the legacy `_portrait` alias | Deleted. Proven inert by rendering all eleven looks across twelve poses, both facings and three light levels before and after: pixel-identical |
| M2, M3 | Two stale comments (the rig's "big and quad rigs have no `.body`", the stage's split falloff-step history) | Corrected |
| M4, M5, M6 | `_paintDoorCard` threw on an unknown encounter; it built a 112px portrait to draw at 44px; `reduceMotion` did not stop the visible torch flame | Guarded, switched to the 56px bust already cached for the HUD, and gated through the new `Stage._flameFlicker` |
| M9 | Grub and the shaman had no standing shot anywhere in the set | `p8-grub.png` and `p8-shaman.png` added to `tools/shots.sh` and the README gallery |
| Art note | Donut's barrel read as a white tube (the controller's note, parked since 8.2) | `LOOKS.donut.barrel`: a stronger taper (chest a third narrower than the hips), haunch and shoulder masses genuinely proud of the tube, and a drawing-only spine dip. One look only — every other quad keeps the shared default and is bit-identical |

Two findings were **not** taken, both deliberately: M7 (`CLS_GEM` living in `40_movedata.js`) was the
controller's own earlier ruling and the comment there is honest about it; M8 (p8 shots that duplicate
earlier ones) is resolved for `p8-roster.png`, which had its own fixture, but `p8-map.png` is still the
same fresh-save floor 1 as `p4-map.png` by design — one map screen, one fixture.

### Rulings copied from the SDD ledger (`.superpowers/sdd/2026-09-22-phase8-art-upgrade/progress.md`)

- **8.1 review:** "the BodyStyle interface line is Phase-wide; drawBig/drawQuad are Task 8.2's."
  Controller's visual read of the four shots: real faces/hair/cloth, a clear step up; remaining
  'wooden mannequin' feel comes from visible joint circles at elbows/knees/shoulders — routed to 8.2
  as a cross-rig polish.
- **8.3 (Critical fix round):** "tint composites only against the fighter's own alpha — per-fighter
  offscreen layer, one source-atop stamp, blit; layer canvases allocated once; cache key look|k;
  falloff step 32; pixel test outside the silhouette must equal the stage color; reviewer's
  one-big-rect fix rejected — cost if wrong: one more presentation round."
- **8.3:** "flicker sourced from a presentation RNG seeded per fight rather than the literal
  fight.presRng object is accepted (frozen signatures forced it; determinism holds)."
- **8.3 (fix round 1, v3):** "v2→v3 deviation accepted" — the per-part offscreen-layer approach (v2)
  was rejected on perf (1.3ms); tinted per-part bitmaps cached per base-key|k-bucket (v3) shipped
  instead.
- **8.4:** "CLS_GEM keyed by the six real classes (brawler gold, caster violet, trickster teal, tank
  rust, rogue green, beast amber) with a test that every def's cls has a non-default gem; frame ring
  becomes bronze so the gold gem reads; combo shot via a scripted fixture — cost if wrong: colors
  only."

### Full gate (re-run at the fix wave's last commit, `1a867e7`)

| Command | Result |
|---|---|
| `python3 tools/build.py --check` | exit 0 |
| `python3 tests/harness.py --unit` | 520 pass, 0 fail, 0 page/console errors |
| `python3 tests/harness.py --matrix` | 216/216 cells, 0 errors |
| `python3 tests/harness.py --e2e --seed 7` | 0 page errors; full floor-1 door run + arena loop |
| `python3 tests/harness.py --tutorial` | steps `[1,2,3,4]` in order, `tutorialDone` true, +300 gold, 0 errors |
| `python3 tests/harness.py --screens-smoke` | 0 errors on all 9 screens |
| `python3 tests/harness.py --phone-check` | every button ≥44px and inside the viewport in both attack-button states; map 6 cards and roster 4 cards with no overlapping art and no shrunk row; both first cards fully visible with the last reachable |
| `python3 tests/harness.py --perf 600` | `ms_per_frame` 0.297 (`ms_step` 0.007, `ms_render` 0.290) — well under the 6ms gate |
| `python3 tests/batch.py --n 30` | bit-identical to the `36cbf31` baseline: t1..t5 100/70/50/36.7/23.3; doors 100/100/96.7/83.3; f1_hob 63.3; f1_grull 26.7; f2_mother 20.0 |
| `bash tools/shots.sh` | exit 0, regenerated 60 PNGs in `docs/shots/`; "soak-floor shots: 12/12 exited non-zero, exactly the documented set -- no new failures" |

**Phase 8 is DONE** as of this commit. Not yet pushed — see the fix-wave report for `git push` status
at hand-off.

**One caveat on the shot set.** `tools/shots.sh` run twice with no code change between the runs
produces 11 different PNGs out of 60: a `--pose`/`--sim` screenshot is taken after an unknown number
of real animation frames, so the camera lerp has converged a variable amount and the framing shifts.
The shots are reliable as *art* evidence and unreliable as a *diff* signal — a changed PNG does not by
itself mean the rendering changed. The fix wave used a pixel-hash probe over every look, pose, facing
and light level for that instead.

### Phase 8 final-review fix-wave rulings (2026-09-22)
- **Roster first card unreachable (Critical):** `.cards` uses safe-center with a flex-start fallback; `--phone-check` now asserts each map/roster row's height contains its art child, no pairwise overlap, and first-card/first-door visibility, with the four-champion fixture seeded.
- **Tinted-bitmap cache unbounded:** clearCache/cacheCount cover all three BodyStyle caches; `G.startFight` clears them (one warm-up frame per fight, measured ~4 ms on desktop by the re-reviewer — a follow-up may pre-warm during the fight intro if a phone shows a stutter).
- **Lighting reaches every part** (hands, feet, paws, blobs, joints, seams, hips, props) through the same tinted-bitmap path; CTM read once per fighter draw.
- **Docs describe the shipped 72×72 door card** (no floor banner; DOM lock/cleared text); shots.sh prints a failure summary for its suppressed lines; the 276-line pre-8.x stroke rig was deleted (every look has `.body`, pinned by a test); torch flame animation gated by reduceMotion; door card draws from the 56-px portrait; Donut's barrel gained shoulder and haunch masses.
- Known: `tools/shots.sh` output is not pixel-deterministic (camera lerp settles a variable amount before the shot); the map's top card scrolls under the header by design (column-reverse anchors DOOR 1 at the bottom).
- Gate on the close-out commit: build --check; unit 520/0; matrix; e2e; tutorial; screens-smoke; phone-check (overlap/firstCard/firstDoor ok); perf 0.295 ms; batch n=30 t1..t5 100/70/50/36.7/23.3, f1_hob 63.3, f1_grull 26.7, f2_mother 20.0.

## Phase 9 balance (Task 9.4, 2026-09-23): AI kit usage and the busy()-gate fix

Task 9.4 closes two gaps the 9.1b review found and wires AI.make into the kit system 9.1-9.3 built:

1. **Busy()-gate fix (9.1b review Important finding).** `AI.make`'s `decideBlock('hold')` and
   `Ctrl.competent`'s own block-react both sat *behind* `me.busy()`, which is true for `BLOCKSTUN` —
   so a scripted bot's held block dropped to `block:false` on literally every frame it spent absorbing
   a multi-hit special, permanently zeroing `Fighter.blockAge` and defeating 9.1b's own same-frame
   `BLOCKSTUN`→`BLOCK` re-entry for every bot in the codebase (only a real player, whose input Input.js
   reads with no busy() gate at all, could ever exercise the 9.1b fix). Fixed by moving
   `decideBlock('hold')` ahead of the busy() gate (mirroring `decideHeavy`/`decideBait`'s own
   continuation checks) and reading `Ctrl.competent`'s own `me.blockAge` the same way, one line ahead
   of its own busy() gate.
   - A first cut (the reorder alone) still only ever absorbed 1-2 sub-hits of a real 5-hit special —
     `st.hold`'s own short reactive-grace value (t3: `5+[0,10)` frames) burns down every frame it's
     checked, busy or not, and is nowhere near a real special's ~40+ frame first-to-last-sub-hit span.
     `decideBlock('hold')` now always presses block while `me.state==='BLOCKSTUN'` (no countdown
     spent at all — BLOCKSTUN re-arms itself every sub-hit it blocks), and lets `st.hold`'s own
     countdown govern only the post-danger grace period it was actually designed for.
2. **`tier.kit`.** A new per-tier field (t1 `0`, t2 `0`, t3 `.5`, t4 `.8`, t5 `1`): the probability a
   t3+ AI, once eligible to consider a special, commits to holding power for "the special whose effect
   matters" — s3 when the foe holds ≥2 `PURIFIABLE` debuff stacks, s2 otherwise — instead of firing
   whatever it can already afford. Gated on `p.kit>0` before it ever touches `r`, so t1/t2 draw no
   extra rng and stay bit-for-bit identical to the pre-9.4 rule (verified against a measured pre-9.4
   golden run: same seed-7 fight log, hp and frame count for both tiers).
   - "≥2 debuffs" is read as **total stacks** across the six `PURIFIABLE` ids, not a count of distinct
     ids. Measured before choosing this reading: a distinct-id reading needs two genuinely different
     debuff types stacked at once, which this roster's own frozen kit data makes vanishingly rare for
     carl/donut/katia and *structurally unreachable* for mongo (his only pre-S3 debuff source, S1's own
     last-hit stun, is a single `maxStacks:1` application — no second id exists anywhere in his kit
     before S3 itself). A total-stack reading is reachable for carl (his own heavy applies armorBreak
     ×2 in one hit), donut and katia (their own S1s land 3-5 stacking sub-hits) — mongo remains
     structurally stuck either way, a kit-data property, not an AI defect (see below).
   - A first cut re-read the live debuff count every single frame while holding, which measurably
     starved s3: the foe's own debuff clock (150-480f, `EFFECTS`' frozen durations) is routinely
     shorter than the extra time a hold needs to climb from 200 to 300 power against a real, defending
     opponent, so a hold that legitimately qualified for s3 at one moment watched the debuff simply
     tick out a few dozen frames later and fell straight back to firing s2 the instant power crossed
     200. `st.kitLockS3` now latches the target at s3 for the rest of that hold the first time ≥2
     stacks are ever observed, even if they later decay — "the foe was significantly debuffed, so this
     hold is for the punish special," not a frame-by-frame re-litigation of an already-satisfied
     condition. This took mongo/katia/donut's own S3 usage in a 300-seed unprimed search from 0/300 to
     reliably found within the first handful of seeds (carl and donut within the first 4, katia by
     seed 39) for every champion except mongo.
3. **Champion of the Floor's cadence, 1200f → 600f.** Real boss fights against this encounter average
   300-620 frames (`f1_grull`/`f2_mother` rows below); the frozen 1200f interface meant the mechanic
   almost never fired within a real fight's length. `kitText`'s own "every 20s" line updated to "every
   10s" to match.
4. **`mother_rat` atk 50→53.** See the balance battery below — the general tier sweep and the rest of
   the boss/door bands landed back in band from items 1-2 alone; `f2_mother` alone sat 1.7pp over the
   10-35% boss band at n=60/seed-base 1. Same atk-only lever every prior `mother_rat` retune in this
   file used, hp/armor/blockProf untouched.
5. **`tests/harness.py --matrix`'s stall floor, 0.9 → 0.85 (documented margin).** See "The one marginal
   stall cell" below.

### Donut's S1/S3 gap trims (Task 9.3 carry-over) — kept, with reason

Task 9.3 trimmed donut's S1 gap 6→4 and S3 gap 8→5 when resizing both moves up to the kit table's own
hit counts (S1 3→5 hits, S3 4→6 hits), to keep each move's own total active span proportionate to its
new hit count. Re-examined here per the ruling ("look at Donut's S1/S3 gap trims... and keep or revert
with a reason") now that the busy()-gate fix changes how defenders hold block across multi-sub-hit
gaps specifically:
- The general invariant test ("for every multi-hit move (s1/s2/s3) of every def in `MOVES`, a
  continuously held block absorbs every non-unblockable sub-hit as a real block event") already covers
  donut's own trimmed-gap S1/S3 and passed both before and after this task's `decideBlock` changes —
  the trims never created a Task-9.1b-style blockstun/sub-hit-period coincidence gap.
- Both moves still land within ±0% of their pre-resize total damage (S1 `3*1.5=4.5 -> 5*0.9=4.5`; S3
  `4*3=12 -> 6*2.0=12`), per the 9.3 report.
- The new tier.kit hold mechanism depends on donut's own S1 (poison + her royalDisdain passive's
  weakness, both landing together) to seed the ≥2-debuff-stack condition her own S3 hold checks for —
  a *shorter* S1 gap (more sub-hits landing sooner) is, if anything, a small net positive for that path
  (more of S1's own sub-hits connect before a defender can react), not a regression.

**Kept, unchanged**, for all three reasons above.

### Balance battery

**Tier sweep, before this task (base `95ca6e3`) vs after (this task's final commit), n=60:**

```
                 seed-base 1              seed-base 101
tier           before   after           before   after
t1             100.0    100.0           100.0    100.0
t2             66.7     80.0            63.3     88.3
t3             45.0     48.3            50.0     55.0
t4             40.0     38.3            30.0     31.7
t5             21.7     13.3            21.7     18.3
t4-t5 gap      18.3pp   25.0pp          8.3pp*   13.4pp
# before sb101: monotone OK, t5<=30 OK, but t4-t5=8.3pp < the new >=10pp bar (*not required pre-9.4)
# after,  both: monotone OK, t1=100(>=80), t5<=30, t4-t5>=10pp -- both seed bases pass every 9.4 bar
```

n=30 (informational — noisier at this sample size, not the gate; seed-base 101 n=30 already failed
plain monotonicity pre-9.4, `t2 56.7 < t3 60.0`, an existing small-sample artifact, not something this
task introduced or needed to fix since the ruling scopes the hard bar to n=60):

```
                 seed-base 1              seed-base 101
tier           before   after           before   after
t1             100.0    100.0           100.0    100.0
t2             70.0     76.7            56.7     90.0
t3             50.0     50.0            60.0     66.7
t4             36.7     33.3            33.3     40.0
t5             23.3     16.7            13.3     10.0
```

**Doors/bosses, before vs after, n=30 (both seed bases) and n=60 (final gate):**

```
                        seed-base 1                    seed-base 101
encounter      band     before(30) after(30) after(60)  before(30) after(30) after(60)
f1_goblin      >=85%    100.0      100.0     100.0       93.3       100.0     100.0
f1_skel        >=85%    100.0      100.0     100.0       96.7       100.0     100.0
f1_goblin2     >=85%    96.7       96.7      98.3         86.7       96.7      98.3
f1_shaman      n/a      83.3       90.0      90.0         90.0       83.3      81.7
f1_hob         40-70%   63.3       63.3      60.0         46.7       46.7      50.0
f1_grull       10-35%   26.7       6.7       18.3         23.3       20.0      20.0
f2_grub        n/a      83.3       80.0      81.7         80.0       76.7      71.7
f2_skel2       n/a      90.0       96.7      91.7         90.0       90.0      88.3
f2_shaman2     n/a      66.7       60.0      68.3         56.7       63.3      60.0
f2_hob2        n/a      56.7       56.7      58.3         53.3       46.7      48.3
f2_grub2       n/a      80.0       70.0      75.0         70.0       53.3      56.7
f2_mother      10-35%   20.0       30.0*     35.0**       23.3       30.0*     33.3**
# *  measured before the mother_rat atk 50->53 retune (item 4 above)
# ** measured AFTER the retune -- the number the gate is actually scored against
```

`f1_grull` at n=30/seed-base-1 (6.7%) is small-sample noise, not a real under-band result — n=60 for
the same seed base (18.3%) sits comfortably mid-band; both n=60 numbers pass. Every required
combination at the n=60 gate — tier sweep monotone with t1≥80/t5≤30/t4-t5≥10pp, both seed bases; doors
1-3 ≥85%; f1_hob 40-70%; f1_grull and f2_mother 10-35% (after the mother_rat retune) — passes.

### The one marginal `--matrix` stall cell

Pre-9.4 (base `95ca6e3`), `mongo/hobgoblin/t5/seed2` measured `frames_total=2517, ko_ticks=722` —
`2517+722=3239`, one tick under `3600*0.9=3240`, the exact cell and margin the 9.1b review's own
independent re-run already found and confirmed pre-existing/unrelated to that task. Post-9.4, that
specific cell now clears the line (`2522+722=3244`), but a *different* cell now sits on the wrong side
of it: `carl/hobgoblin/t5/seed2` measured `frames_total=2051, ko_ticks=1187` — `2051+1187=3238`, two
ticks under. Both cells are real, zero-error, healthy soaks (3-4 completed fights in 60s against a
slow, defensive tank matchup) — not stalls in any meaningful sense — that happen to sit within a
handful of ticks of an arbitrary 90%-of-budget line; this task's own busy()-gate fix and tier.kit
shifted a few tiers' block/special cadence by exactly enough frames to move which single cell is
closest to that line. Retuning boss/mob stats to chase whichever cell is currently marginal would just
relocate the same coin-flip to a different cell the next time an unrelated AI change nudges the
numbers by a few frames — not a fix for a threshold this close, and not something `retune by
stats/AI fields only` is meant to cover. Resolved per the ruling's own second option: raised
`tests/harness.py --matrix`'s stall floor from `0.9` to `0.85` (`tests/harness.py`, documented margin
in the code comment) — `3600*0.85=3060` leaves both measured cells (3238, 3239) a comfortable ~180-tick
buffer while still catching a genuine stall (frames_total+ko_ticks stuck near 0). `--matrix` measured
clean (`exit 0`, 216 cells, 0 errors) after the change.

### Full gate (this task's final commit)

| Check | Result |
|---|---|
| `python3 tools/build.py --check` | exit 0 |
| `python3 tests/harness.py --unit` | 600/0 (60 new: 2 tier.kit hold-target tests, 1 t1/t2 bit-identical test, 1 AI.make block-hold-through-BLOCKSTUN test, 1 Ctrl.competent block-hold test, 1 rename + 1 genuine-unprimed-usage test, plus the pre-existing far/near-medium and t4-boss-special tests updated for the new behavior, plus the Champion of the Floor cadence test updated for 600f) |
| `python3 tests/harness.py --matrix` | exit 0, 216 cells, 0 errors |
| `python3 tests/harness.py --e2e --seed 7` | exit 0, `errors: []` |
| `python3 tests/harness.py --tutorial --seed 1` | exit 0, `tutorialDone:true, goldGranted:300, errors:[]` |
| `python3 tests/harness.py --screens-smoke` | exit 0, every screen `errors: []` |
| `python3 tests/harness.py --phone-check` | exit 0 |
| `python3 tests/harness.py --perf 600` | exit 0, 0.31 ms/frame (well under the 6 ms gate) |
| `python3 tests/batch.py --n 60 --seed-base 1` / `--seed-base 101` | tier sweep + doors/bosses, see tables above — all bands pass |

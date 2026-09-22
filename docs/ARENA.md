# Carl's Doorway Brawl: rubric and progress log

Rubric table lands in Phase 5 (same format as Carls-Dash docs/PARITY.md: criterion, status, verification command).

## Progress log

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

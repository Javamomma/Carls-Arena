# Carl's Doorway Brawl: rubric and progress log

Rubric table lands in Phase 5 (same format as Carls-Dash docs/PARITY.md: criterion, status, verification command).

## Progress log

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

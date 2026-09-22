# Carl's Doorway Brawl: rubric and progress log

Rubric table lands in Phase 5 (same format as Carls-Dash docs/PARITY.md: criterion, status, verification command).

## Progress log

- 2026-09-21 16:19 — Phase 1 complete. Unit tests: 26 passing. Soaks: 4 x 300 s (basic/brawl x seeds 1,2) clean. Screenshot verified renderer output: two colored fighters, doorway structure, green health bars, gold power segments, timer, special move buttons, and combo counter. Six gameplay control checks from Task 1.7 Step 3 (light chains, medium closes distance, heavy charges, block/parry timing, dash evasion, special button) remain unverified pending human hand-play in browser.
- 2026-09-21 — Final-review fix wave for Phases 0-1: (1) two-thumb touch tracked per zone via a pointer Map so a second finger can no longer steal or clear the other's hold, fixing block drop and stuck-heavy; (2) `Fight.step` now detects both sides' hits against pre-resolve state before applying either, so a mutual trade lands both hits instead of only p1's; (3) `Audio.*` calls removed from `Fight` and dispatched from `G.onEvent` per event type, keeping the sim free of presentation-layer calls; (4) `tests/harness.py --sim` now restarts the fight on KO and reports a running `frames_total`/`fights` across the soak, failing under 90% of the requested duration, instead of idling through the rest of the budget after an early KO; (6) keyboard actions no longer queue while `G.state!=='FIGHT'`, fixing delayed inputs and stuck heavy after resuming from pause; (7) `AI.make` throws on an unknown profile instead of silently falling back to basic. Unit tests: 32 passing. Soaks re-run under the new `frames_total` rule (all exit 0, threshold 16200 of 18000): basic/seed1 `frames_total` 16636 (`fights` 17), basic/seed2 `frames_total` 16612 (`fights` 18), brawl/seed1 `frames_total` 16363 (`fights` 20), brawl/seed2 `frames_total` 16400 (`fights` 19).
- 2026-09-21 — Task 2.8: added the `brute` AI profile (slow `react`, heavy-happy) and a heavy-charge-hold behavior in `src/55_ai.js`, gated on the `p.heavy>0` short-circuit so `dummy`/`basic`/`brawl` draw the identical rng sequence they always did (the naive version broke the seeded 60s soak by inserting an unconditional extra `rng.next()` per decision, shifting every downstream roll). `ENCOUNTERS.f1_hob` now uses tier `'brute'`. Added `tests/harness.py --matrix`, which runs the full 36-cell soak (see below) as a single in-page evaluate() per cell (JS-side restart-on-KO loop) so a KO is caught the very next tick instead of at the next Python-side poll, keeping every cell's `frames_total` comfortably over the 90% floor. Unit tests: 61 passing.
- 2026-09-21 20:31 — Task 2.9: Phase 2 close-out. Added `tests/harness.py --perf N` (Ctrl.random bot vs brawl AI, `G.sim=true`, `performance.now()` confined to the page-evaluate); green at `ms_per_frame` 0.056 (`ms_step` 0.003, `ms_render` 0.053), far under the 6 ms gate. `Render` now bakes HUD statics (title glyph, the 4 chevron fill-level variants, floor-line text keyed by its label) into offscreen canvases via `Render.hudCache()` instead of redrawing them every frame; portraits were already cached per-look from Task 2.2. Fixed a determinism gap: `G.tick()` now ages `FX` itself once per sim step whenever `G.sim` is true (both the normal and cinematic branches), instead of relying on `G.loop()`'s wall-clock `requestAnimationFrame` cadence, so `--sim --shot` screenshots no longer depend on real time elapsed between harness round trips. Replaced the four emoji on-screen buttons with inline monochrome SVG icons (shield, fist, boot, lightning bolt) using `currentColor`, so they inherit `.cbtn`'s gold and correctly invert on `.ready`. Unified the `--sim` and `--matrix` soak loops behind one `build_soak_js()` restart-on-KO implementation in `tests/harness.py`, catching a KO the tick it happens instead of at the next 60-tick/probe boundary; verified `--sim --seconds 60`, `--sim --probe`, `--sim --pose`, `--sim --cinematic`, and `--sim --encounter` all still work. Small cleanups: dropped the dead `HITSTOP` constant, documented why the brute AI's heavy-hold counter being blind to interruption is safe today, and removed the silent try/catch around the HUD portrait `drawImage` calls. Generated the `docs/shots/` screenshot set (see table below) and un-ignored `docs/shots/*.png`. Unit tests: 63 passing.
- 2026-09-21 — Final-review fix wave for Phase 2 (in progress). (1) KO slow-mo actually plays now: `G.onEvent('ko')` no longer flips state synchronously; `G.tick()` keeps ticking through `FIGHT` while `fight.over`, counting `fight.slowmo` down every 4th tick, and only calls the new `G.showResult(winner)` once it hits 0. (2) `FX.update()`/`Camera.update()` moved into `G.tick()` unconditionally (both the cinematic and normal branches), once per call, and dropped from `G.loop()`'s `requestAnimationFrame` cadence entirely, so both now advance on the fixed sim step instead of display refresh (fixes double-speed FX/camera on >60Hz displays) and correctly freeze while `PAUSED`; `G.debugCinematic()`'s redundant `for(...20) FX.update()` loop (flagged by the Task 2.9 review) is gone, replaced by stepping until the card is actually up and past its slide-in. (3) Wall clamp widened: `EDGE_PAD=110` (40_movedata.js) replaces the old `width/2+8` inset in `Fighter.tick`'s clamp, so a pinned fighter's rig no longer renders off-canvas (`p2-goblin.png`, regenerated in the art-pass commit). (4) `Fight` now derives a `presRng` stream from the seed that the sim never reads; `Audio.announce`/`pickLine` calls in `G` were switched from `fight.rng` to `fight.presRng` so announcer line picks can no longer perturb crit rolls or any other sim outcome — this was a plan defect (the frozen interface specified the fight rng). `tests/harness.py`'s soak-floor check (`--sim` and `--matrix`) now also credits back `ko_ticks` (wall-clock ticks legitimately spent in the KO slow-mo grace period from fix (1), which don't advance `Fight.frame`) against the 90% floor — see the re-run matrix below. Unit tests: 66 passing so far.

## Phase 2 exit (2026-09-21)

| Criterion | Status | Verification |
|---|---|---|
| Unit tests ≥ 60 pass | 63 passing, 0 failing | `python3 tests/harness.py --unit` |
| Soak matrix clean (36 cells) | 36/36 cells, 0 errors, every `frames_total` well over the 90% floor | `python3 tests/harness.py --matrix` |
| Perf < 6 ms/frame | `ms_per_frame` 0.056 (`ms_step` 0.003, `ms_render` 0.053) | `python3 tests/harness.py --perf 600` |
| Screenshot set present | 8 shots in `docs/shots/`: `p2-idle.png` (Carl, idle stance), `p2-light3.png` (Carl, light-3 jab extended), `p2-heavy.png` (Carl, heavy overhead wind-up), `p2-block.png` (Carl, guard raised, parry-window indicator lit), `p2-hit.png` (Carl, hitstun recoil), `p2-s3.png` (Carl, S3 flurry mid-swing), `p2-goblin.png` (Carl vs. Goblin Scavenger, `FLOOR 1 • THE DEPTHS`, both HP bars damaged from a real 6 s fight), `p2-card.png` (S3 cinematic name card, "CARL / SPECIAL 3") | `python3 tests/harness.py --sim --seconds 1 --pose <key> --shot docs/shots/p2-<key>.png`; `--sim --seconds 6 --encounter f1_goblin --shot docs/shots/p2-goblin.png`; `--cinematic --shot docs/shots/p2-card.png` |

## Phase 2 soak matrix (2026-09-21, re-run post-fixwave)

`python3 tests/harness.py --matrix`: p1 in {carl, katia} x p2 in {goblin, hobgoblin, carl} x ai in {basic, brawl, brute} x seed in {1, 2}, 36 cells, each a restart-on-KO soak over 120 simulated seconds (7200 frames requested). Ran in one Chromium instance, a fresh page per cell. Exit 0; no page or console errors; every cell's `frames_total` cleared the 90%-of-requested floor once `ko_ticks` (wall-clock ticks legitimately spent in the KO slow-mo grace period, which don't advance `Fight.frame`) is credited back — see the fix-wave note on `tests/harness.py`'s soak-floor check. Total wall time 2.6 s for all 36 cells.

**These numbers moved from the original Phase 2 table above for real reasons, not noise:** the KO fix wave (1) made the 90-frame KO slow-mo actually play (previously dead), so every KO now spends ~360 real ticks counting it down before a fight restarts — fewer fights complete per 120s soak, hence lower `fights`/`frames_total` across the board; and the announcer RNG split (4) stopped `Audio.announce` from drawing off the fight's own `rng` stream, so crit rolls (and everything downstream of them) no longer shift depending on which announcer lines happened to fire — `--matrix`'s bot doesn't wire `onEvent`, so this table's numbers were already announcer-independent before and after; the RNG split's effect here is that they're now also identical to what a live, `onEvent`-wired playthrough at the same seed would produce, which was not true before.

```
p1     p2         ai     seed  fights  p1wins  frames_total  errors
carl   goblin     basic  1     11      10      3423          0
carl   goblin     basic  2     10      9       3537          0
carl   goblin     brawl  1     10      9       3446          0
carl   goblin     brawl  2     11      10      3387          0
carl   goblin     brute  1     11      10      3156          0
carl   goblin     brute  2     11      10      3211          0
carl   hobgoblin  basic  1     6       5       5087          0
carl   hobgoblin  basic  2     6       5       5079          0
carl   hobgoblin  brawl  1     6       4       5070          0
carl   hobgoblin  brawl  2     6       4       5065          0
carl   hobgoblin  brute  1     6       5       5092          0
carl   hobgoblin  brute  2     6       5       5061          0
carl   carl       basic  1     5       4       5437          0
carl   carl       basic  2     5       4       5312          0
carl   carl       brawl  1     5       3       5233          0
carl   carl       brawl  2     5       2       5127          0
carl   carl       brute  1     6       3       5035          0
carl   carl       brute  2     6       4       5018          0
katia  goblin     basic  1     11      10      3422          0
katia  goblin     basic  2     10      9       3547          0
katia  goblin     brawl  1     10      9       3464          0
katia  goblin     brawl  2     11      10      3397          0
katia  goblin     brute  1     11      10      3156          0
katia  goblin     brute  2     11      10      3211          0
katia  hobgoblin  basic  1     6       5       4760          0
katia  hobgoblin  basic  2     7       6       4733          0
katia  hobgoblin  brawl  1     7       6       4726          0
katia  hobgoblin  brawl  2     7       6       4721          0
katia  hobgoblin  brute  1     7       6       4748          0
katia  hobgoblin  brute  2     6       5       4835          0
katia  carl       basic  1     6       4       5092          0
katia  carl       basic  2     6       4       5078          0
katia  carl       brawl  1     6       3       5066          0
katia  carl       brawl  2     6       4       5066          0
katia  carl       brute  1     6       2       4809          0
katia  carl       brute  2     7       4       4707          0
# 36 cells, 2.6s total wall time
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

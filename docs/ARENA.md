# Carl's Doorway Brawl: rubric and progress log

Rubric table lands in Phase 5 (same format as Carls-Dash docs/PARITY.md: criterion, status, verification command).

## Progress log

- 2026-09-21 16:19 — Phase 1 complete. Unit tests: 26 passing. Soaks: 4 x 300 s (basic/brawl x seeds 1,2) clean. Screenshot verified renderer output: two colored fighters, doorway structure, green health bars, gold power segments, timer, special move buttons, and combo counter. Six gameplay control checks from Task 1.7 Step 3 (light chains, medium closes distance, heavy charges, block/parry timing, dash evasion, special button) remain unverified pending human hand-play in browser.
- 2026-09-21 — Final-review fix wave for Phases 0-1: (1) two-thumb touch tracked per zone via a pointer Map so a second finger can no longer steal or clear the other's hold, fixing block drop and stuck-heavy; (2) `Fight.step` now detects both sides' hits against pre-resolve state before applying either, so a mutual trade lands both hits instead of only p1's; (3) `Audio.*` calls removed from `Fight` and dispatched from `G.onEvent` per event type, keeping the sim free of presentation-layer calls; (4) `tests/harness.py --sim` now restarts the fight on KO and reports a running `frames_total`/`fights` across the soak, failing under 90% of the requested duration, instead of idling through the rest of the budget after an early KO; (6) keyboard actions no longer queue while `G.state!=='FIGHT'`, fixing delayed inputs and stuck heavy after resuming from pause; (7) `AI.make` throws on an unknown profile instead of silently falling back to basic. Unit tests: 32 passing. Soaks re-run under the new `frames_total` rule (all exit 0, threshold 16200 of 18000): basic/seed1 `frames_total` 16636 (`fights` 17), basic/seed2 `frames_total` 16612 (`fights` 18), brawl/seed1 `frames_total` 16363 (`fights` 20), brawl/seed2 `frames_total` 16400 (`fights` 19).
- 2026-09-21 — Task 2.8: added the `brute` AI profile (slow `react`, heavy-happy) and a heavy-charge-hold behavior in `src/55_ai.js`, gated on the `p.heavy>0` short-circuit so `dummy`/`basic`/`brawl` draw the identical rng sequence they always did (the naive version broke the seeded 60s soak by inserting an unconditional extra `rng.next()` per decision, shifting every downstream roll). `ENCOUNTERS.f1_hob` now uses tier `'brute'`. Added `tests/harness.py --matrix`, which runs the full 36-cell soak (see below) as a single in-page evaluate() per cell (JS-side restart-on-KO loop) so a KO is caught the very next tick instead of at the next Python-side poll, keeping every cell's `frames_total` comfortably over the 90% floor. Unit tests: 61 passing.

## Phase 2 soak matrix (2026-09-21)

`python3 tests/harness.py --matrix`: p1 in {carl, katia} x p2 in {goblin, hobgoblin, carl} x ai in {basic, brawl, brute} x seed in {1, 2}, 36 cells, each a restart-on-KO soak over 120 simulated seconds (7200 frames requested). Ran in one Chromium instance, a fresh page per cell. Exit 0; no page or console errors; every cell's `frames_total` cleared the 90%-of-requested floor (6480) by a wide margin. Total wall time 2.8 s for all 36 cells (well under the 40 s/cell budget that would have triggered the 60 s-per-cell fallback, so that fallback was not needed).

```
p1     p2         ai     seed  fights  p1wins  frames_total  errors
carl   goblin     basic  1     18      17      6861          0
carl   goblin     basic  2     18      17      6865          0
carl   goblin     brawl  1     19      18      6775          0
carl   goblin     brawl  2     19      18      6771          0
carl   goblin     brute  1     17      16      6791          0
carl   goblin     brute  2     17      16      6770          0
carl   hobgoblin  basic  1     7       6       6782          0
carl   hobgoblin  basic  2     8       7       6781          0
carl   hobgoblin  brawl  1     7       5       6776          0
carl   hobgoblin  brawl  2     7       4       6764          0
carl   hobgoblin  brute  1     8       6       6766          0
carl   hobgoblin  brute  2     8       6       6742          0
carl   carl       basic  1     7       6       6788          0
carl   carl       basic  2     7       6       6781          0
carl   carl       brawl  1     7       4       6775          0
carl   carl       brawl  2     7       3       6774          0
carl   carl       brute  1     8       5       6719          0
carl   carl       brute  2     8       6       6704          0
katia  goblin     basic  1     18      17      6860          0
katia  goblin     basic  2     18      17      6862          0
katia  goblin     brawl  1     20      19      6781          0
katia  goblin     brawl  2     20      19      6784          0
katia  goblin     brute  1     19      18      6775          0
katia  goblin     brute  2     19      18      6765          0
katia  hobgoblin  basic  1     10      9       6784          0
katia  hobgoblin  basic  2     10      9       6792          0
katia  hobgoblin  brawl  1     10      8       6768          0
katia  hobgoblin  brawl  2     11      9       6756          0
katia  hobgoblin  brute  1     9       8       6775          0
katia  hobgoblin  brute  2     9       8       6765          0
katia  carl       basic  1     7       5       6785          0
katia  carl       basic  2     7       5       6772          0
katia  carl       brawl  1     8       5       6770          0
katia  carl       brawl  2     8       5       6765          0
katia  carl       brute  1     9       5       6738          0
katia  carl       brute  2     8       5       6731          0
# 36 cells, 2.8s total wall time
```

## Deferred from the Phase 1 final review (2026-09-21)

Not fixed yet; triage before or during Phase 2.
- Spec gap: mash-blocking (6 frames on, 1 off) out-parries holding block about 7:1. Fix in Phase 2 task 2.6 with a parry-attempt lockout.
- `G.startFight` resets `Input.q`/`held` but not `Input._ptrs`; a restart mid-touch can carry stale pointer records.
- Pointer zone is fixed at pointerdown; a finger that swipes across the def/off boundary keeps its original zone.
- `src/80_game.js` looks up the three special buttons every simulated frame; cache the nodes at init.
- Global `Audio` shadows the browser constructor of that name.
- `tools/build.py` sorts lexicographically, so a future `src/100_*.js` would sort before `src/10_util.js`.
- No input buffer: chain taps arriving during startup or active frames are dropped (all measured tap periods still reach the five-hit knockdown).
- Double KO awards p2; attacker combo never resets while the foe sits in BLOCK; hitstop pauses the round clock (~3% at current hit rates).
- Harness restart block names its variable `ctrl2` while feeding `ctrl1` (cosmetic).
- `src/90_tests.js` is the largest source file; split into `9x_*.js` files once it passes ~200 lines.

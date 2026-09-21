# Carl's Doorway Brawl: rubric and progress log

Rubric table lands in Phase 5 (same format as Carls-Dash docs/PARITY.md: criterion, status, verification command).

## Progress log

- 2026-09-21 16:19 — Phase 1 complete. Unit tests: 26 passing. Soaks: 4 x 300 s (basic/brawl x seeds 1,2) clean. Screenshot verified renderer output: two colored fighters, doorway structure, green health bars, gold power segments, timer, special move buttons, and combo counter. Six gameplay control checks from Task 1.7 Step 3 (light chains, medium closes distance, heavy charges, block/parry timing, dash evasion, special button) remain unverified pending human hand-play in browser.
- 2026-09-21 — Final-review fix wave for Phases 0-1: (1) two-thumb touch tracked per zone via a pointer Map so a second finger can no longer steal or clear the other's hold, fixing block drop and stuck-heavy; (2) `Fight.step` now detects both sides' hits against pre-resolve state before applying either, so a mutual trade lands both hits instead of only p1's; (3) `Audio.*` calls removed from `Fight` and dispatched from `G.onEvent` per event type, keeping the sim free of presentation-layer calls; (4) `tests/harness.py --sim` now restarts the fight on KO and reports a running `frames_total`/`fights` across the soak, failing under 90% of the requested duration, instead of idling through the rest of the budget after an early KO; (6) keyboard actions no longer queue while `G.state!=='FIGHT'`, fixing delayed inputs and stuck heavy after resuming from pause; (7) `AI.make` throws on an unknown profile instead of silently falling back to basic. Unit tests: 32 passing. Soaks re-run under the new `frames_total` rule (all exit 0, threshold 16200 of 18000): basic/seed1 `frames_total` 16636 (`fights` 17), basic/seed2 `frames_total` 16612 (`fights` 18), brawl/seed1 `frames_total` 16363 (`fights` 20), brawl/seed2 `frames_total` 16400 (`fights` 19).

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

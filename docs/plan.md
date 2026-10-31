# Plan: an earnable rank for every champion, on a save that can't be lost by accident

Source: the 2026-10-31 audit (`~/audits/reports/Carls-Arena/2026-10-31.md`) and its dev-team task
(`~/audits/reports/Carls-Arena/2026-10-31-devteam-task.md`). Base branch: `main` (audited at 8a217b2).

Every task is tests-first: the new tests are written and seen failing against the old code, then
the fix makes them pass, with all existing checks still green (see "Verify" in AGENTS.md).

Not Phase 10: no 6-star champions, ISO curves, catalyst tiers, signature levels, fragments or
mastery tree. The single shop catalyst is the only piece taken from that plan.

## 1. Save hardening — `save-hardening` — status: done (17c8e32)
Goal: a damaged save can't stop the game from starting, an unreadable save is never wiped without a
backup, and a failed write is no longer silent.
Acceptance:
- A new harness mode `--saves` loads the page with a prepared save already in `localStorage` (set
  before any game script runs) and checks the result. It covers four saves, each an otherwise valid
  v2 save with one of `cats`, `energy`, `arena` or `stats` set to `null`. For each, the game starts
  (`G` exists), the broken record is repaired to its defaults, and every other field keeps its value.
  These four checks fail on 8a217b2.
- `Meta.migrate` normalises every nested record before migrating (`cats`, `energy`, `arena`,
  `stats`, `settings`, `roster` and each roster entry, `floors` and each floor, `leaderboard`,
  `pity`). A record that isn't a plain object (null, array, number, string) is replaced by its
  default, and missing keys are filled in. Nothing else in the save changes.
- Before any reset (JSON that won't parse, a non-object, an unknown `v`), the raw string is copied
  to `carlsArena.v1.bak`. If that copy fails, the original key is not overwritten. `--saves`
  checks the garbage-string and unknown-version cases (the `.bak` equals the original string, and
  the game starts) and the case where writing the backup fails (the original key is unchanged).
- `Save.put()` returns `true` or `false`. When a write fails, one quiet note ("Progress isn't saving
  on this device.") appears once per session, not on every fight or every write.
Files: `src/12_meta.js`, `src/15_save.js`, `src/85_screens.js` and/or `src/00_head.html` (the
note), `src/90_tests.js`, `tests/harness.py`, `index.html`, `AGENTS.md` (add `--saves` to Verify).

## 2. Stable fight IDs — `fight-ids` — status: done (e9fe0d1)
Goal: campaign progress is stored per fight, not per list position, so reordering doors can never
move a player's progress onto a different fight.
Acceptance:
- Save version 3 stores completion per fight ID. Open and locked doors are worked out from
  completion and today's `FLOORS` order.
- The v2→v3 migration uses a frozen copy of today's `FLOORS` order kept in the migration code,
  never whatever `FLOORS` says at migration time. The raw v2 string is backed up to
  `carlsArena.v1.bak` before the upgrade is written.
- Real v2 fixtures in `tests/fixtures/` (the default save as 8a217b2 writes it, and a played save
  with floor 1 done and floor 2 part-done) load through `--saves`. Every field keeps its value,
  `floors` becomes the per-ID record with the same doors done/open, and an unknown extra field is
  preserved.
- A test swaps two fights in `FLOORS` and shows each fight keeps its own progress.
- Save key stays `carlsArena.v1`.
Files: `src/12_meta.js`, `src/85_screens.js` (`lastFloor`, floor tabs), `src/90_tests.js`,
`tests/harness.py` (the e2e helper that walks `Save.data.floors`), `tests/fixtures/*.json`,
`index.html`.

## 3. A rank-up catalyst in the shop — `shop-catalyst` — status: in progress at 600 gold; merge waits for Arshia to confirm the price
Goal: every champion can earn its next rank through normal play.
Acceptance:
- One new `Meta.SHOP_ITEMS` entry, a "choose a class" catalyst bought with gold, and a class picker
  on the shop screen (the four playable classes: brawler, caster, trickster, tank).
- The price is the one Arshia picks (the recommendation is 600 gold; reasoning in the commit).
- Unit tests: buying grants one catalyst of the chosen class and deducts the gold; refused when
  short; Carl can rank up with a bought brawler catalyst.
- Optional, only if Arshia says yes: a boss drops a catalyst of the active champion's class
  instead of the boss's own class.
Files: `src/12_meta.js`, `src/85_screens.js`, `src/00_head.html` (picker styles), `src/90_tests.js`,
`index.html`.

## 4. Journey tests — `journey-tests` — status: todo
Goal: tests that earn resources the way a player does.
Acceptance: from a fresh save, with no injected gold, catalysts or energy, the test plays or
simulates the path (tutorial, campaign doors, arena runs, crystals, shop) through the game's own
reward code until each of the four champions completes its first rank-up. Existing isolated tests
stay.
Files: `src/90_tests.js` and/or `tests/harness.py`.

## 5. Energy refresh and a campaign-complete screen — `energy-campaign` — status: todo
Goal: waiting on the map refills energy, and finishing both bosses tells the player what's next.
Acceptance:
- `Energy.tick()` runs inside `Quest.canStart()`/`Quest.start()` and when the window regains focus.
  A test waits on the map with an injected `Energy.now` and can start a fight without leaving it.
- Once both floor bosses are beaten, a "campaign complete" screen appears, with a button to the
  arena.
Files: `src/12_meta.js`, `src/80_game.js`, `src/85_screens.js`, `src/00_head.html`,
`src/90_tests.js`, `index.html`.

## 6. Small fixes — `small-fixes` — status: todo
Acceptance: `--unit` fails on console errors, like the other modes; the arena leaderboard row is
built with `textContent`.
Files: `tests/harness.py`, `src/85_screens.js`, `src/90_tests.js`, `index.html`.

## 7. Reproducible checks and CI — `ci` — status: todo
Acceptance: pinned `requirements.txt` (Playwright); README developer setup including
`python -m playwright install chromium`; AGENTS.md (done at setup) kept current; one GitHub
Actions workflow running `build.py --check`, `--unit`, `--tutorial --seed 1`, `--e2e --seed 1`,
`--screens-smoke`, `--phone-check` (and `--saves`) on pushes and PRs to `main`. The workflow is
advisory until Arshia changes Pages or branch protection.
Files: `requirements.txt`, `README.md`, `.github/workflows/checks.yml`, `AGENTS.md`.

## 8. Player build vs test build — `build-split` — status: todo
Goal: phones stop downloading the test suite (41.8% of the page today).
Acceptance: `tools/build.py` writes a player `index.html` without `src/90_tests.js` and a test
page the harness loads; `--check` verifies both; the player page starts and plays one fight in a
smoke check; the harness passes on the test page.
Files: `tools/build.py`, `tests/harness.py`, the new test page, `index.html`, README, AGENTS.md,
the CI workflow.

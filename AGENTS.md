# Carl's Doorway Brawl (Carls-Arena)

A one-thumb, tap-and-swipe browser fighter in the Dungeon Crawler Carl universe. It ships as one
offline HTML file (`index.html`, served by GitHub Pages from `main`). Four champions, two campaign
floors, an endless arena, a shop (the "kiosk"), crystals, ranks and stars. The save lives in
`localStorage` under the key `carlsArena.v1`.

Base branch: main

## Stack
- Vanilla JavaScript and HTML/CSS. No runtime dependencies, no network, no assets. The sprite atlas
  stays opt-in (off by default).
- `src/*` is concatenated in filename order into `index.html` by `tools/build.py` (Python 3).
- Unit tests are in-page: `src/90_tests.js` (`Test.add(name, fn)`; helpers `eq`, `ok`, `threw`).
- `tests/harness.py` drives headless Chromium through Python Playwright and runs every check mode.

## Setup
- On this Mac, `python3.14` has Playwright and the default `python3` does not. Use `python3.14` for
  the harness. On a new machine: `python3.14 -m pip install playwright` and
  `python3.14 -m playwright install chromium`.

## Build
- Edit files in `src/`, then run `python3 tools/build.py`. Commit the rebuilt `index.html` together
  with the `src/` change.
- Never hand-edit `index.html`.
- `python3 tools/build.py --check` exits 1 if `index.html` is stale.

## Verify
Run this before you stop. It must print `ALL GREEN`:

```sh
python3 tools/build.py --check && python3.14 tests/harness.py --unit >/dev/null && python3.14 tests/harness.py --tutorial --seed 1 >/dev/null && python3.14 tests/harness.py --e2e --seed 1 >/dev/null && python3.14 tests/harness.py --screens-smoke >/dev/null && python3.14 tests/harness.py --phone-check >/dev/null && echo ALL GREEN
```

To see why a mode failed, run it again without `>/dev/null` and read the JSON it prints. `--unit`
lists every test with `ok:false` and its error.

Run only one harness command at a time. Each one starts a browser, and other agents share this
machine.

## Conventions
- Comments: one sentence saying *why*. Don't narrate task history ("Task 6.1", "Fix-wave item 5");
  git keeps the history.
- Randomness goes through `RNG(seed)`. The wall clock enters only through `Energy.now`, which tests
  can replace.
- Content lives in tables (`CHAMPS`, `DEFS`, `ENCOUNTERS`, `FLOORS`, `Meta.SHOP_ITEMS`). Screens
  read the tables and don't hard-code content.
- `85_screens.js` is the DOM layer. Game state changes go through Meta, Quest, Rewards, Roster,
  Arena and Crystal (`12_meta.js`).
- Build DOM text with `textContent`, not `innerHTML`, when the text comes from the save.
- Never change the save key `carlsArena.v1`. Any change to the save's shape needs a migration and a
  test that an older save keeps its progress.

## Don't change
- Combat feel and balance numbers (moves, champion and mob stats, AI tiers, encounter tiers and
  multipliers). The bot-tier win-rate bands and floor-boss gates must stay where they are.
- `tests/batch.py` inputs.
- `docs/superpowers/plans/` (historical plans), `docs/reference/` (ignored by git).
- `docs/shots/*.png`, unless the task is about screenshots.
- Out of scope unless a task says otherwise: Phase 10 (6-star champions, ISO curves, catalyst
  tiers, signature levels, fragments, masteries), replayable fights, practice drills.

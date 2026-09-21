# Carl's Doorway Brawl

One-on-one tap-and-swipe fighter in the Dungeon Crawler Carl universe. Single HTML file, no assets, no build besides `python3 tools/build.py`.

- Edit files in `src/`, then `python3 tools/build.py` writes `index.html`.
- `python3 tests/harness.py --unit` runs the in-page unit tests headless.
- `python3 tests/harness.py --sim --seconds 60 --bot random --ai basic` soaks the fight loop.
- Plan: `docs/superpowers/plans/2026-09-21-carls-arena-fighter.md`.

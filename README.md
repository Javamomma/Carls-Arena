# Carl's Doorway Brawl

One-on-one tap-and-swipe fighter in the Dungeon Crawler Carl universe. Single HTML file, no assets, no build besides `python3 tools/build.py`.

## How to play

Open `index.html`. The title screen offers CAMPAIGN, ARENA, ROSTER, KIOSK, and EXHIBITION.

- **CAMPAIGN** opens the floor map: a vertical column of doors (five per floor) ending in a boss
  door. Doors unlock left-to-right as you clear the one before them; each costs 1 energy (10 max,
  regenerating over time) and pays out gold, ISO, and XP for your active champion on a win, plus
  units and a class catalyst for a boss win. Clearing a floor's boss opens the next floor.
- **ROSTER** shows every champion you own, star rating, rank, and level. LEVEL UP spends ISO,
  RANK UP spends that champion's class catalyst, and SELECT makes a champion the one who actually
  fights doors/arena runs.
- **KIOSK** (the SPONSOR PERK KIOSK) sells crystals with gold or units, plus an ISO pack for gold.
  Opening a crystal from here or the CRYSTALS screen grants a new champion or, on a duplicate, star
  shards toward that champion's next star.
- **ARENA** is an endless, energy-free gauntlet: win to raise your streak (tougher every couple of
  wins) and bank gold, or lose and the streak resets. BEST tracks your all-time high streak.

Touch controls: BLOCK (bottom-left), PUNCH/KICK/POWER (bottom-right, POWER opens a special picker
once enough power is charged). Same moves work from a keyboard in a desktop browser for testing.

## Development

- Edit files in `src/`, then `python3 tools/build.py` writes `index.html`.
- `python3 tests/harness.py --unit` runs the in-page unit tests headless.
- `python3 tests/harness.py --sim --seconds 60 --bot random --ai basic` soaks the fight loop.
- `python3 tests/harness.py --e2e --seed 1` runs the full crystals → roster → quest → rewards →
  arena loop headless; add `--loops 20` for a longer menu+fight soak.
- Plan: `docs/superpowers/plans/2026-09-21-carls-arena-fighter.md`.

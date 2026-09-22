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

## Adding your own art

Every fighter is drawn by a stylized vector rig by default — no image assets ship with the game,
and nothing is fetched over the network unless you turn this on. If you'd rather draw a character
by hand, you can drop in a sprite sheet per look; it replaces the rig for that character only,
pose by pose, falling back to the rig for any pose the sheet doesn't cover.

**Enable it** with Settings → USE SPRITE ATLAS, or by loading the page with `?atlas=1` in the URL.
Off (the default), the game never fetches anything — this is a purely optional, offline-friendly
feature.

**Folder layout**, one folder per look id (the same ids the roster/encounters use — `carl`,
`katia`, `goblin`, `hobgoblin`, `donut`, `skeleton`, `shaman`, `grub`, `mongo`, `grull`,
`mother_rat`):

```
assets/
  carl/
    sheet.png   # one sprite sheet, any grid layout you like
    sheet.json  # the manifest below
  donut/
    sheet.png
    sheet.json
```

A look with no folder, no `sheet.json`, or a `sheet.png` that fails to load just draws the rig —
silently, with no error and no console noise, at the exact frame it would've drawn anyway.

**Manifest** (`sheet.json`):

```json
{
  "frame": {"w": 96, "h": 128, "anchorX": 48, "anchorY": 120},
  "poses": {
    "idle": [[0, 0], [96, 0]],
    "light1": [[0, 128], [96, 128], [192, 128]]
  }
}
```

- `frame` is the pixel size every frame in the sheet shares, plus the **anchor**: the point inside
  each frame — in frame-local pixels, from its top-left corner — that lands on the character's own
  feet on the floor. Get this wrong and the sprite floats above or sinks below the floor line.
- `poses` maps a pose key to a list of `[x, y]` frame origins (the top-left corner of that frame
  within `sheet.png`). You don't need every pose — cover as many or as few as you like; anything
  missing draws the vector rig instead. The keys the game can ever ask for are: `idle`, `walk`,
  `dash`, `light1`–`light5`, `medium`, `heavyCharge`, `heavy`, `block`, `blockstun`, `hit`,
  `knockdown`, `getup`, `stunned`, `s1`, `s2`, `s3`, `win`, `ko`.
- Each pose's frame list is sampled across the move's whole duration (frame 0 at the pose's start,
  the last frame at its end) — a 2-frame `idle` alternates back and forth, a 3-frame `light1`
  plays start → peak → recovery once, in order.
- The sprite is mirrored automatically when the fighter faces left, and scaled by that character's
  own `def.scale` — draw the sheet at its natural size, facing right.

Contact shadows and the floor reflection still draw under/behind a sprite exactly as they do for
the rig — nothing else about a fight changes.

# Carl's Doorway Brawl

One-on-one tap-and-swipe fighter in the Dungeon Crawler Carl universe. Single HTML file, no assets, no build besides `python3 tools/build.py`.

**Play it now:** **[javamomma.github.io/Carls-Arena](https://javamomma.github.io/Carls-Arena/)** — works on a phone (landscape) or a desktop browser, nothing to install.

## Screenshots

| | |
|---|---|
| ![A fight in progress, Carl vs Goblin Scavenger, gestures-only HUD](docs/shots/p2-close.png) | ![The tutorial's visible spar mode: SPAR plate, LESSON banner](docs/shots/p5-tutorial-1.png) |
| A fight in progress — one thumb, gestures-only HUD | The tutorial's own visible sparring session |
| ![The campaign map: door cards show an arch, a torch, the enemy's portrait and a REC. LVL hint](docs/shots/p8-map.png) | ![The roster: 112px class-framed portraits with a bronze ring and class gem](docs/shots/p8-roster.png) |
| The campaign map — a door card per node, locked doors dimmed with a lock glyph | The roster screen, each card framed with its champion's own class gem |
| ![An intercept: INTERCEPT! popup, camera punch-in, directional shake](docs/shots/p7-intercept.png) | ![A crit heavy: damage popup, spark burst, the new impactBlunt ring](docs/shots/p7-heavy.png) |
| Intercepting a foe's dash-in: punch-in camera + directional shake | A landed heavy, with its own per-class impact fx |
| ![The in-fight HUD: chevron bars, bronze class-gem portrait frames, a gold combo counter](docs/shots/p8-hud.png) | ![Carl vs Mother Rat, Floor 2's boss](docs/shots/p3-floor2-boss.png) |
| The in-fight HUD — chevron bars, class-gem portrait frames, a tilted gold combo counter | Floor 2's boss fight |
| ![The grub: a segmented chitin-plated larva with a dark head-end and six stubby legs](docs/shots/p8-grub.png) | ![The shaman: a robed caster with a sash, staff arm raised](docs/shots/p8-shaman.png) |
| The grub — banded chitin plates on the quad rig's own body language | The shaman — the sixth human-rig look, in robe and sash |
| ![Carl's Doorway Drop landing: a STUN banner and damage popup](docs/shots/p9-carl-s3.png) | ![Princess Donut's Regal Pounce landing through a held block: an UNBLOCKABLE banner](docs/shots/p9-donut-s2.png) |
| Carl's S3, Doorway Drop — the guaranteed Stun landing on its last hit | Princess Donut's S2, Regal Pounce — its last hit ignores a held block |
| ![Katia's Misdirection landing a guaranteed crit: a big red damage popup](docs/shots/p9-katia-s2.png) | ![Mongo's Bear Hug landing: his own hp bar climbing mid-fight](docs/shots/p9-mongo-s2.png) |
| Katia's S2, Misdirection — every hit is a guaranteed crit | Mongo's S2, Bear Hug — healing 30% of the damage each hit deals |

The [S3 cinematic card](docs/shots/p7-s3.png) (Carl's SPECIAL 3) rounds out `docs/shots/p7-*.png`. See
"Champions" below for every champion's full kit.

### Art

Every fighter is a layered procedural vector body — real cloth, hair, and a face module shared by
the fight sprite, the HUD portrait, the map's door cards, and the roster cards, so the same character
reads the same way everywhere it appears — over a stage with torchlit depth (parallax layers, a
per-column lighting model that tints and rim-lights whoever's standing near a torch, and floor
falloff with distance). The HUD carries that through: chevron-capped bars, an ornate bronze
portrait frame with a class-colored gem, and a tilted gold combo counter. None of it needs an asset
file — see "Adding your own art" below if you'd rather draw one by hand; the sprite atlas stays
optional and off by default either way.

## How to play

Open `index.html` (or the play link above). A fresh save lands straight in the **tutorial** — Floor
0, "THE WAITING ROOM" — a scripted fight against a harmless dummy that walks you through all four
core moves (punch, kick, block/parry, power) one prompt at a time before you can be hurt; finishing
it grants a small gold bonus and opens Floor 1. You can always replay it later from the floor 1 map
(the green TUTORIAL button) or from the title screen's CAMPAIGN button, which starts it automatically
until it's been completed once.

After the tutorial, the title screen offers CAMPAIGN, ARENA, ROSTER, KIOSK, EXHIBITION, and SETTINGS.

- **CAMPAIGN** opens the floor map: a vertical column of doors (five per floor) ending in a **boss
  door**. Every door and the boss show a **REC. LVL** hint (the recommended level for that fight,
  turning red once your active champion is below it) — you can still walk in under-leveled, it's
  just a fair warning, not a hard gate. Doors unlock left-to-right as you clear the one before them;
  each costs 1 energy (10 max, regenerating over time) and pays out gold, ISO, and XP for your
  active champion on a win, plus units and a class catalyst for a boss win. Clearing a floor's boss
  opens the next floor.
- **ROSTER** shows every champion you own, star rating, rank, and level. LEVEL UP spends ISO,
  RANK UP spends that champion's class catalyst, and SELECT makes a champion the one who actually
  fights doors/arena runs.
- **KIOSK** (the SPONSOR PERK KIOSK) sells crystals with gold or units, plus an ISO pack for gold and
  permanent sponsor perks (small combat buffs, bought once with gold). Opening a crystal from here or
  the CRYSTALS screen grants a new champion or, on a duplicate, star shards toward that champion's
  next star.
- **ARENA** is an endless, energy-free gauntlet: win to raise your streak (tougher every couple of
  wins) and bank gold, or lose and the streak resets. BEST tracks your all-time high streak; the
  local leaderboard ranks your best runs by peak viewers.
- **SETTINGS** toggles reduce motion, haptics (a short vibration when you're hit, on supported
  devices), left-handed controls (mirrors the on-screen button placement — see below), show attack
  buttons (BLOCK/PUNCH/KICK, off by default), the optional sprite atlas, sound effects, and announcer
  text.

Every fight tracks **viewers** — a live score built from hits, parries, and specials (style
multipliers for a parry, a 5-hit combo, or landing an S3) that decays while you're being hit. The
result screen shows your PEAK VIEWERS for that fight.

### Controls

**Touch** (landscape phone or tablet): one thumb, anywhere on the canvas — the whole screen is a
single gesture surface. Only one finger is read at a time; a second finger touching the canvas is
ignored until the first lifts.

- **Tap** — a quick down-and-up (under 140 ms, moving less than 24 px) fires a **light** hit on
  release.
- **Hold in place** (≥140 ms, no drift) — **BLOCK**; release right before a hit lands to **PARRY** it.
- **Swipe right** (≥44 px within 260 ms) — dashes in with a **medium**; keep holding for another
  200 ms after the swipe and it starts charging a **heavy** — release after a short charge to swing
  it, or keep holding through the full charge and it fires automatically.
- **Combo chain**: landing a light or medium opens a window (release and press again during its
  recovery) to chain up to five hits, light or medium in any order. On the fourth hit specifically,
  swipe right and keep holding through that hit's own recovery instead — release any time before the
  recovery ends for the usual medium finisher (with a knockdown), or keep holding right up to when it
  ends for a quicker in-combo **heavy** finisher instead.
- **Swipe left** — **DASH BACK** (with a moment of invulnerability); keep holding through the dash
  and it rolls straight into **BLOCK** once the dash ends.
- **POWER** (bottom-right, always on screen) taps to fire your strongest affordable special; hold it
  to open a picker for S1/S2/S3 specifically, then release over the one you want.

BLOCK/PUNCH/KICK on-screen buttons are optional — off by default (SETTINGS' SHOW ATTACK BUTTONS
toggle brings them back), and shown automatically during the tutorial's early lessons. LEFT-HANDED
CONTROLS only mirrors where those buttons sit; gestures read the same regardless of that setting.

**Keyboard** (desktop browsers, for testing or just preference): `J` light, `K` medium (`Shift`+`K`
dashes in with a medium and arms the follow-up heavy *instantly* — the keyboard has no hold timing
to emulate, so unlike the touch swipe-and-hold this skips straight to the heavy with no delay),
`L` (hold) heavy, `A`/`D` dash back, `S` (hold) block, `1`/`2`/`3` fire that special, `Space` starts
a fight from the title screen, `P` pauses.

## Combat

### Chaining

Landing an opening light or medium from neutral opens a five-node combo chain: release and press
again during the move's own recovery window to continue it, light or medium in any order, for up to
four more hits. The chain always ends on node 5 — whatever move lands there decides the **ender**:

- **Light ender** — no bonus. A chain that ends on a light plays out exactly like a plain light hit.
- **Medium ender** — shoves the foe back and knocks them down.
- **Heavy ender** (in-combo only) — on the fourth hit specifically, swipe right and keep holding
  through that hit's own recovery instead of releasing for a plain fifth node: release any time before
  the recovery ends for the usual medium finisher above, or hold right up to when it ends for a
  shorter, quicker in-combo heavy instead. Landing it fires your champion's own **signature effect**
  (Carl: fury on himself; Donut: weakness on the foe; Katia: bleed on the foe; Mongo: armor break on
  the foe) — mobs and bosses have no signature effect of their own.

### Intercept and dexterity

Two reads, offense and defense, both tier-agnostic (they trigger off live fight state, not who's
throwing the hit):

- **Intercept** — land a hit on a foe who's still in the *startup* of any light or medium (a medium's
  own track dash-in counts, and so does a light's flat startup dash — a light doesn't have to actually
  be stepping in from range for this to trigger, a point-blank jab is just as interceptable) and it
  counts as an intercept: **x1.5 damage**, **+15 power**, its own heavier hitstop, camera punch-in and
  directional shake, and an INTERCEPT! popup.
- **Dexterity** — dash back (swipe left, or hold through into block) so that your i-frames cover the
  exact moment a foe's hit would've connected, and it whiffs clean through you instead: **+20% crit
  chance for your next hits** (a timed buff, refreshed rather than stacked by a second dodge), an
  afterimage fx, and its own event.

### Status effects

Twelve timed, stacking effect ids exist (eleven below, plus dexterity — see "Intercept and
dexterity" above), all wired through the same `Effects.apply`/`.tick`/`.mods` pipeline with HUD
badges and timed expiry. Every champion's heavy-ender signature (see "Chaining" above) and every
champion/boss's own kit (see "Champions" below) hands one or more of these out; **regen** is the one
id in the registry with no real producer today — `Buffs.regen` (a separate, older, non-stacking
mechanism) is what actually heals Mother Rat, not this timed effect.

| Effect | What it does | Producers |
|---|---|---|
| **Fury** | Raises the holder's own outgoing damage, up to 5 stacks | Carl's heavy-ender signature and his own Spite passive (both self); Mongo's Immovable passive (self, while blocking); Grull's Champion of the Floor passive (self) |
| **Weakness** | Lowers the holder's own outgoing damage, up to 3 stacks | Donut's Royal Disdain passive (every special she throws) and her S3 Sponsor Meltdown (every hit); Grull's S3 Floor Wipe (last hit) — all on the foe |
| **Bleed** | Damage over time, up to 5 stacks | Katia's heavy-ender signature, her S1 Knife Work (every hit) and S3 Curtain Call (last hit, x3); Carl's S1 Two-Fisted (last hit); Mother Rat's heavy Tail Sweep (x3) — all on the foe |
| **Armor break** | Lowers the holder's armor, up to 3 stacks | Mongo's heavy-ender signature; Carl's heavy (x2); Katia's S3 Curtain Call (last hit); Grull's heavy Pillar Swing — all on the foe |
| **Stun** | Locks the holder in place for a beat (reuses the parry-stun state) | Carl's S3 Doorway Drop (last hit, guaranteed) and Mongo's S1 Backhand (last hit) — both on the foe |
| **Poison** | Damage over time that ignores armor, up to 3 stacks | Donut's S1 Hairball (every hit, on the foe) |
| **Power burn** | An instant hit: drains a chunk of the holder's own banked power as damage | Donut's heavy (on the foe) |
| **Power gain** | Slowly banks power over time | Mother Rat's Brood passive (self, below 50% hp) |
| **Crit damage** | Raises the holder's own crit multiplier, +40%, one stack only | Katia's Understudy passive (self, on a successful parry) |
| **Armor up** | Raises the holder's own armor, +60% | Mongo's S3 Doorway Denial (self, last hit, 10s) — Grull keeps a separate, older, permanent armor-up buff of his own (`47_buffs.js`), not this timed effect |
| **Regen** | Heals over time, up to 3 stacks | No producer — see above |

## Champions

Four playable champions and two floor bosses. Every champion has a passive, a signature effect (see
"Chaining" above), and three real specials (**S1**/**S2**/**S3**, costing 1/2/3 power bars) each with
its own hit count and kit effect; the two bosses only carry a signature **S3**. A special's own kit
effect always lands on the **foe** unless noted "(self)". Duration numbers below are each effect's
real, shipped duration — see "Status effects" above; two of these disagree with an earlier design
note by name (`docs/design/mcoc-comparison-notes.md`'s own footnote has the detail): Carl's S3 stun
is 1s, not 2s, and Grull's S3 weakness is 8s, not 10s.

- **Carl** (brawler) — *Spite*: below 40% hp, an uncapped Fury stack (self) builds up every 3s, up to
  10. Heavy: 2 stacks of Armor Break. **S1, Two-Fisted** (3 hits): last hit Bleeds. **S2, Boot Party**
  (5 hits): a blocked hit refunds 20 power. **S3, Doorway Drop** (4 hits): last hit guarantees a 1s
  Stun. Signature: Fury (self).
- **Princess Donut** (caster) — *Royal Disdain*: every special she throws Weakens the foe (2 stacks
  if the foe is already debuffed). Heavy: burns 30 power. **S1, Hairball** (5 hits): every hit
  Poisons. **S2, Regal Pounce** (5 hits): last hit is Unblockable, even through a held block. **S3,
  Sponsor Meltdown** (6 hits): every hit Weakens. Signature: Weakness.
- **Katia** (trickster) — *Understudy*: a successful parry grants +1 Crit Damage stack (self, +40%
  crit damage, 3s). Heavy: refreshes the duration of every Bleed stack already on the foe. **S1,
  Knife Work** (5 hits): every hit Bleeds. **S2, Misdirection** (5 hits): every hit is a guaranteed
  crit. **S3, Curtain Call** (4 hits): last hit Bleeds x3 and Armor Breaks. Signature: Bleed.
- **Mongo** (tank) — *Immovable*: +1 Fury stack (self) per 120 consecutive frames spent blocking,
  capped at 5. Heavy, Ground Slam: knocks down even through a raised guard. **S1, Backhand** (3
  hits): last hit Stuns. **S2, Bear Hug** (5 hits): heals him 30% of the damage each hit deals. **S3,
  Doorway Denial** (4 hits): last hit grants himself Armor Up (+60% armor, 10s) — the AI throws this
  one automatically once its own hp drops to 60% or below and 3 bars are banked, rather than waiting
  for a debuffed foe the way every other champion's AI does (Mongo's own kit gives the foe nothing to
  debuff-count). Signature: Armor Break.
- **Grull** (boss, tank, floor 1) — *Champion of the Floor*: every 10s, purifies every debuff on
  himself and gains 3 Fury (self). Heavy, Pillar Swing: long reach, Armor Breaks the foe. **S3, Floor
  Wipe** (3 hits): last hit Weakens the foe for 8s. Keeps a separate, permanent Armor Up buff of his
  own (an older mechanism, not the timed effect above).
- **Mother Rat** (boss, beast, floor 2) — *Brood*: below 50% hp, gains a Power Gain stack (self) and
  her regen triples. Heavy, Tail Sweep: Bleeds the foe x3. **S3, Swarm** (6 hits): every hit heals
  her 2% of the damage it deals.

## Development

- Edit files in `src/`, then `python3 tools/build.py` writes `index.html`. Never hand-edit
  `index.html` — it's a generated, concatenated build of every `src/*.js`/`*.html` file.
  `python3 tools/build.py --check` builds without writing, exiting non-zero if the build would
  differ from the committed `index.html`.
- `python3 tests/harness.py --unit` runs the in-page unit tests headless (Python Playwright driving
  a real headless Chromium against `index.html`, no npm/node toolchain).
- `python3 tests/harness.py --sim --seconds 60 --bot random --ai basic` soaks the fight loop for a
  fixed number of simulated frames, restarting on every KO.
- `python3 tests/harness.py --matrix` runs the full AI/content soak matrix (every rig × mob × AI
  tier × seed combination); `python3 tests/harness.py --perf 600` gates ms/frame under 6 ms.
- `python3 tests/harness.py --e2e --seed 1` runs the full crystals → roster → quest → rewards →
  level-up → arena loop headless; add `--loops 20` for a longer menu+fight soak.
- `python3 tests/harness.py --tutorial --seed 1` plays the Floor 0 tutorial headless via a scripted
  bot and asserts every prompt fires in order.
- `python3 tests/harness.py --share --shot /tmp/share.png` checks `G.shareCard()`'s PNG data URL.
- `python3 tests/harness.py --screens-smoke` visits every screen plus one real fight and checks for
  page/console errors on each; `python3 tests/harness.py --phone-check` asserts the canvas stays
  letterboxed, on-screen buttons are real ≥44px touch targets, and the page never scrolls
  horizontally at an 844×390 CSS-px landscape-phone viewport.
- `python3 tests/harness.py --screen <name> --shot out.png` screenshots any menu screen
  (`title|map|roster|crystal|shop|arena|settings`) without starting a fight; `--pose <key> --shot
  out.png` freezes a fighter in a named rig pose for a clean reference shot; `--tutorial-shot
  {1,3,shield} --shot out.png` freezes one of three deterministic tutorial frames (lesson 1's SPAR
  plate, lesson 3's red wind-up flash, the SHIELD DOWN moment) for a clean reference shot.
- `python3 tests/batch.py --n 30 --ai t1,t2,t3,t4,t5` runs the seeded win-rate table against
  `Ctrl.competent` across the AI difficulty tiers (and, by default, every floor node/boss), gating on
  a monotone non-increasing curve.
- `tools/shots.sh` regenerates every `docs/shots/*.png` in one command.
- Release rubric (every exit criterion, verified): `docs/ARENA.md`.
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
silently, at the exact frame it would've drawn anyway, with no thrown error and no app-code console
message (`Atlas.load`'s own try/catch turns every failure mode into a clean resolved `null`). The
browser's own devtools network log still records the failed fetch itself (two `error`-level lines per
missing asset on a real HTTP server, or under `file://`) — the same log entry any missing resource
produces, not something this game's code emits; see `docs/ARENA.md`'s release rubric for the verified
detail.

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

## Credits

A fan project, built for fun and not for profit. *Dungeon Crawler Carl* is Matt Dinniman's — this
game borrows its tone and setting as an homage and isn't affiliated with or endorsed by him or his
publisher. All code, art, and writing here are original.

# Carl's Doorway Brawl vs Marvel Contest of Champions — redesign notes

Written against the tree at 2026-09-22. Claims about current behaviour cite `file:line`. Timings come
from driving `index.html` in headless Chromium at 844×390 with the keyboard.

Headline finding from play: a level-1 Carl kills the floor-1 goblin (300 hp) with **one uninterrupted light chain** — four hits for 110/69/72/49 damage across sim frames 106-138, about half a second of contact. Before that the same taps whiffed for ~70 frames, because a light has no approach and `medium` is the only way to close. Both halves are the core feel problem: nothing to think about, and no way to get there.

## 1. What MCoC does that this game does not

| System | MCoC | This game | Gap |
|---|---|---|---|
| Combo grammar | 5-hit chains mixing light/medium, medium ender with push, heavy as opener/ender | Fixed `light1→light5` ladder plus `medium→light1`; medium-as-ender is a `combo>=3` push special case (`60_fight.js:97`) | must |
| Intercept | Hitting a dashing opponent: big damage, hard stop, the skill ceiling of the game | Not modelled. The AI has an `intercept` knob (`55_ai.js:18-22`); the player gets no reward | must |
| Dexterity / evade | Swipe-back through an active hitbox grants a buff; the core defensive loop | Dash-back exists with i-frames (`40_movedata.js:79`), but a dodged hit only emits `miss` (`60_fight.js:51`) — no reward, no feedback | must |
| Parry | Tap-block timing, stun, follow-up | Implemented and good: 6-frame window, 50-frame stun, 20-frame lockout (`40_movedata.js:78`, `60_fight.js:60`) | — |
| Status effects | Bleed, stun, armor break, fury, power gain/burn, regen, timed and stacking | Nine permanent per-fight hooks, no duration, no stacks, applied only by encounters/bosses/perks (`47_buffs.js:7-103`). No move applies anything | must |
| Champion kits | Unique heavy, three specials, signature, passives per champion | All six fighters share one move table (`40_movedata.js:2-12`). The only kit difference shipped is Katia's `s1` hit-count override (`40_movedata.js:18-19`) | must |
| Signature ability | Awakened by dupes, scaled 1-200 | Absent. Dupes give 5 shards toward a star (`12_meta.js:210-212`) | should |
| Class triangle | 6 classes, 1.15× bonus | Present and correct (`40_movedata.js:77`) | — |
| Specials | Per-champion animations and on-hit effects, cinematic S3 | Shared s1/s2/s3 differing only in hits/damage; the S3 cinematic freeze is implemented (`60_fight.js:44-48`) | should |
| Hit feel | Impact frames, directional shake, camera punch-in, finisher slow-mo | Per-move hitstop 3-14f (`40_movedata.js:3-12`), scalar shake (`72_fx.js:27`), camera zoom driven only by fighter distance (`60_fight.js:18-19`) | should |
| Art | Rendered characters in lit arenas | Flat vector stick rigs: capsule limbs, one dot for an eye, no face, no cloth (`68_rig.js:918`) | must |
| Progression | Stars 1-6, catalyst-tiered ranks, ISO levels, signature levels, masteries | Stars 1-5, rank cap = stars, level cap = 10×rank, ISO `10*level`, catalysts = rank (`12_meta.js:113`, `:324`, `:335`). No masteries, no signature, no catalyst tiers | must |
| Content | 30+ acts, event quests, arenas, alliances | Two floors × 5 nodes + boss (`45_encounter.js:13-15`) | should |
| Roster | Hundreds | Four playable (`40_movedata.js:14-21`) | could |

## 2. Controls redesign

The owner wants one thumb: tap to attack, swipe right to dash in, swipe back to block. Today the
canvas is split into a left-third defence zone and a right two-thirds offence zone
(`30_input.js:9-13`) — a two-thumb scheme, and the reason the on-screen buttons exist at all.

**Drop the zones. The whole canvas becomes one gesture surface.** Every move gets a distinct gesture,
so nothing needs a zone:

| Gesture | Move | Threshold |
|---|---|---|
| Tap | Light (chains) | down→up under 140 ms, drift under 24 px; fires on release |
| Hold in place | Block; release inside the parry window = parry | engages at 140 ms held, drift under 24 px |
| Swipe → | Dash-in medium | ≥44 px within 260 ms, fires on threshold crossing |
| Swipe → and keep holding | Heavy: dash in, charge while held, swing on release | finger still down 200 ms after the swipe fired |
| Swipe ← | Dodge back with i-frames | ≥44 px within 260 ms |
| Swipe ← and keep holding | Dodge, then block engages the frame the dash ends | finger still down when `DASH_BACK.frames` expire |
| POWER button | Tap = strongest affordable special; hold 400 ms = S1/S2/S3 picker | unchanged (`30_input.js:55-64`) |

- **Hold-to-block, not a block button.** Parry is the one thing this game already gets right and it
  depends on release timing; a held gesture preserves `Fighter.act`'s `blockAge` bookkeeping
  (`50_fighter.js:54-65`) untouched.
- **Light fires on release**, so its latency is the player's own tap length, 60-90 ms. That is what
  MCoC does. Moving light to pointerdown would destroy tap/hold disambiguation.
- **Two-thumb conflicts**: parse gestures from exactly one canvas pointer, the first one down, and
  ignore every later canvas pointer until it lifts. Specials stay DOM buttons with `stopPropagation`
  (`30_input.js:50-56`), so POWER during a block hold still works — the only two-finger action.
- **Left-handed** becomes a button-placement setting only; `zoneFor`/`swipeDx` (`30_input.js:13-17`)
  can be deleted.
- **Keyboard**: `J` light, `K` dash-in medium, `L` hold heavy, `A` dash back, `S` hold block, `1/2/3`
  specials, `P` pause. Add `D` as a dash-back alias and `Shift`+`K` for the dash-in heavy.

## 3. Combat depth

**Combo grammar.** Replace the fixed ladder with a 5-node chain where each node accepts a light or a
medium. Node 1 opens with either. Nodes 2-4 take a light (fast, cheap) or a medium (slower, more
damage and blockstun). Node 5 is the ender: light keeps you close, medium pushes 90 px out of light
range and knocks down, heavy charged inside the node-4 recovery window gets a shortened 14-frame
charge (vs 22 standalone, `40_movedata.js:9`) and fires the champion's signature. MCoC's canonical
M-L-L-L-M falls out for free. Cap the chain at 5; the combo counter already increments per landed hit
(`60_fight.js:92`).

**Intercept.** A hit landed on a fighter whose current move has `dash > 0`, still in startup, moving
toward you: 1.5× damage, +15 power, `INTERCEPT!` popup, hitstop 10, hard camera punch. The move break
already happens (`60_fight.js:94`).

**Dexterity.** When `detect` returns `miss` because `def.inv > 0` (`60_fight.js:51`) and the defender
is in `DASH`, grant 3 s of +20% crit, with a popup and a blue afterimage. That turns dash-back from a
panic button into a rewarded read.

**Status effects.** There is no timed-effect system. Add an `Effects` module alongside `Buffs`:
`{id, dur, stacks, potency, source, onApply, onFrame, onExpire}`, per-Fighter, ticked once in
`Fight.step`, drawn in the HUD slot the buff badges already occupy (`70_render.js:209-211`). Ship
eight: **bleed** (DoT, ignores armor, stacks), **stun** (reuses the existing `STUNNED` state),
**armor break**, **fury**, **power gain**, **power burn** (drain their bar, deal what burned),
**regen**, **weakness**.

**Champion kits.**

| Champion | Signature | Heavy | S1 / S2 / S3 | Passive |
|---|---|---|---|---|
| **Carl** (brawler) | *Spite*: below 40% hp, +1 Fury every 3 s, uncapped | Haymaker — 2 armor break stacks, 8 s | S1 Two-Fisted, 3 hits, last applies bleed · S2 Boot Party, 5 hits, refunds 20 power on block · S3 Doorway Drop, 4 hits, guaranteed 2 s stun | −10% damage from the class he beats |
| **Princess Donut** (caster) | *Royal Disdain*: every special applies Weakness, doubled if the foe is already debuffed | Feline Contempt — power burn 30 | S1 Hairball, 5 hits, poison DoT · S2 Regal Pounce, 5 hits, unblockable final hit · S3 Sponsor Meltdown, 4 hits, strips every enemy buff first | +50% power from hits taken |
| **Katia** (trickster) | *Understudy*: a parry grants 3 s of +40% crit damage | Quickdraw — refreshes every bleed stack | S1 Knife Work, 5 hits (already tuned, `40_movedata.js:19`), each bleeds · S2 Misdirection, 5 hits, 100% crit · S3 Curtain Call, 4 hits, damage scales with active bleed stacks | Crits apply 1 bleed stack |
| **Mongo** (tank) | *Immovable*: while blocking, +1 Fury every 2 s, max 5 | Ground Slam — knockdown that ignores block | S1 Backhand, 3 hits, stun on the third · S2 Bear Hug, 5 hits, self-heal 30% of damage dealt · S3 Doorway Denial, 4 hits, +60% armor for 10 s | Unstoppable during heavy; keeps blockProf 0.15 (`40_movedata.js:21`) |
| **Grull** (boss, tank) | *Champion of the Floor*: every 20 s, purify and gain 3 Fury | Pillar Swing — long range, armor break | S3 Floor Wipe, 3 hits (already), applies 10 s Weakness | Keeps `armorUp` (`45_encounter.js:39`) |
| **Mother Rat** (boss, beast) | *Brood*: below 50% hp, regen triples and she gains Power Gain | Tail Sweep — 3 bleed stacks | S3 Swarm, 6 hits (already), each heals her 2% | Keeps retuned `regen` (`47_buffs.js:8-15`) |

**Hitstop and camera per move class.** Light 3 f, no shake, no camera. Medium 5 f, 4 px directional
shake, 2% punch-in over 6 f. Heavy 9 f, 8 px, 4% punch-in held 10 f. Intercept 10 f, 10 px, 5%
punch-in plus 6 f at half speed. S1/S2 6-8 f on the final hit only (already gated, `60_fight.js:103`),
6 px, slow 3% creep. S3 14 f plus the existing 72-frame cinematic, 12 px, and a dolly toward the
attacker. Shake is currently a scalar (`72_fx.js:27`) — make it a vector so a hit from the right shoves
the camera left. Camera zoom is distance-only (`60_fight.js:18-19`); add an additive punch-in term so
it composes with the existing `zoomCap` safety.

## 4. Art direction

The reference (`docs/reference/rendition.jpg`) is a lit, wet-stone dungeon with photoreal figures. The
shipping game is capsule limbs and one eye dot. Three routes:

**(a) Richer procedural vector rigs** — layered shapes, gradients, outlines, real faces, cloth
overlays, per-look silhouettes. **M**, about a week. Ceiling is a good stylized game, never "real",
but it lifts all eleven looks at once, needs no assets, keeps the offline promise, and it is the
fallback path regardless.

**(b) Pre-rendered sprite sheets** through the existing atlas hook (`68_rig.js:624-657`; manifest
documented in the README). **L** for art, **S** for code — the hook is done and falls back per pose
(`68_rig.js:937`). Ceiling is the reference image.

**(c) Hybrid: sprite bodies, procedural FX and props.** Sprites carry the character; sparks, dust,
popups, the S3 card, shadows and reflections stay procedural and per-champion tintable.

**Recommendation: (c), with (a) shipped first as the bridge.** Do the vector upgrade now so the game stops looking like a prototype this week, then generate sheets look by look. Every look that gets a sheet upgrades in place with no code change; every look that does not still looks decent.

**Sheet spec.** Frame 256×320, `anchorX` 128, `anchorY` 300 (feet on the floor line). Author at
512×640 and downsample. Character faces right; mirroring and `def.scale` are handled for you.
Transparent background, no baked shadow. Key light upper left, cool rim light from the right, to match
the stage. Core 9 poses first, ≈22 frames per look: `idle` 4, `walk` 4, `light1` 3, `light3` 3,
`medium` 3, `heavy` 3, `block` 1, `hit` 1, `ko` 1. Full set later, ≈68 frames: add `dash` 2,
`light2/4/5` 3 each, `heavyCharge` 3, `blockstun` 2, `knockdown` 3, `getup` 2, `stunned` 2, `s1` 6,
`s2` 6, `s3` 8, `win` 2.

Template prompt for the owner's image tools:

> Full-body character sheet of {CHARACTER}, {N} frames of a {POSE} animation, side view facing right,
> evenly spaced across one horizontal row, identical camera and scale in every frame, feet on a common
> baseline, transparent background, no shadow, no ground, dramatic torchlit dungeon key light from the
> upper left with a cool rim light from the right, gritty painted realism, 512×640 per frame,
> consistent costume and proportions across all frames.

**Stage, lighting and HUD polish, ranked.** (1) Stage depth: blurred far layer, torch flicker driving
real floor falloff, specular streak under each fighter — **M**. (2) Fighter lighting: tint by
proximity to the nearest torch, rim light on the far side — **S**. (3) HUD: chevron bar caps, portrait
frames with class gems, the gold italic combo counter from the reference — **S**. (4) Impact art: per
class instead of the generic 8-spark burst (`60_fight.js:104`) — blunt dust ring, bladed arc, caster
energy ring — **M**. (5) Menu screens: the map and roster are grey boxes over a blurred stage
(`docs/shots/p4-map.png`, `p4-roster.png`) — give doors art and the roster real portraits — **M**.

## 5. Progression redesign

Current: stars 1-5, rank cap = stars, level cap = 10×rank, level-up `10*level` ISO, rank-up `rank`
class catalysts, dupes give 5 shards (`12_meta.js:113`, `:210-212`, `:324`, `:335`). Income is
`20*floor` ISO and `30*floor` XP per node (`12_meta.js:294-295`); energy is 10 max, one per 6 minutes
(`12_meta.js:128`, `:138`).

- **Stars 1-6.** Rank cap = `min(stars, 5)`. Level cap = `10 + 5*rank`, so r1 = 15 up to r5 = 35.
- **ISO curve.** Level `L → L+1` costs `8 * L * stars`: a 1★ 1→2 is 8, a 3★ 10→11 is 240, a 5★ 20→21
  is 800.
- **ISO income.** Change `iso` from `20*n` to `round(20 * n^1.4)` — 20 / 53 / 93 / 139 / 190 per node.
  A full floor run (5 nodes plus a boss at 2×) pays ≈140 / 370 / 650 / 970 / 1330, about one rank's
  worth of levels per floor.
- **Catalysts get tiers.** Rank `r → r+1` costs `r` class catalysts of tier `r`. Floor `n`'s boss drops
  one tier-`min(n,5)` catalyst of its own class; the kiosk sells tier 1-2 for gold (2 000 / 6 000) and
  tier 3 for units. Floors, not gold, become the rank gate.
- **Signature levels.** Dupes keep granting 5 shards, and additionally one Awakening Fragment. Ten
  fragments awaken a champion (signature turns on at sig 1); every dupe after that is +10 sig, capped
  at 100. Potency scales `base * (1 + sig/100)`, so unawakened is playable and awakened is better
  without being mandatory.
- **Masteries.** One tree, 40 points: 1 per first-time node clear, 3 per boss, across five floors.
  Max 5 per node, costs ramping 1/1/2/2/3. *Offense*: Cruelty (+crit), Assassin (light1 ignores 30%
  armor), Liquid Courage (+atk under 25% hp). *Defense*: Block Proficiency, Coagulate (−bleed
  duration), Dexterity (bigger evade reward). *Utility*: Recovery (−1 min energy regen), Salt (+power
  on block), Despair (−enemy regen).
- **Crystals.** Keep basic (500 gold) and premium (100 units) for champions (`12_meta.js:153-154`).
  Add an ISO crystal (800 gold, 200-600 ISO) and a Catalyst crystal (150 units, one tier 1-3). Keep
  the 10-pull pity (`12_meta.js:186-201`).
- **Daily loop**, about 20 minutes: spend 10 energy on one floor's nodes, run the energy-free arena
  until you lose, open one crystal, spend ISO on the champion you actually play, place one mastery
  point if you cleared something new.
- **Cut**: alliances, real PvP, timed events, purchasable energy, any 6★ rank past 3, and every
  currency beyond gold, units, ISO, catalysts and fragments.

## 6. Tutorial and first-run

The owner's report — "the goblin didn't really die until it started to beat me up" — is exactly what
the code does. `BUFFS.tutorialGuard` silently caps every hit at `holder.hp - 1` (`47_buffs.js:100-103`)
until all four lessons are done, and `Ctrl.tutorialDummy` throws a medium every 90 idle frames from
frame 0 (`30_input.js:139-144`). So the player beats an unkillable goblin to 1 hp while being hit back,
and nothing on screen explains either fact. The shipped screenshot shows it: the goblin sits at 40/150
while the prompt still reads lesson 1 (`docs/shots/p5-tutorial-1.png`).

1. **Make the shield visible.** Replace the dummy's HP bar with a `SPAR` plate carrying a shield glyph.
   Render capped damage popups in grey. Add a persistent `TRAINING DUMMY — CANNOT BE KO'D` label under
   its name and a `LESSON n / 4` banner above the prompt.
2. **Make the dummy passive until it is taught.** Gate its first swing to lesson 3, the parry lesson,
   and telegraph it with a wind-up and a red flash. Being hit before you have been taught to block is
   the other half of the complaint.
3. **End on a real kill.** When lesson 4 completes, flash `SHIELD DOWN`, drop the plate, restore the HP
   bar, and let the existing FINISH HIM path play (`80_game.js:70-77` already clears `guardActive`).
   The goblin dies to the next chain, which is the payoff.

**First three minutes.** 0:00 title, auto-start into SPAR. 0:10 lesson 1, tap to punch, dummy passive. 0:30 lesson 2, swipe right to dash in. 0:50 lesson 3, the dummy winds up, swipe back to block, release on the telegraph to parry. 1:15 lesson 4, POWER. 1:30 SHIELD DOWN and the kill. 1:45 result, and a free crystal auto-opens granting a second champion so the roster has something in it. 2:00 map, door 1 highlighted. 2:10 the first real fight, against a goblin that no longer dies to one chain.

## 7. Prioritized roadmap

1. **Tutorial spar mode** (S) — visible shield plate, lesson banner, dummy passive until lesson 3, SHIELD DOWN kill. Fixes the one thing the owner called a bug.
2. **Gesture control rewrite** (M) — drop the zones, whole-canvas gestures per §2, one canvas pointer, keyboard aliases.
3. **Combat rebalance pass** (S) — mob hp and player damage so a floor-1 mob survives two chains, not one; lights get a small forward step so a tap at neutral connects.
4. **Effects system** (M) — timed, stacking `Effects` alongside `Buffs`, HUD icons, the eight statuses.
5. **Combo grammar** (M) — 5-node chain accepting light or medium per node, three ender types, shortened in-combo heavy.
6. **Intercept and dexterity** (S) — reward hitting a dashing foe and dodging through an active hitbox.
7. **Vector art upgrade** (M) — layered bodies, gradients, outlines, faces, cloth, per-look silhouettes. Ships "not stick figures any more" with no assets.
8. **Hit-feel pass** (S) — directional shake, camera punch-in per move class, per-class impact art.
9. **Champion kits** (L) — signature, heavy effect, three specials, one passive for four champions and both bosses. Depends on 4 and 5.
10. **Progression rewrite** (M) — 6 stars, catalyst tiers, new ISO curve, signature levels from dupes.
11. **Masteries tree** (M) — 40 points, three branches, earned from first clears.
12. **Sprite atlas content** (L) — core-9 sheets for Carl, Donut, Katia, Mongo, then the mobs.

Do 1-3 first, in that order, in one week. They are cheap, every first-time player hits all three in the first five minutes, and none depends on anything else on the list.

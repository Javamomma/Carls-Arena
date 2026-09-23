# Marvel Contest of Champions — gameplay study

Written 2026-09-22 against the Carl's Arena tree at Phase 8 close-out (Phase 9 partly landed:
`40_movedata.js` already carries kit flags). Research method: no video playback available, so this is
built from written beginner guides, mechanics blogs, Kabam's own champion spotlights, and
`forums.playcontestofchampions.com` mechanic threads — 20 sources, listed in §6. Every MCoC number
below is sourced unless marked **(est.)**, which means it is my professional inference from how the
game is described to behave, not a figure anyone published.

Companion document: `docs/design/mcoc-comparison-notes.md` (2026-09-22). That file is the *redesign
proposal* that Phases 7-11 were planned from. This file does not repeat it. Where the two disagree,
this one is the later and better-sourced read, and §4 marks each correction explicitly.

Carl's Arena numbers below are read out of `src/` at this commit and are given in frames at 60 Hz
with the millisecond equivalent, because MCoC's own published numbers are all in seconds.

---

## 1. How a fight actually plays

### 1.1 The five inputs

MCoC is a one-thumb 1v1 fighter on a fixed 2D lane. The whole move set is five gestures, split across
a two-zone screen: tap the right side for a **light**, swipe right for a **medium**, hold the right
side for a **heavy**, hold the left side to **block**, swipe left to **dash back**. A separate power
button fires a special. That is the entire vocabulary, and everything else in the game is timing on
top of those five.

Carl's Arena deliberately diverges here: Phase 7 replaced the two zones with whole-canvas gestures
(tap / hold / swipe-right / swipe-right-and-hold / swipe-left), which is a genuine improvement for
one-thumb play and should not be reverted. The *moves* it maps to are the same five.

### 1.2 The combo string

The combo grammar is the thing most written guides get to first, and it is narrower than it looks:

- A combo is built from **light and medium attacks only**. Heavies are outside the string —
  they cannot normally be chained into one, with a small number of per-champion exceptions
  (Wasp being the canonical one).
- **The combo ends on your second medium or your fourth light.** That single rule is what generates
  every combo in the game. It is the reason the standard string is exactly five hits.
- The canonical string is **M-L-L-L-M**: medium opener, three lights, medium ender. Guides describe
  this as the core combo and the highest raw damage with no other factors in play.

Why a medium opener. A medium is a *dash-in* — it closes the gap. A light has essentially no
approach. So from neutral, the medium is the only move that both travels and starts a string, and
opening with it spends your one allowed "first medium" at the moment it also does the work of
closing distance. Opening with a light means the fourth light ends your combo at four hits, and you
never get the ender's damage. **(est.)** on the "highest damage" framing being a consequence rather
than a designed bonus — the sources assert the outcome, not the mechanism.

Why a medium ender. Two reasons, both sourced. First, the medium finisher's recovery is what lets
you chain directly into Special 1 or Special 2 — a combo that ends on a medium can flow straight
into a special without the opponent getting a turn. Second, the medium shoves the opponent back,
which resets you to neutral spacing on your terms rather than leaving you standing in their face.

The two real alternatives, both in the sources:

- **M-L-L-L-L** — ends on the fourth light instead. Shorter recovery, so it is the safer string
  against an opponent who counter-attacks the instant your combo ends.
- **M-L-L** — deliberately cut short. You stop mid-string to bait a special out of the AI while you
  still have your own defensive options available.

### 1.3 The rhythm of an exchange

A competent MCoC exchange is a loop of roughly: **close with a medium → four more hits → dash back
out of range → wait for the AI to commit → punish the commitment → repeat**. The punish is where the
skill lives, and there are three of them: parry, intercept, and dex-into-punish.

### 1.4 Block, parry, chip

Holding block absorbs a hit and takes reduced damage. How much less is set by **Block Proficiency**, a
base stat; the opponent's **Block Penetration** stat cancels some of it. That reduced-but-nonzero
damage is what players call chip. **Blocking a special attack still takes chip damage** — it is
mitigated by Block Proficiency exactly like a basic, which is why blocking a Special 3 can still kill
you at low health.

**Parry** ("well-timed block") is tapping block in a narrow window just before the hit connects. The
cue guides give is to block when the opponent *starts* the attack, not when they start dashing at
you. No source publishes the window in milliseconds. **(est.) roughly 100-200 ms**, from how it is
described (a few milliseconds' tolerance either side of a hit that itself has 3-5 active frames).

Parry's stun, which *is* published:

| Fact | Value | Source |
|---|---|---|
| Parry base stun on contact with a basic attack | **1.0 s** | forum, Parry mastery description update |
| Parry mastery description ceiling | **up to 1.5 s** | mcocguideblog mastery guide |
| Bonus stun above the 1 s base | up to **+0.5 / +0.7 / +1.0 s** at parry ranks | forum thread on parry ranks |
| How that bonus is actually earned | scaled by your **Perfect Block Chance**, so you never see the full listed value unmodified | forum thread |
| Perfect Block mastery | **+1% perfect-block chance per rank** | mcocguideblog |
| Stupefy mastery | **every stun you inflict lasts +0.1 s per rank** (max 5 → +0.5 s) | mcocguideblog |

The practical takeaway: **a real parry stun in MCoC is a bit over one second**, not the 1.5 s the
description implies. A Perfect Block sets that hit's damage to zero outright and is not affected by
Block Proficiency, since there is nothing left to mitigate.

Parry is gated behind the Limber mastery and does nothing against stun-immune champions or
stun-immune quest nodes.

### 1.5 The heavy, and what a parry is for

A heavy is **hold to charge, release to swing**. It has a long wind-up, it breaks through a held
block, and for some champions it is outright unblockable. The charge is the cost: you are committed
and visibly telegraphing for most of a second.

Which is why the parry matters. **The canonical punish is parry → immediately charge a heavy.** Kabam's
own champion spotlights confirm the interaction directly: charging a heavy right after a parry can
re-stun the opponent and open your offense (Cassandra Nova), and some champions pause the parry stun's
clock while a heavy is charging (Madelyne Pryor). A separate spotlight (Thanos, Deathless) shows the
generalized version of the same idea: charging a heavy after a *non-combo-ending* attack inflicts a
0.75 s stun passive — i.e. the heavy is the designed follow-up to any state where the opponent is
already frozen.

So the shape is: **parry buys you roughly a second; the heavy is what you spend it on.** Anything
faster (a light) wastes the window; anything slower does not exist.

### 1.6 Dash back and Dexterity

Swiping back moves you out of range. With the **Dexterity** mastery it also becomes an evade. The
mastery text is specific:

> Evade all attacks while dodging back. A successful dodge grants a buff increasing Critical Rating
> by **+250**, lasting until **0.2 s after your next hit**.

Three things follow from that wording, and all three matter for design:

1. **The reward is a crit buff, not damage.** Dexterity turns defense into offense.
2. **It expires on use, not on a timer.** It lasts until shortly after your next hit lands — so a
   dex is worth exactly one punish, which forces you to dex *and then commit*, rather than
   stockpiling dodges.
3. **Only the crit number changes with mastery rank.** The evade itself is rank-independent; the
   sources agree there is little reason to max it.

"Dexing" a special means dodging through its hits. Because most specials are multi-hit, the practical
technique is to dex the hits you must avoid and block the rest — for some opponents only the first hit
carries the unblockable or debuff payload, and the remainder can safely eat your block. The
much-discussed "dex the last hit" case is the mirror of that: a special whose *final* hit is the
dangerous one. Timing varies per champion; e.g. Cyclops's beam must be dodged after it fires, not
before. There is a live community question about whether every special in the game is dexable.

**Coldsnap blocks evade entirely** while it is on you, which is how the game denies this tool.

### 1.7 Intercept

An intercept is hitting the opponent while they are dashing toward you. It is the highest-skill core
mechanic and the sources treat it as the ceiling of the game.

The enabling condition, stated plainly on the forums: **you need the AI to have recovery frames after
its light and medium attacks**, and on a medium it also needs recovery to continue its own combo.
That recovery is the room you dash back into and then attack out of. No recovery, no intercept.

Three named variants:

- **Medium intercept.** You dash back, the AI dashes in, you throw a medium into their approach. The
  most damaging and the most timing-sensitive. Community threads describe it as unreliable after
  certain patches, and Kabam shipped a fix for attackers "losing" intercepts between their medium and
  the defender's at 60 fps — which tells you the real window is only a frame or two wide.
- **Light intercept.** Same read with a light. Faster startup, so it is more forgiving; the trade is
  much less damage. This is the version tutorials recommend learning first.
- **Backdraft intercept.** The named setup: **swipe back after your third light, then throw a medium
  as they dash at you.** The dash-back out of your own combo is the bait; their dash-in is the
  punishable commitment. Fragile — if the AI takes a single step instead of committing to a dash, the
  intercept is lost.

### 1.8 AI behaviour

This is worth reading carefully, because it is the part of MCoC that Carl's Arena most directly
competes with, and it is also the part the MCoC community most complains about.

From the forum threads, including a developer diary discussion:

- The AI's reactions are effectively **frame-perfect**. It can backdraft-intercept you on the exact
  frame you dash in, even while its posture reads as aggressive.
- It **blocks between the hits of your combo** if your medium is slow enough to leave a gap, which is
  why some champions with long mediums can no longer chain medium-into-special safely.
- It will **block instantly** when you dex a special perfectly and dash in to punish, because it reacts
  in the frame you move.
- Players' framing of the fix is instructive: other fighting games (Tekken, MK, Injustice Mobile)
  deliberately give the AI reaction delays, buffered moves, or a cooldown state after a decision, so
  a human can bait and punish. MCoC's AI does not, and it feels unfair as a result.

**The design lesson for us is the inverse of MCoC's implementation.** What makes MCoC's *loop* good is
that the AI commits to readable dash-ins on a cadence. What makes it feel bad is that its reactions
are instant. A good AI for Carl's Arena is one with MCoC's commitment cadence and *without* its
frame-perfect defense: a visible tell, a committed approach, and a short post-decision cooldown during
which it cannot re-react.

### 1.9 Specials and the power bar

- The power bar fills from **dealing and taking damage**. More damage in either direction fills it
  faster. **Blocking does not generate power** — the BlueStacks battle-system page is explicit that
  blocking has no effect on the meter.
- The bar is **three bars**, shown as a segmented octagon indicator that colours by how full it is:
  **green at one bar (S1 available), yellow at two (S2), red at three (S3)**.
- Power rate varies per champion — some (Psylocke is the named example) need noticeably more hits per
  bar. The modifiable stat is **Combat Power Rate**.
- Specials are **multi-hit**. Every special is a short scripted sequence of several hits, which is what
  makes partial dexing and partial blocking meaningful.
- Specials can be launched **from range** — you do not have to be adjacent. This is central: it makes
  neutral dangerous, and it is why "bait the special" is a real activity.
- Specials can also be **chained out of a combo**, specifically off a medium ender (§1.2).
- The **S3 plays a cinematic** — the camera cuts away for a scripted sequence.
- Special attacks that are blocked still chip you (§1.4).

### 1.10 The class triangle

Six classes: Cosmic, Tech, Mutant, Skill, Science, Mystic. The cycle, confirmed identically by two
independent guides:

**Cosmic > Tech > Mutant > Skill > Science > Mystic > Cosmic**

Both BlueStacks and GamingOnPhone give the magnitude as roughly **+40% attack with the advantage and
−20% attack with the disadvantage**. Note this is a 1.4× / 0.8× pair, not the symmetric 1.15× that
`CLASS_BONUS` currently uses — see §4.

There is also a widely-discussed power-gain component to class matchups (the disadvantaged side
generating power faster); I could not source a number for it, so I am not stating one. **(est.)** that
if we want it, a 1.15-1.25× power-rate bonus to the disadvantaged side is the right shape, because its
job is to give the losing matchup a comeback tool rather than to change DPS.

### 1.11 Ability Accuracy

A champion's abilities are gated on **Ability Accuracy** — the chance an ability actually fires.
Reducing an opponent's *Defensive* Ability Accuracy is how the game turns off a defender's evade,
auto-block, or regen. A whole family of debuffs exists to do exactly that: **Incinerate, Shock, Plasma,
Nova Flame, Coldsnap, Soul Barb, Critical Failure and Neuroshock all reduce Defensive Ability Accuracy
and Block Proficiency.** The Assassin mastery does it too (−12% defensive ability accuracy below 18%
health).

This is a genuinely good system and Carl's Arena has no analogue. It is what makes debuffs feel like
*tools* rather than damage-over-time padding.

### 1.12 Buffs and debuffs

The clean split, sourced from a forum thread on damaging debuffs and their secondary effects:

**Damaging debuffs** — Bleed, Poison, Acid Burn, Power Burn, Degeneration, Damnation, Disintegration.
These deal direct damage over their duration **and** reduce the holder's Attack Rating, Armor Rating,
Critical Rating, Critical Resistance, Block Penetration and Combat Power Rate. Bleed specifically
ignores armor and resistances. Poison additionally reduces health recovery.

**Accuracy debuffs** — Incinerate, Shock, Plasma, Nova Flame, Coldsnap, Soul Barb, Critical Failure,
Neuroshock. These reduce Defensive Ability Accuracy and Block Proficiency. Incinerate removes Perfect
Block. Coldsnap prevents Evade.

**Control debuffs** — Stun (cannot attack, block, or move), Weakness (reduced attack), Power Lock
(cannot gain power), Power Drain / Power Burn (removes power; Burn converts it to damage).

**Buffs** — Fury (attack up), Cruelty (critical damage up), Precision (critical rating up), Armor Up,
Regeneration, Power Gain, Unstoppable (cannot be interrupted), Unblockable (attacks pass through
block), Indestructible (takes no damage), Evade, Auto-Block. Nullify removes an opponent's buffs
instantly.

Published durations are per-champion, not global, so there is no canonical "bleed lasts N seconds" to
copy. The mastery numbers do give the scale of the tuning knobs: Deep Wounds makes bleed last 0.5 s
longer; Coagulate reduces enemy bleed *damage* by 10% per rank; Willpower regenerates 0.5% health per
second and grants +2% armor per debuff type held (max 3); Liquid Courage applies a permanent poison
draining 1% health per second; Despair reduces enemy healing and regeneration by 5% per rank; Recovery
increases health recovered by 5% per rank.

### 1.13 Masteries, briefly

Masteries unlock at account level 6 and are a point-buy tree across offense, defense and utility.
Every beginner guide gives the same first-purchases advice: **Parry and Dexterity first**, then
Precision and Cruelty for damage. The ones that change how a fight *feels* rather than how hard it
hits are Parry, Dexterity, Perfect Block, Stupefy, Coagulate and Willpower.

Per-rank numbers, all sourced:

| Mastery | Per rank | At 5/5 |
|---|---|---|
| Precision | +2.0% critical rate | +10% |
| Cruelty | +10.0% critical damage | +50% |
| Block Proficiency | +2.0% block proficiency | +10% |
| Perfect Block | +1.0% perfect-block chance | +5% |
| Recovery | +5.0% health recovered | +25% |
| Despair | −5.0% enemy healing per debuff | −25% |
| Coagulate | −10.0% enemy bleed damage | −50% |
| Stupefy | +0.1 s to every stun you inflict | +0.5 s |
| Dexterity | changes only the crit rating granted on evade (+250 at the documented rank) | — |
| Willpower | +0.5% health/s and +2% armor per debuff type (max 3/3) | — |
| Assassin | +20% attack, −12% enemy defensive ability accuracy below 18% health | — |
| Deep Wounds | bleed lasts +0.5 s, with max-health scaling | — |
| Liquid Courage | permanent poison draining 1.0% health per second | — |

### 1.14 Node buffs

Quest map tiles carry **nodes** — per-fight rule modifiers on the defender (stun immunity, unblockable
windows, power gain, thorns, and so on). They are the game's content-generation engine: the same
champion fought on a different node is a different fight. Stun-immune nodes are the canonical example,
because they specifically switch off parry, the player's most reliable tool.

---

## 2. Feel and presentation

MCoC is a technically modest game that reads as expensive, and almost all of that is presentation
discipline. Sources give very few presentation numbers, so this section is explicitly my professional
description of what the game does, with **(est.)** on the specific figures.

### 2.1 Camera

- **Baseline.** A near-locked side camera framing both fighters, tightening as they close and pulling
  back as they separate. The zoom range is small — **(est.) 1.0× to about 1.15×** — because the health
  bars and power bar are pinned to the screen edges and cannot be allowed to crop.
- **Hit punch-in.** Each landed hit adds a brief additive zoom, largest on heavies and specials.
  **(est.) 2% on a medium over ~6 frames, 4-5% on a heavy or intercept held ~10 frames.**
- **Directional shake.** A hit from the right shoves the camera left. It is a vector, not a scalar
  jitter, which is what makes a heavy feel like it has a direction. **(est.) 4 px medium, 8 px heavy,
  10 px intercept.**
- **Special cut.** A special breaks the camera's rules: it cuts to a scripted framing, often much
  closer, sometimes rotating or tracking the attacker. S1 and S2 do a small version. **The S3 is a
  full cinematic** — the game hands the camera entirely to a choreographed sequence with its own
  framing, a title treatment naming the champion and the attack, and a slow-motion beat on the
  landing hit before returning control.
- **KO.** A slow-motion beat on the killing blow, then a hold on the fallen champion.

### 2.2 Hitstop and impact

Every landed hit freezes both fighters for a few frames before the reaction plays. This is the single
highest-value trick in the whole presentation: it is nearly free and it is the difference between a
punch and a sprite overlapping another sprite. **(est.) light 3 frames, medium 5, heavy 8-10, special
sub-hit 4, special final hit 10-14.** A blocked hit gets a shorter freeze and a different, duller
sound.

### 2.3 Hit sparks and impact frames

A landed hit spawns a burst at the contact point, not at the target's centre: a short-lived radial
spark cluster, a directional smear oriented along the attack's travel, and for heavier hits a
expanding ring. Bladed attacks get an arc; energy attacks get a ring and a glow; blunt attacks get a
dust puff. Crits get a larger, brighter version plus a distinct colour.

### 2.4 Numbers, counter, bars

- **Damage numbers** rise from the contact point and fade over roughly half a second. Colour carries
  meaning: **(est.)** white for a normal hit, yellow or orange for a critical, a duller grey for
  chip through a block, red for bleed and damage-over-time ticks, green for healing.
- **The combo counter** sits high on the attacker's side of the screen and animates on each increment:
  it scales up and settles, often with a slight tilt or italic slant, and changes colour or adds a
  glow at milestone counts. It clears with its own animation when the combo drops, which is a
  deliberate small punishment.
- **Health bars** run along the top, one per fighter, drained from the inside. A damage "ghost" trails
  the real value for a moment so you can see the size of the hit you just took.
- **The power bar** is the segmented gauge under the health bar — three segments, one per bar of
  power. Crucially **both fighters' power bars are visible**, because knowing the AI is about to have
  a special is what makes baiting possible. At three bars the bar gets a gold glow and a pulse, which
  is a "you are now in danger" signal on the defender's side and a "spend me" signal on yours.
- **Portrait frames** bracket each health bar, with a class-coloured badge.

### 2.5 The fighter

- **Idle** is a continuous breathing loop in a braced stance — weight low, guard up, slight sway. A
  fighter is never still.
- **Anticipation frames.** Every attack has a visible wind-up before the hitbox exists: shoulder
  loads, weight shifts back, the limb cocks. This is the entire basis of the parry and dex reads —
  you are reading anticipation, not reacting to the hit.
- **Follow-through.** The limb overshoots and settles rather than snapping back, which is what sells
  weight.
- **Dash-in** leans forward hard with the trailing limb strung behind; **dash-back** leans away with a
  ground push. Both get a motion smear or afterimage and a small dust puff at the feet.
- **Block** is a distinct closed silhouette. **Blockstun** is a visible shove.

### 2.6 Stage

Layered parallax depth with a lit foreground, a blurred background, and a **reflective arena floor** —
the wet-looking floor reflection is one of the strongest single elements in MCoC's look, because it
doubles the character's visual mass and grounds them. Crowd and environment animation in the
background layers. Stage lighting keys the fighters from the scene, with a rim light separating them
from the background. A vignette pulls the eye to centre.

### 2.7 Audio

An announcer calls the fight open and the KO. Crowd noise swells on big hits and specials. Each hit
class has its own sound, and a blocked hit sounds different from a clean one — this is the cheapest
"did it land?" feedback channel and MCoC uses it constantly.

---

## 3. Meta loop

### 3.1 What a session looks like

A typical session is 15-30 minutes: spend your **energy** on story or event quest tiles, run **arena**
(which costs no energy) for battlechips and units, do your **alliance quest** tiles, open whatever
crystals you have, and spend the ISO-8 and catalysts you collected on one champion.

### 3.2 The modes

| Mode | What it is |
|---|---|
| **Story Quest** | Acts 1-9, the permanent campaign |
| **Event / Monthly Quest** | Rotating map at five difficulties (Normal through Cavalier and above) |
| **Daily Quests** | Rotate by weekday; Monday-Saturday each target one class's catalysts, with difficulty setting the catalyst tier |
| **Arena** | Endless PvE grind for battlechips, gold and units; no energy cost |
| **Alliance Quest** | Weekly co-op map. Its own energy pool: **max 6, +1 every 45 minutes, 1 per tile** |
| **Alliance War** | Three-phase alliance PvP: matchmaking, defender placement, attack |
| **Battlegrounds** | Ranked 1v1 with deck-building |
| **Towers** | Permanent mode with class and tag restrictions (added June 2026) |

### 3.3 Resources

- **Energy** gates quest tiles and regenerates over time.
- **Gold** pays for rank-ups and mastery purchases.
- **Units** are the premium currency: crystals, potions, revives, mastery cores.
- **Battlechips** come from arena and buy arena crystals (the published odds are heavily gold-weighted
  — roughly 83% gold, 15% units).
- **ISO-8** levels a champion. Class-specific ISO-8 gives a bonus to matching-class champions.
- **Catalysts**, tiers **T1-T5**, rank a champion up. Class catalysts are class-specific; basic
  catalysts are not.
- **Signature Stones** raise an awakened champion's signature level. **Awakening Gems** switch the
  signature on in the first place.
- **Crystals** are the gacha layer and the source of new champions and duplicates.

### 3.4 How a champion scales

Four independent axes, which is why MCoC's progression has so much room in it:

1. **Star rating** (1★ through 7★). Sets the ceiling for everything else.
2. **Rank**, gated by catalysts of the right class and tier.
3. **Level**, gated by ISO-8 and capped by rank.
4. **Signature level**, 1-200, from duplicates and signature stones. An unawakened champion is
   playable; an awakened one is better. Sig level scales the signature ability's potency, not the
   base stats.

Progression titles mark account-wide progress: Uncollected → Cavalier → Thronebreaker → Paragon →
Valiant → Elder.

### 3.5 PI and Prestige

**PI (Power Index)** is a single scalar summarising a champion's power, computed from star rating,
rank, level, and signature level. The in-game "Hero Rating" a champion displays **includes your
masteries**; **Prestige does not**. Prestige is the **average base PI of your top five champions**, and
it is what alliance content is matched on — it sets alliance quest map difficulty and scoring
potential.

Two concrete calibration points from the sources: a champion showing 13,719 Hero Rating can have a
Prestige of 10,481 — masteries are worth roughly a quarter of the displayed number. And a 6★ champion
passes a maxed 5★ of the same champion at about Rank 2 / Signature 160. The spread between the
highest- and lowest-Prestige champions at Signature 200 exceeds 1,000 points.

---

## 4. Gap table against Carl's Arena

Read first: `README.md`, `docs/ARENA.md` (Phases 6-8 exits), the Phase 9/10/11 plans, and
`docs/shots/p7-*.png` / `p8-*.png`. Current-state numbers below come from `src/40_movedata.js`,
`src/48_effects.js`, `src/55_ai.js`, `src/60_fight.js`, `src/70_render.js` and `src/72_fx.js`.

Carl's Arena is in better shape than the earlier comparison notes describe — Phases 7 and 8 landed
the combo grammar, intercept, dexterity, the effects system, hit-feel and the art upgrade. The gaps
below are what remains, plus four places where the earlier notes were wrong.

### 4.1 Corrections to `mcoc-comparison-notes.md`

| Earlier claim | Correction |
|---|---|
| "Class triangle — present and correct, 1.15×" | The sourced MCoC magnitude is **+40% / −20%**, i.e. 1.4× and 0.8×, not a symmetric 1.15×. Our 1.15× is a legitimate balance choice but it should be called a deviation, not parity. |
| "Dexterity: grant 3 s of +20% crit" (shipped as `EFFECTS.dexterity.dur = 180`) | MCoC's dex buff **expires 0.2 s after your next hit**, not on a fixed timer. The fixed 3 s version lets you bank a dodge and spend it whenever; the real one forces dodge-then-commit. This is a feel difference, not a balance one. |
| "Parry — implemented and good" | Our stun is **50 f (833 ms)**; MCoC's real parry stun is **~1.0-1.5 s**. Close, slightly short. The bigger gap is that our parry window is **6 f (100 ms)** with a 20-frame lockout on a miss, which is tighter and more punishing than MCoC's. |
| "Specials … the S3 cinematic freeze is implemented" | True, but our specials **cannot be launched from range in the MCoC sense** and the S3 "cinematic" is a static card over a frozen scene, not a camera sequence. Both are listed below. |

### 4.2 The table

Sizes: **S** ≈ a day, **M** ≈ 2-4 days, **L** ≈ a week or more.

| MCoC element | Carl's Arena today | Gap | Proposed change | Size | Phase |
|---|---|---|---|---|---|
| **5-hit combo, M-L-L-L-M** | `CHAIN` = 5 nodes, openers light/medium, any mix | None — parity | — | — | — |
| **Combo ends on 2nd medium / 4th light** | Chain simply caps at node 5; you can throw five mediums | Our grammar is looser than MCoC's, so the ender is a position not a *rule*, and "why open with a medium" never arises | Enforce MCoC's real rule: a chain ends on its 2nd medium or 4th light, whichever comes first. M-L-L-L-M becomes the only 5-hit string, which is the whole point | S | **12** |
| **Medium ender knockback** | `CHAIN.enders.medium.push = 90 px` + knockdown | MCoC's medium ender pushes to roughly the edge of light range and does **not** knock down — the opponent stays standing and can act | Keep 90 px; **drop the knockdown** from the medium ender. The knockdown is what removes the opponent's turn and flattens the loop into "combo, wait for getup, combo" | S | **12** |
| **Medium ender → chain straight into a special** | Not possible; a special is a separate input from neutral | This is MCoC's single most-used offensive pattern and we have none of it | Allow S1/S2 to be buffered during the medium ender's recovery and fire immediately | M | **12** |
| **Heavy cannot be chained into a combo** | In-combo heavy ender at node 4, 14-frame charge, fires `sigEffect` | Deliberate divergence, and a good one — it is our signature delivery system | Keep. Document as an intentional deviation | — | — |
| **Parry window** | `PARRY_WINDOW = 6 f` (100 ms), `PARRY_LOCKOUT = 20 f` | Tight; a missed parry costs you a third of a second of blocking | Widen to **8 f (133 ms)**; keep the lockout | S | **12** |
| **Parry stun 1.0-1.5 s** | `PARRY_STUN = 50 f` (833 ms) | ~20% short of MCoC's floor | Raise to **66 f (1.1 s)**, which is long enough to charge our 22-frame heavy and land it | S | **12** |
| **Parry → heavy is the canonical punish** | Possible but not taught, not rewarded, not reliable | The heavy's 22-frame charge plus 8-frame startup is 30 f against an 50 f stun — it works, but nothing tells the player | Add a **PUNISH!** popup and bonus damage when a heavy lands on a parry-stunned foe; teach it in the tutorial's parry lesson | S | **12** |
| **Stun-immune defenders** | `EFFECTS.stun` applies to anyone | No node-style rule can switch parry off, so parry is never situationally wrong | Add a per-encounter `stunImmune` flag; use it on one Floor-2+ boss | S | **10** |
| **Dexterity: +250 crit rating until 0.2 s after your next hit** | `EFFECTS.dexterity`: +0.2 crit chance, `dur: 180` (3 s), refreshed not stacked | Fixed timer lets the player bank a dodge | Change expiry to **"until 12 f after the next landed hit"**, capped at 180 f. Keeps the buff, restores the commit pressure | S | **12** |
| **Coldsnap-style "cannot evade"** | No effect disables dexterity | No counter-tool to the defensive read | Add a `chilled` effect that blocks the dexterity grant while held; give it to the shaman | S | **9** |
| **Medium / light / backdraft intercept** | One rule: any hit landing on a foe in light-or-medium startup. x1.5 dmg, +15 power, once per attacking move instance | Good, and correctly tier-agnostic. But MCoC distinguishes light (safe, low reward) from medium (risky, high reward) | Split the multiplier: **light intercept x1.3, medium intercept x1.8**. Same detection, different payout, so the player has a risk decision | S | **12** |
| **Backdraft setup: dash back mid-combo, medium their dash-in** | Reachable, but the AI's dash-in is not readable enough to plan around | The named MCoC technique effectively does not exist for us | Falls out of the AI cadence work below; add a **BACKDRAFT!** recognition when an intercept lands within 30 f of a dash-back out of a chain | S | **12** |
| **AI commits to readable dash-ins on a cadence** | `AI_TIERS.approach` = 90/70/50/40/30 frames between approach presses; `decideApproach` has a 12-frame neutral debounce | The cadence *exists* but has no telegraph, so a player cannot read it. This is the biggest single gameplay gap | Give the approach a **visible 6-frame wind-up** (weight shift, lean, a dust puff) before the dash begins, and hold the cadence steady enough to learn. Without this, intercept is guesswork | M | **12** |
| **AI has recovery after light/medium (what makes intercept possible)** | AI moves use the same `MOVES` recovery as the player | Parity, and it is why intercept works at all today | Keep. Add a test that asserts AI recovery is never shortened | S | **12** |
| **AI should NOT be frame-perfect** (MCoC's own community complaint) | `t5.react = 1` — a one-frame action cooldown | We have reproduced MCoC's worst feel property at the top tier | Floor `react` at **4 frames** across all tiers and add a **post-decision cooldown** during which the AI cannot re-react. Rebalance t5 through `attack`/`parry` instead | M | **12** |
| **AI baits by cutting its combo short** | `bait` field exists (0 → .4 by tier) | Partially there | Wire `bait` to a real M-L-L cut-and-wait, not just a pause | S | **12** |
| **Three-bar power meter, both fighters visible** | Three chevron cells at bottom-centre, **player only** (`Render.chevrons`) | The opponent's power is invisible, so baiting a special is impossible by construction | Add the **opponent's power bar under their health bar**, with a gold glow and pulse at 3 bars | S | **12** |
| **Specials launch from range** | `s1` range 130, `s2` 150, `s3` 220 — all require closing | We have the range numbers but a special from neutral rarely reaches | Give s1/s2 a **tracked dash-in like `medium`**, so a special from neutral travels. This is what makes neutral tense | M | **12** |
| **Specials are multi-hit and partially dexable** | s1 3 hits / s2 5 / s3 4, per-hit resolution exists | Structure is right. But the sub-hits resolve too fast to react between | Widen `gap` on s2/s3 by 2-3 f and let a dash-back mid-special dodge the remaining hits; grant dexterity if the **final** sub-hit is dodged | M | **12** |
| **Blocking a special still chips** | `CHIP = .08`, and `s3.unblockable = true` | Parity on s1/s2. Our S3 being fully unblockable is harsher than MCoC, where an S3 can be blocked for chip | Make s3 **blockable at 2× chip (16%)** instead of unblockable; keeps it scary, removes the un-interactive death | S | **12** |
| **Class triangle +40% / −20%** | `CLASS_BONUS = 1.15` symmetric | Much flatter than MCoC | Move to **1.25× advantage / 0.9× disadvantage** (est. — a compromise; the full 1.4/0.8 is too swingy for a 6-champion roster) and re-run the tier gate | S | **10** |
| **Ability Accuracy** | No concept | Debuffs cannot switch abilities off, so they are all just damage or stat deltas | Add `defensiveAccuracy` to the mods pool; have shock/chill reduce it; gate the AI's parry and block rolls on it | M | **9** |
| **Buffs/debuffs with real interaction** | 11 effects wired (`bleed, stun, armorBreak, fury, powerGain, powerBurn, regen, weakness, dexterity, critDmg, poison, armorUp`), all reachable via Phase 9 kits | Close to parity in breadth | Add **Nullify** (strip buffs) and **Power Lock**; both are cheap and both create real decisions | S | **9** |
| **Effect durations tunable per application** | `EFFECTS[id].dur` is frozen global; Phase 9 kits wanting 120 f stun got 60 f | Already logged as a Phase 9 deviation in `40_movedata.js` | Add a per-call `dur` override to `Effects.apply` | S | **9** |
| **Signature ability, sig level 1-200** | Phase 10 plans 1-100 from dupes | Planned, not shipped | Ship as planned | M | **10** |
| **Masteries: Parry, Dexterity, Perfect Block, Stupefy** | Phase 10 plans a 9-node, 40-point tree | Planned. Note the plan's `dexterity` node grants crit; MCoC's grants **crit rating** and its Perfect Block node is what actually lengthens parry stun | Add **Perfect Block** and **Stupefy** nodes so the parry stun has a progression axis, matching MCoC's actual structure | S | **10** |
| **Node buffs on quest maps** | No per-node rule modifiers | The single cheapest content multiplier MCoC has, and we have none | Add a `nodes: []` array per encounter: `stunImmune`, `powerGain`, `thorns`, `unblockableWindow`. Reuse the existing `Buffs` fight-start path | M | **10** |
| **PI / prestige** | Roster shows stars, rank, level | No single number summarising a champion | Compute a PI from hp/atk/stars/rank/level/sig; show it on the roster card and the map's REC. LVL hint | S | **10** |
| **Energy, arena, crystals, ISO, catalysts** | All present | Good parity for our scale | — | — | — |
| **Alliance quest/war** | Absent, explicitly cut | Correct call for a solo offline game | Keep cut | — | — |

### 4.3 Presentation gap table

| MCoC element | Carl's Arena today | Gap | Proposed change | Size | Phase |
|---|---|---|---|---|---|
| Hitstop per move class | 3 / 5 / 9 / 6 / 8 / 14 f (light/medium/heavy/s1/s2/s3) | At parity, arguably better documented | — | — | — |
| Directional shake, punch-in | `HITFEEL` in `72_fx.js`, vector shake, punch-in zoom | Parity | — | — | — |
| Camera zoom range | Sim 1.0-1.06 by distance, gameplay cap 1.12, cinematic cap 1.28 | Narrower than MCoC's, and the gameplay zoom is distance-only | Widen the distance ramp to 1.0-1.12 and let the punch-in ride on top to the 1.18 cap | S | **12** |
| S3 cinematic | 72-frame freeze + a static diagonal name card (`p7-s3.png`) | Reads as a title card over a paused game, not a camera sequence | Make the 72 frames a real sequence: dolly toward the attacker, desaturate the background, play the special's hits at 0.5× speed, then a snap back on the last hit | M | **12** |
| KO slow-motion | `slowmo` counter exists | Check it actually fires on KO and is long enough to read | Ensure a **20-frame 0.4× slow-mo** on the killing blow | S | **12** |
| Hit sparks | 8-spark burst plus per-class `impactBlunt`/`impactBlade`/`impactEnergy` rings | Good. Missing the directional smear along the attack's travel | Add a 3-frame smear quad oriented along the hit vector | S | **12** |
| Damage number colours | Single style | No crit/chip/DoT distinction, so the player cannot read what happened | Colour by kind: white normal, gold crit (larger), grey chip, red bleed tick, green heal | S | **12** |
| Combo counter | Gold italic, tilted, count-up tween, top-left | Parity or better | — | — | — |
| Health bar ghost trail | Bars snap to the new value | The size of a hit is not legible | Add a 12-frame trailing ghost fill behind the real value | S | **12** |
| Power meter | 3 chevron cells, player only, bottom-centre | See §4.2 — the opponent's is missing entirely | Add opponent power bar + 3-bar gold glow | S | **12** |
| Portrait frames with class gem | Shipped (Phase 8.4) | Parity | — | — | — |
| Idle breathing | `POSES.idle` has a two-keyframe breathing sway | Present but subtle; at rest the fighter still reads as posed | Add a slow secondary sway on the hips and a 2 px vertical bob at ~0.4 Hz | S | **12** |
| Anticipation frames | Poses exist per move; wind-up is short | The parry/dex read depends entirely on a legible wind-up, and ours is thin at 5-10 startup frames | Add a distinct **pre-startup pose** with a colour flash on the striking limb for medium and heavy | M | **12** |
| Dash smear / afterimage | `afterimage` fx exists, 20 frames, dexterity only | Dashes themselves have no smear | Push 3 ghost copies at decreasing alpha on every dash-in and dash-back | S | **12** |
| Foot dust | None | Dashes have no ground contact | 6-particle dust puff at the feet on every dash start and knockdown | S | **12** |
| Floor reflection | `Render.reflection` — mirrored ghost at 0.12 alpha | Present but very faint; in the shots it reads as nothing | Raise to ~0.22, add a vertical gradient fade and a slight horizontal wobble | S | **12** |
| Stage parallax + torch lighting | Shipped (Phase 8.3), per-column light model | Parity or better | — | — | — |
| Vignette | `Render.vignette` shipped | Parity | — | — | — |
| Announcer / crowd | Announcer text toggle, viewers score, commentary lines | Distinctive and on-theme; better than MCoC for this setting | Add a crowd-swell sound on intercepts and specials | S | **12** |
| Character silhouettes | Layered procedural vector bodies with faces and cloth (Phase 8) | A real step up, but outlines are uniform-weight and every look reads at a similar visual density | See §5 | M | **12** |

---

## 5. Graphics direction without hand-made art

Constraint: canvas 2D, procedural vector bodies, no asset files, perf gate of 6 ms/frame (we are at
0.297 ms, so there is enormous headroom — roughly 20× — and perf is not the binding constraint on
anything below).

Ranked by visual impact per hour of work.

**1. Anticipation and follow-through poses on every attack.**
Add a `pre` keyframe before startup and a `settle` keyframe after recovery in each `POSES` entry, with
the limb overshooting its target angle by 10-15° on the settle. *Sketch:* extend the pose arrays from
3 to 5 keyframes and let `Rig.solve` interpolate across a longer normalized t. *Perf:* nil — same
number of draw calls. *This is first because it is simultaneously the biggest look upgrade and a
gameplay fix: the parry and intercept reads depend on a legible wind-up.*

**2. A real floor reflection.**
`Render.reflection` already exists at 0.12 alpha and is effectively invisible in the shots. Raise to
0.22, clip to a 90 px band, apply a top-to-bottom alpha gradient so it fades with distance from the
feet, and add a 2 px sinusoidal horizontal offset that varies with y to suggest a wet, uneven floor.
*Sketch:* one extra `createLinearGradient` used as a composite mask on the existing mirrored draw.
*Perf:* one extra full-figure draw per fighter, already being paid; the gradient is cached. ~0.02 ms.

**3. Dash smears and afterimages.**
Three ghost copies of the rig at the last three frames' positions, alpha 0.3 / 0.2 / 0.1, tinted
toward the champion's own colour. *Sketch:* keep a 3-entry ring buffer of `{x, frame}` per fighter and
re-draw the cached body bitmap at those positions before the real one. *Perf:* 3 extra blits of an
already-cached bitmap during dashes only. ~0.05 ms while dashing.

**4. Per-hit spark sprites drawn procedurally, with a directional smear.**
Beyond the existing radial burst, add a stretched quad oriented along the attack's travel vector that
lives 3 frames. *Sketch:* `ctx.translate` to the contact point, `rotate` to `atan2` of the hit vector,
fill a white-to-transparent radial-gradient ellipse scaled 4:1. *Perf:* one gradient fill per hit.
Negligible.

**5. Foot dust and ground contact.**
A 6-particle puff at `y = FLOOR` on every dash start, landing, and knockdown; particles drift outward
and up, fading over 14 frames. *Sketch:* a new `FX` kind reusing the existing particle list. *Perf:*
6 arcs per event. Negligible.

**6. Idle breathing plus a secondary sway.**
`POSES.idle` already breathes between two keyframes. Add a slow hip rotation and a 2 px vertical body
bob at roughly 0.4 Hz, phase-offset per fighter so the two never sync up. *Sketch:* a sine term added
to the root transform in `Rig.solve`, driven by the fighter's own frame counter plus an id-derived
phase. *Perf:* nil.

**7. Variable-weight silhouette outline.**
Currently every part carries a uniform stroke. Make the outline thicker on the outer silhouette and
thinner on interior seams, and darken it toward the champion's own colour rather than pure black.
*Sketch:* draw each limb twice — once at `lineWidth + 2` in the dark tone with `lineJoin: 'round'`,
then the fill on top — for the outermost parts only. *Perf:* roughly doubles stroke calls for outer
parts, ~0.04 ms. This is the single change that most makes a vector rig read as "drawn" rather than
"assembled from shapes".

**8. Bloom on specials and crits.**
A cheap two-pass glow: draw the bright elements to a half-resolution offscreen canvas, draw it back
scaled up with `globalAlpha 0.4` and `globalCompositeOperation: 'lighter'`. *Sketch:* one reusable
half-res canvas, only allocated when a special is active. *Perf:* one half-res blit during specials
only. ~0.15 ms, and only for the ~30 frames a special lasts. **Risk:** `lighter` compositing on a
large canvas is the one item here that could actually show up on a low-end phone — gate it behind the
existing reduce-motion setting.

**9. Colour-graded stage lighting per floor.**
The per-column torch model (Phase 8.3) already tints fighters. Add a per-floor grade: a full-screen
multiply pass with a floor-specific tint, plus a matching shift to the torch colour. *Sketch:* one
`fillRect` with `globalCompositeOperation: 'multiply'` over the stage layer, colour from the encounter
data. *Perf:* one full-screen fill. ~0.03 ms. Makes each floor feel like a different place for almost
nothing.

**10. A stronger, animated vignette.**
The vignette exists. Make it react: tighten by ~15% during a special and on a KO, and pulse red at the
edges when the player is below 25% health. *Sketch:* animate the existing radial gradient's inner
radius off a single tween variable. *Perf:* the gradient must be rebuilt when the radius changes —
cache per 5% bucket. ~0.02 ms.

Everything above stays inside the 6 ms gate with roughly 5 ms to spare. The binding constraint is
implementation time, not frame time.

---

## 6. Sources

Fandom's MCoC wiki (`marvel-contestofchampions.fandom.com`) is behind a Cloudflare challenge and
returned HTTP 402/403 to direct fetches; where it appears below, the content came through search-result
extracts rather than a full page read, and is marked accordingly.

1. https://www.bluestacks.com/blog/game-guides/marvel-contest-of-champions/battle-system-marvel-contest-of-champions-en.html — the control scheme, the three-colour power octagon (green/yellow/red for S1/S2/S3), power filling from damage dealt and taken, and the explicit statement that blocking does not generate power.
2. https://www.bluestacks.com/blog/game-guides/marvel-contest-of-champions/mcoc-beginners-guide-en.html — the class triangle in full, the +40% / −20% class magnitudes, parry and dexterity definitions, and the mastery priority order for new players.
3. https://gamingonphone.com/guides/marvel-contest-of-champions-beginners-guide-and-tips/ — independent confirmation of the +40% / −20% class numbers and the six-class list; star ratings raising level and rank caps; signature abilities.
4. https://www.thegamer.com/marvel-contest-of-champions-mcoc-beginner-tips-tricks/ — the stat vocabulary (armor and armor penetration, crit rating, crit damage, crit resistance, block proficiency, block penetration, physical and energy resistance) and the units/ISO-8/crystals framing.
5. https://frontlinemcoc.home.blog/2019/08/19/mcoc-101-combos/ — the combo rules: second medium or fourth light ends a combo; M-L-L-L-M as the core string; why the medium ender chains into S1/S2; M-L-L-L-L and M-L-L as the alternatives; heavies not chainable except Wasp.
6. https://www.mcocguideblog.com/2017/05/mcoc-mastery-guide.html — the per-rank mastery numbers table in §1.13, including Dexterity's +250 critical rating lasting until 0.2 s after the next hit, Parry's 1.5 s ceiling, Stupefy's +0.1 s, Precision 2%, Cruelty 10%, Perfect Block 1%.
7. https://www.mcoc-guide.com/how-to-parry-well-timed-block-what-is-it/ — the parry timing cue (block when the attack starts, not when they dash), the Limber prerequisite, and that parry fails against stun-immune targets and nodes.
8. https://forums.playcontestofchampions.com/en/discussion/182975/parry-mastery-description-update-and-core-refund — parry's 1 s base stun on basic-attack contact and the +0.5/0.7/1.0 s rank bonuses (read via search extract).
9. https://forums.playcontestofchampions.com/en/discussion/182991/bonus-parry-stun-time-vs-perfect-block-mastery-by-the-numbers — that the bonus stun is scaled by Perfect Block Chance, so the listed maximum is never reached unmodified; Stupefy as the reliable alternative (read via search extract).
10. https://forums.playcontestofchampions.com/en/discussion/272945/backdraft-intercepts-core-mechanics-broken — the backdraft intercept's exact setup (dash back after the third light, medium into their dash-in) and its fragility when the AI steps instead of dashing (read via search extract).
11. https://forums.playcontestofchampions.com/en/discussion/337882/how-to-medium-intercept-safely — the enabling condition for all intercepts: the AI needs recovery frames after its light and medium attacks (read via search extract).
12. https://forums.playcontestofchampions.com/en/discussion/386605/medium-intercepts-are-extremely-unreliable-in-latest-update — the 60 fps medium-intercept loss bug and its fix, which is the evidence that the real intercept window is a frame or two wide (read via search extract).
13. https://forums.playcontestofchampions.com/en/discussion/comment/2797820 — the AI dev-diary discussion: frame-perfect reactions, instant backdraft intercepts on the frame you dash, blocking between combo hits, and the comparison to Tekken/MK/Injustice deliberately adding AI reaction delay. The basis for §1.8 and for the anti-frame-perfect recommendation in §4.
14. https://forums.playcontestofchampions.com/en/discussion/292674/damaging-debuffs-and-their-secondary-effects — the two debuff families and their secondary effects: damaging debuffs reducing attack/armor/crit/block-penetration/combat-power-rate, and accuracy debuffs reducing Defensive Ability Accuracy and Block Proficiency (read via search extract).
15. https://www.mcocguideblog.com/2017/05/champions-immune-to-bleed-poison-incinerate-coldsnap-shock-abilities.html — Coldsnap preventing Evade, Incinerate removing Perfect Block, Poison reducing health recovery.
16. https://marvel-contestofchampions.fandom.com/wiki/Block_Proficiency and .../Block_Penetration — block proficiency as the damage-mitigation stat, block penetration as its counter, and that a Perfect Block is unaffected by block proficiency because damage is already zero (read via search extracts; direct fetch blocked).
17. https://www.mcocguideblog.com/2017/04/mcoc-tips-by-kabam.html — the mode list (Story Acts 1-9, Event Quest tiers, AQ, AW, Arena, Battlegrounds, Towers), the resource list (units, gold, battlechips with 83%/15% arena-crystal odds, T1-T5 catalysts, signature stones, awakening gems), progression titles, masteries unlocking at level 6, and the independent confirmation of the class cycle.
18. https://frontlinemcoc.home.blog/2020/06/10/what-is-prestige/ — Prestige as the average base PI of the top five champions, excluding masteries; the 13,719 Hero Rating vs 10,481 Prestige worked example; 6★ Rank 2 at ~Sig 160 passing a maxed 5★; Prestige driving alliance quest difficulty.
19. https://playcontestofchampions.com/news/champion-spotlight-cassandra-nova/ and .../champion-spotlight-thanos-deathless/ and .../champion-spotlight-madelyne-pryor/ — Kabam's own text confirming the parry→heavy punish (heavy after a parry re-stuns and opens offense), the 0.75 s stun passive from charging a heavy after a non-combo-ending attack, and parry stun pausing during a heavy charge (read via search extracts).
20. https://marvel-contestofchampions.fandom.com/wiki/Alliance_Quest — Alliance Quest energy: max 6, +1 per 45 minutes, 1 per tile; and that daily quests rotate by class Monday through Saturday with difficulty setting catalyst tier (read via search extract).

Consulted and yielding only titles, not usable transcripts (YouTube pages do not expose captions to a
text fetch): https://www.youtube.com/watch?v=VRPXxHrgDnY (parry tutorial),
https://www.youtube.com/watch?v=OzayoRV9GlY ("The Basics of Light Attack Intercepts"),
https://www.youtube.com/watch?v=IL1Uri5vwqc (light intercepts),
https://www.youtube.com/watch?v=27kRDgfAVkI (backdraft intercepts). The mechanics those videos cover
are captured above from the written forum threads on the same techniques.

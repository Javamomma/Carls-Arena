# Phase 10: Progression — Stars, ISO Curve, Catalyst Tiers, Signature Levels, Masteries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner asked to "think through the level up process." Replace the placeholder meta (stars 1-5, level cap 10×rank, flat ISO) with the comparison notes' progression: stars 1-6, rank-gated level caps, an ISO curve and income that pay about one rank of levels per floor, tiered class catalysts dropped by floor bosses, signature levels from dupes (which make Phase 9's passives scale), a 40-point mastery tree earned by clearing nodes, and two new crystals — all inside the existing 20-minute daily loop. Save v3 with migration.

**Inputs:** `docs/design/mcoc-comparison-notes.md` §5 (authority for every number below); Phase 9's `def.passive` and `EFFECTS` (sig scaling multiplies passive potency); `src/12_meta.js` (Save v2, Stats, Energy, Crystal, Quest, Rewards, Roster, Arena, SHOP_ITEMS, Meta.buy) and `src/85_screens.js` (roster, crystal, shop, map, arena screens).

**Architecture:** Save v3 adds `catalysts {cls:{tier:n}}`, `fragments {champ:n}`, `sig {champ:n}`, `masteries {id:points}`, `masteryPoints`, and 6-star support; `migrate()` fills defaults. Stats gains the new caps and curves; `Rewards.grant` gets the new income, boss catalyst drops, and mastery points on first clears; Roster gets rankUp with tiered catalysts and `awaken`/`sigUp`; a new `src/14_masteries.js` (meta) holds the tree and exposes `Masteries.mods(save)` that the sim reads once at fight start through the existing champion-stat path (masteries apply as fight-start buffs via `Buffs`, so the sim stays pure). Screens: roster card shows sig level and rank-up requirements; a Masteries screen; crystal screen gains ISO and Catalyst crystals; the map shows mastery-point rewards on uncleared nodes.

**Rulings (2026-09-22):**
1. Numbers verbatim from §5: rank cap `min(stars,5)`; level cap `10+5*rank`; ISO cost `8*L*stars`; node ISO income `round(20*n^1.4)`, boss ×2; rank `r→r+1` costs `r` class catalysts of tier `r`; boss drops one tier-`min(n,5)` catalyst of its class; kiosk sells tier 1 (2000 gold), tier 2 (6000 gold), tier 3 (units); dupes give 5 shards + 1 Awakening Fragment; 10 fragments awaken (sig 1), each further dupe +10 sig, cap 100; passive potency `base*(1+sig/100)`; masteries 40 points (1 per first-time node clear, 3 per boss), max 5 per node, costs 1/1/2/2/3; ISO crystal 800 gold → 200-600 ISO; Catalyst crystal 150 units → one tier 1-3; 6★ rank cap 3.
2. Masteries affect the sim only through fight-start `Buffs` entries computed by `Masteries.buffsFor(save)`; batch/matrix/tier gates run with no masteries and stay bit-identical; a separate batch flag `--masteries max` measures the ceiling.
3. Save migration v2→v3 is tested with a real v2 fixture (the shipped default plus a played save); no field is lost; unknown fields are preserved.
4. The energy regen mastery (Recovery) changes `Energy.regenMs`; the injectable `Energy.now` clock makes this testable.
5. Every new currency shows in the HUD wallet strip and every new screen fits 844×390 with no clipping (`--phone-check`).
6. Seams from the Phase 8 final review: every new list screen copies the `.path`/`.node` pattern (`flex-shrink:0` items, `justify-content:flex-start` container) and gets a first-item-visible assertion in `--phone-check`; champion identity chips reuse `Screens.portraitCard(look, size, cls)`; `Rig.portrait` sizes are capped to {56, 112} unless a size is added to the cache-eviction scheme; the door-card cache key gains any per-node completion tier this phase introduces.

## Global Constraints
Everything from Phases 1-9. Plus: `--screens-smoke`, `--phone-check`, `--e2e` (which plays a floor and opens a crystal) green; determinism of meta randomness via `RNG(Save.data.seed++)` unchanged.

## Interfaces (frozen for Phase 10)
```
// 12_meta.js
Save.VERSION = 3; Save.data adds: catalysts:{brawler:{1:0,2:0,3:0,4:0,5:0}, caster:{...}, trickster:{...}, tank:{...}}, fragments:{}, sig:{}, masteries:{}, masteryPoints:0, clearedNodes:[] (ids), roster[champ].stars 1..6
Stats.caps = {stars:[1,6], rank: s=>Math.min(s,5), level: r=>10+5*r}; Stats.isoCost(L, stars) = 8*L*stars; Stats.sixStarRankCap = 3
Stats.mul(entry) unchanged in shape; passives read Passives.potency(champ) = base*(1+ (Save.data.sig[champ]||0)/100)
Rewards.grant(node): iso = round(20*n^1.4) (×2 boss), xp as today, boss drops {catalyst:{cls, tier:min(n,5)}}, masteryPoints +1 first clear (+3 boss first clear)
Roster.levelUp(champ): costs Stats.isoCost; Roster.rankUp(champ): needs rank catalysts of tier rank in the champ's class; Roster.onDupe(champ): +5 shards, +1 fragment; Roster.awaken(champ): 10 fragments → sig 1; Roster.sigUp(champ): +10 per further dupe, cap 100
Crystal.kinds adds iso {cost:{gold:800}, roll: 200..600 iso}, catalyst {cost:{units:150}, roll: tier 1..3 of a random owned class}
SHOP_ITEMS adds cat1 {gold:2000}, cat2 {gold:6000}, cat3 {units:60} (class chosen on the shop screen)

// 14_masteries.js (meta; loaded after 12_meta.js, before 47_buffs.js is used at fight start)
MASTERIES = { cruelty:{tree:'offense', max:5, per:{crit:.02}}, assassin:{tree:'offense', max:5, per:{light1ArmorIgnore:.06}}, liquidCourage:{tree:'offense', max:5, per:{atkUnder25:.04}},
              blockProficiency:{tree:'defense', max:5, per:{blockProf:.03}}, coagulate:{tree:'defense', max:5, per:{bleedDurMul:-.08}}, dexterity:{tree:'defense', max:5, per:{dexCritDelta:.04}},
              recovery:{tree:'utility', max:5, per:{energyRegenMin:-1}}, salt:{tree:'utility', max:5, per:{powerOnBlock:2}}, despair:{tree:'utility', max:5, per:{enemyRegenMul:-.1}} }
MASTERY_COST = [1,1,2,2,3]   // cost of point k (k=1..5)
Masteries.canBuy(id), Masteries.buy(id), Masteries.refund() (full refund, free), Masteries.buffsFor(save) → [{id:'mastery', ...mods}] consumed by Buffs at fight start; Masteries.total(save) ≤ 40

// Screens (85_screens.js / 00_head.html)
Roster card: stars ★×n (6 max), rank r/cap, level L/cap, ISO cost to next, rank-up requirement line ("2× TIER-2 BRAWLER CATALYST"), SIG n or AWAKEN (k/10), buttons LEVEL UP / RANK UP / AWAKEN
Masteries screen: three columns, 9 nodes, point pips, cost, REFUND; reachable from the title and the roster
Crystal screen: four crystals; Shop: catalyst rows with class picker; map nodes show "+1 MP" until cleared
HUD wallet strip: gold, units, ISO, MP
```

---

### Task 10.1: Save v3, caps, ISO curve and income
Files: `src/12_meta.js`, `src/90_tests.js` (v2 fixtures), `tests/harness.py` (`--reset-save` untouched).
- Tests: migrate v2 default and a played v2 save → v3 with every listed field defaulted and no loss; caps (6★ rank 3 cap; level cap 15/20/25/30/35); isoCost table (8, 240, 800 examples); income table (20/53/93/139/190, boss ×2); level-up refuses when short; Stats.mul unchanged for existing entries.
- Commit `feat: save v3, star/rank/level caps, ISO curve and income`.

### Task 10.2: Catalysts, dupes, signature levels
Files: `src/12_meta.js`, `src/49_passives.js` (Passives.potency), `src/85_screens.js` (roster lines), `src/90_tests.js`.
- Tests: boss drop tier by floor; rankUp consumes `r` tier-`r` class catalysts and refuses otherwise; kiosk rows; dupe → 5 shards + 1 fragment; awaken at 10; sigUp +10 cap 100; potency scaling `base*(1+sig/100)` reaches a Phase 9 passive (Spite fury stacks value); catalyst crystal rolls only owned classes; ISO crystal range; pity untouched; roster card text.
- Commit `feat: catalyst tiers, dupes, signature levels`.

### Task 10.3: Masteries
Files: create `src/14_masteries.js`; `src/12_meta.js` (mastery points on first clears, clearedNodes), `src/47_buffs.js` (a `mastery` buff applying the mods), `src/60_fight.js`/`50_fighter.js` (light1 armor ignore, atkUnder25, powerOnBlock hooks — read from buffs only), `src/12_meta.js` Energy (Recovery), `src/85_screens.js`/`00_head.html` (Masteries screen), `tests/batch.py` (`--masteries max`), `src/90_tests.js`.
- Tests: point income (1/node, 3/boss, first clear only, total ≤ 40 across five floors); cost ramp; refund; each mastery's mod at 5 points (crit +.10, light1 ignores 30%, +20% atk under 25%, blockProf +.15, bleed −40% duration, dex crit +.20, regen −5 min, +10 power on block, enemy regen −50%); buffsFor with no masteries yields nothing (batch bit-identical); `--masteries max` batch table recorded; Masteries screen phone-check.
- Commit `feat: 40-point mastery tree`.

### Task 10.4: Screens, wallet, crystals, close-out
Files: `src/85_screens.js`, `src/00_head.html`, `src/70_render.js` (wallet strip), `src/12_meta.js` (crystal kinds, shop rows), `tests/harness.py` (`--e2e` opens the ISO crystal and buys a mastery point), `docs/ARENA.md` (Phase 10 exit table + progression table), `README.md` (Progression section), `tools/shots.sh` (`p10-{roster,masteries,crystal}.png`), the program file.
- Tests: screens smoke + phone-check at 844×390; e2e path; wallet strip shows all four currencies; commit `docs: Phase 10 close-out`.

**Phase 10 exit criteria:** v3 save with migration; caps/curves/income/catalysts/sig/masteries live and visible; batch gates bit-identical with no masteries and a recorded max-masteries ceiling; screens fit the phone; docs and shots; final whole-branch review clean; pushed.

# Phase 3: AI Tiers, Buffs, Floors, and New Rigs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fights against the dungeon feel like a progression: five AI tiers that read the player (intercept, bait, punish), node buffs that change how a fight must be played, two authored floors with bosses, and the remaining roster rigs (Princess Donut as a real cat, Mongo as a big brute, plus three new mobs and two bosses) so Phase 4's quest map has content to hang on.

**Architecture:** The sim stays the authority: buffs are pure hooks on `Fight` driven by an `Encounter.buffs[]` list; AI tiers are data (profile tables) plus three new behaviours in one controller; floors are data in `ENCOUNTERS` grouped by `FLOORS`. Presentation adds two rig kinds (`quad` for Donut, `big` for Mongo/bosses) behind the same `Rig.draw` entry point via a `rig` field on each def. A batch tool measures win rates so difficulty claims are numbers, not adjectives.

**Tech Stack:** unchanged (canvas 2D, Python Playwright harness).

**Spec:** the Phase 1 plan's "## Spec", the Phase 2 plan's rulings, plus the rulings below.

## Rulings (2026-09-21)

1. **Opponents approach by dashing, not walking.** MCoC has no free walk; the AI closes with mediums and dash-ins. The Phase 2 `walk` pose is triggered by presentation from `fighter.dx` and covers pushes/lunges. No WALK sim state is added.
2. **Tier names are `t1..t5`; `basic/brawl/brute/dummy` stay as aliases** (`basic→t2`, `brawl→t3`, `brute→t3` with heavy bias) so existing tests, encounters and the matrix keep working.
3. **Buffs never touch presentation.** A buff is `{id, onFrame?(fight, holder, foe), onHit?(fight, att, def, dmgRef), onBlock?(...)}`; the HUD shows buff badges by reading `encounter.buffs`.
4. **Bosses are mobs with a `boss:true` def flag, a bigger rig, a unique S3 override, and one signature buff.** No boss-only mechanics engine.
5. **New rigs are separate bone sets, not recolors.** `Rig.solve` dispatches on `look.rig` (`human` existing, `quad`, `big`).

## Global Constraints

Everything from Phases 1-2 (single built `index.html`, `file://`, 854x480, `STEP=1/60`, no `Math.random`/`performance.now` in sim, sim/presentation boundary, `presRng` for presentation randomness, gate before every commit, exact Fable 5.1 trailer). Plus: `--matrix` and `--batch` must exit 0 at each task's end; determinism test unchanged; `EDGE_PAD` clamp respected by every new rig's width (rigs wider than 2×`EDGE_PAD` are not allowed).

## File structure

```
src/40_movedata.js   MODIFY: CHAMPS.donut (real stats), CHAMPS.mongo, MOBS.skeleton, MOBS.shaman, MOBS.grub, BOSSES.grull, BOSSES.mother_rat (boss:true), rig fields ('human'|'quad'|'big')
src/45_encounter.js  MODIFY: FLOORS = [{floor, name, nodes:[encounterId...], boss:encounterId}], ENCOUNTERS gains buffs:[] and ~12 more entries; Encounter.resolve resolves buffs to BUFFS objects
src/47_buffs.js      NEW: BUFFS table + Buffs.apply(fight, holder, list)
src/55_ai.js         MODIFY: TIERS t1..t5 + aliases; intercept, bait, punish behaviours; boss profiles
src/60_fight.js      MODIFY: buff hooks (onFrame per fighter each step; onHit/onBlock inside resolve via dmgRef), fighter.buffs, fighter.armorBonus/regen fields
src/68_rig.js        MODIFY: LOOKS for new characters; Rig.solve dispatch; RigQuad (cat), RigBig (brute) bone sets/poses/draw
src/70_render.js     MODIFY: buff badges under the enemy bar; boss name plate
src/80_game.js       MODIFY: G.startFight({floor, node}) sugar; encounter buffs wired
src/90_tests.js      MODIFY: tests per task (target 85+)
tests/batch.py       NEW: win-rate table over N seeds per (p1, ai tier, encounter)
docs/ARENA.md        MODIFY: batch table, Phase 3 exit table
docs/shots/          p3-*.png
```

## Interfaces (frozen for Phase 3)

```
AI.TIERS = {t1:{react:24,attack:.03,block:.25,parry:.02,dash:.01,special:.3,heavy:0,intercept:0,bait:0,punish:0},
            t2:{react:14,attack:.04,block:.5, parry:.1, dash:.02,special:.6,heavy:0,intercept:.1,bait:0,punish:.2},
            t3:{react:8, attack:.09,block:.65,parry:.3, dash:.04,special:.9,heavy:.2,intercept:.3,bait:.1,punish:.5},
            t4:{react:5, attack:.12,block:.75,parry:.45,dash:.06,special:1, heavy:.3,intercept:.5,bait:.25,punish:.8},
            t5:{react:3, attack:.15,block:.85,parry:.6, dash:.08,special:1, heavy:.35,intercept:.7,bait:.4,punish:1}}
AI.profiles keeps dummy/basic/brawl/brute as aliases resolved through AI.resolveProfile(name) -> tier object
Behaviours (inside AI.make): intercept = when foe.state==='ATTACK' && foe.moveName==='medium' && foe.f<=2 && rng<p.intercept → press light (interrupts the dash-in); bait = when idle at dist in [140,220] && rng<p.bait → hold heavy for 6 frames then dashBack (the feint); punish = when foe.state in {STUNNED,'KNOCKDOWN' getup i-frames ended} or foe.parryLock>0 && rng<p.punish → medium then light chain
BUFFS = { regen:{onFrame: +0.05% maxHp per frame to holder}, armorUp:{onHit: dmg *= .7 when holder defends}, powerGain:{onHit: holder gains ×1.5 power}, unblockableSpecials:{onHit: holder's specials ignore block}, degen:{onFrame: foe loses 0.03% maxHp per frame while holder alive}, thorns:{onBlock: attacker takes 20% of chip back} }
Buffs.apply(fight, holder, ids[]) sets holder.buffs = resolved objects; Fight.step calls b.onFrame(fight, holder, foe) for each; Fight.resolve calls b.onHit(fight, att, def, ref) with ref={dmg} for defender-side and attacker-side buffs, and b.onBlock(fight, att, def, ref) with ref={chip}
FLOORS = [ {floor:1, name:'THE DEPTHS', nodes:['f1_goblin','f1_skel','f1_hob','f1_shaman','f1_goblin2'], boss:'f1_grull'},
           {floor:2, name:'THE SEWERS', nodes:['f2_grub','f2_skel2','f2_shaman2','f2_hob2','f2_grub2'], boss:'f2_mother'} ]
ENCOUNTERS[id] = {floor, name, enemy, tier:'t1'..'t5'|alias, hpMul, atkMul, buffs:[ids], boss?:true}
G.startFight({floor:1, node:2}) resolves FLOORS[floor-1].nodes[node] (node === 'boss' resolves the boss)
DEFS gains: donut (cls caster, rig 'quad', hp 820 atk 70), mongo (cls tank, rig 'big', hp 1300 atk 66, scale 1.25), skeleton (rogue, human, hp 260 atk 34), shaman (caster, human, hp 240 atk 44, s1 override 6-hit), grub (beast, quad, hp 380 atk 40, scale .8), grull (boss, big, tank, hp 1600 atk 70, buffs ['armorUp']), mother_rat (boss, quad, beast, hp 1400 atk 62, scale 1.3, buffs ['regen'])
Rig.solve(look, poseKey, t01, face) dispatches on look.rig: 'human' (existing), 'quad' (bones: hip, spine, chest, neck, head, tail1, tail2, fl1, fl2, fr1, fr2, bl1, bl2, br1, br2 — four legs with two segments, feet at y=0), 'big' (human bone names, different proportions and a hunched spine offset, hands as fists 1.5×)
POSES_QUAD[key] and POSES_BIG[key] for the same 22 keys; Rig.poseFor unchanged
tests/batch.py --n 30 --p1 carl --ai t1,t2,t3,t4,t5 [--encounter id] prints p1 win rate per tier and exits 1 if any tier's win rate is not monotone non-increasing from t1 to t5 by at least 40 points t1→t5 (with --bot auto: a scripted 'competent' bot that blocks mediums and chains lights when in range)
```

---

### Task 3.1: AI tiers and the three behaviours

**Files:** modify `src/55_ai.js`, `src/90_tests.js`.

- [ ] **Step 1: Failing tests**
```js
Test.add('tiers t1..t5 exist, aliases resolve, dummy stays inert',()=>{for(const t of ['t1','t2','t3','t4','t5'])ok(AI.TIERS[t]);eq(AI.resolveProfile('basic'),AI.TIERS.t2);eq(AI.resolveProfile('brawl'),AI.TIERS.t3);ok(AI.resolveProfile('brute').heavy>=.5);const f=mkFight({ctrl2:AI.make('dummy',3)});run(f,600);eq(f.log.filter(e=>e.type==='hit'&&e.who===-1).length,0)});
Test.add('t5 intercepts a dash-in medium with a light',()=>{const f=mkFight({ctrl1:Ctrl.script(Array.from({length:20},(_,i)=>({f:i*40,intent:{medium:true}}))),ctrl2:AI.make('t5',4)});f.p1.x=f.p2.x-260;run(f,800);const ai=f.log.filter(e=>e.type==='hit'&&e.who===-1);ok(ai.length>0,'ai landed');ok(f.log.some(e=>e.type==='hit'&&e.who===-1&&e.move==='light1'),'a light interrupted')});
Test.add('t4 punishes a parried (stunned) player',()=>{const f=mkFight({ctrl1:Ctrl.script([{f:0,until:600,intent:{light:true}}]),ctrl2:AI.make('t4',5)});closeIn(f);run(f,900);ok(f.log.some((e,i)=>e.type==='parry'&&f.log.slice(i+1,i+30).some(h=>h.type==='hit'&&h.who===-1)),'hit within 30 frames after a parry')});
Test.add('t1 loses to t5 head to head over 5 seeds',()=>{let w5=0;for(let s=1;s<=5;s++){const f=mkFight({ctrl1:AI.make('t1',s),ctrl2:AI.make('t5',s+100),clock:120});run(f,7200);if(f.winner===f.p2)w5++}ok(w5>=4,'t5 wins '+w5+'/5')});
```
(`Fight.emit` must include `move: att.moveName` on hit/block entries for the second test — add it; existing log consumers ignore extra fields.)
- [ ] **Step 2-5:** implement TIERS, resolveProfile, behaviours; keep rng consumption identical for `dummy/basic/brawl` when their new fields are 0 (gate each new roll on the field being > 0, as 2.8 did); run the gate (`--sim`, `--matrix`); commit `feat: AI tiers t1-t5 with intercept, bait, punish`.

### Task 3.2: Buffs framework
**Files:** create `src/47_buffs.js`; modify `src/60_fight.js`, `src/45_encounter.js`, `src/70_render.js` (badges), `src/90_tests.js`.
- [ ] Tests: regen heals 0.05%/frame (600 frames → +30% capped at max); armorUp cuts a light from 60 to 42; powerGain ×1.5; unblockableSpecials makes a blocked s1 hit; degen ticks the foe; thorns returns 20% chip; `Encounter.resolve` maps buff ids to objects and unknown ids throw; `Fight` with no buffs is bit-identical to before (determinism test unchanged).
- [ ] Commit `feat: node buffs framework`.

### Task 3.3: Floors, encounters, bosses (data)
**Files:** modify `src/40_movedata.js` (new defs incl. `boss:true`, overrides), `src/45_encounter.js` (FLOORS, ENCOUNTERS), `src/80_game.js` (`{floor,node}` sugar, boss plate), `src/70_render.js`, `src/90_tests.js`, `tests/harness.py` (`--floor N --node K|boss`).
- [ ] Tests: every FLOORS node and boss resolves; every referenced enemy exists in DEFS; boss defs have `boss:true`, an s3 override and ≥1 buff; `G.startFight({floor:2,node:'boss'})` sets `G.encounter.boss`; hp/atk multipliers scale with floor (`hpMul = 1 + 0.15*(floor-1)`).
- [ ] Commit `feat: two floors of encounters with bosses`.

### Task 3.4: Quadruped rig (Donut, Grub, Mother Rat)
**Files:** modify `src/68_rig.js` (RigQuad bones, POSES_QUAD, draw: cat with ears, tail, whiskers, a tiara for Donut; grub segmented; rat), `src/40_movedata.js` (donut real look), `src/90_tests.js`; shots `docs/shots/p3-donut-*.png`.
- [ ] Tests: `Rig.solve(LOOKS.donut,'idle',0,1)` returns the quad bone set with four feet at y≈0; every POSES_QUAD key exists; `light1` at t 0.5 moves a front paw forward; `Render.frame` with donut as p1 and grub as p2 does not throw.
- [ ] Screenshots for idle/light1/heavy/s3/hit; reviewer judges "reads as a cat with a tiara".
- [ ] Commit `feat: quadruped rig for Donut, Grub, Mother Rat`.

### Task 3.5: Big rig (Mongo, Grull)
**Files:** `src/68_rig.js` (RigBig proportions, hunched spine, fists, POSES_BIG), `src/40_movedata.js`, `src/90_tests.js`; shots `docs/shots/p3-mongo-*.png`.
- [ ] Tests: big rig height ≥ 1.25× human at scale 1; width within 2×EDGE_PAD; every POSES_BIG key; no-throw render.
- [ ] Commit `feat: big rig for Mongo and Grull`.

### Task 3.6: Batch tool, balance pass, close-out
**Files:** create `tests/batch.py`; modify `src/55_ai.js` (tune), `docs/ARENA.md` (batch table, Phase 3 exit table), main plan (Phase 3 done).
- [ ] `--batch` (or `tests/batch.py`) prints win rate of a competent scripted bot vs t1..t5 and vs each floor node; requirement: monotone non-increasing, t1 ≥ 80%, t5 ≤ 30% for the bot; tune tier numbers until true; paste table.
- [ ] Shots: `p3-floor1-boss.png`, `p3-floor2-boss.png`.
- [ ] Commit `docs: Phase 3 close-out`.

**Phase 3 exit criteria:** ≥ 85 tests; `--matrix` extended to the new defs clean; batch table monotone; reviewer names every new character from the shots; final whole-branch review clean; pushed.

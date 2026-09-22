# Phase 8: Art Upgrade — Vector Bodies, Stage Lighting, HUD, Screen Art — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner's verdict was "it's just stick figures right now." Ship route (a) from the comparison notes: richer procedural vector bodies for all eleven looks (layered shapes, gradients, outlines, real faces, cloth), stage depth and lighting, the reference HUD, and door/roster art — with zero new asset files, so the game stops looking like a prototype this week and every look still upgrades in place later when a sprite sheet lands through the existing atlas hook.

**Inputs:** `docs/design/mcoc-comparison-notes.md` §4 (art direction, the ranked polish list) and `docs/reference/rendition.jpg` (untracked reference: lit wet-stone dungeon, torchlit key light upper-left, cool rim right). The Phase 6/7 shots in `docs/shots/` are the "before".

**Architecture:** Rendering stays procedural canvas. `src/68_rig.js` gains a body-style layer between the FK solve and the stroke: each bone segment is drawn as a layered limb (fill gradient along the bone, darker outline, cloth/armor overlay from the look) instead of a capsule; heads get a face module (eyes with whites/iris, brow, mouth by state, hair/ears/horns from the look); torsos get a chest/abdomen split and a cloth overlay. Lighting is a per-fighter tint computed from torch positions on the stage (presentation only). Stage gets a far layer with blur, torch flicker driving floor falloff, and a specular streak under each fighter. HUD gets chevron caps, class-gem portrait frames, and the gold italic combo counter. The atlas hook stays the override path per pose. No change touches the sim.

**Rulings (2026-09-22):**
0. The Phase 7 final review's seams are fixed first (Task 8.0) so the art pass can retune feel without touching sim data or the tier gate.
1. Zero new asset files remain the default; everything here is procedural. Sprite sheets are Phase 11.
2. Every look's new body must pass the existing HUD-clearance, `Rig.extent` reach, and pose tests unchanged — the silhouette budget is frozen; the art adds detail inside it.
3. Performance: `--perf 600` stays under 6 ms per frame on the Playwright desktop run; body gradients are cached per look+bone+face in an offscreen cache keyed by zoom bucket (0.1 steps), never rebuilt per frame.
4. `presRng` for all flicker/particles; determinism tests and the purity scan stay green.
5. reduceMotion (Settings) disables flicker and specular animation but not the static lighting.

## Global Constraints
Everything from Phases 1-7 (single built file, sim boundary, determinism, gate before every commit, exact Fable 5.1 trailer, no controller commits while an implementer runs, intent contract frozen). Plus: `--perf 600` < 6 ms; `--screens-smoke`/`--phone-check` green; `tools/shots.sh` full set regenerated at the end and reviewed by eye by the controller.

## Interfaces (frozen for Phase 8)
```
// 68_rig.js
LOOKS[id].body = { outline:'#hex', skinShade:[-0.25, 0.18], cloth:{ torso:'shirt'|'vest'|'bare'|'robe'|'chitin'|'fur'|'bone'|'plate', legs:'pants'|'shorts'|'bare'|'robe'|'fur'|'bone', primary, secondary }, face:{ eyes:'human'|'cat'|'rat'|'skull'|'goblin'|'none', iris:'#hex', brow:true|false, mouth:'human'|'fangs'|'snout'|'none', hair:'crop'|'long'|'bald'|'mohawk'|'none', ears:'human'|'pointed'|'cat'|'rat'|'none', horns:false|'small'|'big' } }
BodyStyle.limb(c, x1,y1,x2,y2, w, look, opts{cloth, lit})   // gradient fill + outline, replaces the capsule stroke
BodyStyle.torso(c, chest, hip, look, face, lit)               // chest/abdomen split, cloth overlay
BodyStyle.head(c, x,y, r, look, face, state, lit)             // skull + face module; state ∈ idle|hit|ko|block|attack|win
BodyStyle.cache(key, w, h, paint) → canvas                     // offscreen cache keyed by look|bone|face|zoomBucket
Rig.draw/drawBig/drawQuad call BodyStyle instead of the stroke primitives; Atlas override path unchanged
Rig.portrait(look) uses BodyStyle.head with state 'idle' at 56 px and 112 px (roster)

// 65_stage.js
Stage.build(themeId) adds layers: far (blurred arches/pillars, parallax 0.4), torches[] {x, y, flicker seed}, floor specular streak per fighter
Stage.lightAt(x) → {tint:'#rrggbb', k:0..1, rimSide:+1|-1} from the two nearest torches (presentation only; cached per 8-px column)
Stage.draw(c, cam, frame, st) renders far → torches → mid → floor falloff; Render draws fighters with Stage.lightAt(f.x)

// 70_render.js HUD
HUD.bar(c, x, y, w, h, pct, side) draws chevron-capped bars; HUD.portraitFrame(c, x, y, size, cls) draws the frame with a class gem (cls colors: brawler gold, beast green, caster violet, undead bone, brute rust); combo counter: gold italic 900-weight, tilted ±6°, count-up tween, class gem color for enemy side
Screens (85_screens.js / 00_head.html): map doors get a procedural door card (arch, torch, floor-number banner, enemy portrait, REC. LVL); roster cards use the 112-px portrait and class gem
```

---

### Task 8.0: Pre-art seams (from the Phase 7 final review)
Files: `src/40_movedata.js` (remove HITFEEL), `src/72_fx.js` (HITFEEL lives here; `FX.hitfeel(cls, dir, opts)` resolves a bare descriptor), `src/60_fight.js` (resolve pushes `{kind:'hitfeel', cls:'light'|'medium'|'heavy'|'s1'|'s2'|'s3'|'intercept', dir, last}` and nothing else about shake/punch), `src/50_fighter.js` (`Fighter.resetPerMove()` called from startMove; every per-move flag listed in one place), `src/72_fx.js`+`src/60_fight.js` (`IMPACTS` registry keyed by id: blunt, blade, energy — resolve reads `IMPACTS[att.def.impact] || IMPACTS.blunt`, draw dispatches through the registry), `src/48_effects.js` (`Effects.mods` writes into a pooled per-fighter object), `src/90_tests.js`.
- Tests: the sim purity scan asserts 40_movedata.js/60_fight.js contain no shake/punch numbers; hitfeel descriptors resolve to the same shake/punch/hold values as before (table test); resetPerMove clears chainNode/interceptedThisMove/guardActive/parryBonus/dashLeft/effStartup exactly as startMove did; IMPACTS lookup falls back to blunt for an unknown id; Effects.mods returns the pooled object with correct values across two calls; batch/matrix/replay hashes bit-identical to the Phase 7 head.
- Commit `refactor: hitfeel and impacts move to presentation; resetPerMove; pooled mods`.

### Task 8.1: Body style layer for the human rig
Files: `src/68_rig.js` (BodyStyle, LOOKS.carl/katia/goblin/hobgoblin/skeleton/shaman `.body`), `src/90_tests.js`.
- Tests: BodyStyle.cache returns the same canvas for the same key and a new one per zoom bucket; every human look has a complete `.body` (schema check); Rig.extent for each human look unchanged versus a table snapshot taken before the task; HUD-clearance and reach tests untouched and green; face state changes with fighter state (hit/ko/block) via a pose-key → state mapping test; purity scan green; `--perf 600` < 6 ms.
- Shots: `docs/shots/p8-human-{carl,katia,goblin,skeleton}.png` via `--pose idle --shot`.
- Commit `art: layered vector bodies and faces for the human rig`.

### Task 8.2: Body style for the big and quad rigs
Files: `src/68_rig.js` (drawBig/drawQuad through BodyStyle; LOOKS.mongo/grull/donut/grub/mother_rat `.body`), `src/90_tests.js`.
- Tests: schema complete for all eleven looks; extent snapshots unchanged for big/quad; Donut's cat face (eyes, ears, whiskers) and Mother Rat's snout render through BodyStyle.head with the species branch; quad kick pose still draws front paws in front (existing test); perf.
- Shots: `docs/shots/p8-{mongo,donut,grull,mother}.png`.
- Commit `art: layered bodies for the big and quad rigs`.

### Task 8.3: Stage depth and lighting
Files: `src/65_stage.js`, `src/70_render.js` (fighter tint/rim from Stage.lightAt), `src/12_meta.js`/settings (reduceMotion honoured), `src/90_tests.js`.
- Tests: Stage.lightAt is deterministic for a given frame with presRng seeded; torch flicker is off under reduceMotion; floor falloff never brightens above the base; far layer parallax factor 0.4; specular streak follows fighter x; perf.
- Shots: `docs/shots/p8-stage-{doorway,sewers}.png`.
- Commit `art: stage depth, torch lighting, fighter rim light`.

### Task 8.4: HUD from the reference
Files: `src/70_render.js`, `src/40_movedata.js` (def.cls already exists; add cls → gem color table), `src/90_tests.js`.
- Tests: chevron bar geometry at 0/50/100%; portrait frame gem color per class; combo counter tween reaches the count within 8 frames and never exceeds it; HUD clearance test still green with the new frame size; phone-check.
- Shots: `docs/shots/p8-hud.png`.
- Commit `art: chevron bars, class-gem portrait frames, gold combo counter`.

### Task 8.5: Door cards, roster portraits, and close-out
Files: `src/85_screens.js`, `src/00_head.html` (CSS), `src/68_rig.js` (112-px portrait), `tools/shots.sh`, `docs/ARENA.md` (Phase 8 exit table), `README.md` (gallery refresh), the program file.
- Tests: map door card renders one canvas per node with the enemy portrait and REC. LVL text; roster card uses the 112-px portrait; `--screens-smoke` and `--phone-check` green at 844×390 (no clipping); full gate; `tools/shots.sh` regenerates every shot; commit `docs: Phase 8 close-out`.

**Phase 8 exit criteria:** all eleven looks have layered bodies and faces; stage lighting and reference HUD shipped; door/roster art; extent/clearance tests unchanged; perf under budget; shots regenerated and reviewed by the controller; final whole-branch review clean; pushed.

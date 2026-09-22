# Phase 5: Broadcast Layer, Tutorial, Settings, Assets, Release — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Carl's Doorway Brawl as a complete, polished, phone-playable game: the Dungeon Crawler Carl broadcast layer (viewers, ratings multipliers, sponsor perks, announcer packs), a first-run tutorial, settings, a share card, an optional sprite-atlas hook so hand-made art can replace any rig, a first-play flow that works on a real phone (orientation, touch, audio unlock), a final quality pass against the rendition, and the release rubric in `docs/ARENA.md` with every criterion verified.

**Architecture:** Broadcast is a meta feature (`src/13_broadcast.js`: viewers score derived from fight events, ratings multipliers, sponsor perks applied through the existing player-side `Buffs.apply` path and `Stats`), fed by `G.onEvent` and rendered by the HUD (viewers counter) and screens (ratings recap on the result screen). Tutorial is a scripted encounter with prompt overlays. Settings are `Save.data.settings` read by input/render/audio. The atlas hook is a `Rig.draw` short-circuit: if `ATLAS[lookId]` is loaded, draw the sheet frame for the pose instead of the rig; loading is optional and off by default. Release polish is a rubric-driven pass, not new systems.

**Tech Stack:** unchanged; optional `assets/` folder with PNG atlases + JSON manifests (not required to run).

**Spec:** Phase 1 spec + all rulings so far, plus:

## Rulings (2026-09-22)

1. **Viewers are the score; gold is the economy.** Viewers reset per fight, accrue from hits/parries/specials with style multipliers (parry ×1.5, 5-hit ×2, S3 ×3, first-blood +250), decay slowly on being hit, and the peak is recorded; the result screen shows PEAK VIEWERS; the arena leaderboard (local) ranks by peak viewers.
2. **Sponsor perks are permanent buffs bought with gold**, applied to the player as `playerBuffs` at fight start plus stat perks via a `perks` multiplier in `Stats.derive`: e.g. "Sponsor: Doorway Dashers" +5% atk, "Parry Insurance" +2 parry-window frames, "Second Wind" one regen tick at 20% hp per fight.
3. **Tutorial is Floor 0.** A scripted goblin encounter (dummy AI) with four prompts (tap PUNCH, swipe KICK, hold BLOCK then release to PARRY, POWER when charged); completing it marks `Save.data.tutorialDone` and opens Floor 1. First run after a fresh save lands on the tutorial.
4. **Atlas format:** `assets/<lookId>/sheet.png` + `sheet.json` (`{frame:{w,h,anchorX,anchorY}, poses:{key:[[x,y],...]}}`); the game never fetches unless `Save.data.settings.useAtlas` is true or `?atlas=1`; missing files fall back to the rig silently.
5. **Release = GitHub Pages `main` root, README with a play link and screenshots, ARENA.md rubric all DONE.**

## Global Constraints

All prior constraints (single built file, sim boundary, determinism, gate before every commit, exact trailer, controller never commits while an implementer runs). Plus: nothing in this phase may add a network dependency for the default path; `--e2e` stays green; `--perf` stays under 6 ms with the viewers/FX additions; all text on screens fits 854×480; the tutorial is completable by `Ctrl.competent` headless (a `--tutorial` harness flag).

## File structure

```
src/13_broadcast.js   NEW: Broadcast.reset/onEvent/tick → viewers, peak, multipliers; Sponsors.PERKS, Sponsors.buy/owned/apply(fightOpts)
src/12_meta.js        MODIFY: settings defaults (reduceMotion, haptics, leftHanded, useAtlas, sfx, announcer), tutorialDone, leaderboard[], perks{}
src/45_encounter.js   MODIFY: tutorial encounter + FLOORS[0]-style entry `TUTORIAL`
src/80_game.js        MODIFY: broadcast wiring, tutorial prompts state machine, settings application, share card, first-run flow, orientation overlay
src/85_screens.js     MODIFY: settings screen, tutorial prompt overlay, result ratings recap, leaderboard on arena, kiosk perks tab
src/70_render.js      MODIFY: viewers counter (top center under the floor line), ratings pop on multipliers; atlas draw path in Rig.draw
src/68_rig.js         MODIFY: Rig.draw atlas short-circuit; Atlas.load(lookId) (Image + JSON, promise, never blocks first render)
src/00_head.html      MODIFY: #settings, #tutorialPrompt, #rotate overlays; audio-unlock tap layer
tests/harness.py      MODIFY: --tutorial, --screen settings, --share (asserts a PNG data URL is produced)
docs/ARENA.md         MODIFY: Release rubric (criterion, status, verification) covering Phases 1-5; final tables
README.md             MODIFY: play link, controls, screenshots, how to add an atlas
```

## Interfaces (frozen for Phase 5)

```
Broadcast.reset(); Broadcast.onEvent(type, a, b, val, fight) → updates {viewers, peak, combo, mult, lastPop}; Broadcast.tick(fight) (decay 0.5/frame while the player is in hitstun; no wall clock)
  viewers gains: hit by player +dmg*2*mult; parry +300; special s1/s2/s3 +400/+800/+1500; 5-hit +500; first blood +250; player hit −dmg (floor 0)
Sponsors.PERKS = {dashers:{cost:800, atkMul:1.05}, insurance:{cost:1200, parryWindow:+2}, secondWind:{cost:1500, buff:'secondWind'}, crowd:{cost:1000, viewersMul:1.2}}
  Sponsors.buy(id) (gold, refuses), Sponsors.owned() → ids, Sponsors.apply(opts) → adds playerBuffs and a stat multiplier consumed by G.startFight
BUFFS.secondWind: onFrame once per fight when hp ≤ 20% → +15% maxHp, then spent
Tutorial: ENCOUNTERS.tutorial {floor:0, name:'THE WAITING ROOM', enemy:'goblin', tier:'dummy', hpMul:.5}; G.startTutorial(); Tutorial.steps = [{prompt, done(fight)}...] four steps; Tutorial.state; on completion Save.data.tutorialDone=true, Screens.result with a special line, map opens Floor 1
Settings: Save.data.settings = {reduceMotion:false, haptics:true, leftHanded:false, useAtlas:false, sfx:true, announcer:true}; Screens.settings(); applied: reduceMotion → shake/flash off; haptics → navigator.vibrate(12) on hit taken (guarded); leftHanded → mirror button layout; sfx/announcer → Audio flags
Share: G.shareCard() → PNG data URL of an 854×480 canvas card (champion portrait, PEAK VIEWERS, floor/boss, date) + navigator.share when available else download link; harness --share asserts a data URL prefix
Atlas.load(lookId) → Promise<{img, meta}|null>; Rig.draw uses ATLAS[lookId] when present: picks poses[key][floor(t01*(frames-1))], draws with anchor at the feet, mirrored by face
Orientation: #rotate overlay shown when innerHeight > innerWidth on a touch device; audio unlock on first pointerdown (already Audio.init) plus a "TAP TO START" layer on first load
Leaderboard: Save.data.leaderboard = top 10 {viewers, champ, floor|streak, date}; Screens.arena shows it
Release rubric: docs/ARENA.md "Release rubric" table, one row per criterion with a verification command; all DONE
```

---

### Task 5.1: Broadcast layer (viewers, multipliers, HUD, result recap, leaderboard)
Tests: viewers math per event; decay; peak; multiplier windows; leaderboard insert/sort/cap 10; HUD label cached; result recap text. Commit `feat: broadcast layer with viewers, ratings, leaderboard`.

### Task 5.2: Sponsor perks (kiosk tab, apply path, secondWind buff)
Tests: buy/refuse/owned; apply adds buffs and multipliers; Stats.derive with perks; secondWind fires once at ≤20%; kiosk tab renders owned state. Commit `feat: sponsor perks`.

### Task 5.3: Tutorial (Floor 0) and first-run flow
Tests: steps advance on the right inputs (scripted via Ctrl.script through G.tick); completion sets tutorialDone and opens floor 1; a fresh save routes to the tutorial; `--tutorial` completes headless with a scripted controller. Shots p5-tutorial-*.png. Commit `feat: tutorial floor and first-run flow`.

### Task 5.4: Settings, orientation, haptics, audio unlock, share card
Tests: settings persist and apply (reduceMotion disables shake; leftHanded mirrors button positions; sfx/announcer flags); share card produces a PNG data URL with the expected size; rotate overlay logic (pure function of dimensions). Shots p5-settings.png, p5-share.png. Commit `feat: settings, orientation guard, share card`.

### Task 5.5: Optional sprite atlas hook
Tests: `Atlas.load` resolves null for a missing manifest without throwing and never blocks; with a synthetic in-test atlas (data URL image + inline meta) `Rig.draw` takes the atlas path (spy) and picks the right frame index; setting off → rig path. README section "Adding your own art". Commit `feat: optional sprite atlas per look`.

### Task 5.6: Release pass
- Rubric in ARENA.md: every Phase 1-5 exit criterion + release items (load time < 1 s local, `index.html` size, no console errors on title/map/roster/crystal/shop/arena/fight/result, phone layout at 390×844 CSS px landscape with the canvas letterboxed, buttons ≥ 44 px), each with a verification command run and pasted.
- Final art/feel pass against the rendition: HUD frame details (angled bars), title font treatment, stage lighting; regenerate all `docs/shots/p*.png`; README with the play link and 4 screenshots.
- Pages deploy check: `curl` the live URL, confirm the new build.
Commit `docs: release rubric and README`.

**Phase 5 exit criteria:** rubric all DONE; `--e2e`, `--tutorial`, `--matrix`, `--perf`, batch gate green; final whole-branch review clean; pushed; Pages serving the release.

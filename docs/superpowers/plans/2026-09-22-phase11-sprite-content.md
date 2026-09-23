# Phase 11: Sprite Content — Atlas Pipeline, Baked Sheets, Hybrid FX, Owner Art Slot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sprite route real end to end without waiting on hand-made art: a tool bakes every look's core-9 poses from the Phase 8 vector rigs into a `assets/<look>/sheet.png` + `sheet.json` at the comparison notes' spec (256×320 frames, anchor 128/300), the atlas hook renders them with the procedural FX layered on top, the owner gets a documented drop-in slot (spec + prompt) for real art per look, and `?atlas=1` becomes a shippable mode instead of a hook.

**Inputs:** `docs/design/mcoc-comparison-notes.md` §4 (sheet spec, core-9 pose list, template prompt, hybrid route (c)); the atlas hook in `src/68_rig.js` (Atlas.load, `_drawAtlasFrame`, per-pose fallback) and the README "sprite atlas" section (manifest format); Phase 8's BodyStyle rigs (the bake source).

**Architecture:** `tools/bake_sheets.py` drives the harness (`tests/harness.py --bake LOOK`) to render each core-9 pose's frames off the live rig at 2× and downsample to 256×320, writing the sheet and manifest. The manifest gains `"source": "baked"|"art"` and a `"version"`. The atlas path draws the sheet frame, then FX (impacts, popups, shadows, reflections, tint, rim) continue to draw procedurally around it — the tint/rim path applies to the sheet frame through the same alpha-mask principle as Phase 8. A `--atlas` harness flag and an atlas-on `tools/shots.sh` variant prove parity. Owner art replaces a baked sheet by dropping files in the same folder; nothing else changes.

**Rulings (2026-09-22):**
1. Baked sheets are committed under `assets/` only if the total stays under 6 MB; otherwise the bake is a build step documented in the README and `assets/` stays git-ignored except `README.md`. (Decide in Task 11.1 from the measured size; record the ruling.)
2. Atlas mode must render every core-9 pose for all eleven looks with zero console errors and fall back per pose for the full-set poses not baked (dash, light2/4/5, heavyCharge, blockstun, knockdown, getup, stunned, s1-s3, win).
3. Default stays atlas-off (offline, zero fetch). Settings → USE SPRITE ATLAS and `?atlas=1` are the switches; the tutorial and every gate run atlas-off unless the flag says otherwise.
4. Sheet frames are lit by the Phase 8 tint through a tinted-frame cache keyed by look|pose|frame|k-bucket, bounded like BodyStyle's.
5. Perf in atlas mode ≤ 6 ms/frame; a `--perf 600 --atlas` gate is added.
6. Lighting for sprite frames (decided here, per the Phase 8 final review): tint is applied as ONE `source-atop` pass over the blitted frame using the frame's own alpha (one blit, no layer round-trip); if `--perf 600 --atlas` exceeds 1.0 ms, fall back to pre-tinted frames cached per (look, pose, frameIdx, kBucket) with the k-bucket set capped at 5 per fight; the cache is cleared on `G.startFight` like BodyStyle's. Rim light for sprites comes from an optional per-frame rim mask row in the manifest (`rim:[[x,y],...]` aligned with `poses`); when absent the rim stroke is skipped and the report records the look as flat-rimmed.
7. Portraits: the manifest gains `portrait:{"56":[x,y,w,h], "112":[x,y,w,h]}` (front-facing, authored or baked from the rig's `face:0` bust); `Rig.portrait` consults the atlas first and falls back to the rig bust.

## Global Constraints
Everything from Phases 1-10. Plus: `--e2e --atlas` and `--screens-smoke --atlas` green; no network fetch when atlas is off (existing test); the hand-play rubric row remains for the owner.

## Interfaces (frozen for Phase 11)
```
// tools/bake_sheets.py [--look ID|all] [--scale 2] → assets/<look>/sheet.png + sheet.json
sheet.json: {"frame":{"w":256,"h":320,"anchorX":128,"anchorY":300}, "source":"baked", "version":1, "poses":{ idle:[4 cells], walk:[4], light1:[3], light3:[3], medium:[3], heavy:[3], block:[1], hit:[1], ko:[1] }}
tests/harness.py --bake LOOK --out DIR   // renders the pose frames at 2× off the rig with a transparent stage, returns the cell list
tests/harness.py flags: --atlas (sets ?atlas=1 for any mode), --perf N --atlas
tools/shots.sh --atlas → docs/shots/atlas-*.png (same fixtures as the p8 set)

// 68_rig.js
Atlas.load(lookId) unchanged; Atlas.frameFor(look, poseKey, t01) → {img, sx, sy, w, h} | null (null = fall back to the rig for that pose)
Rig._drawAtlasFrame(c, F, cam, frame, atlas, key, t01, lit) — applies tint via BodyStyle._tintedBitmap on a per-frame transparent copy; rim stroke skipped for sheet frames
Reflection/shadow/impacts/popups unchanged (they read fighter x/width, not the rig)

// README: "Bringing your own art" section — folder, spec, prompt, how to verify (`?atlas=1`, the atlas shots), what falls back
```

---

### Task 11.1: Bake tool and baked sheets
Files: create `tools/bake_sheets.py`; `tests/harness.py` (`--bake`, transparent-stage fixture), `assets/<look>/sheet.{png,json}` for all eleven looks (or the build-step documentation per ruling 1), `.gitignore`, `src/90_tests.js` (manifest schema test against a fixture), `docs/ARENA.md` (size ruling).
- Tests: manifest schema (frame spec, core-9 keys, cell counts 4/4/3/3/3/3/1/1/1); bake output dimensions 256×320 per cell; anchor on the floor line (bottom 20 px transparent); size ruling recorded.
- Commit `feat: sheet bake tool and baked core-9 sheets`.

### Task 11.2: Atlas rendering parity and lighting
Files: `src/68_rig.js` (frameFor, lit path, fallback per pose), `src/70_render.js` (nothing sim-side), `tests/harness.py` (`--atlas`), `src/90_tests.js`.
- Tests: with a fixture atlas, every core-9 pose draws from the sheet and every non-core pose falls back to the rig (spy on which path ran); a missing look folder falls back silently with zero app-code console errors; tinted-frame cache bounded; `--perf 600 --atlas` under 6 ms; `--e2e --atlas` and `--screens-smoke --atlas` green; reflections/shadows still align to the sheet frame's anchor.
- Commit `feat: atlas mode renders lit sheet frames with per-pose fallback`.

### Task 11.3: Owner art slot, atlas shots, close-out
Files: `README.md` ("Bringing your own art": spec, core-9 list, full-set list, the template prompt from the notes, verification steps), `tools/shots.sh --atlas`, `docs/shots/atlas-*.png`, `docs/ARENA.md` (Phase 11 exit table), the program file (Phase 11 done; program complete), `docs/design/mcoc-comparison-notes.md` (roadmap status column).
- Tests: `tools/shots.sh --atlas` produces the set; README section present; full gate atlas-off and atlas-on; commit `docs: Phase 11 close-out`.

**Phase 11 exit criteria:** every look has a baked core-9 sheet (or a documented one-command bake); atlas mode is lit, falls back per pose, and passes every gate; the owner has a documented drop-in path for real art; program complete; final whole-branch review clean; pushed.

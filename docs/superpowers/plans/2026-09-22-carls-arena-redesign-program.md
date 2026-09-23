# Carl's Doorway Brawl: redesign program (Phases 6-11)

This is the standing index for the multi-phase redesign that started with
[Phase 6's own plan](2026-09-22-phase6-first-five-minutes.md) — a running record of what each phase
is for, whether it's done, where its plan file lives (written or not yet), and how its exit is
verified. Phases 7-11 below are Phase 6's own "Program outline" section, carried over verbatim as
the phase breakdown, cross-referenced against the reviewer's
[prioritized roadmap](../../design/mcoc-comparison-notes.md#7-prioritized-roadmap) (`docs/design/
mcoc-comparison-notes.md` §7) for which roadmap items each phase covers. Each phase after 6 gets its
own dated plan file, written when that phase starts (not in advance) — this table's own "Plan file"
column names the file once it exists and says "not yet written" until then.

| Phase | Goal | Status | Plan file | Exit criterion |
|---|---|---|---|---|
| 6 — The First Five Minutes | Make the first five minutes read as a real fighter: gestures drive every move, floor 1 is winnable at level 1 with a clear level-gate hint, the tutorial is a visible sparring session ending in a real kill, punches and kicks look different, and a defeat always has an exit. | **DONE** at this commit (Tasks 6.1-6.6 landed on `main`) | [`2026-09-22-phase6-first-five-minutes.md`](2026-09-22-phase6-first-five-minutes.md) | Full gate green (`--unit`/`--sim`/`--matrix`/`--e2e`×3/`--tutorial`×3/`--screens-smoke`/`--phone-check`/`--perf`) plus the floor-1 door/boss batch table in band — see `docs/ARENA.md`'s "Phase 6 exit" table for the exact commands and results, including one known-open item (the AI-tier `t1..t5` batch gate, a regression traced to Task 6.2, flagged there for a dedicated fix round) |
| 7 — Combat depth | Timed, stacking `Effects` (bleed, stun, armor break, fury, power gain, power burn, regen, weakness) alongside the existing `Buffs`; a 5-node combo grammar accepting light or medium per node with three ender types; intercept and dexterity mechanics; a hit-feel pass (directional shake, per-move-class camera punch-in, per-class impact art). Covers roadmap items 4-6 and 8. | **DONE** (Tasks 7.1-7.5, commits `ca0989a..4b8d5ae` on `main`) | not yet written | Every new `Effects` type has HUD icons and a unit test for its timed application/expiry; the combo grammar and its three enders are exercised by `--matrix`/`--batch`; the batch win-rate gate (monotone, t1≥80%, last≤30%) still holds after the rebalance a deeper combat system requires — see `docs/ARENA.md`'s "Phase 7 exit" section for the full gate, before/after balance tables (both seed bases, n=30/60), and rulings |
| 8 — Art upgrade | Richer procedural vector bodies (layered shapes, gradients, outlines, faces, cloth) for all eleven looks; stage depth and lighting; HUD chevrons and portrait frames; door and roster art. Covers roadmap item 7 ("ships 'not stick figures any more' with no assets"). | **DONE** (Tasks 8.0-8.5 plus the final-review fix wave, commits `5bc5397..1a867e7` on `main`) | [`2026-09-22-phase8-art-upgrade.md`](2026-09-22-phase8-art-upgrade.md) | Every look's new rig passes the existing HUD-clearance/reach/pose tests unchanged; `tools/shots.sh`'s full set regenerated and reviewed (60 PNGs, including a standing shot for each of the eleven looks); no new asset files required (still zero-asset by default) — see `docs/ARENA.md`'s "Phase 8 exit" section for the full gate, the perf trend (0.124→0.297ms, well under the 6ms budget throughout), and the rulings copied from the SDD ledger |
| 9 — Champion kits | Signature ability, heavy effect, S1/S2/S3, and a passive for Carl, Donut, Katia, Mongo, Grull, and Mother Rat, per the comparison notes §3. Depends on Phase 7's `Effects`/combo grammar. Covers roadmap item 9. | Planned | not yet written | Every kitted champion has a named signature/passive with its own unit test; `--matrix`/`--batch` stay clean with the new kits live; reviewer confirms each kit reads as that character (not a reskinned stat block) |
| 10 — Progression | 6-star system, catalyst tiers, a new ISO curve and income, signature levels from duplicate pulls, a 40-point masteries tree (three branches), and the daily loop. Covers roadmap items 10-11. | Planned | not yet written | `--e2e` exercises the full pull→level→rank→mastery loop across multiple seeds with 0 errors; the ISO/catalyst economy is checked against the new curve (no soft-lock, no runaway currency); masteries persist through save/load |
| 11 — Sprite content | Core-9 sprite sheets per look through the existing atlas hook (owner-generated art, with the spec and prompt already captured in the design notes), plus hybrid FX layered over sprite frames. Covers roadmap item 12. | Planned | not yet written | `?atlas=1` with the new `assets/` content loads every core-9 pose with 0 console errors; the existing silent-fallback-to-rig behavior is unchanged for any pose a sheet doesn't cover; `tools/shots.sh` gets an atlas-on variant reviewed alongside the rig-only shots |

**Roadmap items not yet assigned a phase**: the reviewer's roadmap (`mcoc-comparison-notes.md` §7)
numbers items 1-12; items 1-3 were Phase 6's own first three (tutorial spar mode, gesture rewrite,
combat rebalance) and are folded into the Phase 6 row above rather than listed separately here.

Status legend: **DONE** (landed and verified, own exit table exists), **In progress** (a task from
that phase's plan has an open SDD ledger), **Planned** (goal and roadmap mapping fixed, no plan file
written yet — the next phase to start).

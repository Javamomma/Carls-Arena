#!/usr/bin/env bash
# Regenerates every docs/shots/*.png in one command (Task 5.6, release pass).
#
# Each line below is a `tests/harness.py` invocation, grouped by the phase the shot was first taken
# in. Every p2-*/p5-* command is copied verbatim from where it's documented (docs/ARENA.md's Phase 2
# exit table; the Task 5.2-5.4/5.3 reports for p5-settings/p5-kiosk-perks/p5-share/p5-tutorial-1). The
# p3-*/p4-* commands are NOT preserved anywhere on disk or in git history -- their own task's
# .superpowers/sdd/ working folder was already gone by the time this script was written (SDD working
# folders are transient/gitignored per phase, and only the current phase's folder survives) -- so
# they're reconstructed here from the shot's own filename plus the one-line description already in
# docs/ARENA.md's Phase 3/4 exit tables ("donut idle/light1/heavy/s3/hit, mongo idle/heavy/s3, grub,
# grull, mother, quads, floor1-boss, floor2-boss" / "title/map/roster/roster-4/crystal/shop/arena").
# Every reconstructed shot was viewed after generation to confirm it actually shows what its name
# says (see the Task 5.6 report for the release pass this script was written in) -- treat a
# `p3-*`/`p4-*` regeneration as "matches the documented intent", not "byte-identical to history".
set -euo pipefail
cd "$(dirname "$0")/.."
H="python3 tests/harness.py"
S=docs/shots

# ---- Phase 2: Carl's own pose set + one real fight + the S3 cinematic card --------------------
for key in idle light3 heavy block hit s3; do
  $H --sim --seconds 1 --pose "$key" --shot "$S/p2-$key.png"
done
$H --sim --seconds 6 --encounter f1_goblin --shot "$S/p2-goblin.png"
$H --sim --seconds 4 --encounter f1_goblin --shot "$S/p2-close.png"
$H --sim --seconds 4 --encounter f1_hob --shot "$S/p2-close-hob.png"
$H --cinematic --shot "$S/p2-card.png"

# ---- Phase 3: quad/big rigs (donut/mongo pose sets), the new Phase-3 mobs, both floor bosses ----
for key in idle light1 heavy hit s3; do
  $H --p1 donut --pose "$key" --shot "$S/p3-donut-$key.png"
done
for key in idle heavy s3; do
  $H --p1 mongo --pose "$key" --shot "$S/p3-mongo-$key.png"
done
$H --sim --seconds 3 --p2 grub --ai t3 --shot "$S/p3-grub.png"
$H --sim --seconds 3 --p2 grull --ai t4 --shot "$S/p3-grull.png"
$H --sim --seconds 3 --p2 mother_rat --ai t5 --shot "$S/p3-mother.png"
$H --sim --seconds 3 --p1 donut --p2 grub --shot "$S/p3-quads.png"
$H --sim --seconds 4 --encounter f1_grull --shot "$S/p3-floor1-boss.png"
$H --sim --seconds 4 --encounter f2_mother --shot "$S/p3-floor2-boss.png"

# ---- Phase 4: menu screens (title/map/roster/roster-4/crystal/shop/arena) ---------------------
$H --reset-save --screen title --shot "$S/p4-title.png"
$H --reset-save --screen map --shot "$S/p4-map.png"
$H --reset-save --screen roster --shot "$S/p4-roster.png"
$H --reset-save --pre "Save.data.roster.katia={stars:1,rank:1,level:1,xp:0,shards:0};Save.data.roster.donut={stars:1,rank:1,level:1,xp:0,shards:0};Save.data.roster.mongo={stars:1,rank:1,level:1,xp:0,shards:0};Save.put()" --screen roster --shot "$S/p4-roster-4.png"
$H --reset-save --screen crystal --shot "$S/p4-crystal.png"
$H --reset-save --screen shop --shot "$S/p4-shop.png"
$H --reset-save --pre "Save.data.gold=1000;Save.put()" --screen arena --shot "$S/p4-arena.png"

# ---- Phase 5: settings, sponsor perks, share card, tutorial ------------------------------------
$H --reset-save --screen settings --shot "$S/p5-settings.png"
$H --reset-save --pre "Save.data.gold=1200;Sponsors.buy('dashers')" --screen shop --shot "$S/p5-kiosk-perks.png"
$H --share --shot "$S/p5-share.png"
$H --tutorial --seed 1 --shot "$S/p5-tutorial-1.png"
$H --reset-save --screen map --shot "$S/p5-tutorial-map.png"

# ---- Phase 6: kick poses (Task 6.5) -- KICK reads as a leg strike in every rig -----------------
$H --sim --seconds 1 --pose medium --p2 goblin --shot "$S/p6-kick-carl.png"
$H --p1 mongo --pose medium --shot "$S/p6-kick-mongo.png"
$H --p1 donut --p2 goblin --pose medium --shot "$S/p6-kick-donut.png"

# ---- Phase 6: tutorial spar mode (Task 6.4) -- deterministic freeze frames via --tutorial-shot,
# same tool the task's own report used; the '1'/'3'/'shield' choices are frozen by harness.py itself.
$H --tutorial-shot 1 --shot "$S/p6-tutorial-1.png"
$H --tutorial-shot 3 --shot "$S/p6-tutorial-3.png"
$H --tutorial-shot shield --shot "$S/p6-tutorial-shield.png"

# ---- Phase 7: hit-feel pass (Task 7.4) -- directional shake, camera punch-in, per-class impact fx.
# Seeds/tick offsets below were found empirically (see the Task 7.4 report) by probing
# G.fight.log/FX state with --eval at a handful of candidate --seconds values, then picking the
# smallest --seconds whose exact tick count (--sim steps floor(seconds*60) ticks) lands a few frames
# after the event so its own fx (popup/shake/punch/impact ring, each with its own short lifetime)
# are still fresh on screen -- not a hand-picked "looks right" frame, a reproducible deterministic one.
# p7-intercept.png: carl (t3 AI) vs goblin, seed 1 -- an intercept lands at sim frame 14 (hitstop then
# freezes the sim frame counter there for 10 ticks, but FX still ages every real tick); 17 ticks
# (0.28333s) is 3 ticks past the landed hit, well inside every fx kind's own lifetime, showing the
# INTERCEPT! popup, the camera punch-in and the directional shake all still live.
$H --sim --seconds 0.28333333333333333 --p1 carl --p2 goblin --ai t3 --seed 1 --shot "$S/p7-intercept.png"
# p7-heavy.png: carl (t3 AI) vs goblin, seed 2 -- a heavy crits at sim frame 97; 99 ticks (1.65s) is
# 2 ticks later, showing the crit damage popup, the spark burst, the new impactBlunt ring (carl's
# own def.impact) and the directional shake together.
$H --sim --seconds 1.65 --p1 carl --p2 goblin --ai t3 --seed 2 --shot "$S/p7-heavy.png"
# p7-s3.png: the S3 cinematic card (same --cinematic convention as p2-card.png) -- Task 7.4 doesn't
# touch the card itself, but this is the frozen "p7-s3" filename the task brief asked for.
$H --cinematic --shot "$S/p7-s3.png"

echo "shots.sh: regenerated $(ls "$S"/*.png | wc -l | tr -d ' ') PNGs in $S"

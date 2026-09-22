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

echo "shots.sh: regenerated $(ls "$S"/*.png | wc -l | tr -d ' ') PNGs in $S"

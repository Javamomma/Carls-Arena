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

# Task 8.5: many of the plain `--sim --seconds N` freeze-frame shots below (no --bot idle, no --seed
# tuned to a guaranteed KO) legitimately don't reach a KO in N simulated seconds against the default
# AI, and some (the tight hitstop-frame p7-intercept.png further down) don't even advance frame-for-
# tick while hitstop holds -- either way, tests/harness.py's own soak-floor guard (frames_total +
# ko_ticks >= 90% of requested ticks, meant to catch a genuinely hung sim) then exits 1 even though
# the screenshot itself was already written correctly (pg.screenshot runs before that exit check).
# This predates Task 8.5 -- the Phase 8 comment further down already called it out for p3-mother.png
# alone ("the pre-existing p3-mother line above already exits 1 on this tree... not this task's") --
# but running the *whole* script start to finish under `set -euo pipefail` (this file's own line 3)
# had never actually been verified until this task's own gate needed it to: every one of these lines
# reproducibly exits 1 on this tree today (verified individually, not a flake), which aborted the
# script before it ever reached most of Phase 4 onward. `|| true` on exactly these lines (never a
# blanket suppression -- every other line keeps `set -e`'s real protection) lets the shot still get
# taken and the script still run to completion; each is still worth a LOOK afterward (a freeze-frame
# mid-fight is exactly what these shots are for), just not a real pass/fail signal on its own.
#
# Task 8.5 review, Important #3: bare `|| true` threw the exit code away, so a genuinely NEW failure
# among those ten lines (a real crash, a broken screen) was indistinguishable from the expected
# soak-floor case -- both exited 1, both were swallowed, and the script's closing line only printed a
# PNG count. `soft` below records each one instead, and the summary at the bottom compares what
# actually happened against EXPECTED_SOFT_FAIL: the ten names that reproducibly exit non-zero on this
# tree for the documented reason. A line that starts failing (or stops) is named in the summary, so
# it is visible without being fatal -- these shots still can't be a pass/fail signal on their own.
SOFT_FAIL=()
SOFT_OK=()
soft(){ local label="$1"; shift
  if "$@"; then SOFT_OK+=("$label"); else SOFT_FAIL+=("$label"); fi; }
EXPECTED_SOFT_FAIL="p2-close-hob p2-close p2-goblin p3-floor1-boss p3-floor2-boss p3-grub p3-grull p3-mother p3-quads p7-intercept p8-stage-doorway p8-stage-sewers"
# ---- Phase 2: Carl's own pose set + one real fight + the S3 cinematic card --------------------
for key in idle light3 heavy block hit s3; do
  $H --sim --seconds 1 --pose "$key" --shot "$S/p2-$key.png"
done
soft p2-goblin $H --sim --seconds 6 --encounter f1_goblin --shot "$S/p2-goblin.png"
soft p2-close $H --sim --seconds 4 --encounter f1_goblin --shot "$S/p2-close.png"
soft p2-close-hob $H --sim --seconds 4 --encounter f1_hob --shot "$S/p2-close-hob.png"
$H --cinematic --shot "$S/p2-card.png"

# ---- Phase 3: quad/big rigs (donut/mongo pose sets), the new Phase-3 mobs, both floor bosses ----
for key in idle light1 heavy hit s3; do
  $H --p1 donut --pose "$key" --shot "$S/p3-donut-$key.png"
done
for key in idle heavy s3; do
  $H --p1 mongo --pose "$key" --shot "$S/p3-mongo-$key.png"
done
soft p3-grub $H --sim --seconds 3 --p2 grub --ai t3 --shot "$S/p3-grub.png"
soft p3-grull $H --sim --seconds 3 --p2 grull --ai t4 --shot "$S/p3-grull.png"
soft p3-mother $H --sim --seconds 3 --p2 mother_rat --ai t5 --shot "$S/p3-mother.png"
soft p3-quads $H --sim --seconds 3 --p1 donut --p2 grub --shot "$S/p3-quads.png"
soft p3-floor1-boss $H --sim --seconds 4 --encounter f1_grull --shot "$S/p3-floor1-boss.png"
soft p3-floor2-boss $H --sim --seconds 4 --encounter f2_mother --shot "$S/p3-floor2-boss.png"

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
# INTERCEPT! popup, the camera punch-in and the directional shake all still live. Hitstop holding
# G.fight.frame for part of that tiny window is exactly the "don't advance frame-for-tick" case the
# top-of-file note explains -- `|| true` here for the same reason, not a Task 8.5-introduced issue.
soft p7-intercept $H --sim --seconds 0.28333333333333333 --p1 carl --p2 goblin --ai t3 --seed 1 --shot "$S/p7-intercept.png"
# p7-heavy.png: carl (t3 AI) vs goblin, seed 2 -- a heavy crits at sim frame 97; 99 ticks (1.65s) is
# 2 ticks later, showing the crit damage popup, the spark burst, the new impactBlunt ring (carl's
# own def.impact) and the directional shake together.
$H --sim --seconds 1.65 --p1 carl --p2 goblin --ai t3 --seed 2 --shot "$S/p7-heavy.png"
# p7-s3.png: the S3 cinematic card (same --cinematic convention as p2-card.png) -- Task 7.4 doesn't
# touch the card itself, but this is the frozen "p7-s3" filename the task brief asked for.
$H --cinematic --shot "$S/p7-s3.png"

# ---- Phase 8: layered vector bodies for the human rig (Task 8.1) -----------------------------
# One idle frame per human-rig look, the same --pose fixture the earlier phases use. These are the
# shots the body layer is graded on: a stick figure, a blob, or a limb disconnected at a joint is a
# failure, so regenerate and LOOK at them after any change to BodyStyle or to a look's .body block.
for id in carl katia goblin skeleton; do
  $H --p1 "$id" --pose idle --shot "$S/p8-human-$id.png"
done

# ---- Phase 8: the big and quad rigs, and the cross-rig joint-seam polish (Task 8.2) -----------
# Donut, Grull and Mother Rat use the same --pose idle fixture as the human shots above. Mongo does
# NOT: --pose screenshots without ticking, so the camera sits at its initial zoom 1.0 and Mongo --
# the tallest look in the roster -- has his head cut off by the HUD there (a pre-existing framing
# quirk LOOKS.mongo's own Fix-round-2 comment already calls out; no test grades it). A one-second
# deterministic --sim against an idle bot lets the per-fight zoom cap frame him properly.
#
# Note: a --sim shot has to clear the harness's own short-soak floor (frames_total + ko_ticks >=
# 90% of the requested ticks). Hitstop does not advance G.fight.frame, so a hit-heavy matchup falls
# under it and the harness exits 1 -- which is why these use an idle bot, and why the pre-existing
# p3-mother line above already exits 1 on this tree (verified at 1a6d501 too; not this task's).
#
# p8-human-carl.png above is re-shot by the same loop it always was: it is the proof for the
# joint-seam half of Task 8.2, so LOOK at it, not just at the new rigs -- a visible ring at a
# shoulder, an elbow or a knee is a failure.
$H --sim --seconds 1 --p1 mongo --p2 donut --bot idle --ai t1 --shot "$S/p8-mongo.png"
$H --p1 donut --p2 goblin --pose idle --shot "$S/p8-donut.png"
$H --p1 grull --p2 goblin --pose idle --shot "$S/p8-grull.png"
$H --p1 mother_rat --p2 goblin --pose idle --shot "$S/p8-mother.png"
# Final review, Minor #9: grub and the shaman were the two of the eleven looks with no standing shot
# anywhere in the set. Grub appeared only prone at the floor line in p8-hud.png and p3-grub.png, in
# both cases mostly behind the subtitle bar, and the shaman only inside regenerated p2/p3 fight
# shots -- so the phase's "all eleven looks have layered bodies and faces" exit criterion had visual
# evidence for nine. Same --pose idle fixture as every other body shot above, which is the point:
# these are graded the same way, on the same frame, as the nine that already had one.
# `--pre "G.say=()=>{}"` silences the announcer toast for these two only. That toast is what buried
# grub in every previous shot: it is a larva, so its whole body sits at the floor line exactly where
# the subtitle bar draws, and with the bar up only its back half cleared it. Suppressing it shows the
# full chitin plating, the head-end and all six legs. The shaman gets the same treatment so the pair
# is shot identically; nothing else about the frame changes.
$H --p1 grub --p2 goblin --pose idle --pre "G.say=()=>{}" --shot "$S/p8-grub.png"
$H --p1 shaman --p2 goblin --pose idle --pre "G.say=()=>{}" --shot "$S/p8-shaman.png"

# ---- Phase 8: stage depth and torch lighting (Task 8.3) ---------------------------------------
# These two were never in this script -- they were taken by hand during Task 8.3 and are documented
# only in that task's report ("floor 1, f1_grull, 4s sim" / "floor 2, f2_mother, 4s sim"), which made
# them the one part of the p8 set this file could not regenerate. Same two encounters the
# p3-floor{1,2}-boss lines above use, so the two themes are shown on their own floors.
soft p8-stage-doorway $H --sim --seconds 4 --encounter f1_grull --shot "$S/p8-stage-doorway.png"
soft p8-stage-sewers $H --sim --seconds 4 --encounter f2_mother --shot "$S/p8-stage-sewers.png"

# ---- Phase 8: door cards + roster portrait frames (Task 8.5) ----------------------------------
# p8-map.png: a fresh save's floor 1 -- door 1 open, everything else locked -- so the door-card art
# (arch/torch/portrait/banner) and the lock overlay are both visible in one shot; see the task's own
# report for a second, mixed-state (done/open/locked) reference render reviewed alongside this one.
# p8-roster.png: its OWN fixture, not p4-roster-4.png's. The final review found two problems with
# reusing that one (Critical #1, Minor #8): the two files came out byte-identical, so the p8 shot
# added no evidence of its own; and its framing -- the first card sliced through the middle -- read
# as a cropping choice when it was actually the unreachable-content bug in `.cards`
# (justify-content:center on an overflowing scroll container, fixed to `safe center`; see
# src/00_head.html). This fixture keeps four champions (the densest roster the game grants, so the
# list still overflows and the first card's position is still a real test of the fix) but gives each
# one a different stars/rank/level/shards state, so the star row, the rank pips, the XP bar and the
# N/5 shard count all show real variety instead of four identical rank-1 rows -- and the shot opens
# at the list's own top, where CARL's card is now fully visible.
$H --reset-save --screen map --shot "$S/p8-map.png"
$H --reset-save --pre "Save.data.roster.carl={stars:3,rank:2,level:14,xp:22,shards:2};Save.data.roster.katia={stars:2,rank:2,level:9,xp:30,shards:4};Save.data.roster.donut={stars:2,rank:1,level:6,xp:12,shards:1};Save.data.roster.mongo={stars:1,rank:1,level:3,xp:5,shards:0};Save.data.iso=400;Save.put()" --screen roster --shot "$S/p8-roster.png"

# ---- Phase 9: kit specials actually connecting in real combat (Task 9.5) ----------------------
# Every earlier "sN" shot in this file is a frozen POSE (--pose s3, no sim ticking, no hitbox ever
# resolves) or the generic --cinematic S3 name-card (p2-card.png/p7-s3.png). None of those show a
# kit's own listed EFFECT actually landing. These four use `--eval` (which runs after the harness's
# own startFight but before --shot's screenshot) to drive a real, deterministic connect: closeIn(f)
# (the same test-file helper every scripted unit test uses, concatenated into index.html along with
# everything else in src/90_tests.js, so it's callable here too) puts the two fighters adjacent,
# the attacker's own power is set directly to the special's exact cost (100/200/300 -- not "primed"
# gameplay, just the harness's own debug-state convention every other fixture in this file already
# uses, e.g. p4/p5's `--pre "Save.data...=...;Save.put()"`), and `Ctrl.script([{f:0,intent:{special:
# N}}])` (30_input.js's own frozen script-controller shape, identical to the one src/90_tests.js's
# scripted tests already use) fires it on the very next tick. The opponent's hp/maxHp are padded so
# a multi-hit special can't KO them before its own LAST sub-hit -- the one carrying the kit's listed
# effect -- ever lands. Each loop below polls the real fight log (`f.log`, the same shape every
# other test/tool in this repo already reads) for the exact event that proves the kit effect landed,
# not just "a hit happened", then ticks a small fixed buffer further so the popup/banner fx (each
# with its own short lifetime -- see 72_fx.js) are still fresh on screen, same "a few ticks past the
# event, inside every fx kind's own lifetime" convention p7-intercept.png/p7-heavy.png above already
# use. Each shot was viewed after generation to confirm it actually shows the claimed effect (see
# the Task 9.5 report's Shots section for what was checked in each one).
#
# p9-carl-s3.png: Doorway Drop's guaranteed stun, on the LAST of its 4 sub-hits only -- naively
# breaking out of the tick loop on the FIRST 's3' hit (sub-hit 1) catches the moment `Fight.
# checkCinematic` (60_fight.js) arms the 72-frame S3 name-card freeze, which is a real (and already
# separately shot, p7-s3.png/p2-card.png) but DIFFERENT beat than this shot's subject -- its own
# gold ribbon fx has a longer on-screen lifetime than the tick budget below and would just cover the
# fighters. Polling instead for the real `{type:'effect',who:-1,id:'stun',applied:true}` log entry
# (48_effects.js's own frozen log shape; who:-1 is p2's side, not p1's -- see the golden bit-identical
# test in src/90_tests.js for the same convention) waits past that card (which auto-clears once its
# own 72-frame lifetime elapses, well before the stun fires on sub-hit 4) and lands on the real STUN
# banner + the guaranteed hit's own damage popup instead.
$H --sim --seconds 1 --bot idle --ai dummy --p1 carl --p2 goblin --eval "(()=>{const f=G.fight;closeIn(f);f.p2.hp=f.p2.maxHp=5000;f.p1.power=300;f.p1.ctrl=Ctrl.script([{f:0,intent:{special:3}}]);let applied=false;for(let i=0;i<400&&!applied;i++){G.tick();if(f.log.some(e=>e.type==='effect'&&e.who===-1&&e.id==='stun'&&e.applied))applied=true}for(let i=0;i<8;i++)G.tick();return{applied}})()" --shot "$S/p9-carl-s3.png"
# p9-donut-s2.png: Regal Pounce's own `unblockable:'last'` flag (Task 9.1's fix round 1) only shows
# its {kind:'popup',text:'UNBLOCKABLE'} fx (60_fight.js) when the defender is ACTUALLY holding block
# the instant that final sub-hit lands -- sub-hits 1-4 chip through a real held block normally. p2's
# own ctrl is overridden to `Ctrl.script([{f:0,until:300,intent:{block:true}}])` (a continuously-held
# block, the same shape 9.1b's own "held block absorbs every sub-hit" fixtures use) so sub-hits 1-4
# log as real `type:'block'` entries and only sub-hit 5 -- unblockable -- logs `type:'hit'`, which is
# what the loop polls for.
$H --sim --seconds 1 --bot idle --ai dummy --p1 donut --p2 hobgoblin --eval "(()=>{const f=G.fight;closeIn(f);f.p2.hp=f.p2.maxHp=5000;f.p2.ctrl=Ctrl.script([{f:0,until:300,intent:{block:true}}]);f.p1.power=200;f.p1.ctrl=Ctrl.script([{f:0,intent:{special:2}}]);let landed=false;for(let i=0;i<400&&!landed;i++){G.tick();if(f.log.some(e=>e.type==='hit'&&e.who===1&&e.move==='s2'))landed=true}for(let i=0;i<6;i++)G.tick();return{landed}})()" --shot "$S/p9-donut-s2.png"
# p9-katia-s2.png: Misdirection's own `critChance:1.0` forces a real crit roll on every sub-hit (a
# real rng draw still happens -- see 40_movedata.js's own frozen-interface comment -- it just always
# resolves true), which Fight.resolve's own damage-popup fx (60_fight.js) already renders differently
# for a crit (bigger, red `#ff4444`, vs a normal hit's gold `#ffd86b`) -- no separate "CRIT" text
# exists, so the shot's own evidence is that red/big popup. Opponent is left on the harness's usual
# `--ai dummy` (no block-holding needed here, unlike donut's S2 above); the loop just waits for a
# few real sub-hits to land so a fresh one is on screen at shot time.
$H --sim --seconds 1 --bot idle --ai dummy --p1 katia --p2 hobgoblin --eval "(()=>{const f=G.fight;closeIn(f);f.p2.hp=f.p2.maxHp=5000;f.p1.power=200;f.p1.ctrl=Ctrl.script([{f:0,intent:{special:2}}]);let hits=0;for(let i=0;i<400&&hits<3;i++){G.tick();hits=f.log.filter(e=>e.type==='hit'&&e.who===1&&e.move==='s2').length}for(let i=0;i<4;i++)G.tick();return{hits}})()" --shot "$S/p9-katia-s2.png"
# p9-mongo-s2.png: Bear Hug's `healPct:0.30` (60_fight.js: `att.hp=Math.min(att.maxHp,att.hp+Math.
# round(dmg*m.healPct))`) has no dedicated fx of its own -- it's a bare hp restore, so the only real
# evidence is mongo's OWN hp bar climbing. `f.p1.hp=700` dents him first (mongo's real hp is 1300, so
# this is a real mid-fight hp value, not a padded one -- only p2's hp/maxHp are padded, same as every
# other shot above) so the recovery across a few landed sub-hits is visible against a real baseline
# rather than starting already at full.
$H --sim --seconds 1 --bot idle --ai dummy --p1 mongo --p2 hobgoblin --eval "(()=>{const f=G.fight;closeIn(f);f.p2.hp=f.p2.maxHp=5000;f.p1.hp=700;f.p1.power=200;f.p1.ctrl=Ctrl.script([{f:0,intent:{special:2}}]);let hits=0;for(let i=0;i<400&&hits<3;i++){G.tick();hits=f.log.filter(e=>e.type==='hit'&&e.who===1&&e.move==='s2').length}for(let i=0;i<4;i++)G.tick();return{hits}})()" --shot "$S/p9-mongo-s2.png"

echo "shots.sh: regenerated $(ls "$S"/*.png | wc -l | tr -d ' ') PNGs in $S"
# Task 8.5 review, Important #3: the one-line summary. Sorted so the comparison against
# EXPECTED_SOFT_FAIL is order-independent, and both directions are reported -- a line that newly
# fails is a possible real regression, and a line that newly PASSES means this list is stale.
got=$(printf '%s\n' ${SOFT_FAIL[@]+"${SOFT_FAIL[@]}"} | sort | tr '\n' ' ' | sed 's/ $//')
want=$(printf '%s\n' $EXPECTED_SOFT_FAIL | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$got" = "$want" ]; then
  echo "shots.sh: soak-floor shots: ${#SOFT_FAIL[@]}/12 exited non-zero, exactly the documented set -- no new failures"
else
  echo "shots.sh: soak-floor shots CHANGED -- look at these before trusting the set:"
  echo "  expected non-zero: $want"
  echo "  actually non-zero: ${got:-(none)}"
  for n in $want; do case " $got " in *" $n "*) ;; *) echo "  NEWLY CLEAN: $n (this list is stale)";; esac; done
  for n in $got; do case " $want " in *" $n "*) ;; *) echo "  NEWLY FAILING: $n (a real crash, or the shot is wrong -- LOOK at it)";; esac; done
fi

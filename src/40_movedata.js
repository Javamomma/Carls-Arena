// All frame counts at 60 Hz. dash = px the attacker advances during startup. push = px the defender is shoved on hit.
// Task 7.2: the fixed light1->light5 ladder collapses into one MOVES.light entry (every node plays
// the exact same startup/active/recovery/range/hitstun/blockstun/push/pow/dash timing -- only the
// landed hit's effective damage varies by chain node, via CHAIN.chainDmg below) plus base MOVES.medium
// keeping its own single entry the same way. MOVES.light's non-dmg fields are light1's own old values
// verbatim (dmg:1 too -- node-1 numbers must stay unchanged), so a fresh opener light thrown from
// neutral is bit-identical to the old light1. The old per-move `chain` pointers (light1->light2->...,
// medium->light1) and every move's dead chain:null are deleted -- Fighter.chainNode/CHAIN (below) now
// own the grammar; see 50_fighter.js's startMove/act for how chainNode replaces this.move.chain.
const MOVES={
  light: {startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,dash:18,stepIn:110,hitstop:3,
    chainDmg:[1,1,1.05,1.1,1.4]},
  medium:{startup:10,active:4,recovery:14,dmg:1.6,range:120,hitstun:18,blockstun:11,push:24,powHit:12,powTaken:6,track:300,hitstop:5,
    chainDmg:[1.6,1.6,1.7,1.8,2.0]},
  heavy: {charge:22,startup:8,active:5,recovery:26,dmg:2.6,range:130,hitstun:26,blockstun:14,push:70,powHit:18,powTaken:9,knockdown:true,hitstop:9},
  s1:{startup:8, active:4,recovery:22,dmg:1.5,hits:3,gap:6,range:130,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:100,knockdown:true,hitstop:6},
  s2:{startup:10,active:4,recovery:28,dmg:1.6,hits:5,gap:6,range:150,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:200,knockdown:true,hitstop:8},
  s3:{startup:20,active:6,recovery:40,dmg:3,  hits:4,gap:8,range:220,hitstun:20,blockstun:0, push:90,powHit:0,powTaken:0,cost:300,knockdown:true,unblockable:true,hitstop:14}};
// Task 7.4 fix round 1 (frozen ruling, exact values): per-class hit-feel magnitudes, read by
// Fight.resolve's shake/punch push sites (60_fight.js) keyed off the landed move's own moveName
// ('light'/'medium'/'heavy'/'s1'/'s2'/'s3'), or 'intercept' when the landed hit is itself an
// intercept (overriding whatever the landing move's own class would otherwise have been -- an
// intercepting hit always feels like an intercept). `stop` is NOT read by resolve() for hitstop
// itself -- MOVES.*.hitstop (above) and the intercept's own hardcoded 10 (60_fight.js) stay the
// sim's only source for that; `stop` is carried here purely so this table documents/cross-checks
// against those same numbers in one place (every value below equals its matching MOVES.*.hitstop,
// and 10 equals the intercept hitstop) -- a future hitstop retune that forgets to update this table
// alongside MOVES would be a visible mismatch, not a silent drift. `shake`/`punch` are the actual
// px/pct magnitudes resolve() pushes; `hold` is the punch envelope's own hold-frame count (FX.push's
// 'punch' case, 72_fx.js, falls back to its own PUNCH_HOLD when a push carries none); `creep` (s1/s2
// only) means the punch eases IN over `hold` instead of snapping straight to its target. light's
// shake:0/punch:0 means neither fx is ever pushed for a plain light (see resolve()'s own `if(hf.
// shake>0)`/`if(hf.punch>0)` guards); s3's punch:0 means s3 never gets a punch-in fx of its own (the
// existing S3 cinematic dolly/card already owns that beat).
const HITFEEL={
  light:{stop:3, shake:0, punch:0,   hold:0},
  medium:{stop:5, shake:4, punch:.02,hold:6},
  heavy:{stop:9, shake:8, punch:.04, hold:10},
  s1:{stop:6, shake:6, punch:.03,    hold:6, creep:true},
  s2:{stop:8, shake:6, punch:.03,    hold:6, creep:true},
  s3:{stop:14,shake:6, punch:0,      hold:0},
  intercept:{stop:10,shake:10,punch:.05,hold:6}};
// Task 7.2 (frozen interface, exact values): the five-node combo grammar. openers are the two moves
// that can start a chain from IDLE/BLOCK; nodes is the chain's max length (Fighter.chainNode runs
// 1..5); enders describes what the FINAL blow of the chain does, keyed by which move type actually
// lands it -- light: nothing extra (no push/knockdown bonus: a light-ended chain plays exactly like a
// plain light hit); medium: shoves the defender out to `push` and knocks them down; heavy: a
// "shortened ender" only offered at chainNode===4 (skips a would-be node 5 light/medium and swings a
// heavy instead) that charges for just `charge` frames (not the normal MOVES.heavy.charge) and, once
// it lands, fires the attacker's own def.sigEffect (see CHAMPS/MOBS below) via `sig:true` -- see
// Fight.resolve's own comment (60_fight.js) for exactly where each of these three is read.
// chainDmg lives on MOVES.light/medium themselves (not here) since Fight.resolve already has the
// landed move's own merged data (m) in hand; CHAIN.enders is the only per-node data resolve() has to
// look up separately, since a chain's own base move data never carries push/knockdown for the light/
// medium case (those come only from the enders table, at node 5, or from heavy's own base data at the
// node-4 shortened ender -- heavy already carries knockdown/push, so its ender never needs an override
// for either).
const CHAIN={openers:['light','medium'],nodes:5,
  enders:{light:{},medium:{push:90,knockdown:true},heavy:{charge:14,sig:true}}};
// Task 6.2 (movement inside moves): per-frame rates Fighter.setupDash uses for medium's track and
// light1's stepIn. DASH_TRACK_SPEED preserves medium's old flat dash(140)/startup(10) rate exactly
// (140/10=14) so an already-in-range medium (dashLeft 0, see setupDash) and a near one that only needs
// a few frames both move at the same speed a player already learned. DASH_STEPIN_SPEED is chosen so
// stepIn(110)/DASH_STEPIN_SPEED always equals light1's own unchanged 5-frame startup (110/22=5) --
// a step-in light never needs to run longer than the swing already does; it either closes the gap
// within its own 5 frames or it doesn't connect, same as a real whiffed jab.
// Task 7.3 (frozen interface, exact ruling): DASH_TRACK_SPEED is now only the FLOOR speed for a
// medium's tracked dash-in, not a fixed rate for every gap -- Fighter.setupDash scales the per-frame
// speed up to max(DASH_TRACK_SPEED, dashLeft/14) so the far end of MOVES.medium.track (up to 300px)
// never needs more than 14 effective startup frames to close, capping the dash-in telegraph a defender
// can be caught napping in (a longer, uncapped startup is exactly what made intercepting a far dash-in
// nearly free before this task -- see Fight.resolve's own intercept comment). A close medium (small or
// zero dashLeft) still travels at the same flat 14px/frame rate as always.
const DASH_TRACK_SPEED=14,DASH_STEPIN_SPEED=22;
// Task 7.2 (frozen interface): def.sigEffect={id,stacks,target?} -- fired only by the in-combo heavy
// ender (CHAIN.enders.heavy, m.sig:true) once it lands, via Effects.apply (48_effects.js). `target`
// is 'self'|'foe', default 'foe' (Fight.resolve's own ruling) -- Carl's fury (an attacker-side buff)
// is the one champion whose signature targets itself; every mob/boss below has no sigEffect at all
// (undefined), so the in-combo heavy ender is a plain hit for them, no bonus effect.
// Task 7.4 (frozen ruling): def.impact ('blunt'|'blade'|'energy') -- read on the ATTACKER by
// Fight.resolve's landed-hit branch (60_fight.js) to push a per-class impact fx (FX.push's
// 'impactBlunt'/'impactBlade'/'impactEnergy' cases, 72_fx.js) alongside the existing spark/dustArc
// hit fx. Exact per-id values are the controller's own ruling, verbatim.
const CHAMPS={
  carl: {id:'carl', name:'CARL',           cls:'brawler',  hp:1000,atk:60,color:'#f4c542',armor:0,  crit:.10,critMul:1.6,blockProf:0,  scale:1,   rig:'human',impact:'blunt',
    sigEffect:{id:'fury',stacks:1,target:'self'}},
  // rig:'quad' — Donut is a real cat (Task 3.4's RigQuad, a four-legged bone set; see LOOKS.donut
  // and Rig.solve's 'quad' branch in 68_rig.js).
  donut:{id:'donut',name:'PRINCESS DONUT', cls:'caster',   hp:820, atk:70,color:'#e8a0d8',armor:0,  crit:.18,critMul:1.6,blockProf:0,  scale:1,   rig:'quad',impact:'energy',
    sigEffect:{id:'weakness',stacks:1}},
  katia:{id:'katia',name:'KATIA',          cls:'trickster',hp:900, atk:64,color:'#7fb0a8',armor:0,  crit:.22,critMul:1.6,blockProf:0,  scale:1,   rig:'human',impact:'blade',
    moves:{s1:{hits:5,gap:4,dmg:1.2}},sigEffect:{id:'bleed',stacks:1}},
  // rig:'big' — Mongo is Task 3.5's brute bone set (Rig.solveBig/drawBig; see LOOKS.mongo, 68_rig.js).
  mongo:{id:'mongo',name:'MONGO',          cls:'tank',     hp:1300,atk:66, color:'#a3742f',armor:.15,crit:.08,critMul:1.6,blockProf:.15,scale:1.25,rig:'big',impact:'blunt',
    sigEffect:{id:'armorBreak',stacks:1}}};
// Task 6.1, ruling 3 (playtest note: "Hobgoblin Brute is impossible to defeat" at floor 1 door 3,
// level 1): goblin/skeleton hp raised and atk lowered exactly to the plan's given numbers (360/30,
// 320/28) -- longer, safer early fights instead of fast trades a level-1 player can lose to a bad
// opening. hobgoblin's hp/atk raised within ±15% of the plan's 640/46 (to 700->736/-5.5%->52), plus
// ENCOUNTERS.f1_hob's AI tier (45_encounter.js) moved from 'brute' (a t3 clone) to 't4' -- both
// together land it at 70% (n=20 seed 1, tests/batch.py --encounter f1_hob) against Ctrl.competent.
//
// Fix round 0 (controller ruling, post-review): shaman was first tuned to 820hp/36atk/.15 armor/.25
// blockProf/tier t5 to force it under 70% against Ctrl.competent (the batch tool's scripted bot) --
// reverted. That combination changes the character's own identity (a squishy caster becoming a tanky
// blocker) just to satisfy a bot yardstick, which the controller ruled out of scope for this task.
// shaman is back to the plan's own ±15%-ceiling numbers (hp 345, atk 36, armor/blockProf/tier
// untouched at their originals) and stays there regardless of what tests/batch.py's Ctrl.competent
// prints for it -- door 4's actual target is "a level-3 human (this door's recLevel) should find it
// fair," not a 40-70% bot win rate; the batch table below is recorded as information, not a gate, for
// this one encounter. See docs/ARENA.md's Task 6.1 entry, "Fix round 0" section, for the full context.
const MOBS={
  goblin:   {id:'goblin',   name:'GOBLIN SCAVENGER',cls:'rogue',hp:360,atk:30,color:'#6b9a45',armor:0,  crit:.15,critMul:1.6,blockProf:0,  scale:.85,rig:'human',impact:'blade',
    moves:{heavy:{charge:14,dmg:2.0}}},
  hobgoblin:{id:'hobgoblin',name:'HOBGOBLIN BRUTE',  cls:'tank', hp:736,atk:52,color:'#5c6b52',armor:.15,crit:.05,critMul:1.6,blockProf:.1, scale:1.1,rig:'human',impact:'blunt', // Phase 2 fix round 2: 1.2->1.1, see LOOKS.hobgoblin
    moves:{heavy:{charge:30,dmg:3.4,hitstop:12}}},
  skeleton: {id:'skeleton',name:'SKELETON',cls:'rogue', hp:320,atk:28,color:'#d8d0c0',armor:0,  crit:.15,critMul:1.6,blockProf:0,  scale:.95,rig:'human',impact:'blade'},
  // s1 override: a longer 6-hit flurry (base s1 is 3 hits) — the shaman's signature multi-hit special.
  shaman:   {id:'shaman',  name:'SHAMAN',  cls:'caster',hp:345,atk:36,color:'#6a4c93',armor:0,  crit:.1, critMul:1.6,blockProf:0,  scale:.95,rig:'human',impact:'energy',
    moves:{s1:{hits:6,gap:4,dmg:1.1}}},
  // rig:'quad' — Task 3.4's four-legged bone set, same as Donut above (LOOKS.grub, 68_rig.js) but
  // drawn as a segmented larva with stubby leg nubs instead of a cat.
  grub:     {id:'grub',    name:'GRUB',    cls:'beast', hp:380,atk:40,color:'#8a9a4f',armor:.05,crit:.05,critMul:1.6,blockProf:0,  scale:.8, rig:'quad',impact:'blunt'}};
const BOSSES={
  // rig:'big' — Task 3.5's brute bone set (see LOOKS.grull, 68_rig.js). scale is .94, trimmed down
  // from the Task 3.4-era placeholder's 1.3 during Task 3.5 (a real --sim screenshot showed his head/
  // horns going off the top of the canvas at both 1.3 and an intermediate 1.1 — see
  // docs/shots/p3-floor1-boss.png). At the time, the only HUD safety net was a fixed test against
  // heavyCharge/s3, which happen to be Grull's *shortest* poses (a deep crouch by design), so scale
  // was the only lever available and got tuned down until the visible clipping stopped.
  // Task 3.5 fix round 1 (controller review): that fixed-pose test was replaced with a per-fight camera zoom
  // cap computed from Rig.extent's true worst case across every pose and prop (G.startFight,
  // 68_rig.js/65_stage.js) — the camera itself now stays out of any look's way at whatever scale it's
  // set to, which is the real fix for this class of bug. Left at .94 rather than re-tuned back up,
  // since nothing in this task required changing it further.
  // s3 override + buffs are his boss-signature mechanics per Phase 3 ruling #4 (a mob def with
  // boss:true, a bigger rig, a unique S3, and one signature buff — no boss-only engine).
  // Fix-wave item 2: hp 1600->1300, atk 70->60 (armorUp kept) — both bosses were a hard 0/20 vs
  // Ctrl.competent before this pass. Not enough on its own: item 1's special fix and item 8's
  // closing-distance/heavy-mixup fix both landed and Grull was STILL a near-wall (10% at n=20, mostly
  // 0-10% at n=30) — Carl's own competent-bot offense turned out weak against a react:5/punish:.8
  // tank even once it could reach him, landing only ~4 hits total in an 8s loss while Grull landed
  // ~11 (see docs/ARENA.md's fix-wave boss notes for the log breakdown). atk retuned further, 60->42,
  // once items 1/8 were in (per item 2's own deferred plan) — lands 16.7-25% (n=30/n=20) in the
  // 10-35% target band.
  // Task 4.6 re-check: `python3 tests/batch.py --n 30 --p1 carl --encounter f1_grull` still lands at
  // 13.3% (n=30) against the current Ctrl.competent/AI_TIERS — inside the 10-35% band, no retune
  // triggered (see docs/ARENA.md's Phase 4 exit table for the full command output).
  // Task 7.2: atk 42->50. The combo grammar's own CHAIN.enders.light={} (no knockdown, frozen ruling)
  // removes the old ladder's forced ~50-frame knockdown+getup pause every 5 light hits, so Ctrl.
  // competent's own sustained DPS roughly doubled (see 55_ai.js's own tier-gate retune comment for the
  // measured before/after) — the t4 AI_TIERS retune alone still left this boss at 40% (n=30), over the
  // 10-35% band; the atk bump alone (hp untouched) brings it back to 26.7% (n=30).
  grull:{id:'grull',name:'GRULL',cls:'tank',hp:1300,atk:50,color:'#5c2f2f',armor:.2,crit:.05,critMul:1.6,blockProf:.15,scale:.94,rig:'big',impact:'blunt',
    boss:true,buffs:['armorUp'],moves:{s3:{dmg:3.6,hits:3,gap:10}}},
  // rig:'quad' — Task 3.4's four-legged bone set at boss scale (LOOKS.mother_rat, 68_rig.js).
  // Fix-wave item 2: atk 62->50 (see grull's comment above; regen itself was also retuned, in
  // 47_buffs.js, since disabling it entirely still left her a 20/20 wall — her offense, not the
  // heal, was the problem). Same story as Grull above: atk 50 alone was still a 0/20 wall even with
  // items 1/8 in. Retuned to atk 35 + hp 1400->1100 (close to the final review's own alternate, "rat
  // atk 46 + hp 1100") once items 1/8 landed — 16.7-25% (n=30/n=20), ending well below full hp.
  // Fix-wave item 9: scale 1.3->1.15 (paired with a LOOKS.mother_rat bodyLen trim — see that look's
  // own comment) to close the quad-rig reach gap past EDGE_PAD; a presentation-side number, doesn't
  // touch the balance numbers above.
  // Task 4.6 re-check (the progress ledger flagged a quick n=10 run coming back 0/10, against the
  // wave table's own 5/30, as variance worth re-checking here): `python3 tests/batch.py --n 30 --p1
  // carl --encounter f2_mother` lands at 16.7% (n=30) — the retune trigger was "under 10% at n=30",
  // not hit, so no further change; see docs/ARENA.md's Phase 4 exit table for the full command output.
  // Phase 6 fix-wave close-out: the RNG warm-up (10_util.js) shifted every AI stream and this boss
  // drifted to 46.7% (band 10-35%); hp 1100->1350, atk 35->36 measured at 23.3% (seed-base 1) and
  // 13.3% (seed-base 101), n=30 — chosen over atk-only bumps that fell under 10% on base 101.
  // Task 7.2: atk 36->46, same driver as grull's own comment above (Ctrl.competent's sustained DPS
  // roughly doubled once CHAIN.enders.light stopped forcing a knockdown pause every 5 lights) — the t5
  // AI_TIERS retune alone still left this boss at 53.3% (n=30), well over the 10-35% band; hp left
  // untouched, atk-only brings it back to 23.3% (n=30).
  mother_rat:{id:'mother_rat',name:'MOTHER RAT',cls:'beast',hp:1350,atk:46,color:'#4a3040',armor:.1,crit:.1,critMul:1.6,blockProf:.05,scale:1.15,rig:'quad',impact:'blunt',
    boss:true,buffs:['regen'],moves:{s3:{dmg:2.4,hits:6,gap:5}}}};
const DEFS=Object.assign({},CHAMPS,MOBS,BOSSES);
const CLASS_BEATS={brawler:'rogue',rogue:'caster',caster:'brawler',tank:'beast',beast:'trickster',trickster:'tank'};
// Fix-wave item 5 (final review, Important): the minimum CHARGE frames a released heavy still swings
// at, instead of cancelling outright -- see Fighter.act's own CHARGE branch comment (50_fighter.js).
// A flat frame count, independent of any per-champion moves.heavy.charge override (goblin 14, hobgoblin
// 30) -- it's well under every one of those (a full charge is still what auto-fires the swing; this
// only decides what an EARLY release does).
const HEAVY_MIN_CHARGE=8;
const CLASS_BONUS=1.15,PARRY_WINDOW=6,PARRY_STUN=50,CHIP=.08,POWER_MAX=300,PARRY_LOCKOUT=20,CRIT_MUL_DEFAULT=1.6;
const DASH_BACK={frames:12,dist:90,inv:8},KNOCKDOWN={frames:40,inv:10};
const STAGE_W=1400;
// Wall clamp half-width for Fighter.tick's x clamp. Wide enough that a fighter pinned at the wall
// stays fully on screen: the rig can reach (shoulderW/2 + armLen + limb) * def.scale past the
// fighter's x. Fix round 1 set this to 110 against the Phase-2-era rig; fix round 2's rescaled
// LOOKS push that reach to ~162px for Carl and ~212px for the hobgoblin (its def.scale=1.1 on top
// of already-larger proportions), so 110 was no longer enough — see the "every look's reach fits
// inside EDGE_PAD" test. A camera margin can't fix this alone because the parallax-1.0 floor layer
// is drawn exactly STAGE_W wide, so letting the camera past its own limit would expose blank canvas
// past the stage edge; this has to be a sim-side constant (Fighter stays independent of Rig) instead.
// Fix-wave item 3: bumped 220->260 (pulled forward from item 9's own EDGE_PAD work) — folding the
// drawn head into Rig.extent (see that function's own comment) pushed Mongo's reach to 234.3, past
// the old 220 margin. 260 is item 9's own number (it fixes Donut/Mother Rat's much larger quad-rig
// gap the same pass), so bumping it here rather than re-deriving a smaller one just for Mongo avoids
// moving this constant twice across two commits for the same underlying (headR/reach) reason.
// Fix-wave item 9: Donut/Mother Rat (LOOKS.donut/mother_rat, 68_rig.js) trimmed until Rig.extent's
// reach — props and head both included — clears this 260 value for every look with real margin
// (Mongo 234.3, Grull 191.2, Donut 257.2, Mother Rat 254.7, everyone else already well under); the
// "every look's reach fits inside EDGE_PAD" test's quad carve-out is deleted, no longer needed.
const EDGE_PAD=260;

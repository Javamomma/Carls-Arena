# Playtest notes — 2026-09-22

## Owner (Arshia), on a phone, first run
- "The goblin didn't really die until it started to beat me up." The tutorial dummy is invulnerable (tutorialGuard) until lesson 4, then throws mediums; to a player it reads as a bug, not a lesson.
- "The graphics could use a lot of work. It's just stick figures right now."
- Mobile controls wanted: swipe RIGHT = dash forward, swipe BACK = block, TAP = attack.
- "We'll need to develop more complicated attacks."
- "We need to think through the level up process."
- "Kick and punch do the same thing graphically." (KICK triggers the medium, which is drawn as a lunging straight punch; there is no leg strike.)
- "Hobgoblin Brute is impossible to defeat, need to level up before we get there." (Floor 1 door 3, tier brute, 700 hp, at level 1 with ~460 gold banked.)

## Controller (Claude), desktop Chrome, keyboard, tutorial replay
- At spawn distance (~320 px) every light punch whiffs: there is no walk, and the medium's 140 px dash-in covers less than half the gap, so "TAP PUNCH — land 3 light hits" cannot be satisfied without first discovering that KICK moves you. The dummy never approaches either. First-run failure #1.
- After a whiffed medium the pose recovers to idle; the player gets no feedback that they are out of range (no "too far" cue, no auto-approach).
- The rendered characters are readable but read as posed mannequins: limbs are capsule strokes, faces are two dots, no clothing detail beyond the vest/shorts, no muscle silhouette, animations are keyframe tweens without anticipation/overshoot. The stage, HUD and buttons read as a game; the fighters do not.
- Announcer toast at the bottom competes with the tutorial prompt at the top for attention.

## Immediate implications for the redesign
1. Movement: add forward/back locomotion (auto-approach on tap when out of range, or swipe-right dash that always closes to striking range) and make the tutorial dummy step in.
2. Tutorial: make the sparring state visible (SPAR badge, "lesson 1/4", dummy shield icon) or let the dummy die and respawn per lesson; never let an invulnerable enemy start attacking without a banner.
3. Controls: the owner's scheme (tap attack, swipe right dash-forward attack, swipe left block) with hold-tap heavy, block-release parry, and specials on buttons.
4. Distinct move art: kick = leg strike; punch = arm strike; heavies and specials with anticipation and follow-through.
5. Progression gate: floor 1 must be clearable at level 1-3 by a human; the brute belongs on floor 2 or needs a level gate/hint ("recommended LVL 4").
6. Art: move from capsule rigs to a real character look (layered shapes with gradients/outlines/faces or sprite sheets through the atlas hook).
- Owner: 'No way to exit it seems after a defeat' (result screen after a loss has no working CONTINUE/exit).

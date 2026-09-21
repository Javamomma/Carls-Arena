# Carl's Doorway Brawl (MCoC-style fighter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Carl's Doorway Dash shell (canvas, touch layer, HUD, save, audio synth, announcer, perk shop) into a Marvel Contest of Champions-style one-on-one tap-and-swipe fighter with a Dungeon Crawler Carl roster, built in five phases where each phase ships a playable, harness-verified game.

**Architecture:** A new repo (`~/Projects/Carls-Arena`) whose `src/` holds one file per responsibility and whose `tools/build.py` concatenates them into a single `index.html` (the only deliverable, runnable from `file://`). The fight is a deterministic 60 Hz fixed-step simulation: two `Fighter` state machines driven by pluggable controllers (touch input, AI, scripted bots), resolved by a `Fight` object that owns the RNG, hit resolution, timer, and event log. Rendering reads fight state and never mutates it, so the same `Fight` runs headless under Playwright for unit tests and soak runs.

**Tech Stack:** Vanilla ES2020 in one HTML file, canvas 2D, Web Audio synth (no assets), `localStorage`, Python 3 + Playwright for headless tests (already installed, same as Carls-Dash `tests/harness.py`). No npm, no bundler.

**Spec:** Inline, next section. No separate brainstorm document exists; the decisions below were made from the Carls-Dash codebase and the MCoC reference and are the assumptions to change if you disagree.

---

## Spec (design decisions, treat as the source of truth)

**Working title:** Carl's Doorway Brawl. Rename freely; it only appears in `src/00_head.html`.

**Fight model (what MCoC does, kept):**
- Player is always on the left facing right; opponent on the right. No crossover, no jumping.
- One round, 120 s clock. Win by KO or higher health percentage at time-up.
- Touch layout in landscape: left third of the canvas is the defense zone (hold = block, swipe left = dash back); the rest is offense (tap = light, swipe right = medium dash-in attack, hold = heavy which fires when its charge completes and cancels if released early). Three round buttons on the right edge fire specials 1/2/3 when the power bar holds 1/2/3 bars.
- Light chain L1-L5 (L5 knocks down). Medium can open or end a chain. Heavy knocks down.
- Block takes chip damage (8%) and blockstun. Parry = block pressed within 6 frames before the hit lands, and only versus non-special attacks: attacker is stunned 50 frames, no chip.
- Dash back has 8 invulnerable frames. Knockdown lasts 40 frames plus 10 get-up invulnerable frames; no hitting a downed fighter.
- Power: attacker gains on hit, defender gains on being hit or blocking; 3 bars of 100. Specials cost 1/2/3 bars. Special 3 is unblockable and cinematic.
- Class triangle (two triangles, six classes, like MCoC's six): BRAWLER > ROGUE > CASTER > BRAWLER, and TANK > BEAST > TRICKSTER > TANK. Advantage = 15% damage.
- Stats per champion: hp, atk, armor (fraction), crit rate (Phase 2 adds crit multiplier, block proficiency).

**Roster:** DCC cast only, no Marvel characters. Phase 1: Carl, Princess Donut. Phase 2: Mongo, Katia. Phase 3: Mordecai, Imani, Li Jun, Zev. Bosses later.

**Meta (Phase 4):** roster with stars/rank/level, crystals (seeded gacha with pity), ISO and catalysts, quest map (Act 1 = 3 chapters x 6 nodes), arena streak mode, energy timer, gold + units currencies. The Carls-Dash "SPONSOR PERK KIOSK" becomes the catalyst/perk shop.

**Broadcast layer (Phase 5):** viewers counter, ratings multipliers for style, announcer packs, sponsor perks, share card. The `Lines` table and `say()` from Carls-Dash port over.

**Non-goals:** multiplayer, real-money anything, cloud saves, external art or audio, portrait mode.

## Global Constraints

- Deliverable is a single `index.html` produced by `python3 tools/build.py`; never hand-edit `index.html`.
- Runs from `file://` with no network. Canvas is 854x480 landscape, `image-rendering: pixelated`, scaled to fit the viewport.
- Fixed timestep `STEP = 1/60`; every fight is reproducible from `{seed, controllers}`. No `Math.random()` or `performance.now()` inside `Fight`, `Fighter`, `AI`, or `Ctrl.*`; only `Input` (human) may read the wall clock.
- Zero external assets: all art is drawn to canvas, all audio is `Audio.tone` synthesis.
- Only dev dependency: Python 3 with Playwright (`python3 -c "import playwright"` already passes on this Mac).
- Before every commit: `python3 tools/build.py && python3 tests/harness.py --unit && python3 tests/harness.py --sim --seconds 60` must all exit 0.
- Save key is `carlsArena.v1`; never reuse `carlsDoorwayDash.v1`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Phase overview and budgets

| Phase | Deliverable | Sessions | Total tokens (est.) | Detail level in this doc |
|---|---|---|---|---|
| 0 | Repo, build, harness, title-to-fight state machine | 1 | 0.3M | Full tasks |
| 1 | Core fight loop: input, moves, block/parry/dash, specials, timer, KO, basic AI, unit tests | 2-3 | 1.2M | Full tasks |
| 2 | Feel and champions: camera, procedural sprites, hitstop/shake/particles, sfx, crit/armor, 4 champions, S3 cinematic | 3-4 | 1.5-2M | Task list + interfaces + exit tests |
| 3 | AI tiers, node buffs, encounters, 8 champions, batch win-rate tool | 3 | 1-1.5M | Task list + interfaces + exit tests |
| 4 | Meta: roster, crystals, quest map, rewards, arena streak | 5-6 | 2-3M | Task list + interfaces + exit tests |
| 5 | Broadcast layer, tutorial, settings, perf, rubric, Pages deploy | 3-4 | 1-1.5M | Task list + exit tests |

Phases 2-5 get their own bite-sized plan file (same format as Phase 1) at the start of that phase, written against the interfaces frozen here. Do not start a later phase until the earlier phase's exit criteria pass.

## File structure (locked in Phase 0)

```
~/Projects/Carls-Arena/
  index.html              built artifact, committed, never hand-edited
  src/
    00_head.html          doctype, <style>, DOM overlays, opening <script>
    10_util.js            W, H, FLOOR, STEP, canvas, clamp, RNG(seed)
    15_save.js            Save (localStorage, key carlsArena.v1)
    20_audio.js           Audio.init/tone/say + named sfx recipes
    30_input.js           Input (touch/keys -> action queue) and Ctrl (controller factories)
    40_movedata.js        MOVES frame data, CHAMPS, CLASS_BEATS, tuning constants
    50_fighter.js         Fighter state machine
    55_ai.js              AI profiles and controller factory
    60_fight.js           Fight: step(), hit resolution, timer, log
    70_render.js          Render: arena, fighters, HUD (reads state only)
    80_game.js            G: app states TITLE/FIGHT/PAUSED/RESULT, loop, sim hooks, DOM wiring
    90_tests.js           Test registry + in-page unit tests
    99_tail.html          closing </script></body></html>
  tools/build.py          concatenates src/* sorted by name into index.html; --check
  tests/harness.py        Playwright runner: --unit, --sim, --bot, --ai, --seed, --eval, --probe, --shot
  docs/ARENA.md           rubric with verification column (Phase 5), modeled on Carls-Dash docs/PARITY.md
  docs/superpowers/plans/ this plan, plus one plan per later phase
```

Interfaces every file relies on (defined in Phase 0/1, frozen afterwards):

```
intent = {light:bool, medium:bool, heavy:bool(held), block:bool(held), dashBack:bool, special:0|1|2|3}
ctrl   = {next(fight, me, foe) -> intent}            // Ctrl.player(), Ctrl.idle(), Ctrl.hold(intent), Ctrl.script(steps), Ctrl.random(seed), AI.make(profile, seed)
Fighter(def, side, ctrl)   .state .f .x .face .hp .maxHp .power .combo .move .inv .blockAge
                           .act(intent, fight) .tick(fight) .hitbox() .hurtbox() .startMove(name) .phase() .hitIndex()
Fight({seed,p1,p2,ctrl1,ctrl2,clock,onEvent})  .step() .frame .clock .over .winner .log[] .hitstop
Fight events: 'hit'(att,def,dmg) 'block'(att,def,chip) 'parry'(def,att) 'miss'(att,def) 'ko'(winner)
G.startFight({seed,p1,p2,ai,ctrl1,ctrl2,clock})  G.simFrames(n)  G.sim  G.state  G.fight
Test.add(name, fn)  Test.run() -> {pass, fail, results:[{name, ok, err}]}
```

---

# Phase 0: Scaffold

### Task 0.1: Create the repo, build script, and static shell

**Files:**
- Create: `~/Projects/Carls-Arena/tools/build.py`
- Create: `~/Projects/Carls-Arena/src/00_head.html`
- Create: `~/Projects/Carls-Arena/src/99_tail.html`
- Create: `~/Projects/Carls-Arena/.gitignore`
- Create: `~/Projects/Carls-Arena/README.md`
- Copy: this plan to `~/Projects/Carls-Arena/docs/superpowers/plans/2026-09-21-carls-arena-fighter.md`

**Interfaces:**
- Produces: `python3 tools/build.py` writes `index.html`; `python3 tools/build.py --check` exits 1 when `index.html` is stale. DOM ids `game`, `specials`, `s1` `s2` `s3`, `toast`, `title`, `fightBtn`, `titleMute`, `pauseMenu`, `resume`, `quit`, `result`, `resultTitle`, `resultLine`, `again`, `resultTitleBtn`.

- [ ] **Step 1: Create the repo**

```bash
mkdir -p ~/Projects/Carls-Arena/{src,tools,tests,docs/superpowers/plans}
cd ~/Projects/Carls-Arena && git init -b main
printf '__pycache__/\n.DS_Store\n*.png\n' > .gitignore
cp ~/Projects/Carls-Dash/docs/superpowers/plans/2026-09-21-carls-arena-fighter.md docs/superpowers/plans/
```

- [ ] **Step 2: Write the build script**

`tools/build.py`:
```python
#!/usr/bin/env python3
"""Concatenate src/* (sorted by filename) into index.html.

  python3 tools/build.py          # write index.html
  python3 tools/build.py --check  # exit 1 if index.html differs from a fresh build
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
parts = [open(p, encoding='utf-8').read() for p in sorted(glob.glob(os.path.join(ROOT, 'src', '*')))]
out = '\n'.join(parts)
idx = os.path.join(ROOT, 'index.html')
if '--check' in sys.argv:
    cur = open(idx, encoding='utf-8').read() if os.path.exists(idx) else ''
    sys.exit(0 if cur == out else 1)
open(idx, 'w', encoding='utf-8').write(out)
print(f'wrote index.html ({len(out)} bytes, {len(parts)} parts)')
```

- [ ] **Step 3: Write the HTML head (style + DOM)**

`src/00_head.html`:
```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>Carl's Doorway Brawl</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;min-height:100%;background:#090b12;color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;touch-action:none;user-select:none}
#wrap{position:relative;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}
canvas{display:block;image-rendering:pixelated;background:#101422}
.overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(9,11,18,.85)}.overlay.show{display:flex}
.panel{text-align:center;padding:16px;max-width:520px}.panel h1{margin:0 0 8px;font-size:28px;letter-spacing:2px}.panel p{font-size:13px;line-height:1.5}.panel button{display:block;width:100%;margin:8px 0;padding:12px;font:inherit;font-size:16px;background:#f4c542;color:#111;border:0;border-radius:6px}
#specials{position:absolute;right:12px;bottom:12px;display:none;flex-direction:column;gap:8px}#specials.show{display:flex}#specials button{width:64px;height:64px;border-radius:50%;border:3px solid #f4c542;background:#1a1f33;color:#f4c542;font:inherit;font-size:18px;opacity:.35}#specials button.ready{opacity:1;background:#f4c542;color:#111}
#toast{position:absolute;left:50%;top:70px;transform:translateX(-50%);font-size:13px;color:#f4c542;pointer-events:none;text-shadow:0 1px 0 #000;white-space:nowrap}
</style></head><body><div id="wrap"><canvas id="game" width="854" height="480"></canvas>
<div id="specials"><button id="s3">S3</button><button id="s2">S2</button><button id="s1">S1</button></div>
<div id="toast"></div>
<div class="overlay show" id="title"><div class="panel"><h1>CARL'S DOORWAY BRAWL</h1><p>ONE THUMB. ONE DOORWAY. ONE CRAWLER LEAVES.<br>LEFT SIDE: HOLD = BLOCK, SWIPE LEFT = DODGE. RIGHT SIDE: TAP = LIGHT, SWIPE RIGHT = MEDIUM, HOLD = HEAVY.</p><button id="fightBtn">FIGHT</button><button id="titleMute">SOUND: ON</button></div></div>
<div class="overlay" id="pauseMenu"><div class="panel"><h1>PAUSED</h1><button id="resume">RESUME</button><button id="quit">QUIT</button></div></div>
<div class="overlay" id="result"><div class="panel"><h1 id="resultTitle">VICTORY</h1><p id="resultLine"></p><button id="again">FIGHT AGAIN</button><button id="resultTitleBtn">TITLE</button></div></div>
</div><script>
```

`src/99_tail.html`:
```html
</script></body></html>
```

- [ ] **Step 4: Write the README**

`README.md`:
```markdown
# Carl's Doorway Brawl

One-on-one tap-and-swipe fighter in the Dungeon Crawler Carl universe. Single HTML file, no assets, no build besides `python3 tools/build.py`.

- Edit files in `src/`, then `python3 tools/build.py` writes `index.html`.
- `python3 tests/harness.py --unit` runs the in-page unit tests headless.
- `python3 tests/harness.py --sim --seconds 60 --bot random --ai basic` soaks the fight loop.
- Plan: `docs/superpowers/plans/2026-09-21-carls-arena-fighter.md`.
```

- [ ] **Step 5: Build and verify the shell loads**

Run: `cd ~/Projects/Carls-Arena && python3 tools/build.py && python3 tools/build.py --check; echo check=$?`
Expected: `wrote index.html (... bytes, 2 parts)` then `check=0`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Carl's Doorway Brawl repo, build script, static shell

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 0.2: Util, Save, Audio, empty game loop

**Files:**
- Create: `src/10_util.js`, `src/15_save.js`, `src/20_audio.js`, `src/80_game.js`

**Interfaces:**
- Produces: `W H FLOOR STEP canvas clamp RNG(seed)`; `Save.data Save.put()`; `Audio.init() Audio.tone(f,d,type,v,when) Audio.say(line) Audio.hit() Audio.block() Audio.parry() Audio.ko()`; `G.state G.fit() G.show(id,on) G.loop()` (fight wiring comes in Task 1.7).

- [ ] **Step 1: Write util**

`src/10_util.js`:
```js
'use strict';
const W=854,H=480,FLOOR=400,STEP=1/60;
const canvas=document.getElementById('game');
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// xorshift32; deterministic per seed. Never use Math.random inside the sim.
function RNG(seed){let s=(seed>>>0)||0x9e3779b9;return{
  next(){s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296},
  int(n){return Math.floor(this.next()*n)},
  pick(a){return a[this.int(a.length)]}}}
```

- [ ] **Step 2: Write save**

`src/15_save.js`:
```js
const Save={key:'carlsArena.v1',data:null,
  load(){try{this.data=JSON.parse(localStorage.getItem(this.key))||null}catch(e){this.data=null}
    if(!this.data)this.data={v:1,gold:0,units:0,roster:{},mute:false,settings:{}}},
  put(){try{localStorage.setItem(this.key,JSON.stringify(this.data))}catch(e){}}};
Save.load();
```

- [ ] **Step 3: Write audio**

`src/20_audio.js`:
```js
const Audio={ac:null,muted:Save.data.mute,_t:0,
  init(){if(!this.ac){try{this.ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(this.ac&&this.ac.state==='suspended')this.ac.resume()},
  tone(f,d=.08,type='square',v=.035,when=0){if(this.muted||!this.ac)return;const t=this.ac.currentTime+when,o=this.ac.createOscillator(),g=this.ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(this.ac.destination);o.start(t);o.stop(t+d+.02)},
  say(line){const el=document.getElementById('toast');el.textContent=line;clearTimeout(this._t);this._t=setTimeout(()=>{el.textContent=''},2200)},
  hit(){this.tone(180,.06,'square',.05);this.tone(90,.1,'sawtooth',.04,.02)},
  block(){this.tone(420,.04,'triangle',.03)},
  parry(){this.tone(880,.08,'square',.05);this.tone(1320,.12,'square',.04,.06)},
  ko(){for(let i=0;i<6;i++)this.tone(300-40*i,.15,'sawtooth',.05,i*.07)}};
```

- [ ] **Step 4: Write the minimal game object**

`src/80_game.js` (Phase 0 version; Task 1.7 replaces it):
```js
const G={state:'TITLE',fight:null,acc:0,last:0,sim:false,debug:false,seed:1,
  fit(){const s=Math.min(innerWidth/W,innerHeight/H);canvas.style.width=Math.floor(W*s)+'px';canvas.style.height=Math.floor(H*s)+'px'},
  show(id,on){document.getElementById(id).classList.toggle('show',on)},
  loop(t){const c=canvas.getContext('2d');c.fillStyle='#1a1f33';c.fillRect(0,0,W,FLOOR);c.fillStyle='#2b2f45';c.fillRect(0,FLOOR,W,H-FLOOR);requestAnimationFrame(t=>this.loop(t))},
  init(){this.fit();addEventListener('resize',()=>this.fit());
    document.getElementById('titleMute').onclick=e=>{Audio.muted=!Audio.muted;Save.data.mute=Audio.muted;Save.put();e.target.textContent='SOUND: '+(Audio.muted?'OFF':'ON')};
    requestAnimationFrame(t=>{this.last=t;this.loop(t)})}};
G.init();
```

- [ ] **Step 5: Build and smoke-test in headless Chromium**

Run:
```bash
cd ~/Projects/Carls-Arena && python3 tools/build.py && python3 - <<'EOF'
from playwright.sync_api import sync_playwright
import os
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':854,'height':480})
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.abspath('index.html'));pg.wait_for_timeout(500)
    print('state',pg.evaluate('G.state'),'rng',pg.evaluate('RNG(7).next()===RNG(7).next()'))
    b.close()
print('errors',errs)
EOF
```
Expected: `state TITLE rng True` and `errors []`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: util, save, audio synth, empty render loop

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 0.3: Test registry and Playwright harness

**Files:**
- Create: `src/90_tests.js`
- Create: `tests/harness.py`

**Interfaces:**
- Produces: `Test.add(name,fn)`, `Test.run()`, helpers `eq(a,b,msg)`, `ok(v,msg)`. Harness flags listed in the file docstring. `--unit` exits 1 on any failing test or page error.

- [ ] **Step 1: Write the test registry with one sanity test**

`src/90_tests.js`:
```js
const Test={cases:[],add(n,fn){this.cases.push({n,fn})},
  run(){const out=[];for(const c of this.cases){try{c.fn();out.push({name:c.n,ok:true})}catch(e){out.push({name:c.n,ok:false,err:String(e&&e.message||e)})}}
    return{pass:out.filter(o=>o.ok).length,fail:out.filter(o=>!o.ok).length,results:out}}};
const eq=(a,b,m)=>{if(a!==b)throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a))};
const ok=(v,m)=>{if(!v)throw new Error(m||'expected truthy')};
Test.add('rng is deterministic per seed',()=>{const a=RNG(42),b=RNG(42);for(let i=0;i<5;i++)eq(a.next(),b.next());ok(RNG(1).next()!==RNG(2).next())});
```

- [ ] **Step 2: Write the harness**

`tests/harness.py`:
```python
#!/usr/bin/env python3
"""Headless harness for Carl's Doorway Brawl (Python Playwright, no npm).

  python3 tests/harness.py --unit                                   # in-page unit tests; exit 1 on any failure
  python3 tests/harness.py --sim --seconds 60 --bot random --ai basic --seed 7
  python3 tests/harness.py --seconds 20 --shot /tmp/fight.png --eval 'G.fight.p1.hp'
  python3 tests/harness.py --sim --seconds 30 --probe 'G.fight.p1.combo'

Exit 1 on any page error, console error, or if the game never left TITLE.
"""
import argparse, json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = 'file://' + os.path.join(ROOT, 'index.html')

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--unit', action='store_true', help='run Test.run() and exit')
    ap.add_argument('--sim', action='store_true', help='step G.simFrames deterministically instead of wall clock')
    ap.add_argument('--seconds', type=float, default=20)
    ap.add_argument('--bot', default='random', choices=['random', 'idle'])
    ap.add_argument('--ai', default='basic')
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--p1', default='carl')
    ap.add_argument('--p2', default='donut')
    ap.add_argument('--shot', default=None)
    ap.add_argument('--eval', action='append', default=[])
    ap.add_argument('--probe', action='append', default=[], help='JS sampled once per sim second')
    ap.add_argument('--pre', default=None, help='JS run after load, before start')
    a = ap.parse_args()
    errors, console = [], []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 854, 'height': 480})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: console.append(m.text) if m.type == 'error' else None)
        pg.goto(INDEX)
        pg.wait_for_function('typeof G!=="undefined"')
        if a.pre:
            pg.evaluate(a.pre)
        out = {'errors': errors, 'console_errors': console}
        if a.unit:
            r = pg.evaluate('Test.run()')
            out['unit'] = r
            print(json.dumps(out, indent=1))
            b.close()
            sys.exit(0 if r['fail'] == 0 and not errors else 1)
        ctrl = 'Ctrl.random(%d)' % a.seed if a.bot == 'random' else 'Ctrl.idle()'
        pg.evaluate("G.sim=%s;G.startFight({seed:%d,p1:'%s',p2:'%s',ai:'%s',ctrl1:%s})"
                    % ('true' if a.sim else 'false', a.seed, a.p1, a.p2, a.ai, ctrl))
        probes = {e: [] for e in a.probe}
        if a.sim:
            for _ in range(int(a.seconds)):
                pg.evaluate('G.simFrames(60)')
                for e in a.probe:
                    probes[e].append(pg.evaluate(e))
        else:
            t0 = time.time()
            while time.time() - t0 < a.seconds:
                pg.wait_for_timeout(1000)
                for e in a.probe:
                    probes[e].append(pg.evaluate(e))
        out['state'] = pg.evaluate('G.state')
        out['fight'] = pg.evaluate('G.fight&&{frame:G.fight.frame,over:G.fight.over,p1hp:G.fight.p1.hp,p2hp:G.fight.p2.hp,'
                                   'hits:G.fight.log.filter(e=>e.type==="hit").length,winner:G.fight.winner&&G.fight.winner.side}')
        out['probes'] = probes
        out['eval'] = {e: pg.evaluate(e) for e in a.eval}
        if a.shot:
            pg.screenshot(path=a.shot)
        b.close()
    print(json.dumps(out, indent=1))
    sys.exit(1 if errors or console or out['state'] == 'TITLE' else 0)

if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Build and run the unit test**

Run: `cd ~/Projects/Carls-Arena && python3 tools/build.py && python3 tests/harness.py --unit`
Expected: JSON with `"pass": 1, "fail": 0`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: in-page Test registry and Playwright harness

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Phase 0 exit criteria:** `tools/build.py --check` exits 0, `harness --unit` passes 1 test, headless load has no page errors.

---

# Phase 1: Core fight loop

Order matters: move data and the fighter state machine first (pure, testable), then resolution, then controllers/AI, then rendering and DOM wiring, so every task before 1.7 is verified by `--unit` alone.

### Task 1.1: Move data and champion definitions

**Files:**
- Create: `src/40_movedata.js`
- Modify: `src/90_tests.js` (append)

**Interfaces:**
- Produces: `MOVES` (keys `light1..light5 medium heavy s1 s2 s3`), each `{startup,active,recovery,dmg,range,hitstun,blockstun,push,powHit,powTaken,chain,dash?,charge?,hits?,gap?,cost?,knockdown?,unblockable?}`; `CHAMPS.carl CHAMPS.donut` `{id,name,cls,hp,atk,color,armor,crit}`; `CLASS_BEATS`, `CLASS_BONUS=1.15`, `PARRY_WINDOW=6`, `PARRY_STUN=50`, `CHIP=.08`, `HITSTOP=4`, `DASH_BACK={frames:12,dist:90,inv:8}`, `KNOCKDOWN={frames:40,inv:10}`, `POWER_MAX=300`.

- [ ] **Step 1: Write the failing test**

Append to `src/90_tests.js`:
```js
Test.add('move table is complete and sane',()=>{
  for(const k of ['light1','light2','light3','light4','light5','medium','heavy','s1','s2','s3']){const m=MOVES[k];ok(m,k+' missing');
    for(const f of ['startup','active','recovery','dmg','range','hitstun','blockstun','push','powHit','powTaken'])ok(typeof m[f]==='number',k+'.'+f)}
  eq(MOVES.light1.chain,'light2');eq(MOVES.light5.chain,null);ok(MOVES.light5.knockdown);ok(MOVES.s3.unblockable);
  eq(MOVES.s1.cost,100);eq(MOVES.s2.cost,200);eq(MOVES.s3.cost,300);
  eq(CLASS_BEATS[CLASS_BEATS[CLASS_BEATS.brawler]],'brawler');eq(CLASS_BEATS[CLASS_BEATS[CLASS_BEATS.tank]],'tank');
  ok(CHAMPS.carl.hp>0&&CHAMPS.donut.atk>0)});
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: `fail: 1` with `MOVES is not defined`.

- [ ] **Step 3: Write the move data**

`src/40_movedata.js`:
```js
// All frame counts at 60 Hz. dash = px the attacker advances during startup. push = px the defender is shoved on hit.
const MOVES={
  light1:{startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light2',dash:18},
  light2:{startup:5,active:3,recovery:8, dmg:1,   range:70, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light3',dash:18},
  light3:{startup:5,active:3,recovery:9, dmg:1.05,range:75, hitstun:14,blockstun:9, push:18,powHit:7, powTaken:4,chain:'light4',dash:18},
  light4:{startup:6,active:3,recovery:10,dmg:1.1, range:75, hitstun:15,blockstun:10,push:20,powHit:8, powTaken:4,chain:'light5',dash:20},
  light5:{startup:7,active:4,recovery:16,dmg:1.4, range:80, hitstun:20,blockstun:12,push:60,powHit:10,powTaken:5,chain:null,dash:10,knockdown:true},
  medium:{startup:10,active:4,recovery:14,dmg:1.6,range:120,hitstun:18,blockstun:11,push:24,powHit:12,powTaken:6,chain:'light1',dash:140},
  heavy: {charge:22,startup:8,active:5,recovery:26,dmg:2.6,range:130,hitstun:26,blockstun:14,push:70,powHit:18,powTaken:9,chain:null,knockdown:true},
  s1:{startup:8, active:4,recovery:22,dmg:1.5,hits:3,gap:6,range:130,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:100,chain:null,knockdown:true},
  s2:{startup:10,active:4,recovery:28,dmg:1.6,hits:5,gap:6,range:150,hitstun:16,blockstun:10,push:20,powHit:0,powTaken:6,cost:200,chain:null,knockdown:true},
  s3:{startup:20,active:6,recovery:40,dmg:3,  hits:4,gap:8,range:220,hitstun:20,blockstun:0, push:90,powHit:0,powTaken:0,cost:300,chain:null,knockdown:true,unblockable:true}};
const CHAMPS={
  carl: {id:'carl', name:'CARL',           cls:'brawler',hp:1000,atk:60,color:'#f4c542',armor:0,  crit:.10},
  donut:{id:'donut',name:'PRINCESS DONUT', cls:'caster', hp:820, atk:70,color:'#e8a0d8',armor:0,  crit:.18}};
const CLASS_BEATS={brawler:'rogue',rogue:'caster',caster:'brawler',tank:'beast',beast:'trickster',trickster:'tank'};
const CLASS_BONUS=1.15,PARRY_WINDOW=6,PARRY_STUN=50,CHIP=.08,HITSTOP=4,POWER_MAX=300;
const DASH_BACK={frames:12,dist:90,inv:8},KNOCKDOWN={frames:40,inv:10};
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: `pass: 2, fail: 0`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: move frame data, two champions, class triangle constants

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 1.2: Controllers (Ctrl) and the Fighter state machine

**Files:**
- Create: `src/30_input.js` (Ctrl only; the human `Input` object is added in Task 1.6)
- Create: `src/50_fighter.js`
- Modify: `src/90_tests.js` (append)

**Interfaces:**
- Consumes: `MOVES`, `DASH_BACK`, `KNOCKDOWN`, `POWER_MAX`, `clamp`, `W`, `RNG`.
- Produces: `Ctrl.EMPTY() Ctrl.idle() Ctrl.hold(intent) Ctrl.script([{f,until?,intent}]) Ctrl.random(seed)`; `class Fighter` with the fields and methods listed in the interfaces block at the top. `Fighter.act` is called once per frame before `tick`; `blockAge` counts consecutive frames `intent.block` has been held (0 when not held).

- [ ] **Step 1: Write the failing tests**

Append to `src/90_tests.js`:
```js
function mkFighter(ctrl){return new Fighter(CHAMPS.carl,1,ctrl||Ctrl.idle())}
Test.add('fighter light attack walks startup/active/recovery then idles',()=>{
  const F=mkFighter();F.act(Object.assign(Ctrl.EMPTY(),{light:true}));eq(F.state,'ATTACK');eq(F.phase(),'startup');
  for(let i=0;i<5;i++)F.tick();eq(F.phase(),'active');ok(F.hitbox(),'hitbox during active');
  for(let i=0;i<3;i++)F.tick();eq(F.phase(),'recovery');eq(F.hitbox(),null);
  for(let i=0;i<8;i++)F.tick();eq(F.state,'IDLE');eq(F.move,null)});
Test.add('heavy charges while held and cancels when released early',()=>{
  const F=mkFighter();const held=Object.assign(Ctrl.EMPTY(),{heavy:true});F.act(held);eq(F.state,'CHARGE');
  for(let i=0;i<10;i++){F.act(held);F.tick()}eq(F.state,'CHARGE');
  F.act(Ctrl.EMPTY());eq(F.state,'IDLE');
  const G2=mkFighter();G2.act(held);for(let i=0;i<MOVES.heavy.charge;i++){G2.act(held);G2.tick()}eq(G2.state,'ATTACK')});
Test.add('dash back grants invulnerable frames and moves away from facing',()=>{
  const F=mkFighter();const x0=F.x;F.act(Object.assign(Ctrl.EMPTY(),{dashBack:true}));eq(F.state,'DASH');eq(F.inv,DASH_BACK.inv);
  for(let i=0;i<DASH_BACK.frames;i++)F.tick();eq(F.state,'IDLE');ok(F.x<x0,'moved back')});
Test.add('blockAge counts held frames and resets',()=>{
  const F=mkFighter();const b=Object.assign(Ctrl.EMPTY(),{block:true});F.act(b);eq(F.state,'BLOCK');eq(F.blockAge,1);F.act(b);eq(F.blockAge,2);F.act(Ctrl.EMPTY());eq(F.blockAge,0);eq(F.state,'IDLE')});
Test.add('special requires power and deducts it',()=>{
  const F=mkFighter();F.act(Object.assign(Ctrl.EMPTY(),{special:1}));eq(F.state,'IDLE');F.power=250;F.act(Object.assign(Ctrl.EMPTY(),{special:2}));eq(F.state,'ATTACK');eq(F.power,50);eq(F.moveName,'s2')});
Test.add('script controller fires at frames and holds through until',()=>{
  const c=Ctrl.script([{f:0,intent:{light:true}},{f:2,until:4,intent:{block:true}}]);
  eq(c.next().light,true);eq(c.next().block,false);eq(c.next().block,true);eq(c.next().block,true);eq(c.next().block,true);eq(c.next().block,false)});
Test.add('random controller is deterministic per seed',()=>{const a=Ctrl.random(5),b=Ctrl.random(5);for(let i=0;i<50;i++)eq(JSON.stringify(a.next()),JSON.stringify(b.next()))});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: 7 new failures, `Ctrl is not defined` / `Fighter is not defined`.

- [ ] **Step 3: Write Ctrl**

`src/30_input.js` (Phase 1.2 version; Task 1.6 prepends `Input` and adds `Ctrl.player`):
```js
const Ctrl={
  EMPTY:()=>({light:false,medium:false,heavy:false,block:false,dashBack:false,special:0}),
  idle:()=>({next:()=>Ctrl.EMPTY()}),
  hold:intent=>({next:()=>Object.assign(Ctrl.EMPTY(),intent)}),
  // steps: [{f, until?, intent}] in controller frames (frames where next() was called)
  script:steps=>({f:0,next(){const it=Ctrl.EMPTY();for(const s of steps)if(this.f>=s.f&&this.f<=(s.until===undefined?s.f:s.until))Object.assign(it,s.intent);this.f++;return it}}),
  // seeded chaos monkey: picks a plan, holds block/heavy plans for a while, taps others once
  random:seed=>{const r=RNG(seed);let plan='',left=0;return{next(){
    if(left--<=0){plan=r.pick(['','','light','light','medium','dashBack','block','block','heavy','special']);left=plan==='block'?10+r.int(30):plan==='heavy'?30:1}
    const it=Ctrl.EMPTY();if(plan==='block')it.block=true;else if(plan==='heavy')it.heavy=true;else if(plan==='special')it.special=1;else if(plan)it[plan]=true;return it}}}};
```

- [ ] **Step 4: Write Fighter**

`src/50_fighter.js`:
```js
class Fighter{
  constructor(def,side,ctrl){this.def=def;this.side=side;this.face=side;this.ctrl=ctrl;
    this.x=side===1?W/2-160:W/2+160;this.width=48;this.hp=def.hp;this.maxHp=def.hp;this.power=0;
    this.state='IDLE';this.f=0;this.move=null;this.moveName=null;this.hits=null;this.landed=false;
    this.combo=0;this.stun=0;this.inv=0;this.blockAge=0}
  get front(){return this.x+this.face*this.width/2}
  busy(){return this.state!=='IDLE'&&this.state!=='BLOCK'}
  setState(s,f=0){this.state=s;this.f=f}
  startMove(name){this.move=MOVES[name];this.moveName=name;this.hits=new Set();this.landed=false;
    if(this.move.cost)this.power-=this.move.cost;this.setState(this.move.charge?'CHARGE':'ATTACK')}
  activeSpan(){const m=this.move,n=m.hits||1;return n*m.active+(n-1)*(m.gap||0)}
  phase(){const m=this.move;if(!m||this.state!=='ATTACK')return null;const su=m.startup,act=this.activeSpan();
    return this.f<su?'startup':this.f<su+act?'active':this.f<su+act+m.recovery?'recovery':'done'}
  hitIndex(){const m=this.move,k=this.f-m.startup,span=m.active+(m.gap||0);if(k<0)return-1;const i=Math.floor(k/span);return(k%span)<m.active&&i<(m.hits||1)?i:-1}
  hitbox(){if(this.phase()!=='active')return null;const a=this.front,b=this.front+this.face*this.move.range;return{x0:Math.min(a,b),x1:Math.max(a,b)}}
  hurtbox(){return{x0:this.x-this.width/2,x1:this.x+this.width/2}}
  // Consume one frame of intent. Called before tick().
  act(intent){this.blockAge=intent.block?this.blockAge+1:0;const S=this.state;
    if(S==='IDLE'||S==='BLOCK'){
      if(intent.special&&this.power>=MOVES['s'+intent.special].cost)return this.startMove('s'+intent.special);
      if(intent.dashBack){this.inv=DASH_BACK.inv;return this.setState('DASH')}
      if(intent.medium)return this.startMove('medium');
      if(intent.light)return this.startMove('light1');
      if(intent.heavy)return this.startMove('heavy');
      const want=intent.block?'BLOCK':'IDLE';if(want!==S)this.setState(want)}
    else if(S==='ATTACK'&&this.phase()==='recovery'&&this.move.chain&&this.landed){
      if(intent.light)return this.startMove(this.move.chain);
      if(intent.medium&&this.moveName!=='medium')return this.startMove('medium')}
    else if(S==='CHARGE'&&!intent.heavy){this.move=null;this.moveName=null;this.setState('IDLE')}}
  // Advance one frame of the state machine.
  tick(){this.f++;if(this.inv>0)this.inv--;
    switch(this.state){
      case'CHARGE':if(this.f>=this.move.charge)this.setState('ATTACK');break;
      case'ATTACK':{const m=this.move;if(m.dash&&this.f<=m.startup)this.x+=this.face*m.dash/m.startup;
        if(this.phase()==='done'){this.move=null;this.moveName=null;this.landed=false;this.setState('IDLE')}break}
      case'DASH':this.x-=this.face*DASH_BACK.dist/DASH_BACK.frames;if(this.f>=DASH_BACK.frames)this.setState('IDLE');break;
      case'HITSTUN':case'BLOCKSTUN':case'STUNNED':if(this.f>=this.stun)this.setState('IDLE');break;
      case'KNOCKDOWN':if(this.f>=KNOCKDOWN.frames){this.inv=KNOCKDOWN.inv;this.setState('IDLE')}break}
    this.x=clamp(this.x,this.width/2+8,W-this.width/2-8)}}
```

- [ ] **Step 5: Run to verify they pass**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: `pass: 9, fail: 0`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: controller factories and Fighter state machine

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 1.3: Fight resolution (hits, block, parry, evade, knockdown, power, KO, timer)

**Files:**
- Create: `src/60_fight.js`
- Modify: `src/90_tests.js` (append)

**Interfaces:**
- Consumes: `Fighter`, `MOVES`, tuning constants, `Audio.hit/block/parry/ko`, `RNG`, `STEP`.
- Produces: `class Fight` with `step()`, `frame`, `clock`, `hitstop`, `over`, `winner`, `log[{f,type,who,val}]`, `emit(type,...)`, `onEvent(type,...args)`. Hitstop freezes the whole fight (controllers are not polled during hitstop).

- [ ] **Step 1: Write the failing tests**

Append to `src/90_tests.js`:
```js
function mkFight(o={}){return new Fight(Object.assign({seed:1,p1:CHAMPS.carl,p2:CHAMPS.carl,ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle(),clock:120},o))}
function run(f,n){for(let i=0;i<n;i++)f.step()}
function closeIn(f){f.p1.x=f.p2.x-f.p1.width-10}   // p1 within light range of p2
const L=(f,until)=>({f,until,intent:{light:true}});
Test.add('light connects on first active frame for atk*dmg',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.p2.hp,940);eq(f.p2.state,'HITSTUN');eq(f.hitstop,HITSTOP);eq(f.p1.combo,1)});
Test.add('held block takes chip and blockstun, attacker may chain',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(10)]),ctrl2:Ctrl.hold({block:true})});closeIn(f);run(f,15);
  eq(f.p2.hp,995);eq(f.p2.state,'BLOCKSTUN');eq(f.p1.landed,true);eq(f.log.filter(e=>e.type==='block').length,1)});
Test.add('block pressed inside the window parries and stuns the attacker',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.script([{f:2,until:40,intent:{block:true}}])});closeIn(f);run(f,5);
  eq(f.p2.hp,1000);eq(f.p1.state,'STUNNED');eq(f.p1.stun,PARRY_STUN);eq(f.log[f.log.length-1].type,'parry')});
Test.add('specials cannot be parried',()=>{
  const f=mkFight({ctrl1:Ctrl.script([{f:0,intent:{special:1}}]),ctrl2:Ctrl.script([{f:5,until:40,intent:{block:true}}])});closeIn(f);f.p1.power=100;run(f,8);
  ok(f.p1.state!=='STUNNED');eq(f.log.filter(e=>e.type==='block').length,1)});
Test.add('dash back evades a light',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)]),ctrl2:Ctrl.script([{f:0,intent:{dashBack:true}}])});closeIn(f);run(f,5);
  eq(f.p2.hp,1000);eq(f.log[f.log.length-1].type,'miss')});
Test.add('holding light chains five hits into a knockdown and hits stop landing while down',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0,200)])});closeIn(f);run(f,90);
  eq(f.log.filter(e=>e.type==='hit').length,5);eq(f.p2.hp,667);eq(f.p2.state,'KNOCKDOWN');
  run(f,20);eq(f.log.filter(e=>e.type==='hit').length,5)});
Test.add('power accrues for both sides and caps',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0,200)])});closeIn(f);run(f,90);
  eq(f.p1.power,7+7+7+8+10);eq(f.p2.power,4+4+4+4+5);f.p1.power=299;f.p1.hits=new Set();f.p1.power=Math.min(POWER_MAX,f.p1.power+50);eq(f.p1.power,300)});
Test.add('S3 is unblockable, costs three bars, knocks down on last hit',()=>{
  const f=mkFight({ctrl1:Ctrl.script([{f:0,intent:{special:3}}]),ctrl2:Ctrl.hold({block:true})});closeIn(f);f.p1.power=300;run(f,90);
  eq(f.p1.power,0);eq(f.log.filter(e=>e.type==='hit').length,4);eq(f.p2.hp,1000-4*180);eq(f.p2.state,'KNOCKDOWN')});
Test.add('class advantage adds 15%',()=>{
  const f=mkFight({p1:CHAMPS.donut,p2:CHAMPS.carl,ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.p2.hp,1000-Math.round(70*1.15))});
Test.add('KO ends the fight with WIN/KO states',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);f.p2.hp=1;run(f,5);
  ok(f.over);eq(f.winner,f.p1);eq(f.p1.state,'WIN');eq(f.p2.state,'KO');eq(f.log[f.log.length-1].type,'ko');run(f,10);eq(f.p1.state,'WIN')});
Test.add('time-up picks the higher health percentage',()=>{
  const f=mkFight({p1:CHAMPS.carl,p2:CHAMPS.donut,clock:.05});f.p1.hp=500;run(f,5);ok(f.over);eq(f.winner,f.p2)});
Test.add('combo resets after the defender is free for 20 frames',()=>{
  const f=mkFight({ctrl1:Ctrl.script([L(0)])});closeIn(f);run(f,5);eq(f.p1.combo,1);run(f,60);eq(f.p1.combo,0)});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: 12 new failures, `Fight is not defined`.

- [ ] **Step 3: Write Fight**

`src/60_fight.js`:
```js
class Fight{
  constructor(o){this.rng=RNG(o.seed||1);this.p1=new Fighter(o.p1,1,o.ctrl1);this.p2=new Fighter(o.p2,-1,o.ctrl2);
    this.frame=0;this.clock=o.clock===undefined?120:o.clock;this.hitstop=0;this.over=false;this.winner=null;this.log=[];this.onEvent=o.onEvent||(()=>{})}
  step(){if(this.over)return;if(this.hitstop>0){this.hitstop--;return}
    this.frame++;this.clock-=STEP;
    const i1=this.p1.ctrl.next(this,this.p1,this.p2),i2=this.p2.ctrl.next(this,this.p2,this.p1);
    this.p1.act(i1);this.p2.act(i2);this.p1.tick();this.p2.tick();this.separate();
    this.resolve(this.p1,this.p2);this.resolve(this.p2,this.p1);
    if(this.p2.state==='IDLE'&&this.p2.f>20)this.p1.combo=0;if(this.p1.state==='IDLE'&&this.p1.f>20)this.p2.combo=0;
    if(this.p1.hp<=0||this.p2.hp<=0||this.clock<=0)this.finish()}
  separate(){const a=this.p1,b=this.p2,min=a.width/2+b.width/2+4,d=b.x-a.x;if(d<min){const p=(min-d)/2;a.x-=p;b.x+=p}}
  resolve(att,def){const hb=att.hitbox();if(!hb)return;const idx=att.hitIndex();if(idx<0||att.hits.has(idx))return;
    const hu=def.hurtbox();if(hb.x1<hu.x0||hb.x0>hu.x1)return;att.hits.add(idx);const m=att.move,last=idx===(m.hits||1)-1;
    if(def.inv>0||def.state==='KNOCKDOWN'||def.state==='KO'||def.state==='WIN')return this.emit('miss',att,def,0);
    const blocking=def.state==='BLOCK'||def.state==='BLOCKSTUN';
    if(blocking&&!m.unblockable){
      if(def.blockAge<=PARRY_WINDOW&&!m.cost){att.move=null;att.moveName=null;att.stun=PARRY_STUN;att.setState('STUNNED');att.combo=0;def.setState('IDLE');Audio.parry();return this.emit('parry',def,att,0)}
      const chip=Math.round(att.def.atk*m.dmg*CHIP);def.hp=Math.max(0,def.hp-chip);def.stun=m.blockstun;def.setState('BLOCKSTUN');
      def.power=Math.min(POWER_MAX,def.power+m.powTaken);att.landed=true;att.combo=0;def.x+=att.face*m.push*.5;Audio.block();return this.emit('block',att,def,chip)}
    const cls=CLASS_BEATS[att.def.cls]===def.def.cls?CLASS_BONUS:1;
    const dmg=Math.round(att.def.atk*m.dmg*cls*(1-def.def.armor));
    def.hp=Math.max(0,def.hp-dmg);att.landed=true;att.combo++;def.combo=0;
    att.power=Math.min(POWER_MAX,att.power+m.powHit);def.power=Math.min(POWER_MAX,def.power+m.powTaken);
    def.move=null;def.moveName=null;if(m.knockdown&&last)def.setState('KNOCKDOWN');else{def.stun=m.hitstun;def.setState('HITSTUN')}
    if(!m.hits||last)def.x+=att.face*m.push;this.hitstop=HITSTOP;Audio.hit();this.emit('hit',att,def,dmg)}
  finish(){this.over=true;const a=this.p1,b=this.p2;
    this.winner=a.hp<=0?b:b.hp<=0?a:(a.hp/a.maxHp>=b.hp/b.maxHp?a:b);
    a.setState(a===this.winner?'WIN':'KO');b.setState(b===this.winner?'WIN':'KO');Audio.ko();this.emit('ko',this.winner,null,0)}
  emit(type,a,b,val){this.log.push({f:this.frame,type,who:a?a.side:0,val});this.onEvent(type,a,b,val)}}
```

- [ ] **Step 4: Run to verify they pass**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: `pass: 21, fail: 0`. If the five-hit test fails on `hp`, print `f.log` via `--eval` to see which hit whiffed; the fix is the `dash` value on the light that whiffed, not the test.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Fight resolution with block, parry, evade, knockdown, power, KO, timer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 1.4: AI controller

**Files:**
- Create: `src/55_ai.js`
- Modify: `src/90_tests.js` (append)

**Interfaces:**
- Consumes: `Ctrl.EMPTY`, `RNG`, `PARRY_WINDOW`, `Fighter.busy()`.
- Produces: `AI.profiles.{dummy,basic,brawl}` and `AI.make(profile, seed) -> ctrl`. Profile fields: `react` (frames of block hold after reacting), `attack` (per-frame attack chance when free), `block` (chance to react to a visible startup), `parry` (of those reactions, chance to time it), `dash` (per-frame dash-back chance at close range), `special` (chance per second to fire an available special).

- [ ] **Step 1: Write the failing tests**

Append to `src/90_tests.js`:
```js
Test.add('dummy AI never attacks',()=>{const f=mkFight({ctrl2:AI.make('dummy',3)});run(f,600);eq(f.log.filter(e=>e.type==='hit'&&e.who===-1).length,0)});
Test.add('basic AI lands hits on an idle target within 10 seconds',()=>{const f=mkFight({ctrl2:AI.make('basic',3)});run(f,600);ok(f.log.some(e=>e.type==='hit'&&e.who===-1))});
Test.add('AI vs random bot is deterministic',()=>{
  const a=mkFight({ctrl1:Ctrl.random(3),ctrl2:AI.make('basic',9)}),b=mkFight({ctrl1:Ctrl.random(3),ctrl2:AI.make('basic',9)});run(a,900);run(b,900);
  eq(a.p1.hp,b.p1.hp);eq(a.p2.hp,b.p2.hp);eq(a.log.length,b.log.length)});
Test.add('brawl AI blocks a medium at least once in 20 seconds',()=>{
  const f=mkFight({ctrl1:Ctrl.script(Array.from({length:40},(_,i)=>({f:i*30,intent:{medium:true}}))),ctrl2:AI.make('brawl',11)});run(f,1200);
  ok(f.log.some(e=>e.type==='block'||e.type==='parry'))});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: 4 new failures, `AI is not defined`.

- [ ] **Step 3: Write AI**

`src/55_ai.js`:
```js
const AI={profiles:{
    dummy:{react:0, attack:0,  block:0,  parry:0, dash:0,  special:0},
    basic:{react:14,attack:.04,block:.5, parry:.1,dash:.02,special:.6},
    brawl:{react:8, attack:.09,block:.65,parry:.3,dash:.04,special:.9}},
  make(profile,seed){const p=AI.profiles[profile]||AI.profiles.basic,r=RNG(seed);let hold=0,cd=0,plan=null;
    return{next(fight,me,foe){const it=Ctrl.EMPTY();if(me.busy())return it;
      const dist=Math.abs(foe.x-me.x)-me.width;
      if(hold>0){hold--;it.block=true;return it}
      if(cd>0)cd--;
      // A timed parry: wait until the foe's hit is 2 frames out, then press block.
      if(plan==='parry'){if(foe.state!=='ATTACK'){plan=null}else if(foe.f>=foe.move.startup-2){plan=null;hold=8+r.int(8);it.block=true;return it}else return it}
      // React to a visible startup (only moves slow enough that an immediate hold is a block, not an accidental parry).
      if(foe.state==='ATTACK'&&foe.f===1&&foe.move.startup>PARRY_WINDOW+2&&r.next()<p.block){
        if(r.next()<p.parry){plan='parry';return it}hold=p.react+r.int(10);it.block=true;return it}
      if(cd===0&&me.power>=100&&r.next()<p.special*STEP){it.special=me.power>=300?3:me.power>=200?2:1;cd=20;return it}
      if(cd===0&&r.next()<p.attack){if(dist<90)it.light=true;else it.medium=true;cd=p.react;return it}
      if(dist<90&&r.next()<p.dash){it.dashBack=true;return it}
      return it}}}};
```

- [ ] **Step 4: Run to verify they pass**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: `pass: 25, fail: 0`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: seeded AI controller with dummy/basic/brawl profiles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 1.5: Renderer (placeholder fighters, bars, timer, combo)

**Files:**
- Create: `src/70_render.js`

**Interfaces:**
- Consumes: `Fight`, `Fighter.hitbox()`, `W H FLOOR`, `canvas`, `G.debug`.
- Produces: `Render.frame(fight|null)`. Never mutates fight state. Phase 2 replaces `Render.fighter` with sprite frames; the `hud` and `frame` signatures stay.

- [ ] **Step 1: Write the renderer**

`src/70_render.js`:
```js
const Render={ctx:canvas.getContext('2d'),
  fighter(c,F){const w=F.width,down=F.state==='KNOCKDOWN'||F.state==='KO',h=down?30:(F.state==='BLOCK'||F.state==='BLOCKSTUN')?110:120,x=F.x-w/2,y=FLOOR-h;
    c.fillStyle=(F.state==='HITSTUN'||F.state==='STUNNED')?'#fff':F.def.color;c.fillRect(x,y,w,h);
    c.fillStyle='#000';c.fillRect(F.x+F.face*10-3,y+18,6,6);
    const hb=F.hitbox();if(hb){c.fillStyle=F.move.cost?'#7ff':'#f66';c.fillRect(hb.x0,FLOOR-90,hb.x1-hb.x0,14)}
    if(F.state==='CHARGE'){c.fillStyle='#fa4';c.fillRect(x,y-10,w*Math.min(1,F.f/F.move.charge),6)}
    if(F.state==='BLOCK'||F.state==='BLOCKSTUN'){c.fillStyle='#8cf';c.fillRect(F.front-(F.face===1?0:4),y,4,h)}
    if(F.inv>0){c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(x-2,y-2,w+4,h+4)}
    if(G.debug){c.strokeStyle='#0f0';c.strokeRect(x,y,w,h)}},
  bar(c,x,y,w,h,pct,col,right){c.fillStyle='#222';c.fillRect(x,y,w,h);c.fillStyle=col;const fw=w*clamp(pct,0,1);c.fillRect(right?x+w-fw:x,y,fw,h)},
  hud(c,f){const a=f.p1,b=f.p2;this.bar(c,20,16,340,18,a.hp/a.maxHp,'#4d4',false);this.bar(c,W-360,16,340,18,b.hp/b.maxHp,'#4d4',true);
    for(let i=0;i<3;i++){this.bar(c,20+i*116,40,108,8,clamp(a.power-100*i,0,100)/100,'#fc3',false);this.bar(c,W-360+i*116,40,108,8,clamp(b.power-100*i,0,100)/100,'#fc3',true)}
    c.fillStyle='#fff';c.font='bold 22px ui-monospace,monospace';c.textAlign='center';c.fillText(String(Math.ceil(Math.max(0,f.clock))),W/2,34);
    c.font='11px ui-monospace,monospace';c.textAlign='left';c.fillText(a.def.name,20,62);c.textAlign='right';c.fillText(b.def.name,W-20,62);
    c.font='bold 20px ui-monospace,monospace';if(a.combo>1){c.textAlign='left';c.fillStyle='#f4c542';c.fillText(a.combo+' HITS',20,110)}
    if(b.combo>1){c.textAlign='right';c.fillStyle='#f66';c.fillText(b.combo+' HITS',W-20,110)}
    if(f.over){c.textAlign='center';c.fillStyle='#fff';c.font='bold 40px ui-monospace,monospace';c.fillText('K.O.',W/2,H/2)}},
  frame(f){const c=this.ctx;c.clearRect(0,0,W,H);c.fillStyle='#1a1f33';c.fillRect(0,0,W,FLOOR);c.fillStyle='#2b2f45';c.fillRect(0,FLOOR,W,H-FLOOR);
    c.fillStyle='#3a2a1a';c.fillRect(W/2-40,FLOOR-200,80,200);c.fillStyle='#090b12';c.fillRect(W/2-30,FLOOR-190,60,190); // the doorway
    if(!f)return;this.fighter(c,f.p1);this.fighter(c,f.p2);this.hud(c,f)}};
```

- [ ] **Step 2: Build and confirm no errors (rendering is verified visually in Task 1.7)**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: `pass: 25, fail: 0`, no page errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: placeholder renderer with health/power bars, timer, combo counter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 1.6: Human input (touch zones, swipes, hold-to-heavy, keyboard)

**Files:**
- Modify: `src/30_input.js` (prepend `Input`, add `Ctrl.player`)
- Modify: `src/90_tests.js` (append)

**Interfaces:**
- Consumes: `Audio.init`, `G.state`, `G.startFight`, `G.togglePause` (defined in Task 1.7; only referenced inside handlers).
- Produces: `Input.init(canvas)`, `Input.tick()` (touch hold detection, wall clock), `Input.drain() -> intent`, `Input.q` (action strings), `Input.held.{block,heavy}`, `Ctrl.player()`. Keyboard: J light, K medium, L (hold) heavy, A dash back, S (hold) block, 1/2/3 specials, P pause, Space starts from TITLE.

- [ ] **Step 1: Write the failing test (drain semantics, no DOM events needed)**

Append to `src/90_tests.js`:
```js
Test.add('Input.drain folds the action queue into one intent and clears it',()=>{
  Input.q.push('light','special2','dashBack');Input.held.block=true;const it=Input.drain();
  eq(it.light,true);eq(it.special,2);eq(it.dashBack,true);eq(it.block,true);eq(Input.q.length,0);Input.held.block=false;
  const it2=Input.drain();eq(it2.light,false);eq(it2.special,0);eq(it2.block,false)});
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: 1 new failure, `Input is not defined`.

- [ ] **Step 3: Prepend Input and add Ctrl.player**

At the top of `src/30_input.js`, before `const Ctrl=`:
```js
// Touch layout (landscape): left third = defense (hold: block, swipe left: dash back);
// right two thirds = offense (tap: light, swipe right: medium, hold >=180ms: heavy until released).
const Input={q:[],held:{block:false,heavy:false},_ptr:null,DEF_ZONE:W/3,SWIPE:40,HOLD_MS:180,
  init(canvas){
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
    canvas.addEventListener('pointerdown',e=>{Audio.init();if(G.state==='TITLE')return G.startFight();if(G.state!=='FIGHT')return;
      const p=pos(e);this._ptr={id:e.pointerId,x0:p.x,t0:performance.now(),zone:p.x<this.DEF_ZONE?'def':'off',moved:false,holdFired:false};
      if(this._ptr.zone==='def')this.held.block=true});
    canvas.addEventListener('pointermove',e=>{const P=this._ptr;if(!P||e.pointerId!==P.id||P.moved)return;const dx=pos(e).x-P.x0;
      if(Math.abs(dx)>=this.SWIPE){P.moved=true;this.held.block=false;this.held.heavy=false;this.q.push(dx>0?'medium':'dashBack')}});
    const up=e=>{const P=this._ptr;if(!P||e.pointerId!==P.id)return;this._ptr=null;this.held.block=false;
      if(!P.moved&&P.zone==='off'&&!P.holdFired)this.q.push('light');this.held.heavy=false};
    canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    for(const n of[1,2,3])document.getElementById('s'+n).addEventListener('pointerdown',e=>{e.stopPropagation();Audio.init();this.q.push('special'+n)});
    addEventListener('keydown',e=>{if(e.repeat)return;const k=e.key.toLowerCase();
      if(e.code==='Space'&&G.state==='TITLE'){e.preventDefault();return G.startFight()}
      if(k==='p')return G.togglePause();
      if(k==='j')this.q.push('light');if(k==='k')this.q.push('medium');if(k==='a')this.q.push('dashBack');
      if(k==='l')this.held.heavy=true;if(k==='s')this.held.block=true;if(k==='1'||k==='2'||k==='3')this.q.push('special'+k)});
    addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='s')this.held.block=false;if(k==='l')this.held.heavy=false})},
  // Called once per sim frame by Ctrl.player: promotes a long press in the offense zone to a heavy hold.
  tick(){const P=this._ptr;if(P&&!P.moved&&P.zone==='off'&&!P.holdFired&&performance.now()-P.t0>=this.HOLD_MS){P.holdFired=true;this.held.heavy=true}},
  drain(){const it={light:false,medium:false,heavy:this.held.heavy,block:this.held.block,dashBack:false,special:0};
    for(const a of this.q){if(a.startsWith('special'))it.special=+a[7];else it[a]=true}this.q.length=0;return it}};
```
And add to `Ctrl` (after `idle`):
```js
  player:()=>({next(){Input.tick();return Input.drain()}}),
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 tools/build.py && python3 tests/harness.py --unit`
Expected: `pass: 26, fail: 0`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: touch zones, swipes, hold-to-heavy and keyboard input

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 1.7: Game states, fixed-step loop, sim hooks, DOM wiring

**Files:**
- Modify: `src/80_game.js` (replace the Phase 0 version entirely)

**Interfaces:**
- Consumes: everything above.
- Produces: `G.startFight({seed,p1,p2,ai,ctrl1,ctrl2,clock})`, `G.stepFrame()`, `G.simFrames(n)`, `G.sim` (true disables wall-clock stepping), `G.togglePause()`, `G.state in TITLE|FIGHT|PAUSED|RESULT`, `G.fight`. Result overlay text comes from the `'ko'` event.

- [ ] **Step 1: Replace the game object**

`src/80_game.js`:
```js
const G={state:'TITLE',fight:null,acc:0,last:0,sim:false,debug:false,seed:1,
  fit(){const s=Math.min(innerWidth/W,innerHeight/H);canvas.style.width=Math.floor(W*s)+'px';canvas.style.height=Math.floor(H*s)+'px'},
  show(id,on){document.getElementById(id).classList.toggle('show',on)},
  startFight(o={}){const seed=o.seed||this.seed;
    this.fight=new Fight({seed,p1:CHAMPS[o.p1||'carl'],p2:CHAMPS[o.p2||'donut'],clock:o.clock,
      ctrl1:o.ctrl1||Ctrl.player(),ctrl2:o.ctrl2||AI.make(o.ai||'basic',seed^0xa5a5),onEvent:(t,a,b,v)=>this.onEvent(t,a,b,v)});
    Input.q.length=0;Input.held.block=false;Input.held.heavy=false;
    this.state='FIGHT';this.show('title',false);this.show('result',false);this.show('pauseMenu',false);this.show('specials',true);Audio.say('FIGHT!')},
  onEvent(t,a){if(t==='parry')Audio.say('PARRY!');if(t!=='ko')return;
    this.state='RESULT';document.getElementById('resultTitle').textContent=a.side===1?'VICTORY':'DEFEATED';
    document.getElementById('resultLine').textContent=a.def.name+' wins with '+Math.round(100*a.hp/a.maxHp)+'% health.';
    this.show('result',true);this.show('specials',false)},
  togglePause(){if(this.state==='FIGHT'){this.state='PAUSED';this.show('pauseMenu',true)}else if(this.state==='PAUSED'){this.state='FIGHT';this.show('pauseMenu',false);this.acc=0}},
  toTitle(){this.state='TITLE';this.fight=null;this.show('pauseMenu',false);this.show('result',false);this.show('specials',false);this.show('title',true)},
  stepFrame(){if(this.state!=='FIGHT')return;this.fight.step();this.syncSpecials()},
  simFrames(n){for(let i=0;i<n;i++)this.stepFrame()},
  syncSpecials(){const p=this.fight.p1.power;for(const n of[1,2,3])document.getElementById('s'+n).classList.toggle('ready',p>=100*n)},
  loop(t){if(!this.sim){const dt=Math.min(.1,(t-this.last)/1000||0);this.last=t;this.acc+=dt;while(this.acc>=STEP){this.stepFrame();this.acc-=STEP}}
    Render.frame(this.fight);requestAnimationFrame(t=>this.loop(t))},
  init(){this.fit();addEventListener('resize',()=>this.fit());Input.init(canvas);
    document.getElementById('fightBtn').onclick=()=>{Audio.init();this.startFight()};
    document.getElementById('again').onclick=()=>this.startFight({seed:this.fight?this.fight.rng.int(1e9)+1:this.seed});
    document.getElementById('resultTitleBtn').onclick=()=>this.toTitle();
    document.getElementById('resume').onclick=()=>this.togglePause();
    document.getElementById('quit').onclick=()=>this.toTitle();
    document.getElementById('titleMute').onclick=e=>{Audio.muted=!Audio.muted;Save.data.mute=Audio.muted;Save.put();e.target.textContent='SOUND: '+(Audio.muted?'OFF':'ON')};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='FIGHT')this.togglePause()});
    requestAnimationFrame(t=>{this.last=t;this.loop(t)})}};
G.init();
```

- [ ] **Step 2: Build, run unit tests, then soak both ways**

Run:
```bash
python3 tools/build.py && python3 tests/harness.py --unit && \
python3 tests/harness.py --sim --seconds 120 --bot random --ai basic --seed 7 --probe 'G.fight.p1.combo' && \
python3 tests/harness.py --sim --seconds 120 --bot random --ai brawl --seed 8 --p1 donut --p2 carl && \
python3 tests/harness.py --seconds 15 --bot random --shot /tmp/fight.png
```
Expected: all exit 0; the sim runs report `fight.over: true` with a `winner` of 1 or -1 (a random bot versus basic AI should end by KO well inside 120 s), and `/tmp/fight.png` shows two colored fighters, a doorway, two green health bars, three gold power segments each, and a timer.

- [ ] **Step 3: Play it by hand for two minutes**

Run: `open ~/Projects/Carls-Arena/index.html`, then play with the keyboard (J/K/L/A/S/1-3) and, in Chrome device mode set to a landscape phone, with touch. Check each of: tap lights chain to a knockdown, swipe-right medium closes distance, hold on the right charges and fires a heavy, hold on the left blocks and a well-timed press flashes PARRY!, swipe-left dodges through a medium, S1 button lights up at one bar and fires. Note any that fail in the plan's progress log below before moving on.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: game states, fixed-step loop, sim hooks, title/pause/result wiring

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 1.8: Phase 1 soak, GitHub repo, and progress log

**Files:**
- Create: `docs/ARENA.md` (progress log only for now; the rubric table is filled in Phase 5)

- [ ] **Step 1: Four 5-minute soaks**

Run:
```bash
for s in 1 2; do for ai in basic brawl; do python3 tests/harness.py --sim --seconds 300 --bot random --ai $ai --seed $s > /tmp/soak-$ai-$s.json || echo FAIL $ai $s; done; done; grep -l '"errors": \[\]' /tmp/soak-*.json | wc -l
```
Expected: no `FAIL` lines and `4`. Note that a finished fight simply idles in RESULT; the soak still counts because `state` is not TITLE and there are no errors.

- [ ] **Step 2: Start the progress log**

`docs/ARENA.md`:
```markdown
# Carl's Doorway Brawl: rubric and progress log

Rubric table lands in Phase 5 (same format as Carls-Dash docs/PARITY.md: criterion, status, verification command).

## Progress log

- 2026-MM-DD HH:MM — Phase 1 complete. Unit tests: N passing. Soaks: 4 x 300 s (basic/brawl x seeds 1,2) clean. Hand-play notes: <what felt wrong>.
```
Fill in the real date, test count, and hand-play notes.

- [ ] **Step 3: Push to GitHub**

```bash
cd ~/Projects/Carls-Arena && gh repo create Javamomma/Carls-Arena --public --source=. --push
```
Note: the GitHub MCP server failed to connect this session; `gh` on the command line is the path. Enable Pages from the `main` branch root afterwards so the game gets a URL like the Dash one.

- [ ] **Step 4: Commit the log**

```bash
git add -A && git commit -m "docs: ARENA.md progress log, Phase 1 complete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
```

**Phase 1 exit criteria:** 26+ unit tests pass; four 300 s soaks clean; hand-play confirms all six control checks in Task 1.7 Step 3; repo on GitHub.

---

# Phase 2: Feel and champions (write `docs/superpowers/plans/<date>-phase2-feel.md` first)

Interfaces to freeze when writing that plan:

- `Sprite.build(champId) -> {pose: [canvas,...]}` for poses `idle walk dash light1 light2 light3 light4 light5 medium heavyCharge heavy block hit knockdown getup s1 s2 s3 win ko`. `Render.fighter` maps `(state, moveName, f)` to a pose and frame. All drawing via a `px(c, x, y, w, h, color)` helper on offscreen canvases built once per champion.
- `Fight` gains `shake`, `particles[]`, `popups[]` written only in `resolve()`; `Render` consumes them. `HITSTOP` becomes per-move (`m.hitstop`, default 4; heavy 8; s3 14).
- Stats: `def.critMul` (default 1.6), `def.blockProf` (fraction of chip removed). Crit roll uses `fight.rng` so tests stay deterministic; add `Fight` option `noCrit:true` used by the Phase 1 tests.
- Camera: stage width 1400, `Fight.cam` follows the midpoint; `Render` translates. Fighter clamp uses stage width instead of `W`.
- Per-champion movesets: `def.moves` overrides merge over `MOVES` (heavy and specials differ per champion; lights and medium shared).
- Announcer: port `Lines` and the toast `say` from Carls-Dash `index.html` line 37 into `20_audio.js`; trigger on `hit` streaks, `parry`, `ko`, specials.

Tasks: 2.1 camera + stage; 2.2 sprite factory + pose mapping (test: every champ has every pose, screenshots of two poses differ by >2% pixels); 2.3 hit feel (hitstop per move, shake, sparks, damage popups, KO slow-mo); 2.4 sfx recipes per move + announcer port; 2.5 crit/armor/block proficiency (tests with `noCrit` and forced rng); 2.6 combo tuning (medium ender push-out, wall bounce, parry window measured against a human via `--probe 'G.fight.p2.blockAge'` histogram); 2.7 champions Mongo (tank) and Katia (trickster) with unique heavies/specials; 2.8 S3 cinematic (freeze, zoom, name card, unskippable 1.2 s).

Exit: 40+ unit tests; soak matrix 4 champs x 3 AIs x 2 seeds at 300 s clean; a reviewer names every champion and move from a `--shot` screenshot set; token estimate 1.5-2M.

# Phase 3: AI tiers and encounters (plan file first)

Interfaces: `AI.profiles` becomes five tiers `t1..t5` plus named bosses; `Encounter = {enemy, tier, buffs:[], hpMul, atkMul}`; `BUFFS = {regen, armorUp, powerGain, unblockableSpecials, degen, thorns}` as `Fight` hooks (`onFrame`, `onHit`, `onBlock`); `G.startFight({encounter})`. New tool `tests/batch.py --n 50 --p1 carl --bot random --ai t3` prints a win-rate table.

Tasks: 3.1 tiers with intercept (medium into a dash-in) and bait (heavy feint then dash back); 3.2 monotone difficulty test (t5 beats t1's win rate by ≥40 points over 50 sims); 3.3 buffs framework + tests; 3.4 encounters + boss variants; 3.5 champions Mordecai, Imani, Li Jun, Zev; 3.6 batch tool.

Exit: batch table checked in `docs/ARENA.md`; token estimate 1-1.5M.

# Phase 4: Meta (plan file first)

Interfaces: `Save.data` v2 `{roster:{id:{stars,rank,level,xp}}, gold, units, iso, cats:{cls:n}, quests:{act1:{nodes:{id:'locked|open|done'}}}, energy:{n,ts}, arena:{best}}` with a `Save.migrate()`; `Stats.derive(def, stars, rank, level) -> {hp, atk}`; `Crystal.open(kind, rng) -> {champId, stars}` with pity in `Save`; `Quest.map` JSON (3 chapters x 6 nodes, edges, encounter ids, rewards); DOM overlays `roster`, `map`, `crystal`, `shop` following the Carls-Dash `renderShop` pattern.

Tasks: 4.1 save v2 + migration test; 4.2 stat derivation (monotone tests); 4.3 crystals + 10k-draw distribution test + pity test; 4.4 roster screen; 4.5 quest map + energy; 4.6 rewards, XP, rank-up, catalyst shop (reuse SPONSOR PERK KIOSK markup); 4.7 arena streak mode; 4.8 headless script that runs crystal→roster→quest→fight→reward end to end via `--pre`.

Exit: end-to-end headless script exits 0; 10-minute soak through menus and fights clean; token estimate 2-3M.

# Phase 5: Broadcast and release (plan file first)

Tasks: 5.1 viewers score + style multipliers (parry x1.5, 5-hit x2, S3 x3) + peak in result; 5.2 announcer packs per champion; 5.3 sponsor perks (permanent, bought with gold, e.g. +1 parry frame, +5% power gain); 5.4 share card (canvas to PNG, `navigator.share` with clipboard fallback as in Carls-Dash `shareRun`); 5.5 daily arena seed from the date; 5.6 settings (reduce motion, haptics via `navigator.vibrate`, left-handed layout mirror); 5.7 tutorial fight with scripted prompts; 5.8 portrait "rotate your phone" overlay; 5.9 perf pass (sprite cache, ≤4 ms per frame on a mid phone measured with `performance.now()` around `stepFrame`+`Render.frame`); 5.10 fill the ARENA.md rubric (one row per Phase 1-5 exit criterion with a verification command) and turn on GitHub Pages.

Exit: rubric all DONE; Pages URL live; token estimate 1-1.5M.

---

## Self-review notes (done while writing)

- Spec coverage: fight model rows map to Tasks 1.1-1.4; touch layout to 1.6; class triangle to 1.1/1.3; roster and meta to Phases 2-4; broadcast to Phase 5; non-goals have no tasks.
- Type consistency checked: `intent` fields (`light medium heavy block dashBack special`) are identical in `Ctrl.EMPTY`, `Input.drain`, `Fighter.act`, and the AI; `Fight` event names (`hit block parry miss ko`) match between `resolve/finish`, tests, and `G.onEvent`; `DASH_BACK`/`KNOCKDOWN` constants are used by `Fighter.tick` and the tests.
- Known tuning risk called out rather than hidden: the five-hit chain test depends on the `dash` values keeping the defender in range after each push; if it fails, adjust `dash`, not the assertion. The AI cannot react to lights (startup 5 is inside the parry window plus two frames), which is intended for Phase 1 and revisited in 2.6.
- Frame-count expectations in the Task 1.3 tests assume the fight hasn't hit hitstop before the asserted frame; each test was traced by hand against `step()` ordering (act, tick, separate, resolve).
- **Validated 2026-09-21:** every Phase 0/1 code block in this file was extracted verbatim into a scratch directory, built with `tools/build.py`, and run. Result: 26/26 unit tests pass, four 300 s sim soaks (basic/brawl x seeds 1,2) exit clean, and a wall-clock screenshot shows both fighters, bars, timer, and special buttons. Two fixes were folded back in during that run: multi-hit specials now push the defender only on their last hit (otherwise S3's fourth hit whiffed off the wall), and the S3 test runs 90 frames because three hitstops delay the fourth hit past frame 70. Executors should expect the step-by-step counts in this file (2, 9, 21, 25, 26 passing) to match exactly.

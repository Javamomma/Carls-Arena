#!/usr/bin/env python3
"""Headless harness for Carl's Doorway Brawl (Python Playwright, no npm).

  python3 tests/harness.py --unit                                   # in-page unit tests; exit 1 on any failure
  python3 tests/harness.py --sim --seconds 60 --bot random --ai basic --seed 7
  python3 tests/harness.py --seconds 20 --shot /tmp/fight.png --eval 'G.fight.p1.hp'
  python3 tests/harness.py --sim --seconds 30 --probe 'G.fight.p1.combo'
  python3 tests/harness.py --matrix                                  # AI/content soak matrix; exit 1 on any error
  python3 tests/harness.py --perf 600                                # ms/frame gate; exit 1 if >= 6
      # prints {ms_per_frame, ms_step, ms_render, perf:{ms_per_frame, ms_step, ms_render}} -- the
      # same three numbers both flat (unchanged, for any old reader) and nested under a top-level
      # `perf` key (Task 4.6: the controller's gate read d.get('perf'), which was None before this).
  python3 tests/harness.py --e2e --seed 1                            # Task 4.6: full crystals->roster->
      # quest->rewards->level-up->arena loop, headless; exit 1 on any assertion/page/console error
  python3 tests/harness.py --e2e --seed 1 --loops 20                 # --e2e plus a menu+fight soak:
      # N extra cycles of Screens renders + one quest-node fight + one arena fight
  python3 tests/harness.py --screen settings --shot /tmp/settings.png  # Task 5.4: screenshot a Screens.<name>()
  python3 tests/harness.py --share --shot /tmp/share.png             # Task 5.4: G.shareCard() PNG data-URL
      # check (prefix + IHDR-decoded 854x480 dims); --shot writes the decoded PNG bytes to disk
  python3 tests/harness.py --tutorial --seed 1                       # Task 5.3: resets the save, plays
      # ENCOUNTERS.tutorial headless via a scripted Ctrl.tutorialBot (lights, a medium, a timed parry
      # against the dummy's own scripted medium, a special, then lights to the KO); asserts the four
      # Tutorial.steps advance in order, Save.data.tutorialDone is set, and exactly +300 gold is
      # granted; prints a JSON summary and exits 1 on any assertion/page/console error
  python3 tests/harness.py --tutorial --shot docs/shots/p5-tutorial-1.png  # same run, plus an early
      # (step 1, before any light lands) screenshot of a live fight frame with #tutorialPrompt visible
  python3 tests/harness.py --screens-smoke                           # Task 5.6: visits every screen
      # (title/map/roster/crystal/shop/arena/settings) plus one real quest fight through to a natural
      # KO/Screens.result; prints {screens:[{screen,errors}]} and exits 1 if any screen recorded a
      # page/console error
  python3 tests/harness.py --phone-check                             # Task 5.6 / fix-wave item 8:
      # 844x390 CSS-px landscape viewport; asserts the canvas stays letterboxed at 854:480, every
      # in-fight button is a real >=44px touch target fully inside the viewport, the page never scrolls
      # horizontally, AND (fix-wave item 8) every visible <button> on title/map/roster/crystal/shop/
      # arena/settings is also a real >=44px target fully inside the viewport (one legitimately scrolled
      # out of a .path/.setrows/#shopBody internal scroll region is skipped, not failed)

Exit 1 on any page error, console error, or if the game never left TITLE.
"""
import argparse, base64, json, os, struct, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = 'file://' + os.path.join(ROOT, 'index.html')

def build_soak_js(seed, p1n, p2n, ain, ctrl_expr, ticks, enc='', probes=(), pre=''):
    """The one restart-on-KO soak loop, shared by run_matrix_cell and the plain `--sim` path: a
    single in-page evaluate() that starts a fight, steps it G.tick() at a time for `ticks` sim
    frames, and restarts on KO (a fresh seed each time) the instant G.state hits RESULT so a KO
    is caught the very next tick, not at the next batch/probe boundary. `ctrl_expr` is a raw JS
    expression for p1's controller (it's built inside `start=seed=>...`, so it may reference that
    closure's `seed` param to get a fresh Ctrl.random() draw per restart). `probes` are raw JS
    expressions sampled once every 60 ticks (one simulated second) into a returned {expr: [...]}
    map, matching the old per-second Python-side sampling cadence. `pre` is raw JS spliced in once,
    before the loop starts (Task 4.4: `--floor`/`--node` soak runs pass `G.debugEnergy(999)` here so
    a quest fight's real Quest.start energy spend, taken once per restart, can't refuse mid-soak).

    Also returns `koTicks`: the number of G.tick() calls spent with G.fight.over already true (the
    KO slow-mo grace period G.tick keeps counting down every 4th tick before flipping to RESULT).
    Those ticks legitimately consume the wall-clock `ticks` budget without advancing G.fight.frame,
    so the caller's stall/short-soak floor checks `framesTotal+koTicks`, not `framesTotal` alone,
    against the requested budget.
    """
    probe_init = ','.join('%s:[]' % json.dumps(e) for e in probes)
    probe_push = ''.join('probes[%s].push(%s);' % (json.dumps(e), e) for e in probes)
    return ("(()=>{G.sim=true;%s let s=%d,fights=1,framesTotal=0,p1wins=0,ticks=%d,koTicks=0;"
            "const probes={%s};"
            "const start=seed=>G.startFight({seed,p1:'%s',p2:'%s',ai:'%s',ctrl1:%s%s});"
            "start(s);"
            "for(let i=0;i<ticks;i++){G.tick();"
            "if(G.fight&&G.fight.over)koTicks++;"
            "if((i+1)%%60===0){%s}"
            "if(G.state==='RESULT'){framesTotal+=G.fight.frame;"
            "if(G.fight.winner&&G.fight.winner.side===1)p1wins++;"
            "s++;fights++;start(s)}}"
            "framesTotal+=G.fight.frame;"
            "return{fights,framesTotal,p1wins,probes,koTicks}})()"
            ) % (pre, seed, ticks, probe_init, p1n, p2n, ain, ctrl_expr, enc, probe_push)

def build_e2e_js(seed, loops):
    """Task 4.6: the whole crystals -> roster -> quest -> rewards -> level-up -> arena loop, run as
    one in-page evaluate() (same one-round-trip shape as build_soak_js/build_batch_js above) instead
    of a Python-side loop making a page round trip per fight. Grants gold via the new G.debugGrant
    debug hook, opens 2 basic Crystal.open() pulls, sets carl active, then clears every node on
    floor 1 (index 0..len-1) followed by the boss through the real {floor,node} G.startFight sugar
    with Ctrl.competent -- up to 5 attempts per node (energy refilled via G.debugEnergy(999) before
    each attempt so a loss doesn't starve the retry), asserting on every WIN that: the gold/iso/xp
    deltas exactly match an independently-computed Rewards.forNode(floor,node) (xp is tracked via a
    cumulative-xp helper so a mid-run level-up, which moves value from entry.xp into consumed levels
    without discarding any of it, doesn't look like a shortfall), energy actually decreased, and the
    node/next-node state flips to done/open. Losing all 5 attempts at a node (recorded as
    {attempts:5, won:false}, not itself an error -- see the docstring's --e2e entry and
    docs/ARENA.md's Phase 4 exit notes for why: the floor 1 boss's own measured win rate against
    Ctrl.competent is ~13-17% at n=30, so a single seed's 5 retries are not guaranteed to land one)
    simply leaves that node (and anything chained after it) not attempted further in the main pass.
    One Roster.levelUp() on the active champion, then 3 G.startArena() fights (win/loss both fine;
    only the aggregate streak/best/gold are asserted monotone-non-decreasing plus "a win banks
    gold"). `loops` (0 for a plain --e2e) repeats an extra Screens-render + one real quest-node fight
    (always at whatever node Quest.floor reports 'open' right now, via the nextOpen() scan below, so
    a loop never re-targets an already-'done' node, which {floor,node} sugar would just refuse) + one
    arena fight, for a sustained menu+fight soak. Returns
    {seed, crystals:[{champId,stars,dup,shards?},...], nodes:[{id,attempts,won},...], roster:{...},
    arena:{before,wins,streak,best,goldDelta}, energy, currencies:{gold,iso,units}, errors:[...]}.
    """
    return r"""(()=>{
G.sim=true;
const summary={seed:%d,crystals:[],nodes:[],roster:{},arena:{},errors:[]};
const push=m=>summary.errors.push(m);
const cumXp=e=>{let s=e.xp;for(let l=2;l<=e.level;l++)s+=Stats.xpToLevel(l);return s};
const runTo=cap=>{let t=0;while(G.state==='FIGHT'&&t<cap){G.tick();t++}return t};
const nextOpen=()=>{
  for(const fn in Save.data.floors){
    const n=+fn,f=Quest.floor(n);if(!f)continue;
    for(let i=0;i<f.nodes.length;i++)if(f.nodes[i].state==='open')return{floor:n,node:i};
    if(f.boss.state==='open')return{floor:n,node:'boss'}}
  return null};
try{
  Save.data.seed=%d;Save.put();
  G.debugGrant({gold:1200});
  for(let i=0;i<2;i++)summary.crystals.push(Crystal.open('basic'));
  Roster.setActive('carl');
  // Fix-wave item 7: the old runNode called G.debugEnergy(999) on every single attempt, then compared
  // energyBefore (998) against energy after (997 or whatever) -- always true, so the "energy did not
  // decrease" assertion could never fail even against fix-wave item 1's bug (energy never regenerating)
  // or against the whole energy system being deleted. `noTopUp` skips the top-up on ONLY the very
  // first attempt of ONE node (floor 1's node 0, called right after a fresh reset -- Save.data.energy
  // is genuinely untouched, full at 10, so no top-up is needed for the fight to be attemptable), and
  // asserts the real, un-inflated delta: exactly -1 (Quest.start spends exactly 1 energy per attempt,
  // win or lose), then, with Energy.now() pushed 5 simulated minutes forward, that it's STILL not
  // regenerated (5 min < the 6-minute regen interval). Every other attempt/node/the boss keeps the
  // topped-up retry behavior unchanged.
  const runNode=(floor,node,opts)=>{
    opts=opts||{};
    let attempts=0,won=false;
    while(attempts<5&&!won){
      attempts++;
      const skipTopUp=!!(opts.noTopUp&&attempts===1);
      if(!skipTopUp)G.debugEnergy(999);
      const energyBefore=Save.data.energy.n;
      const goldBefore=Save.data.gold||0,isoBefore=Save.data.iso||0;
      const active=Save.data.active,entryBefore=Save.data.roster[active];
      const xpBefore=cumXp(entryBefore);
      const fseed=%d*100+floor*20+(node==='boss'?19:node)*5+attempts;
      const ok=G.startFight({seed:fseed,floor,node,ctrl1:Ctrl.competent(fseed)});
      if(ok===false){push('quest refused floor '+floor+' node '+node+' attempt '+attempts);break}
      if(skipTopUp){
        // Quest.start already spent the energy by the time startFight returns, regardless of the
        // fight's eventual outcome, so this checks right away rather than gating on `won`.
        if(Save.data.energy.n!==energyBefore-1)
          push('un-topped-up energy delta at '+floor+'/'+node+' expected exactly -1, got '+(Save.data.energy.n-energyBefore));
        const origNow=Energy.now;
        try{
          const n0=Save.data.energy.n;
          let t=Energy.now()+5*60*1000; // +5 simulated minutes: under the 6-minute regen interval
          Energy.now=()=>t;
          Energy.tick();
          if(Save.data.energy.n!==n0)
            push('energy regenerated within 5 minutes at '+floor+'/'+node+' ('+n0+' -> '+Save.data.energy.n+')')
        }finally{Energy.now=origNow}}
      runTo(9000);
      won=!!(G.fight.winner&&G.fight.winner.side===1);
      if(won){
        const exp=Rewards.forNode(floor,node);
        const goldDelta=(Save.data.gold||0)-goldBefore,isoDelta=(Save.data.iso||0)-isoBefore;
        const entryAfter=Save.data.roster[active];
        const xpDelta=cumXp(entryAfter)-xpBefore;
        if(goldDelta!==exp.gold)push('gold delta '+goldDelta+' != '+exp.gold+' at '+floor+'/'+node);
        if(isoDelta!==exp.iso)push('iso delta '+isoDelta+' != '+exp.iso+' at '+floor+'/'+node);
        if(xpDelta!==exp.xp)push('xp delta '+xpDelta+' != '+exp.xp+' at '+floor+'/'+node);
        if(!(Save.data.energy.n<energyBefore))push('energy did not decrease at '+floor+'/'+node);
        const f=Quest.floor(floor),st=node==='boss'?f.boss.state:f.nodes[node].state;
        if(st!=='done')push('node not done after win: '+floor+'/'+node+' -> '+st);
        if(node!=='boss'){
          const nxt=node+1<f.nodes.length?f.nodes[node+1].state:f.boss.state;
          if(nxt==='locked')push('next not open after '+floor+'/'+node)}}}
    summary.nodes.push({id:floor+'/'+node,attempts,won});
    return won};
  const fl=FLOORS[0];
  for(let i=0;i<fl.nodes.length;i++)runNode(1,i,i===0?{noTopUp:true}:null);
  runNode(1,'boss');
  const activeId=Save.data.active;
  if(!Roster.levelUp(activeId))push('Roster.levelUp refused');
  const arenaBefore={streak:Save.data.arena.streak,best:Save.data.arena.best,gold:Save.data.gold||0};
  let arenaWins=0;
  for(let i=0;i<3;i++){
    const fseed=%d*13+i;
    G.startArena({seed:fseed,ctrl1:Ctrl.competent(fseed)});
    runTo(9000);
    if(G.fight.winner&&G.fight.winner.side===1)arenaWins++}
  summary.arena={before:arenaBefore,wins:arenaWins,
    streak:Save.data.arena.streak,best:Save.data.arena.best,goldDelta:(Save.data.gold||0)-arenaBefore.gold};
  if(summary.arena.best<arenaBefore.best)push('arena best decreased');
  if(arenaWins>0&&summary.arena.goldDelta<=0)push('arena gold did not increase despite a win');
  const loops=%d;
  for(let L=0;L<loops;L++){
    Screens.title();Screens.map(1);Screens.roster();Screens.arena();Screens.title();
    const t=nextOpen();
    if(t){
      G.debugEnergy(999);
      const fseed=%d*1000+9000+L;
      const ok=G.startFight({seed:fseed,floor:t.floor,node:t.node,ctrl1:Ctrl.competent(fseed)});
      if(ok===false)push('loop '+L+' quest refused at '+t.floor+'/'+t.node);
      else runTo(9000)}
    const afseed=%d*1000+9500+L;
    G.startArena({seed:afseed,ctrl1:Ctrl.competent(afseed)});
    runTo(9000)}
  // The 3-arena-fight assertions above (wins/goldDelta) are measured over that fixed window; a
  // --loops soak runs more arena fights afterward, so streak/best are refreshed here to the final
  // post-loop values instead of quietly going stale in the printed summary.
  summary.arena.streak=Save.data.arena.streak;summary.arena.best=Save.data.arena.best;
  summary.roster=JSON.parse(JSON.stringify(Save.data.roster));
  summary.energy=Save.data.energy.n;
  summary.currencies={gold:Save.data.gold,iso:Save.data.iso,units:Save.data.units};
}catch(e){push(String(e&&e.stack||e))}
return summary})()""" % (seed, seed, seed, seed, loops, seed, seed)

def build_tutorial_js(seed):
    """Task 5.3: ENCOUNTERS.tutorial played headless by the deterministic Ctrl.tutorialBot(seed)
    (30_input.js) -- G.startTutorial() (never Quest.start, so no energy check to satisfy), closeIn(f)
    (a top-level function 90_tests.js already defines globally, same helper every in-page unit test
    uses) so the bot doesn't have to spend real time closing the starting gap, then G.tick() until
    RESULT or a generous 7200-frame (2 simulated minutes) budget. Tutorial.state.step is sampled every
    tick and every actual change recorded, so the summary's own stepsInOrder is exactly the sequence
    of steps the run passed through -- asserted to be [1,2,3,4] (0 is the starting step, never
    recorded as a "change"), i.e. every one of the four prompts completed, in order, before the
    dummy's natural KO ended the fight. Returns {seed, stepsInOrder, tutorialDone, goldGranted,
    frame, errors:[...]}."""
    return r"""(()=>{
G.sim=true;
const summary={seed:%d,stepsInOrder:[],tutorialDone:false,goldGranted:null,frame:0,errors:[]};
const push=m=>summary.errors.push(m);
try{
  Save.data.seed=%d;Save.put();
  const goldBefore=Save.data.gold||0;
  const ok=G.startTutorial({seed:%d,ctrl1:Ctrl.tutorialBot(%d)});
  if(ok===false)push('G.startTutorial refused');
  closeIn(G.fight);
  let lastStep=Tutorial.state.step;
  let t=0;
  while(G.state==='FIGHT'&&t<7200){
    G.tick();t++;
    if(Tutorial.state.step!==lastStep){summary.stepsInOrder.push(Tutorial.state.step);lastStep=Tutorial.state.step}
  }
  summary.frame=t;
  if(G.state!=='RESULT')push('tutorial did not reach RESULT within the tick budget (state: '+G.state+')');
  summary.tutorialDone=Save.data.tutorialDone;
  summary.goldGranted=(Save.data.gold||0)-goldBefore;
  const expected=[1,2,3,4];
  if(JSON.stringify(summary.stepsInOrder.slice(0,4))!==JSON.stringify(expected))
    push('tutorial steps did not advance in order 1,2,3,4: got '+JSON.stringify(summary.stepsInOrder));
  if(!summary.tutorialDone)push('Save.data.tutorialDone was not set');
  if(summary.goldGranted!==300)push('expected exactly +300 gold, got '+summary.goldGranted);
}catch(e){push(String(e&&e.stack||e))}
return summary})()""" % (seed, seed, seed, seed)

def build_tutorial_shot_js(which, seed):
    """Task 6.4: freezes one deterministic tutorial frame for docs/shots/p6-tutorial-{1,3,shield}.png.
    Drives the exact same deterministic Ctrl.tutorialBot(seed) run build_tutorial_js plays to
    completion, but stops early at the frame that actually proves the thing each shot needs:
      '1'      -- a few ticks into lesson 1 (SPAR plate + 'LESSON 1 / 4' banner, dummy still passive,
                  same "quick start-and-freeze" the old --tutorial --shot p5 screenshot used).
      '3'      -- the exact frame Ctrl.tutorialDummy's own windup fx fires during lesson 3 (the red
                  wind-up flash a player must react to by holding block, per the frozen interface).
      'shield' -- the exact frame Tutorial.tick pushes the shieldDown fx (lesson 4 done, the HP bar
                  about to return).
    '3' and 'shield' are detected by spying on the real FX.push (not a re-derived condition, e.g.
    polling Tutorial.state.step or FX.list), so the frozen frame is guaranteed to have that fx at
    life 0 (freshly added, full alpha/glow) right when the screenshot is taken."""
    if which == '1':
        body = "closeIn(G.fight);for(let i=0;i<10;i++)G.tick();"
    else:
        kind = 'windup' if which == '3' else 'shieldDown'
        body = (
            "let fired=false;const origPush=FX.push.bind(FX);"
            "FX.push=ev=>{if(ev.kind==='%s')fired=true;return origPush(ev)};"
            "let t=0;while(!fired&&t<3000){G.tick();t++}FX.push=origPush;"
        ) % kind
    return r"""(()=>{
G.sim=true;
const summary={which:'%s',seed:%d,errors:[]};
const push=m=>summary.errors.push(m);
try{
  Save.data.seed=%d;Save.put();
  const ok=G.startTutorial({seed:%d,ctrl1:Ctrl.tutorialBot(%d)});
  if(ok===false)push('G.startTutorial refused');
  %s
  summary.step=Tutorial.state.step;
  summary.frame=G.fight?G.fight.frame:-1;
}catch(e){push(String(e&&e.stack||e))}
return summary})()""" % (which, seed, seed, seed, seed, body)

def run_matrix_cell(b, p1n, p2n, ain, seed, sim_seconds):
    """One soak cell: a fresh page, p1 on Ctrl.random(seed), p2 on AI.make(ain). The whole
    restart-on-KO loop runs as a single in-page evaluate() so a KO is caught the very next tick
    (no batch-boundary waste), keeping frames_total honest and 36 cells fast in one round trip
    each (plus the initial page load)."""
    pg = b.new_page(viewport={'width': 854, 'height': 480})
    cell_errors = []
    pg.on('pageerror', lambda e: cell_errors.append(str(e)))
    pg.on('console', lambda m: cell_errors.append(m.text) if m.type == 'error' else None)
    pg.goto(INDEX)
    pg.wait_for_function('typeof G!=="undefined"')
    js = build_soak_js(seed, p1n, p2n, ain, 'Ctrl.random(seed)', int(sim_seconds * 60))
    r = pg.evaluate(js)
    pg.close()
    return {'p1': p1n, 'p2': p2n, 'ai': ain, 'seed': seed, 'fights': r['fights'], 'p1wins': r['p1wins'],
            'frames_total': r['framesTotal'], 'ko_ticks': r['koTicks'], 'errors': len(cell_errors),
            'req_frames': sim_seconds * 60}

def run_matrix():
    # Fix-wave item 7: extended from the Phase 2 set (2 p1 x 3 p2 x 3 AI-alias x 2 seed = 36 cells,
    # 'basic'/'brawl'/'brute' aliases) to cover Phase 3's new rigs/defs/tiers, which the exit criteria
    # required explicitly and the Phase 2 set never touched (no quad/big rig, no boss, no t2/t4/t5).
    # P2S adds every non-boss mob rig kind (skeleton/shaman: human placeholders, grub: quad,
    # donut/mongo: quad/big champs as mob-slot stand-ins) plus both bosses (grull, mother_rat) so a
    # boss's own buff (armorUp/regen) and unique s3 get restart-on-KO soak coverage too. P1S adds
    # donut/mongo so a quad/big-rig PLAYER side gets the same soak. AIS switches from the old
    # aliases to real tiers spanning the curve (t1/t3/t5) rather than three adjacent-difficulty ones.
    # 4*9*3*2 = 216 cells — 6x the old 36 — so each cell runs 60s of simulated frames (not the old
    # 120s-then-auto-reduce-to-60s) to keep total wall time reasonable; see the printed total below.
    P1S = ['carl', 'katia', 'donut', 'mongo']
    P2S = ['goblin', 'hobgoblin', 'skeleton', 'shaman', 'grub', 'grull', 'mother_rat', 'donut', 'mongo']
    AIS = ['t1', 't3', 't5']
    SEEDS = [1, 2]
    cells = [(p1n, p2n, ain, sd) for p1n in P1S for p2n in P2S for ain in AIS for sd in SEEDS]
    sim_seconds = 60
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for i, (p1n, p2n, ain, sd) in enumerate(cells):
            t0 = time.time()
            row = run_matrix_cell(b, p1n, p2n, ain, sd, sim_seconds)
            row['wall'] = time.time() - t0
            rows.append(row)
        b.close()
    hdr = '%-6s %-10s %-6s %-5s %-7s %-7s %-13s %-7s' % (
        'p1', 'p2', 'ai', 'seed', 'fights', 'p1wins', 'frames_total', 'errors')
    lines = [hdr]
    bad = False
    for r in rows:
        lines.append('%-6s %-10s %-6s %-5d %-7d %-7d %-13d %-7d' % (
            r['p1'], r['p2'], r['ai'], r['seed'], r['fights'], r['p1wins'], r['frames_total'], r['errors']))
        # frames_total alone undercounts progress: the KO slow-mo grace period (90 frames, stepped
        # one per 4 ticks -> 360 ticks) legitimately consumes wall-clock ticks without advancing
        # G.fight.frame, once per fight. ko_ticks credits that time back so the floor only catches
        # an actual stall (state stuck, no fights completing), not a healthy KO-heavy matchup.
        if r['errors'] or r['frames_total'] + r['ko_ticks'] < r['req_frames'] * 0.9:
            bad = True
    total_wall = sum(r['wall'] for r in rows)
    print('\n'.join(lines))
    print('# %d cells, %.1fs total wall time' % (len(rows), total_wall))
    return 1 if bad else 0

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
    ap.add_argument('--pose', default=None, help='freeze p1 in a named Rig pose (via G.debugPose) and screenshot')
    ap.add_argument('--encounter', default=None, help="start via G.startFight({encounter:ID}) instead of --p2/--ai")
    ap.add_argument('--floor', type=int, default=None,
                     help="start via G.startFight({floor,node}) instead of --p2/--ai/--encounter; "
                          "requires --node")
    ap.add_argument('--node', default=None, help="node index (int) or 'boss', used with --floor")
    ap.add_argument('--player-buffs', default=None,
                     help="comma list of buff ids applied to p1 via G.startFight's playerBuffs "
                          "(fix-wave item 5's player-side buff path)")
    ap.add_argument('--champ', default=None,
                     help="roster champion id for G.startFight's champ option (Task 4.4: Stats.derive "
                          "overrides p1's hp/atk from Save.data.roster[champ] when owned)")
    ap.add_argument('--reset-save', action='store_true',
                     help="clear localStorage and re-run Save.load() before starting, so the run "
                          "begins from Meta.defaults() (full energy, floor 1 node 0 open, only carl "
                          "owned) instead of whatever a previous run left in this browser profile")
    ap.add_argument('--screen', default=None,
                     help="render Screens.<name>() (title|map|roster|crystal|shop|arena) and "
                          "screenshot instead of starting a fight; map defaults to floor 1; "
                          "combine with --pre to seed currencies/roster first")
    ap.add_argument('--cinematic', action='store_true',
                     help="run G.debugCinematic() (starts its own fight, arms an s3, sim-steps past "
                          "the card trigger, advances FX) and screenshot; skips the normal --p2/--ai "
                          "startFight below entirely so it never races G.debugCinematic()'s own "
                          "G.startFight() call")
    ap.add_argument('--matrix', action='store_true',
                     help="soak p1 in {carl,katia} x p2 in {goblin,hobgoblin,carl} x ai in "
                          "{basic,brawl,brute} x seed in {1,2} (36 cells), each restart-on-KO --sim "
                          "for 120s of simulated frames (auto-reduced to 60s if the first cell's wall "
                          "time exceeds 40s); prints a table and exits 1 on any page/console error or "
                          "a frames shortfall in any cell")
    ap.add_argument('--perf', type=int, default=None, metavar='N',
                     help="run N frames of G.stepFrame()+Render.frame(G.fight) under G.sim=true on a "
                          "started fight (Ctrl.random bot vs brawl AI), timing with performance.now() "
                          "in the page-evaluate only; prints {ms_per_frame, ms_step, ms_render, "
                          "perf:{ms_per_frame, ms_step, ms_render}} and exits 1 if ms_per_frame >= 6")
    ap.add_argument('--e2e', action='store_true',
                     help="Task 4.6: reset the save, seed Save.data.seed from --seed, grant gold via "
                          "the debug-only G.debugGrant, open 2 basic Crystal.open() pulls, set carl "
                          "active, clear floor 1 (every node then the boss) via the real {floor,node} "
                          "G.startFight sugar with Ctrl.competent (up to 5 attempts per node, energy "
                          "refilled via G.debugEnergy between attempts), asserting node state/reward-"
                          "deltas/energy on every win, one Roster.levelUp, then 3 G.startArena() "
                          "fights; prints a JSON summary (see build_e2e_js's docstring for the exact "
                          "shape) and exits 1 on any assertion/page/console error")
    ap.add_argument('--loops', type=int, default=None, metavar='N',
                     help="with --e2e: after the main run, repeat a Screens-render + one real "
                          "quest-node fight (at whatever node is currently open) + one G.startArena() "
                          "fight N more times, for a sustained menu+fight soak. NOTE (fix-wave item "
                          "10): loop iterations only assert the quest fight wasn't refused and "
                          "capture page/console errors -- they do NOT re-run the main pass's "
                          "gold/iso/xp/energy delta assertions per fight; treat --loops as a soak, "
                          "not an itemized-assertion run")
    ap.add_argument('--share', action='store_true',
                     help="Task 5.4: start a fight, end it via the debug low-hp+scripted-hit pattern "
                          "(same technique every other e2e-style test in this file already uses, not "
                          "a dedicated debug hook), call G.shareCard(), and assert the returned string "
                          "is a data:image/png;base64,... PNG whose IHDR chunk decodes to exactly "
                          "854x480 (checked directly against the raw PNG bytes, not via an Image "
                          "element); prints {state, prefix_ok, dims_ok, width, height} and exits 1 on "
                          "any page/console error or a failed check; combine with --shot to also write "
                          "the decoded PNG bytes to disk for a manual look")
    ap.add_argument('--tutorial', action='store_true',
                     help="Task 5.3: reset the save, seed Save.data.seed from --seed, play "
                          "ENCOUNTERS.tutorial headless via the deterministic Ctrl.tutorialBot(seed) "
                          "(30_input.js) until RESULT; asserts the four Tutorial.steps advance in "
                          "order (1,2,3,4), Save.data.tutorialDone is set, and exactly +300 gold is "
                          "granted; prints a JSON summary (see build_tutorial_js's docstring for the "
                          "exact shape) and exits 1 on any assertion/page/console error; combine with "
                          "--shot for an early (step 1, before any light lands) screenshot of a live "
                          "fight frame with #tutorialPrompt visible")
    ap.add_argument('--tutorial-shot', default=None, choices=['1', '3', 'shield'],
                     help="Task 6.4: reset the save and play ENCOUNTERS.tutorial headless via the same "
                          "deterministic Ctrl.tutorialBot(seed), but stop at the exact deterministic "
                          "frame each of docs/shots/p6-tutorial-{1,3,shield}.png needs: '1' a few ticks "
                          "into lesson 1 (SPAR plate + 'LESSON 1 / 4' banner, dummy still passive); "
                          "'3' the frame Ctrl.tutorialDummy's own windup fx fires during lesson 3 (the "
                          "red wind-up flash); 'shield' the frame Tutorial.tick pushes the shieldDown fx "
                          "(lesson 4 done, 'SHIELD DOWN'). '3'/'shield' are detected by spying on the "
                          "real FX.push (not a re-derived condition), so the frozen frame always has "
                          "that fx at life 0. Combine with --shot to write the PNG.")
    ap.add_argument('--screens-smoke', action='store_true',
                     help="Task 5.6: reset the save, visit every screen in turn (title, map, roster, "
                          "crystal, shop, arena, settings), then play one real quest fight through to "
                          "a natural KO (floor 1 node 0, Ctrl.script light-chain vs Ctrl.competent, "
                          "closeIn to skip the walk-up) so Screens.result renders too; each screen's "
                          "own pageerror/console-error delta is recorded separately; prints a JSON "
                          "{screens:[{screen,errors}]} and exits 1 if any screen recorded errors")
    ap.add_argument('--phone-check', action='store_true',
                     help="Task 5.6: sets an 844x390 CSS-px landscape viewport (iPhone SE/8-class "
                          "phone rotated), starts a real fight, and asserts: the canvas is letterboxed "
                          "(its displayed box preserves the game's 854:480 aspect ratio and fits "
                          "inside the viewport on both axes), every VISIBLE .cbtn on-screen button has "
                          "a real >=44 CSS-px rect fully inside the viewport, and the page never grows "
                          "a horizontal scrollbar (document.documentElement.scrollWidth<=viewport "
                          "width). Task 6.3: BLOCK/PUNCH/KICK are optional (off by default, POWER "
                          "always shown) -- checked once as-is (only POWER visible) and again with "
                          "Save.data.settings.showButtons forced on (all four visible), so both states "
                          "get real coverage; a button that's display:none in a given pass is skipped "
                          "rather than failed. Fix-wave item 8: also visits title/map/roster/crystal/"
                          "shop/arena/settings and asserts every visible <button> there has a real "
                          ">=44 CSS-px rect fully inside the viewport too -- one currently scrolled out "
                          "of a .path/.setrows/#shopBody internal scroll region is skipped, not failed, "
                          "since it's reachable by scrolling rather than clipped/inaccessible. Task 8.5 "
                          "fix round 1: also asserts no two #mapPath .node elements' own bounding rects "
                          "overlap, and likewise for #rosterCards .card, catching a flex-shrink layout "
                          "bug (each row's box shrank below its own door-card/portrait-card child's "
                          "real height, which then bled into neighboring rows) that per-button size/"
                          "position checks alone can't see; and that the map's DOOR 1 (the door a "
                          "player actually plays next) is fully inside the viewport with zero "
                          "scrolling needed, even though the rest of a full floor may legitimately "
                          "require it. Prints a JSON summary and exits 1 on any check failure or "
                          "page/console error")
    a = ap.parse_args()
    if a.floor is not None and a.node is None:
        ap.error('--floor requires --node (an index or "boss")')  # prints usage + exits 2
    if a.matrix:
        sys.exit(run_matrix())
    if a.perf is not None:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            perf_errors = []
            pg.on('pageerror', lambda e: perf_errors.append(str(e)))
            pg.on('console', lambda m: perf_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            # Restart-on-KO, same as build_soak_js: a plain N-tick loop with no restart leaves
            # G.stepFrame() a no-op for the remainder of the run once the fight ends (Fight.step
            # returns immediately while over), silently deflating ms_step toward 0 well before N
            # frames are up.
            js = ("(()=>{G.sim=true;let s=1,n=%d,tStep=0,tRender=0;"
                  "const start=seed=>G.startFight({seed,p1:'carl',p2:'donut',ai:'brawl',ctrl1:Ctrl.random(seed)});"
                  "start(s);"
                  "for(let i=0;i<n;i++){"
                  "const a=performance.now();G.stepFrame();const b=performance.now();"
                  "Render.frame(G.fight);const c=performance.now();"
                  "tStep+=(b-a);tRender+=(c-b);"
                  "if(G.state==='RESULT'){s++;start(s)}}"
                  "return{ms_per_frame:(tStep+tRender)/n,ms_step:tStep/n,ms_render:tRender/n}})()"
                  ) % a.perf
            r = pg.evaluate(js)
            b.close()
        # Task 4.6 fix: the controller's gate read d.get('perf') on this command's own JSON output
        # and got None, because the three timing numbers were only ever printed flat. `perf` is now
        # a real top-level key nesting the same {ms_per_frame, ms_step, ms_render} object; the flat
        # keys are kept alongside it so nothing that already reads them breaks.
        out = dict(r)
        out['perf'] = r
        print(json.dumps(out, indent=1))
        sys.exit(1 if perf_errors or r['ms_per_frame'] >= 6 else 0)
    if a.e2e:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            e2e_errors = []
            pg.on('pageerror', lambda e: e2e_errors.append(str(e)))
            pg.on('console', lambda m: e2e_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            # Same reset as --reset-save: re-migrate from empty localStorage onto Meta.defaults()
            # so the run starts from full energy / floor 1 node 0 open / only carl owned, regardless
            # of whatever a previous harness invocation left in this browser profile.
            pg.evaluate('localStorage.clear();Save.load()')
            js = build_e2e_js(a.seed, a.loops or 0)
            r = pg.evaluate(js)
            b.close()
        out = {'page_errors': e2e_errors, 'summary': r}
        print(json.dumps(out, indent=1))
        sys.exit(1 if e2e_errors or r.get('errors') else 0)
    if a.share:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            share_errors = []
            pg.on('pageerror', lambda e: share_errors.append(str(e)))
            pg.on('console', lambda m: share_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            # Same "end a fight via a scripted low-hp hit, then step ticks until RESULT" technique
            # every other e2e-style test in this file already uses (no dedicated debug-KO hook exists,
            # or is needed) -- p1 (carl) lands one scripted light on p2 (donut) whose hp is pinned to 1
            # first, so it's a guaranteed one-hit KO.
            js = ("(()=>{G.sim=true;"
                  "G.startFight({seed:1,p1:'carl',p2:'donut',ai:'dummy',"
                  "ctrl1:Ctrl.script([{f:0,until:600,intent:{light:true}}]),ctrl2:Ctrl.idle()});"
                  "G.fight.p1.x=G.fight.p2.x-G.fight.p1.width-10;G.fight.p2.hp=1;"
                  "for(let i=0;i<600&&G.state!=='RESULT';i++)G.tick();"
                  "return{state:G.state,dataUrl:G.shareCard()}})()")
            r = pg.evaluate(js)
            b.close()
        data_url = r.get('dataUrl') or ''
        prefix_ok = isinstance(data_url, str) and data_url.startswith('data:image/png;base64,')
        width = height = None
        dims_ok = False
        raw = b''
        if prefix_ok:
            raw = base64.b64decode(data_url.split(',', 1)[1])
            # PNG: an 8-byte signature, then the IHDR chunk (4-byte length, 'IHDR', 4-byte width,
            # 4-byte height, big-endian) starting at byte 12 -- same byte offsets the in-page unit
            # test (90_tests.js) decodes by hand, checked here independently in Python.
            if raw[12:16] == b'IHDR':
                width, height = struct.unpack('>II', raw[16:24])
                dims_ok = (width == 854 and height == 480)
        if a.shot and raw:
            with open(a.shot, 'wb') as f:
                f.write(raw)
        out = {'errors': share_errors, 'state': r.get('state'),
               'prefix_ok': prefix_ok, 'dims_ok': dims_ok, 'width': width, 'height': height}
        print(json.dumps(out, indent=1))
        sys.exit(1 if share_errors or not prefix_ok or not dims_ok or r.get('state') != 'RESULT' else 0)
    if a.tutorial:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            tut_errors = []
            pg.on('pageerror', lambda e: tut_errors.append(str(e)))
            pg.on('console', lambda m: tut_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            # Same reset as --e2e/--reset-save: re-migrate from empty localStorage onto Meta.defaults()
            # so the run starts from a genuinely fresh (!tutorialDone) save.
            pg.evaluate('localStorage.clear();Save.load()')
            if a.shot:
                # docs/shots/p5-tutorial-1.png: a quick start-and-freeze, well within step 1 (TAP
                # PUNCH) since closeIn(f) is the only thing that ever moves the fighters here -- the
                # full scripted run below (build_tutorial_js) then starts the tutorial fresh again and
                # plays it to completion in the same page/session, unaffected by this earlier peek.
                pg.evaluate(
                    "(()=>{G.sim=true;Save.data.seed=%d;Save.put();"
                    "G.startTutorial({seed:%d,ctrl1:Ctrl.tutorialBot(%d)});"
                    "closeIn(G.fight);for(let i=0;i<10;i++)G.tick()})()" % (a.seed, a.seed, a.seed))
                pg.screenshot(path=a.shot)
            js = build_tutorial_js(a.seed)
            r = pg.evaluate(js)
            b.close()
        out = {'page_errors': tut_errors, 'summary': r}
        print(json.dumps(out, indent=1))
        sys.exit(1 if tut_errors or r.get('errors') else 0)
    if a.tutorial_shot:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            shot_errors = []
            pg.on('pageerror', lambda e: shot_errors.append(str(e)))
            pg.on('console', lambda m: shot_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            pg.evaluate('localStorage.clear();Save.load()')
            js = build_tutorial_shot_js(a.tutorial_shot, a.seed)
            r = pg.evaluate(js)
            if a.shot:
                pg.screenshot(path=a.shot)
            b.close()
        out = {'page_errors': shot_errors, 'summary': r}
        print(json.dumps(out, indent=1))
        sys.exit(1 if shot_errors or r.get('errors') else 0)
    if a.screens_smoke:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            pg.evaluate('localStorage.clear();Save.load()')
            results = []
            def visit(name, js):
                before = len(errs)
                pg.evaluate(js)
                results.append({'screen': name, 'errors': list(errs[before:])})
            visit('title', "Screens.title()")
            visit('map', "Screens.map(1)")
            visit('roster', "Screens.roster()")
            visit('crystal', "Screens.crystal()")
            visit('shop', "Screens.shop()")
            visit('arena', "Screens.arena()")
            visit('settings', "Screens.settings()")
            # A real quest fight (floor 1 node 0), same {floor,node} sugar --floor/--node use below,
            # topped up on energy the same way build_soak_js's own --floor/--node soak path does;
            # p1 chains lights until the mob (a goblin, low hp on node 0) drops, closeIn(f) skips the
            # walk-up, and a real Render.frame(G.fight) call exercises the canvas path mid-fight (
            # G.tick() alone never renders -- only G.loop()'s rAF cadence does, which this harness
            # never drives).
            visit('fight',
                  "G.sim=true;G.debugEnergy(999);"
                  "G.startFight({seed:1,floor:1,node:0,ctrl1:Ctrl.script([{f:0,until:1800,intent:{light:true}}])});"
                  "closeIn(G.fight);"
                  "for(let i=0;i<30;i++)G.tick();"
                  "Render.frame(G.fight);")
            # Continue the same fight to its natural KO, which flips G.state to RESULT and fires
            # Screens.result (G.onFightEnd) -- this is the screen this visit's errors are attributed to.
            visit('result', "for(let i=0;i<1800&&G.state!=='RESULT';i++)G.tick();")
            state = pg.evaluate('G.state')
            b.close()
        bad_screens = [r['screen'] for r in results if r['errors']]
        out = {'screens': results, 'final_state': state}
        print(json.dumps(out, indent=1))
        sys.exit(1 if bad_screens or state != 'RESULT' else 0)
    if a.phone_check:
        with sync_playwright() as p:
            b = p.chromium.launch()
            # 844x390: an iPhone (SE/8-class) 375x667 or 390x844 CSS-px screen rotated to landscape --
            # the frozen interface's own wording ("844x390 CSS-px viewport (iPhone SE/8-class")) --
            # the narrowest realistic landscape phone width, so it's the tightest-fit check available.
            pg = b.new_page(viewport={'width': 844, 'height': 390})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            pg.evaluate('localStorage.clear();Save.load()')
            pg.evaluate("G.startFight({seed:1,p1:'carl',p2:'donut',ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()})")

            def capture():
                return pg.evaluate("""(()=>{
                  const cr=canvas.getBoundingClientRect();
                  const btnIds=['btnBlock','btnPunch','btnKick','btnPower'];
                  const btns=btnIds.map(id=>{
                    const el=document.getElementById(id),rc=el.getBoundingClientRect();
                    return{id,left:rc.left,top:rc.top,width:rc.width,height:rc.height,
                      right:rc.right,bottom:rc.bottom,display:getComputedStyle(el).display};});
                  return{canvas:{left:cr.left,top:cr.top,width:cr.width,height:cr.height},
                    btns,
                    scrollWidth:document.documentElement.scrollWidth,
                    innerWidth:innerWidth,innerHeight:innerHeight};
                })()""")

            # Task 6.3: BLOCK/PUNCH/KICK are optional (Save.data.settings.showButtons, off by
            # default; POWER is never optional) -- two passes, hidden (the default a fresh save
            # loads with) and shown, so both real on-screen states get checked instead of just
            # whichever one happens to be the default this run.
            r_hidden = capture()
            pg.evaluate("Save.data.settings.showButtons=true;G.applySettings()")
            r_shown = capture()
            pg.evaluate("Save.data.settings.showButtons=false;G.applySettings()")
            b.close()

        def check_pass(r):
            vw, vh = r['innerWidth'], r['innerHeight']
            cv = r['canvas']
            # Letterboxed: the displayed canvas box must preserve the game's own 854:480 aspect ratio
            # (within float rounding) and fit entirely inside the viewport on both axes -- that's what
            # "letterboxed" means here (bars on whichever axis has slack), not any particular bar size.
            aspect_game = 854 / 480
            aspect_shown = cv['width'] / cv['height'] if cv['height'] else 0
            aspect_ok = abs(aspect_shown - aspect_game) < 0.01
            fits_ok = cv['width'] <= vw + 0.5 and cv['height'] <= vh + 0.5
            btn_checks = []
            for bt in r['btns']:
                visible = bt['display'] != 'none'
                # A button that's legitimately hidden this pass (display:none, Task 6.3) is skipped,
                # not failed -- only a VISIBLE button has to clear the real touch-target/fit bars.
                ok_size = (not visible) or (bt['width'] >= 44 and bt['height'] >= 44)
                ok_inside = (not visible) or (bt['left'] >= 0 and bt['top'] >= 0 and bt['right'] <= vw + 0.5 and bt['bottom'] <= vh + 0.5)
                btn_checks.append({'id': bt['id'], 'visible': visible, 'width': bt['width'], 'height': bt['height'],
                                    'size_ok': ok_size, 'inside_ok': ok_inside})
            no_hscroll = r['scrollWidth'] <= vw + 1  # +1: sub-pixel layout rounding
            bad_btns = [c['id'] for c in btn_checks if not (c['size_ok'] and c['inside_ok'])]
            return {'canvas': cv, 'aspect_ok': aspect_ok, 'fits_ok': fits_ok, 'buttons': btn_checks,
                    'no_hscroll': no_hscroll, 'viewport': {'w': vw, 'h': vh}, 'bad_btns': bad_btns}

        hidden_out = check_pass(r_hidden)
        shown_out = check_pass(r_shown)
        # The wiring itself, not just sizing: POWER visible and BLOCK/PUNCH/KICK hidden in the
        # default pass; all four visible once showButtons is on.
        power_hidden = next(c for c in hidden_out['buttons'] if c['id'] == 'btnPower')
        atk_hidden = [c for c in hidden_out['buttons'] if c['id'] != 'btnPower']
        wiring_ok = power_hidden['visible'] and not any(c['visible'] for c in atk_hidden) and \
            all(c['visible'] for c in shown_out['buttons'])

        # Fix-wave item 8 (final review, Important): extended to the DOM meta screens -- the in-fight
        # canvas/.cbtn check above never covered title/map/roster/crystal/shop/arena/settings at all,
        # which is exactly how the review found SETTINGS (title) and BACK (map/shop/settings) clipped
        # at 844x390 with nothing catching it. Re-opens a fresh page (a clean save, same as the fight
        # check above) and visits every one of those seven screens, asserting every VISIBLE <button>
        # (any DOM button, not just the fixed 4-id list above) has a real >=44 CSS-px rect fully inside
        # the viewport. A button inside a scrolling ancestor (.path/.setrows/#shopBody all use
        # overflow-y:auto -- a long node/settings/perk list scrolls internally rather than pushing a
        # screen's own BACK button off the bottom edge, the actual fix for the clipping bug) that is
        # currently scrolled OUT of that ancestor's own visible window is skipped, not failed -- it's
        # reachable by scrolling, the same established pattern #setrows/#shopBody already used before
        # this fix wave, not a clipping bug.
        with sync_playwright() as p2:
            b2 = p2.chromium.launch()
            pg2 = b2.new_page(viewport={'width': 844, 'height': 390})
            screen_errs = []
            pg2.on('pageerror', lambda e: screen_errs.append(str(e)))
            pg2.on('console', lambda m: screen_errs.append(m.text) if m.type == 'error' else None)
            pg2.goto(INDEX)
            pg2.wait_for_function('typeof G!=="undefined"')
            pg2.evaluate('localStorage.clear();Save.load()')

            def capture_screen(nav_js):
                pg2.evaluate(nav_js)
                return pg2.evaluate("""(()=>{
                  function scrolledOut(el){
                    const r=el.getBoundingClientRect();
                    let node=el.parentElement;
                    while(node&&node!==document.documentElement){
                      const cs=getComputedStyle(node);
                      if(/(auto|hidden|scroll)/.test(cs.overflowY)||/(auto|hidden|scroll)/.test(cs.overflowX)){
                        const nr=node.getBoundingClientRect();
                        if(r.bottom<=nr.top||r.top>=nr.bottom||r.right<=nr.left||r.left>=nr.right)return true}
                      node=node.parentElement}
                    return false}
                  const btns=[...document.querySelectorAll('button')].filter(b=>{
                    const cs=getComputedStyle(b);
                    return cs.display!=='none'&&cs.visibility!=='hidden'&&b.offsetParent!==null});
                  return btns.map(b=>{const r=b.getBoundingClientRect();
                    return{id:b.id||b.className,top:r.top,bottom:r.bottom,left:r.left,right:r.right,
                      width:r.width,height:r.height,scrolledOut:scrolledOut(b)}});
                })()""")

            SCREENS = [('title', "Screens.title()"), ('map', "Screens.map(1)"), ('roster', "Screens.roster()"),
                       ('crystal', "Screens.crystal()"), ('shop', "Screens.shop()"), ('arena', "Screens.arena()"),
                       ('settings', "Screens.settings()")]
            screen_results = []
            for name, nav in SCREENS:
                btns = capture_screen(nav)
                vw, vh = pg2.evaluate('innerWidth'), pg2.evaluate('innerHeight')
                checks = []
                for bt in btns:
                    if bt['scrolledOut']:
                        checks.append({**bt, 'skipped': True, 'ok': True})
                        continue
                    size_ok = bt['width'] >= 44 and bt['height'] >= 44
                    inside_ok = (bt['left'] >= -0.5 and bt['top'] >= -0.5 and
                                 bt['right'] <= vw + 0.5 and bt['bottom'] <= vh + 0.5)
                    checks.append({**bt, 'skipped': False, 'ok': size_ok and inside_ok})
                bad = [c['id'] for c in checks if not c['ok']]
                screen_results.append({'screen': name, 'buttons': checks, 'bad': bad})

            # Task 8.5 fix round 1 (controller): the map's door cards (and, defensively, the roster's
            # portrait cards) once got flex-shrunk by their scrollable flex-column ancestor (.path/
            # .cards) down below their own content's natural height -- each .node/.card element's own
            # box stayed at the OLD ~44px text-row height while its taller door-card/portrait-card
            # child rendered at its real size and (overflow:visible) bled into the row above/below it.
            # That's a real, screenshot-visible defect no per-button size/position check above would
            # ever catch (each individual button can still be >=44px and "inside the viewport" while
            # overlapping its neighbor) -- so this checks the one property that actually rules it out:
            # no two sibling node/card elements' own bounding rects may overlap on both axes. A small
            # 0.5px tolerance absorbs sub-pixel layout rounding between genuinely-adjacent (touching,
            # zero-gap) rects without masking a real double-digit-pixel overlap.
            def rects_for(selector):
                return pg2.evaluate("""(sel=>[...document.querySelectorAll(sel)].map(el=>{
                  const r=el.getBoundingClientRect();
                  return{left:r.left,top:r.top,right:r.right,bottom:r.bottom};
                }))(%s)""" % json.dumps(selector))

            def overlap_pairs(rects):
                pairs = []
                for i in range(len(rects)):
                    for j in range(i + 1, len(rects)):
                        ra, rb = rects[i], rects[j]
                        if (ra['left'] < rb['right'] - 0.5 and rb['left'] < ra['right'] - 0.5 and
                                ra['top'] < rb['bottom'] - 0.5 and rb['top'] < ra['bottom'] - 0.5):
                            pairs.append([i, j])
                return pairs

            overlap_results = {}
            nav_by_name = dict(SCREENS)
            for scr_name, sel in (('map', '#mapPath .node'), ('roster', '#rosterCards .card')):
                pg2.evaluate(nav_by_name[scr_name])
                rects = rects_for(sel)
                overlap_results[scr_name] = {'count': len(rects), 'bad_pairs': overlap_pairs(rects)}

            # Task 8.5 fix round 1 (controller ruling, distinct from the overlap check above): "at
            # 844x390 the first card must be fully visible without scrolling" -- a full floor with
            # 5 doors + boss legitimately needs #mapPath to scroll (Phase 6 ruling), but the door a
            # player actually plays next (DOOR 1, the map's own .node.open in a worst-case fresh
            # floor) must never itself require scrolling to reach at the game's tightest supported
            # viewport. Sampled straight off the live page (not re-derived from CSS assumptions) so
            # a future layout change that regresses this gets caught here, not just by eye.
            pg2.evaluate(nav_by_name['map'])
            first_door = pg2.evaluate("""(()=>{
              const el=document.querySelector('#mapPath .node.open')||document.querySelector('#mapPath .node');
              if(!el)return null;
              const r=el.getBoundingClientRect();
              return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};
            })()""")
            vw2, vh2 = pg2.evaluate('innerWidth'), pg2.evaluate('innerHeight')
            first_door_ok = bool(first_door) and (
                first_door['top'] >= -0.5 and first_door['left'] >= -0.5 and
                first_door['bottom'] <= vh2 + 0.5 and first_door['right'] <= vw2 + 0.5)
            b2.close()
        screens_bad = [r['screen'] for r in screen_results if r['bad']]
        overlap_bad = [name for name, v in overlap_results.items() if v['bad_pairs']]

        out = {'errors': errs, 'attackButtonsHidden': hidden_out, 'attackButtonsShown': shown_out,
               'wiring_ok': wiring_ok, 'screens': screen_results, 'screenErrors': screen_errs,
               'cardOverlap': overlap_results, 'firstDoor': first_door, 'firstDoorOk': first_door_ok}
        print(json.dumps(out, indent=1))
        bad = (errs or not hidden_out['aspect_ok'] or not hidden_out['fits_ok'] or hidden_out['bad_btns']
               or not hidden_out['no_hscroll'] or not shown_out['aspect_ok'] or not shown_out['fits_ok']
               or shown_out['bad_btns'] or not shown_out['no_hscroll'] or not wiring_ok
               or screen_errs or screens_bad or overlap_bad or not first_door_ok)
        sys.exit(1 if bad else 0)
    errors, console = [], []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 854, 'height': 480})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: console.append(m.text) if m.type == 'error' else None)
        pg.goto(INDEX)
        pg.wait_for_function('typeof G!=="undefined"')
        if a.reset_save:
            # Save.load() re-migrates from (now-empty) localStorage, landing on Meta.defaults() --
            # done before any G.startFight() call below so quest energy/lock state starts clean.
            pg.evaluate('localStorage.clear();Save.load()')
        if a.pre:
            pg.evaluate(a.pre)
        out = {'errors': errors, 'console_errors': console}
        if a.unit:
            r = pg.evaluate('Test.run()')
            out['unit'] = r
            print(json.dumps(out, indent=1))
            b.close()
            sys.exit(0 if r['fail'] == 0 and not errors else 1)
        if a.cinematic:
            pg.evaluate('G.debugCinematic()')
            out['state'] = pg.evaluate('G.state')
            out['fight'] = pg.evaluate(
                'G.fight&&{frame:G.fight.frame,cinematic:G.fight.cinematic,p1power:G.fight.p1.power}')
            if a.shot:
                pg.screenshot(path=a.shot)
            b.close()
            print(json.dumps(out, indent=1))
            sys.exit(1 if errors or console else 0)
        if a.screen:
            # G.state stays 'TITLE' while browsing every Phase 4 screen (Screens owns which overlay
            # is actually visible), so the shared exit check below (`out['state']=='TITLE'` means
            # "never left the title screen", i.e. a real failure for a normal fight run) doesn't
            # apply here -- this branch exits on its own, same as --pose/--cinematic above.
            js = "Screens.map(1)" if a.screen == 'map' else "Screens.%s()" % a.screen
            pg.evaluate(js)
            out['state'] = pg.evaluate('G.state')
            out['screen'] = pg.evaluate('Screens._current')
            if a.shot:
                pg.screenshot(path=a.shot)
            b.close()
            print(json.dumps(out, indent=1))
            sys.exit(1 if errors or console else 0)
        ctrl = 'Ctrl.random(%d)' % a.seed if a.bot == 'random' else 'Ctrl.idle()'
        # --floor/--node take priority over --encounter (both are sugar for the same G.startFight
        # option object; build_soak_js and the plain evaluate() below both just splice `enc` in raw).
        if a.floor is not None:
            node_val = "'boss'" if a.node == 'boss' else str(int(a.node))
            enc = ",floor:%d,node:%s" % (a.floor, node_val)
        else:
            enc = ",encounter:'%s'" % a.encounter if a.encounter else ''
        if a.player_buffs:
            enc += ",playerBuffs:%s" % json.dumps(a.player_buffs.split(','))
        if a.champ:
            enc += ",champ:'%s'" % a.champ
        pg.evaluate("G.sim=%s;G.startFight({seed:%d,p1:'%s',p2:'%s',ai:'%s',ctrl1:%s%s})"
                    % ('true' if a.sim else 'false', a.seed, a.p1, a.p2, a.ai, ctrl, enc))
        if a.pose:
            pg.evaluate("G.debugPose('%s')" % a.pose)
            out['state'] = pg.evaluate('G.state')
            out['fight'] = pg.evaluate('G.fight&&{frame:G.fight.frame,p1state:G.fight.p1.state,p1move:G.fight.p1.moveName,p1f:G.fight.p1.f}')
            if a.shot:
                pg.screenshot(path=a.shot)
            b.close()
            print(json.dumps(out, indent=1))
            sys.exit(1 if errors or console else 0)
        probes = {e: [] for e in a.probe}
        if a.sim:
            # Same restart-on-KO in-page loop run_matrix_cell uses (build_soak_js): one evaluate()
            # steps G.tick() for the whole requested duration, restarting with a fresh seed the
            # instant G.state hits RESULT (not at the next 60-tick/probe boundary as the old
            # per-second Python loop did), and samples --probe expressions once per simulated second.
            ctrl_expr = 'Ctrl.random(seed)' if a.bot == 'random' else 'Ctrl.idle()'
            # A --floor/--node soak restarts through G.startFight's real {floor,node} sugar every
            # KO, which spends 1 real Quest.start energy per restart (Task 4.4) -- topped up once
            # before the loop so a long soak can't run the node/energy dry mid-run and start
            # refusing (the smallest fix: G.debugEnergy is a debug-only hook made for this).
            pre = 'G.debugEnergy(999);' if a.floor is not None else ''
            js = build_soak_js(a.seed, a.p1, a.p2, a.ai, ctrl_expr, int(a.seconds * 60), enc, a.probe, pre)
            r = pg.evaluate(js)
            out['frames_total'] = r['framesTotal']
            out['fights'] = r['fights']
            out['ko_ticks'] = r['koTicks']
            probes = r['probes']
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
    # See run_matrix()'s bad-cell check: ko_ticks credits back the wall-clock ticks legitimately
    # spent in the KO slow-mo grace period, which frames_total alone doesn't advance through.
    short_soak = a.sim and out.get('frames_total', 0) + out.get('ko_ticks', 0) < a.seconds * 60 * 0.9
    sys.exit(1 if errors or console or out['state'] == 'TITLE' or short_soak else 0)

if __name__ == '__main__':
    main()

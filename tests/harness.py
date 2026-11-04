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
  python3 tests/harness.py --journey --seed 1                        # fresh save to every champion's
      # first rank-up with nothing granted: tutorial, campaign doors, arena runs, crystals and the shop
      # catalyst, all through the game's own reward code; prints per-champion milestones and totals;
      # exit 1 on any assertion, a champion that never ranks up, or any page/console error
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

  python3 tests/harness.py --player-smoke                           # player page (index.html) only:
      # no test code, title screen, one full fight to RESULT, no page/console errors

  python3 tests/harness.py --touch-heavy                            # real mouse input through lesson 3 at
      # 844x390: heavy from standing (HEAVY button, swipe-and-hold), BLOCK button then HEAVY button, and
      # a canvas-hold parry then HEAVY button; prints what each did; exit 1 if lesson 3's punish can't
      # be done by touch

  python3 tests/harness.py --3d-smoke                                # opt-in 3D fighters: a real fight on
      # test.html?3d=1 at 854x480 and 844x390 (script loaded, WebGL canvas over the game canvas, fighters
      # read back from WebGL, no 2D bodies, HUD/stage/FX still on the 2D canvas), the fallbacks (no WebGL,
      # missing bundle, lost context, quad looks), no 3D request without the flag, and ms/frame for the
      # 2D path next to the 3D path; exit 1 on any failed check or page/console error
  python3 tests/harness.py --3d-perf 300 --angle metal              # only the ms/frame comparison, on the
      # given ANGLE backend (metal uses this Mac's real GPU; the default swiftshader is software GL)
  python3 tests/harness.py --3d-shots /tmp                          # writes carls-3d-idle.png, carls-3d-hit.png
      # and carls-2d-idle.png at 854x480: the same fight moments in both renderers

  python3 tests/harness.py --saves                                  # damaged-save cases: a prepared
      # localStorage save is seeded before any game script runs (fresh browser context per case);
      # checks the game still starts, only the broken record is repaired, an unreadable save is
      # backed up to carlsArena.v1.bak, and a failed backup never overwrites the original; exit 1
      # on any failed case or page/console error

Exit 1 on any page error, console error, or if the game never left TITLE.
"""
import argparse, base64, json, os, struct, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = 'file://' + os.path.join(ROOT, 'index.html')
TEST_PAGE = 'file://' + os.path.join(ROOT, 'test.html')
# The four-champion roster fixture, kept in one place because two things have to agree on it: the
# docs/shots/p8-roster.png line in tools/shots.sh (which passes it as --pre) and --phone-check's own
# roster seeding (Phase 8 final review, Important #5 -- a fresh one-champion save made every roster
# card assertion vacuous). Four is the whole roster the game can grant today, so it is also the
# densest list the .cards container ever has to lay out.
ROSTER_PRE = ("Save.data.roster.katia={stars:1,rank:1,level:1,xp:0,shards:0};"
              "Save.data.roster.donut={stars:1,rank:1,level:1,xp:0,shards:0};"
              "Save.data.roster.mongo={stars:1,rank:1,level:1,xp:0,shards:0};Save.put()")

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
  for(const fd of FLOORS){
    const n=fd.floor,f=Quest.floor(n);if(!f)continue;
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

def build_journey_js(seed):
    """Earns every resource the way a player does, from a fresh save, until each champion has made
    its first rank-up. One in-page evaluate, like build_e2e_js. The tutorial is the exact scripted run
    build_tutorial_js plays; every other fight starts through G.startFight/G.startArena and ends in a
    KO (the loser's hp set to 0, then G.tick until RESULT), so G.onFightEnd runs Quest.complete and
    Rewards.grant/Arena.record unchanged. Energy only comes back by moving Energy.now forward. Gold is
    spent only through Crystal.open('basic'), Meta.buy('classCatalyst') and Roster.rankUp. Returns
    {seed, champs:{id:{obtained,stars2,rankedUp}}, totals, errors:[...]}, where each milestone is
    {step, gold on hand, earned so far}."""
    return r"""(()=>{
G.sim=true;
const S=__SEED__,CAP=400;
const summary={seed:S,champs:{},totals:{arenaRuns:0,arenaWins:0,crystals:0,catalystsBought:0,
  campaignFights:0,energyWaitsMin:0,goldEarned:{tutorial:0,campaign:0,arena:0}},errors:[]};
const push=m=>summary.errors.push(m);
const origNow=Energy.now;
try{
  const ids=Object.keys(CHAMPS),T=summary.totals;
  const rec=summary.champs;ids.forEach(id=>{rec[id]={obtained:null,stars2:null,rankedUp:null}});
  const ledger={};let step=0,fightN=0;
  const fail=m=>{throw new Error(m)};
  const gold=()=>Save.data.gold||0;
  const earned=()=>T.goldEarned.tutorial+T.goldEarned.campaign+T.goldEarned.arena;
  const mark=()=>{for(const id of ids){
    const e=Save.data.roster[id],r=rec[id];
    if(!e)continue;
    if(!r.obtained)r.obtained={step,gold:gold(),earned:earned()};
    if(e.stars>=2&&!r.stars2)r.stars2={step,gold:gold(),earned:earned()};
    if(e.rank>=2&&!r.rankedUp)r.rankedUp={step,gold:gold(),earned:earned()}}};
  const check=where=>{
    for(const k of ['gold','units','iso'])if((Save.data[k]||0)<0)push(k+' went negative at '+where);
    if(Save.data.energy.n<0)push('energy went negative at '+where);
    for(const c in Save.data.cats){
      if(Save.data.cats[c]<0)push('cats.'+c+' went negative at '+where);
      if(Save.data.cats[c]!==(ledger[c]||0))push('cats.'+c+' is '+Save.data.cats[c]+' but only '+(ledger[c]||0)+' were earned/bought, at '+where)}};
  const sumCats=c=>Object.values(c||{}).reduce((a,b)=>a+b,0);
  const catsNow=()=>Object.assign({},Save.data.cats);
  const snap=()=>({gold:gold(),iso:Save.data.iso||0,units:Save.data.units||0,cats:catsNow(),energy:Save.data.energy.n});
  const absorbCats=(before)=>{for(const c in Save.data.cats){const d=Save.data.cats[c]-(before[c]||0);if(d)ledger[c]=(ledger[c]||0)+d}};

  // Fresh-save preconditions: nothing was handed over before the tutorial.
  if(gold()!==0||Object.keys(Save.data.roster).join()!=='carl'||sumCats(Save.data.cats)!==0)push('save was not fresh');
  Save.data.seed=S;Save.put();

  // Clock: from here on, time only moves when this test moves it.
  let clock=origNow();Energy.now=()=>clock;

  mark();
  const tut=__TUTORIAL__;
  (tut.errors||[]).forEach(e=>push('tutorial: '+e));
  T.goldEarned.tutorial=gold();
  step++;mark();check('tutorial');

  // Starts a fight, forces one side's KO, ticks to RESULT, returns whether p1 won.
  const koFight=(start,p1wins)=>{
    const fseed=S*100000+(++fightN);
    const o={seed:fseed,ctrl1:Ctrl.competent(fseed)};
    const ok=start(o);
    if(ok===false)fail('fight refused');
    (p1wins?G.fight.p2:G.fight.p1).hp=0;
    let n=0;while(G.state==='FIGHT'&&n<3000){G.tick();n++}
    if(G.state!=='RESULT')fail('fight did not reach RESULT');
    const won=!!(G.fight.winner&&G.fight.winner.side===1);
    if(won!==p1wins)fail('KO went the wrong way');
    step++;return won};

  const nextDoor=()=>{
    for(const fd of FLOORS){
      const f=Quest.floor(fd.floor);if(!f)continue;
      for(let i=0;i<f.nodes.length;i++)if(f.nodes[i].state==='open')return{floor:fd.floor,node:i};
      if(f.boss.state==='open')return{floor:fd.floor,node:'boss'}}
    return null};

  const questWin=d=>{
    let waits=0;
    while(!Quest.canStart(d.floor,d.node)){
      if(++waits>12)fail('door '+d.floor+'/'+d.node+' never became startable');
      clock+=360000;T.energyWaitsMin+=6}
    const b=snap(),exp=Rewards.forNode(d.floor,d.node);
    koFight(o=>G.startFight(Object.assign(o,{floor:d.floor,node:d.node})),true);
    const a=snap(),id=d.floor+'/'+d.node;
    if(a.gold-b.gold!==exp.gold)push('gold delta '+(a.gold-b.gold)+' != '+exp.gold+' at '+id);
    if(a.iso-b.iso!==exp.iso)push('iso delta '+(a.iso-b.iso)+' != '+exp.iso+' at '+id);
    if(a.units-b.units!==(exp.units||0))push('units delta '+(a.units-b.units)+' != '+(exp.units||0)+' at '+id);
    if(sumCats(a.cats)-sumCats(b.cats)!==sumCats(exp.cats))push('catalyst count delta wrong at '+id);
    if(a.energy!==b.energy-1)push('energy delta '+(a.energy-b.energy)+' != -1 at '+id);
    const f=Quest.floor(d.floor),st=d.node==='boss'?f.boss.state:f.nodes[d.node].state;
    if(st!=='done')push('door not done after win: '+id);
    absorbCats(b.cats);
    T.goldEarned.campaign+=a.gold-b.gold;T.campaignFights++;
    mark();check('quest '+id)};

  const arenaFight=win=>{
    const b=snap(),s0=Save.data.arena.streak;
    koFight(o=>G.startArena(o),win);
    const g=gold()-b.gold;
    const exp=win?60*(s0+1):0;
    if(g!==exp)push('arena gold delta '+g+' != '+exp+' at streak '+s0+(win?' win':' loss'));
    if(Save.data.arena.streak!==(win?s0+1:0))push('arena streak wrong after '+(win?'win':'loss')+' at '+s0);
    const a=snap();
    for(const k of ['iso','units','energy'])if(a[k]!==b[k])push('arena fight changed '+k+' ('+b[k]+' -> '+a[k]+') at streak '+s0);
    for(const c in a.cats)if(a.cats[c]!==b.cats[c])push('arena fight changed cats.'+c+' at streak '+s0);
    T.goldEarned.arena+=g;if(win)T.arenaWins++;
    check('arena');mark()};
  const arenaRun=()=>{
    if(++T.arenaRuns>CAP)fail('more than '+CAP+' arena runs');
    for(let i=0;i<4;i++)arenaFight(true);
    arenaFight(false)};

  const earn=()=>{const d=nextDoor();if(d)questWin(d);else arenaRun()};

  const basicCost=Crystal.KINDS.basic.cost.gold;
  const shopCat=Meta.SHOP_ITEMS.classCatalyst;
  const buyCrystal=()=>{
    const g=gold(),r=Crystal.open('basic');
    if(!r)fail('basic crystal refused with '+g+' gold');
    if(gold()!==g-basicCost)push('crystal cost '+(g-gold())+' != '+basicCost);
    T.crystals++;step++;mark();check('crystal')};
  const buyCatalyst=cls=>{
    const g=gold(),b=snap();
    if(Meta.buy('classCatalyst',{cls})!==true)fail('catalyst refused with '+g+' gold');
    if(gold()!==g-shopCat.cost.gold)push('catalyst cost '+(g-gold())+' != '+shopCat.cost.gold);
    if(Save.data.cats[cls]!==b.cats[cls]+1)push('catalyst not added to '+cls);
    absorbCats(b.cats);T.catalystsBought++;step++;check('catalyst')};
  const rankUp=id=>{
    const e=Save.data.roster[id],cls=CHAMPS[id].cls,have=Save.data.cats[cls]||0,cost=e.rank;
    if(have<cost||(ledger[cls]||0)<cost)push('rank-up of '+id+' without an earned '+cls+' catalyst');
    const b=snap();
    if(!Roster.rankUp(id))fail('Roster.rankUp refused for '+id);
    if(Save.data.roster[id].rank!==2)push(id+' rank is '+Save.data.roster[id].rank+' after rank-up');
    for(const c in Save.data.cats){
      const want=b.cats[c]-(c===cls?cost:0);
      if(Save.data.cats[c]!==want)push('rank-up of '+id+' left cats.'+c+' at '+Save.data.cats[c]+', expected '+want)}
    ledger[cls]-=cost;step++;mark();check('rankUp '+id)};

  const blocked={};
  for(let guard=0;guard<20000;guard++){
    const pending=ids.filter(id=>!blocked[id]&&!(Save.data.roster[id]&&Save.data.roster[id].rank>=2));
    if(!pending.length)break;
    const cur=pending.find(id=>Save.data.roster[id]);
    if(!cur){if(gold()>=basicCost)buyCrystal();else earn();continue}
    const e=Save.data.roster[cur],cls=CHAMPS[cur].cls;
    if(e.stars<2){if(gold()>=basicCost)buyCrystal();else earn();continue}
    if((Save.data.cats[cls]||0)<1){
      if(!shopCat){if(nextDoor())earn();else blocked[cur]=true;continue}
      if(gold()>=shopCat.cost.gold)buyCatalyst(cls);else earn();continue}
    rankUp(cur)}
  for(const id of ids)if(!rec[id].rankedUp)push(id+' never ranked up');
}catch(e){push(String(e&&e.message||e))}
finally{Energy.now=origNow}
return summary})()""".replace('__SEED__', str(seed)).replace('__TUTORIAL__', build_tutorial_js(seed))

def run_matrix_cell(b, p1n, p2n, ain, seed, sim_seconds):
    """One soak cell: a fresh page, p1 on Ctrl.random(seed), p2 on AI.make(ain). The whole
    restart-on-KO loop runs as a single in-page evaluate() so a KO is caught the very next tick
    (no batch-boundary waste), keeping frames_total honest and 36 cells fast in one round trip
    each (plus the initial page load)."""
    pg = b.new_page(viewport={'width': 854, 'height': 480})
    cell_errors = []
    pg.on('pageerror', lambda e: cell_errors.append(str(e)))
    pg.on('console', lambda m: cell_errors.append(m.text) if m.type == 'error' else None)
    pg.goto(TEST_PAGE)
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
    worst_margin = None  # Fix-wave item M4: the loosest stall margin seen, and which cell it's on --
    worst_cell = None    # see the print just below the loop for why this is printed every run, not
                          # just when something fails.
    for r in rows:
        lines.append('%-6s %-10s %-6s %-5d %-7d %-7d %-13d %-7d' % (
            r['p1'], r['p2'], r['ai'], r['seed'], r['fights'], r['p1wins'], r['frames_total'], r['errors']))
        # frames_total alone undercounts progress: the KO slow-mo grace period (90 frames, stepped
        # one per 4 ticks -> 360 ticks) legitimately consumes wall-clock ticks without advancing
        # G.fight.frame, once per fight. ko_ticks credits that time back so the floor only catches
        # an actual stall (state stuck, no fights completing), not a healthy KO-heavy matchup.
        # Task 9.4 (documented margin, per the phase-9 kit-balance ruling): 0.9 -> 0.85. A handful of
        # low-fight-count boss cells (3-4 fights in 60s -- a slow, defensive tank-vs-tank matchup, not
        # a stall) sit within a few TICKS of the 0.9 line -- e.g. mongo/hobgoblin/t5/seed2 measured
        # frames_total+ko_ticks=3239 pre-9.4 (one tick under 3600*0.9=3240) and carl/hobgoblin/t5/
        # seed2 measured 3238 post-9.4 (two ticks under) -- both real, healthy, zero-error soaks, just
        # on the wrong side of an arbitrary integer-tick line after this task's own busy()-gate fix
        # and tier.kit shifted a few tiers' own block/special cadence by a handful of frames. Chasing
        # whichever single cell happens to sit closest to that line with a boss-stat retune (as
        # opposed to a genuine under/over-band win-rate problem) would just relocate the same coin-flip
        # to a different cell next time an unrelated AI change nudges the numbers again -- not a real
        # fix for a threshold this close. 0.85 (3600*0.85=3060) leaves both measured cells (3238,
        # 3239) a comfortable ~180-frame margin while still catching a genuine stall (a cell stuck near
        # 0 frames_total+ko_ticks, orders of magnitude under either threshold).
        # Fix-wave item M4 (final review, Minor): the 0.85 floor is looser than the data requires --
        # the final review measured every cell's own margin and found the whole distribution sits
        # around 0.90 (worst cell 0.8994), so 0.85 now tolerates a ~5% real degradation before the
        # gate would even notice. Rather than tightening the floor (risking a new round of the exact
        # boss-cell coin-flip flakiness 9.4's own margin widening was fixing), print the worst margin
        # in the summary every run so a real drift is VISIBLE even while the gate keeps passing.
        margin = (r['frames_total'] + r['ko_ticks']) / r['req_frames'] if r['req_frames'] else 1.0
        if worst_margin is None or margin < worst_margin:
            worst_margin = margin
            worst_cell = r
        if r['errors'] or r['frames_total'] + r['ko_ticks'] < r['req_frames'] * 0.85:
            bad = True
    total_wall = sum(r['wall'] for r in rows)
    print('\n'.join(lines))
    print('# %d cells, %.1fs total wall time' % (len(rows), total_wall))
    if worst_cell is not None:
        print('# worst stall margin: %.4f (floor 0.85) on %s/%s/%s/seed%d (frames_total=%d ko_ticks=%d req_frames=%d)' % (
            worst_margin, worst_cell['p1'], worst_cell['p2'], worst_cell['ai'], worst_cell['seed'],
            worst_cell['frames_total'], worst_cell['ko_ticks'], worst_cell['req_frames']))
    return 1 if bad else 0

# A played v2 save in the exact shape Meta.defaults() writes, so --saves can break one record at a time
# and assert every other field survives.
def played_save():
    return {
        'v': 2, 'seed': 7, 'fightSeed': 42, 'gold': 1234, 'units': 55, 'iso': 80,
        'cats': {'brawler': 3, 'rogue': 1, 'caster': 0, 'tank': 2, 'beast': 0, 'trickster': 0},
        'roster': {'carl': {'stars': 1, 'rank': 2, 'level': 5, 'xp': 30, 'shards': 2},
                   'donut': {'stars': 2, 'rank': 1, 'level': 3, 'xp': 10, 'shards': 0}},
        'active': 'donut',
        'floors': {'1': {'nodes': ['done', 'done', 'open', 'locked', 'locked'], 'boss': 'locked'}},
        'energy': {'n': 4, 'max': 10, 'ts': 1700000000000},
        'arena': {'best': 6, 'streak': 2},
        'leaderboard': [{'viewers': 900, 'champ': 'carl', 'floor': 1, 'date': '2026-10-01'}],
        'pity': {'basic': 3},
        'settings': {'reduceMotion': True, 'haptics': False, 'leftHanded': True, 'useAtlas': False,
                     'sfx': False, 'announcer': True, 'showButtons': True},
        'tutorialDone': True, 'mute': True, 'stats': {'fights': 9, 'wins': 5},
    }

SAVE_KEY = 'carlsArena.v1'
BAK_KEY = 'carlsArena.v1.bak'

# A real v2 save (written by the old build) must load as v3: same values everywhere, same door states.
# These saves predate the keys below, which must arrive at their defaults; everything the save already had must not move.
SETTINGS_SINCE_FIXTURES = {'fighters3d': False}
def field_kept(k, was, now):
    if k != 'settings' or not isinstance(now, dict):
        return now == was
    return {j: now.get(j) for j in was} == was and {j: v for j, v in now.items() if j not in was} == SETTINGS_SINCE_FIXTURES

def check_v2_fixture(pg, raw):
    fails = []
    old = json.loads(raw)
    got = pg.evaluate('JSON.parse(JSON.stringify(Save.data))')
    stored = json.loads(pg.evaluate('window.__origGet.call(localStorage,%s)' % json.dumps(SAVE_KEY)))
    if got.get('v') != 3 or stored.get('v') != 3:
        fails.append('v is %r in memory and %r stored, expected 3' % (got.get('v'), stored.get('v')))
    if 'floors' in got or 'floors' in stored:
        fails.append('a v3 save must not keep the floors key')
    for k, v in old.items():
        if k in ('v', 'floors'):
            continue
        if not field_kept(k, v, got.get(k)):
            fails.append('field %s changed: %r' % (k, got.get(k)))
    for n, fl in old['floors'].items():
        state = pg.evaluate('(()=>{const f=Quest.floor(%s);return f&&{nodes:f.nodes.map(x=>x.state),boss:f.boss.state}})()' % n)
        if state != fl:
            fails.append('floor %s doors are %r, v2 had %r' % (n, state, fl))
    for n in (1, 2):
        want = str(n) in old['floors']
        if pg.evaluate('typeof Quest.unlocked==="function"&&Quest.unlocked(%d)' % n) != want:
            fails.append('Quest.unlocked(%d) should be %r' % (n, want))
    bak = pg.evaluate('window.__origGet.call(localStorage,%s)' % json.dumps(BAK_KEY))
    if bak != raw:
        fails.append('.bak does not hold the original v2 string')
    return fails

def run_saves():
    cases = []
    for k in ('cats', 'energy', 'arena', 'stats'):
        d = played_save()
        d[k] = None
        cases.append({'name': 'null-' + k, 'kind': 'null', 'broken': k, 'raw': json.dumps(d),
                      'orig': played_save()})
    cases.append({'name': 'garbage-string', 'kind': 'bak', 'raw': 'not json {{{'})
    cases.append({'name': 'unknown-version', 'kind': 'bak', 'raw': json.dumps(dict(played_save(), v=99))})
    cases.append({'name': 'read-fails', 'kind': 'readfail', 'raw': json.dumps(played_save())})
    cases.append({'name': 'bak-write-fails', 'kind': 'bakfail', 'raw': 'not json {{{'})
    for name in ('v2_default', 'v2_played'):
        raw = open(os.path.join(ROOT, 'tests', 'fixtures', name + '.json')).read()
        cases.append({'name': 'fixture-' + name, 'kind': 'fixture', 'raw': raw})
    results, any_err = [], False
    with sync_playwright() as p:
        b = p.chromium.launch()
        for c in cases:
            ctx = b.new_context(viewport={'width': 854, 'height': 480})
            seed = ("(()=>{try{if(sessionStorage.getItem('__seeded'))return;sessionStorage.setItem('__seeded','1')}catch(e){}"
                    "const set=Storage.prototype.setItem;set.call(localStorage,%s,%s);"
                    "if(%s)Storage.prototype.setItem=function(k,v){if(k===%s)throw new Error('quota');return set.call(this,k,v)};"
                    "const get=Storage.prototype.getItem;window.__origGet=get;"
                    "if(%s)Storage.prototype.getItem=function(k){if(k===%s)throw new Error('denied');return get.call(this,k)}})()"
                    % (json.dumps(SAVE_KEY), json.dumps(c['raw']),
                       'true' if c['kind'] == 'bakfail' else 'false', json.dumps(BAK_KEY),
                       'true' if c['kind'] == 'readfail' else 'false', json.dumps(SAVE_KEY)))
            ctx.add_init_script(seed)
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.goto(TEST_PAGE)
            started = True
            try:
                pg.wait_for_function('typeof G!=="undefined"', timeout=3000)
            except Exception:
                started = False
            fails = []
            if not started:
                fails.append('game did not start (G missing)')
            else:
                if c['kind'] == 'null':
                    got = pg.evaluate('JSON.parse(JSON.stringify(Save.data))')
                    dflt = pg.evaluate('JSON.parse(JSON.stringify(Meta.defaults()))')
                    if got.get(c['broken']) != dflt[c['broken']]:
                        fails.append('%s not repaired to defaults: %r' % (c['broken'], got.get(c['broken'])))
                    for k, v in c['orig'].items():
                        if k not in (c['broken'], 'v', 'floors') and not field_kept(k, v, got.get(k)):
                            fails.append('field %s changed: %r' % (k, got.get(k)))
                    # A repaired null field must not cost the player the original save.
                    bak = pg.evaluate('window.__origGet.call(localStorage,%s)' % json.dumps(BAK_KEY))
                    if bak != c['raw']:
                        fails.append('.bak does not hold the original v2 string')
                elif c['kind'] == 'fixture':
                    fails.extend(check_v2_fixture(pg, c['raw']))
                else:
                    bak = pg.evaluate('window.__origGet.call(localStorage,%s)' % json.dumps(BAK_KEY))
                    cur = pg.evaluate('window.__origGet.call(localStorage,%s)' % json.dumps(SAVE_KEY))
                    if c['kind'] == 'bak' and bak != c['raw']:
                        fails.append('.bak is %r, expected the original string' % bak)
                    if c['kind'] in ('bakfail', 'readfail') and cur != c['raw']:
                        fails.append('original save was overwritten: %r' % cur)
            if errs:
                fails.append('page/console errors: %s' % errs)
                any_err = True
            results.append({'case': c['name'], 'ok': not fails, 'fails': fails})
            ctx.close()
        b.close()
    print(json.dumps({'saves': results}, indent=1))
    return 1 if any_err or any(not r['ok'] for r in results) else 0

def run_player_smoke():
    """Loads the shipped player page and plays one fight through the game's own loop, with no test
    helpers, so a build that leaks test code or breaks without it fails here."""
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 854, 'height': 480})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto(INDEX)
        pg.wait_for_function('typeof G!=="undefined"')
        html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
        r = pg.evaluate("""(()=>{
          const o={test_undefined:typeof Test==='undefined',
                   title_shown:document.getElementById('title').classList.contains('show')&&G.state==='TITLE'};
          G.sim=true;
          G.startFight({seed:1,p1:'carl',p2:'donut',ai:'brawl',ctrl1:Ctrl.random(1)});
          let frames=0;
          while(G.state!=='RESULT'&&frames<20000){G.tick();frames++}
          o.frames=frames;o.final_state=G.state;return o})()""")
        b.close()
    out = dict(r, no_test_add=('Test.add(' not in html), errors=errors)
    print(json.dumps(out, indent=1))
    ok = (r['test_undefined'] and out['no_test_add'] and r['title_shown']
          and r['final_state'] == 'RESULT' and not errors)
    return 0 if ok else 1

# --touch-heavy: real mouse input on the canvas/buttons (Input's own listeners), stepped frame by
# frame, so a finger's chances at lesson 3 are measured without touching intent.heavy or a Ctrl script.
TOUCH_JS = """(()=>{
  window.TH={n:0,moves:[],events:[],seq:-1,scan:0,
    setup(showButtons){
      localStorage.clear();Save.load();
      Save.data.settings.showButtons=!!showButtons;Save.put();
      G.sim=true;G.startTutorial({seed:1});
      G.fight.p1.moveName='medium';Tutorial.state.step=1;Tutorial.tick(G.fight);G.fight.p1.clearMove();
      G.fit();
      this.n=0;this.moves=[];this.events=[];this.seq=G.fight.p1.moveSeq;this.scan=G.fight.log.length;
      return{state:G.state,mode:G.mode,step:Tutorial.state.step,forceButtons:G.forceButtons}},
    tick(){G.tick();this.n++;const f=G.fight;if(!f)return;
      const p=f.p1,q=f.p2;
      if(p.moveSeq!==this.seq){this.seq=p.moveSeq;
        this.moves.push({t:this.n,move:p.moveName,p2ParryStunnedAtStart:!!q.parryStunned,
          p2StunFramesLeft:q.state==='STUNNED'?q.stun-q.f:null})}
      for(;this.scan<f.log.length;this.scan++){const e=f.log[this.scan];
        this.events.push({t:this.n,type:e.type,by:e.who===1?'p1':'p2',move:e.move||null})}},
    step(n,type,by){for(let i=0;i<n;i++){const before=this.events.length;this.tick();
      if(type&&this.events.slice(before).some(e=>e.type===type&&e.by===by))return{ticks:i+1,seen:true}}
      return{ticks:n,seen:false}},
    summary(){const f=G.fight;return{n:this.n,moves:this.moves,
      events:this.events.filter(e=>/^(parry|punish|hit|block)$/.test(e.type)),
      lessonStep:Tutorial.state.step,punished:Tutorial._punished,p1State:f.p1.state,state:G.state}}};
  return true})()"""

class Touch:
    """One headless 844x390 page with a live lesson-3 tutorial fight and a single mouse pointer."""
    def __init__(self, pg, show_buttons=False):
        self.pg = pg
        pg.evaluate(TOUCH_JS)
        self.setup = pg.evaluate('b=>TH.setup(b)', show_buttons)
        self.rect = pg.evaluate('(()=>{const r=canvas.getBoundingClientRect();return{l:r.left,t:r.top,w:r.width,h:r.height}})()')
        self.down_on = None
    def xy(self, cx, cy):  # canvas coordinates (854x480) to viewport CSS pixels
        r = self.rect
        return r['l'] + cx * r['w'] / 854, r['t'] + cy * r['h'] / 480
    def btn_xy(self, bid):
        return self.pg.evaluate("id=>{const r=document.getElementById(id).getBoundingClientRect();"
                                "return[r.left+r.width/2,r.top+r.height/2]}", bid)
    def top_element(self, x, y):
        return self.pg.evaluate("([x,y])=>{const e=document.elementFromPoint(x,y);return e?(e.id||e.tagName):null}", [x, y])
    def tick(self, n=1):
        return self.pg.evaluate('n=>TH.step(n)', n) if n > 0 else None
    def until(self, etype, by, limit):
        return self.pg.evaluate('([n,t,b])=>TH.step(n,t,b)', [limit, etype, by])['seen']
    def now(self):
        return self.pg.evaluate('TH.n')
    def down(self, x, y):
        self.pg.mouse.move(x, y); self.pg.mouse.down()
    def move(self, x, y):
        self.pg.mouse.move(x, y)
    def up(self):
        self.pg.mouse.up()
    def swipe_right(self, cx, cy, px, frames):
        """Drags px canvas-pixels right over `frames` sim frames in equal steps (one pointermove per frame)."""
        for i in range(1, frames + 1):
            self.tick(1)
            self.move(*self.xy(cx + px * i / frames, cy))
    def summary(self):
        return self.pg.evaluate('TH.summary()')

# ---- opt-in 3D fighters ---------------------------------------------------------------------------
FILES_3D = ('render3d.js', 'three.min.js')
# Asks for a named ANGLE backend so WebGL exists on every host; swiftshader is software GL, so CI needs no GPU.
def angle_args(angle='swiftshader'):
    return ['--use-angle=' + angle, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

# Page-side helpers. Every read happens in the same task as Render.frame, while the WebGL back buffer is still valid.
SMOKE3D_JS = r"""(()=>{window.S3={
  read(x,y,w,h){
    const cv=Render3D.canvas,gl=cv.getContext('webgl2'),sx=cv.width/W,sy=cv.height/H;
    const px=Math.max(0,Math.round(x*sx)),pyTop=Math.max(0,Math.round(y*sy));
    const pw=Math.max(1,Math.min(cv.width-px,Math.round(w*sx))),ph=Math.max(1,Math.min(cv.height-pyTop,Math.round(h*sy)));
    const buf=new Uint8Array(pw*ph*4);
    gl.readPixels(px,cv.height-pyTop-ph,pw,ph,gl.RGBA,gl.UNSIGNED_BYTE,buf);
    let opaque=0,r=0,g=0,b=0,top=Infinity,bottom=-Infinity,left=Infinity,right=-Infinity;
    for(let row=0;row<ph;row++)for(let col=0;col<pw;col++){const i=(row*pw+col)*4;
      if(buf[i+3]>=250){opaque++;r+=buf[i];g+=buf[i+1];b+=buf[i+2];
        const yy=(pyTop+ph-1-row)/sy,xx=(px+col)/sx;
        if(yy<top)top=yy;if(yy>bottom)bottom=yy;if(xx<left)left=xx;if(xx>right)right=xx}}
    const n=opaque||1;
    return{opaque,total:pw*ph,frac:opaque/(pw*ph),r:r/n,g:g/n,b:b/n,lum:(r+g+b)/(3*n),top,bottom,left,right}},
  // A window around one fighter, in 854x480 canvas pixels.
  around(F,half){half=half||100;const s=Camera.toScreen(G.cam,F.x,FLOOR);
    return this.read(s.sx-half,Math.max(0,s.sy-400),half*2,Math.min(H,400+40))},
  spy(){const o={rig:[],stage:0,hud:0,fx:0,frames3d:0};
    const wrap=(obj,k,fn)=>{const orig=obj[k];obj[k]=function(...a){fn(a);return orig.apply(this,a)}};
    wrap(Rig,'draw',a=>o.rig.push(a[1].def.id));
    wrap(Stage,'draw',a=>{o.stage++;if(a[0].canvas===window.canvas||a[0]===Render.ctx)o.stageOnGame=(o.stageOnGame||0)+1});
    wrap(Render,'hud',a=>{o.hud++;if(a[0]===Render3D.top)o.hudOnTop=(o.hudOnTop||0)+1});
    wrap(FX,'draw',a=>{o.fx++;if(a[0]===Render3D.top)o.fxOnTop=(o.fxOnTop||0)+1});
    wrap(Gate3D,'frame',()=>o.frames3d++);
    return o},
  // Two fighters far enough apart that a window around one cannot catch the other.
  apart(f){const m=G.cam.x;f.p1.x=m-215;f.p2.x=m+215;f.p1.face=1;f.p2.face=-1;f.p1.state='IDLE';f.p2.state='IDLE';f.p1.f=0;f.p2.f=0;f.p1.dx=0;f.p2.dx=0},
  gamePixel(x,y){return Array.from(Render.ctx.getImageData(x,y,1,1).data)},
  topPixel(x,y){return Array.from(Render3D.top.getImageData(x,y,1,1).data)},
  fight(opts,every){
    G.sim=true;G.startFight(Object.assign({seed:1,p1:'carl',encounter:'f1_goblin',ctrl1:Ctrl.competent(1)},opts));
    let ticks=0,renders=0,samples=0,minP1=1,minP2=1,hudTop=0;const poses={};
    while(G.state==='FIGHT'&&ticks<30000){G.tick();ticks++;
      if(ticks%every===0&&G.state==='FIGHT'){Render.frame(G.fight);renders++;
        poses[Rig.poseFor(G.fight.p1).key]=1;poses[Rig.poseFor(G.fight.p2).key]=1;
        if(renders%3===0){samples++;
          minP1=Math.min(minP1,this.around(G.fight.p1).frac);minP2=Math.min(minP2,this.around(G.fight.p2).frac);
          hudTop=Math.max(hudTop,this.read(0,0,W,70).opaque)}}}
    return{ticks,renders,samples,minP1,minP2,hudTop,poses:Object.keys(poses),state:G.state}}};
  return true})()"""

# Bones against Rig.solve for every 3D look, pose, a few moments and both facings. Hips, spine and legs must match the
# 2D joints exactly. Arm segments must match exactly too, but the shoulders ride with the torso, as a solid body's do.
# A fall past the 38 degree lean settles onto the floor and a foot the rig sinks bends its knee instead, so those are
# held to staying above the floor.
JOINTS3D_JS = r"""(()=>{const J=['hip','neck','head','lHip','rHip','lKnee','rKnee','lFoot','rFoot'];
  const SEG=[['lShoulder','lElbow'],['lElbow','lHand'],['rShoulder','rElbow'],['rElbow','rHand']];
  let worst=0,where=null,n=0,worstShoulder=0,prone=0,sunk=0,sunkAt=null;
  for(const id in LOOKS){const look=LOOKS[id];if(look.rig==='quad')continue;
    const table=look.rig==='big'?POSES_BIG:POSES;
    for(const key in table)for(const t of[0,.37,1])for(const face of[1,-1]){
      const want=Rig.solve(look,key,t,face),got=Render3D.solveProbe(id,key,t,face);
      const lean=(samplePose(table,key,t).ang.torso||0)+(look.hunch||0);
      if(Math.abs(lean)>=D(38)){prone++;
        for(const b in got){const under=got[b].y;if(under>sunk){sunk=under;sunkAt=[id,key,t,b]}}
        continue}
      const note=(d,w)=>{n++;if(d>worst){worst=d;where=w}};
      for(const b of J){
        const leg=b[0]==='l'||b[0]==='r'?b[0]:null;
        if(leg&&want[leg+'Foot'].y>0){if(got[leg+'Foot'].y>sunk){sunk=got[leg+'Foot'].y;sunkAt=[id,key,t,b]}continue}
        note(Math.hypot(want[b].x-got[b].x,want[b].y-got[b].y),[id,key,t,face,b,want[b],got[b]])}
      for(const[a,b]of SEG)note(Math.hypot((want[b].x-want[a].x)-(got[b].x-got[a].x),(want[b].y-want[a].y)-(got[b].y-got[a].y)),[id,key,t,face,a+'>'+b]);
      // The most a shoulder may stray from the rig's is its own arc around the neck for this lean.
      for(const b of['lShoulder','rShoulder']){
        const allow=(look.shoulderW/2+4)*2*Math.abs(Math.sin(lean/2))+.75;
        worstShoulder=Math.max(worstShoulder,Math.hypot(want[b].x-got[b].x,want[b].y-got[b].y)-allow)}}}
  return{worst,where,n,worstShoulder,prone,sunk,sunkAt}})()"""

# The poses that reach highest, per look, at the zoom the fight camera allows that pose: the figure may never cover the HUD.
TALL3D_JS = r"""(()=>{const out=[];let worst=0;
  for(const id in LOOKS){if(LOOKS[id].rig==='quad'||!DEFS[id])continue;
    G.sim=true;G.startFight({seed:1,p1:id,p2:'goblin',ai:'brawl',ctrl1:Ctrl.script([]),ctrl2:Ctrl.script([])});
    const f=G.fight;S3.apart(f);
    for(const[k,set]of[['heavy',F=>{F.move=MOVES.heavy;F.moveName='heavy';F.state='ATTACK';F.f=0}],
        ['charge',F=>{F.move=MOVES.heavy;F.moveName='heavy';F.state='CHARGE';F.f=F.move.charge}],
        ['win',F=>{F.state='WIN';F.f=30}],['s3',F=>{F.move=MOVES.s3;F.moveName='s3';F.state='ATTACK';F.f=60}]]){
      set(f.p1);
      G.cam.zoom=Math.min(1.12,(Camera.anchorY-HUD_LINE)/Math.max(G.topNow(f.p1),G.topNow(f.p2)));
      Render.frame(f);
      const o=S3.read(0,0,W,70).opaque;if(o>worst)worst=o;if(o)out.push([id,k,o])}
    G.toTitle()}
  return{worst,out}})()"""

def run_3d_case(b, url, viewport=(854, 480), init=None, route=None, allow_load_errors=False, density=1):
    """One fresh page: returns (pg, errors, requests) with G up; the caller closes the context."""
    ctx = b.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, device_scale_factor=density)
    pg = ctx.new_page()
    errors, reqs = [], []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    def on_console(m):
        if m.type == 'error' and not (allow_load_errors and 'Failed to load resource' in m.text):
            errors.append(m.text)
    pg.on('console', on_console)
    pg.on('request', lambda r: reqs.append(r.url))
    if init:
        pg.add_init_script(init)
    if route:
        pg.route(route, lambda r: r.abort())
    pg.goto(url)
    pg.wait_for_function('typeof G!=="undefined"')
    return ctx, pg, errors, reqs

def wait_3d(pg, timeout=15000):
    try:
        pg.wait_for_function('typeof Gate3D!=="undefined"&&Gate3D.active()', timeout=timeout)
        return True
    except Exception:
        return False

def settles(pg, js, timeout=8000):
    """True once the page condition holds; other agents load this machine, so a fixed sleep isn't enough."""
    try:
        pg.wait_for_function(js, timeout=timeout)
        return True
    except Exception:
        return False

def asked_for_3d(reqs):
    return [u for u in reqs if u.rsplit('/', 1)[-1].split('?')[0] in FILES_3D]

def smoke_viewport(b, size):
    """The real fight at one viewport size; returns the dict of named boolean checks plus details."""
    ctx, pg, errors, reqs = run_3d_case(b, TEST_PAGE + '?3d=1', viewport=size)
    active = wait_3d(pg)
    c = {'gate_active': active}
    d = {}
    if active:
        pg.evaluate('localStorage.clear();Save.load()')
        pg.evaluate(SMOKE3D_JS)
        r = pg.evaluate("""(()=>{
          const gc=canvas,cv=Render3D.canvas,o={};
          o.script_loaded=typeof THREE==='object'&&typeof Render3D==='object';
          o.is_webgl2=!!cv.getContext('webgl2');
          const a=gc.getBoundingClientRect(),b=cv.getBoundingClientRect();
          o.rect=[a.left,a.top,a.width,a.height,b.left,b.top,b.width,b.height];
          o.canvas_over=Math.abs(a.left-b.left)<=.5&&Math.abs(a.top-b.top)<=.5&&Math.abs(a.width-b.width)<=.5&&Math.abs(a.height-b.height)<=.5;
          G.sim=true;G.startFight({seed:1,p1:'carl',encounter:'f1_goblin'});
          o.no_input_steal=getComputedStyle(cv).pointerEvents==='none'&&document.elementFromPoint(a.left+a.width/2,a.top+a.height*.62)===gc;
          G.toTitle();
          const after=(x,y)=>!!(x.compareDocumentPosition(y)&Node.DOCUMENT_POSITION_FOLLOWING);
          o.layers_in_order=after(gc,cv)&&after(cv,Render3D.topCanvas)&&after(Render3D.topCanvas,document.getElementById('btns'));
          o.top_layer_no_input=getComputedStyle(Render3D.topCanvas).pointerEvents==='none';
          o.smooth_scaling=getComputedStyle(cv).imageRendering!=='pixelated';
          const roster=Object.keys(LOOKS).map(id=>[id,LOOKS[id].rig,!!Render3D.figureFor(id)]);
          o.figures=roster;
          o.human_big_have_figures=roster.filter(r=>r[1]!=='quad').every(r=>r[2]);
          o.quads_fall_back=roster.filter(r=>r[1]==='quad').every(r=>!r[2])&&roster.some(r=>r[1]==='quad');
          return o})()""")
        d['rect'] = r.pop('rect'); d['figures'] = r.pop('figures')
        c.update(r)
        c['requested_both_files'] = len(set(u.rsplit('/', 1)[-1] for u in asked_for_3d(reqs))) == 2
        j = pg.evaluate(JOINTS3D_JS)
        d['joints'] = j
        c['joints_match_rig_solve'] = j['n'] > 1000 and j['worst'] <= 0.75 and j['worstShoulder'] <= 0
        c['falls_stay_above_floor'] = j['prone'] > 10 and j['sunk'] <= 30
        # World-to-screen must agree with the 2D camera at the zooms a fight reaches, including shake.
        m = pg.evaluate("""(()=>{G.sim=true;G.startFight({seed:1,p1:'carl',encounter:'f1_goblin'});
          let worst=0;const f=G.fight;
          for(const zoom of[1,1.12,1.28])for(const x of[G.cam.x-200,G.cam.x,G.cam.x+200])for(const y of[FLOOR,FLOOR-180]){
            G.cam.zoom=zoom;Render.frame(f);
            const p=Render3D.project(x,y),s=Camera.toScreen(G.cam,x,y);
            worst=Math.max(worst,Math.hypot(p.sx-s.sx,p.sy-s.sy))}
          FX.shake.x=9;FX.shake.y=-5;Render.frame(f);
          const p=Render3D.project(G.cam.x,FLOOR),s=Camera.toScreen(G.cam,G.cam.x,FLOOR);
          const shook=Math.hypot(p.sx-(s.sx+9),p.sy-(s.sy-5));
          FX.shake.x=0;FX.shake.y=0;G.cam.zoom=1;
          return{worst,shook}})()""")
        d['projection'] = m
        c['projection_matches_camera'] = m['worst'] <= 1
        c['projection_follows_shake'] = m['shook'] <= 1
        # Facing, floor line and each fighter's own column, read from drawn pixels with the two far apart.
        p = pg.evaluate("""(()=>{const f=G.fight;S3.apart(f);Render.frame(f);
          const a=S3.around(f.p1,110),b=S3.around(f.p2,110);
          const fy=Camera.toScreen(G.cam,0,FLOOR).sy;
          const sa=Camera.toScreen(G.cam,f.p1.x,FLOOR).sx,sb=Camera.toScreen(G.cam,f.p2.x,FLOOR).sx;
          const out={a,b,fy,sa,sb};
          const a1=S3.read(sa,0,110,H).opaque,a0=S3.read(sa-110,0,110,H).opaque;
          f.p1.face=-1;Render.frame(f);
          out.flip=[a0,a1,S3.read(sa-110,0,110,H).opaque,S3.read(sa,0,110,H).opaque];f.p1.face=1;
          return out})()""")
        d['placement'] = p
        c['both_fighters_opaque'] = p['a']['frac'] > 0.02 and p['b']['frac'] > 0.02
        c['feet_on_floor_line'] = abs(p['a']['bottom'] - p['fy']) <= 24 and abs(p['b']['bottom'] - p['fy']) <= 24
        c['centered_on_fighter_x'] = (abs((p['a']['left'] + p['a']['right']) / 2 - p['sa']) <= 40
                                      and abs((p['b']['left'] + p['b']['right']) / 2 - p['sb']) <= 40)
        c['face_flip_mirrors'] = abs(p['flip'][0] - p['flip'][3]) <= 0.2 * max(p['flip'][0], 1) and abs(p['flip'][1] - p['flip'][2]) <= 0.2 * max(p['flip'][1], 1)
        # Hit flash, torch tint and KO all have to show up in the pixels of the 3D figure.
        fx = pg.evaluate("""(()=>{const f=G.fight,F=f.p2;S3.apart(f);
          Render.frame(f);const idle=S3.around(F);
          F.state='HITSTUN';F.f=0;F.stun=20;Render.frame(f);const flash=S3.around(F);F.state='IDLE';F.f=0;
          const saved=Stage.lightAt;
          Stage.lightAt=()=>({tint:'#ff2000',k:1,rimSide:1});Render.frame(f);const red=S3.around(F);
          Stage.lightAt=()=>({tint:'#0030ff',k:1,rimSide:1});Render.frame(f);const blue=S3.around(F);
          Stage.lightAt=saved;
          F.state='KO';F.f=20;Render.frame(f);const ko=S3.around(F);F.state='IDLE';F.f=0;Render.frame(f);
          const keep=o=>({lum:o.lum,r:o.r,b:o.b,top:o.top,bottom:o.bottom,frac:o.frac});
          return{idle:keep(idle),flash:keep(flash),red:keep(red),blue:keep(blue),ko:keep(ko)}})()""")
        d['reads'] = fx
        c['hit_flash_reads'] = fx['flash']['lum'] >= fx['idle']['lum'] * 1.25
        c['torch_tint_reads'] = (fx['red']['r'] - fx['red']['b']) > (fx['blue']['r'] - fx['blue']['b']) + 8
        c['ko_lies_down'] = fx['ko']['top'] - fx['idle']['top'] >= 0.35 * (fx['idle']['bottom'] - fx['idle']['top'])
        # The real fight, Carl vs the floor-1 goblin, to RESULT with the spies on.
        g = pg.evaluate("""(()=>{const o=S3.spy();const r=S3.fight({},8);
          Render.frame(G.fight);
          return{r,rig:o.rig,stage:o.stage,hud:o.hud,fx:o.fx,frames3d:o.frames3d,stageOnGame:o.stageOnGame||0,hudOnTop:o.hudOnTop||0,fxOnTop:o.fxOnTop||0,
            portrait:S3.topPixel(46,42),stagePx:S3.gamePixel(427,300),topMiddle:S3.topPixel(427,300)}})()""")
        d['fight'] = dict(g['r'], rig_draws=len(g['rig']), stage=g['stage'], hud=g['hud'], fx=g['fx'], frames3d=g['frames3d'],
                          portrait=g['portrait'], stage_px=g['stagePx'], top_middle=g['topMiddle'])
        fr = g['r']
        c['fight_reached_result'] = fr['state'] == 'RESULT' and fr['renders'] > 20
        c['poses_varied'] = len(fr['poses']) >= 4
        c['drew_both_every_sample'] = fr['samples'] > 5 and fr['minP1'] > 0.02 and fr['minP2'] > 0.02
        c['no_2d_bodies'] = len(g['rig']) == 0
        c['stage_hud_fx_on_2d'] = g['stage'] >= fr['renders'] and g['hud'] >= fr['renders'] and g['fx'] >= fr['renders'] and g['frames3d'] >= fr['renders']
        c['stage_on_game_canvas'] = g['stageOnGame'] >= fr['renders'] and g['stagePx'][3] == 255 and sum(g['stagePx'][:3]) > 0
        c['hud_and_fx_above_figures'] = g['hudOnTop'] >= fr['renders'] and g['fxOnTop'] >= fr['renders'] and g['portrait'][3] == 255 and g['topMiddle'][3] < 128
        c['hud_stays_clear_of_figures'] = fr['hudTop'] == 0
        t = pg.evaluate(TALL3D_JS)
        d['tall_poses'] = t
        c['tall_poses_clear_hud'] = t['worst'] == 0
        # The layer has to follow G.fit when the window changes.
        pg.set_viewport_size({'width': size[0] - 120, 'height': size[1] - 60})
        c['follows_resize'] = settles(pg, """(()=>{const a=canvas.getBoundingClientRect(),b=Render3D.canvas.getBoundingClientRect();
          return innerWidth===%d&&Math.abs(a.left-b.left)<=.5&&Math.abs(a.top-b.top)<=.5&&Math.abs(a.width-b.width)<=.5&&Math.abs(a.height-b.height)<=.5})()""" % (size[0] - 120))
    c['no_errors'] = not errors
    d['errors'] = errors
    ctx.close()
    return c, d

def smoke_fallbacks(b):
    """Every way 3D can be off or broken: the game must play in 2D with no error."""
    checks, details = {}, {}
    FIGHT = """(()=>{G.sim=true;const rig=[];const orig=Rig.draw;Rig.draw=function(c,F,...r){rig.push(F.def.id);return orig.call(this,c,F,...r)};
      G.startFight({seed:1,p1:'carl',encounter:'f1_goblin',ctrl1:Ctrl.competent(1)});
      let n=0;while(G.state==='FIGHT'&&n<30000){G.tick();n++;if(n%40===0&&G.state==='FIGHT')Render.frame(G.fight)}
      Rig.draw=orig;return{state:G.state,ticks:n,carl:rig.filter(x=>x==='carl').length,goblin:rig.filter(x=>x==='goblin').length,
        webgl_canvases:document.querySelectorAll('#wrap>canvas').length-1}})()"""
    # No flag: not one 3D request, no WebGL context, on both pages, through a real fight.
    probe = ("window.__webgl=0;const __gc=HTMLCanvasElement.prototype.getContext;"
             "HTMLCanvasElement.prototype.getContext=function(k,...r){if(/webgl/i.test(k))window.__webgl++;return __gc.call(this,k,...r)};")
    for name, url in (('test_page', TEST_PAGE), ('player_page', INDEX)):
        ctx, pg, errors, reqs = run_3d_case(b, url, init=probe)
        pg.evaluate('localStorage.clear();Save.load()')
        r = pg.evaluate(FIGHT)
        pg.wait_for_timeout(100)
        checks['no_flag_%s_requests_nothing' % name] = not asked_for_3d(reqs)
        checks['no_flag_%s_no_webgl_context' % name] = pg.evaluate('window.__webgl') == 0
        checks['no_flag_%s_draws_2d' % name] = r['state'] == 'RESULT' and r['carl'] > 0 and r['goblin'] > 0 and r['webgl_canvases'] == 0
        checks['no_flag_%s_no_errors' % name] = not errors
        details['no_flag_' + name] = dict(r, errors=errors)
        ctx.close()
    # WebGL unavailable: getContext returns null, the flag is on, the game must not care.
    noctx = ("const __gc=HTMLCanvasElement.prototype.getContext;"
             "HTMLCanvasElement.prototype.getContext=function(k,...r){if(/webgl/i.test(k))return null;return __gc.call(this,k,...r)};")
    ctx, pg, errors, reqs = run_3d_case(b, TEST_PAGE + '?3d=1', init=noctx)
    pg.wait_for_timeout(300)
    pg.evaluate('localStorage.clear();Save.load()')
    r = pg.evaluate(FIGHT)
    checks['no_webgl_inactive'] = pg.evaluate('typeof Gate3D!=="undefined"&&Gate3D.active()===false')
    checks['no_webgl_draws_2d'] = r['state'] == 'RESULT' and r['carl'] > 0 and r['goblin'] > 0
    checks['no_webgl_no_errors'] = not errors
    details['no_webgl'] = dict(r, errors=errors, requested=asked_for_3d(reqs))
    ctx.close()
    # The bundle can't be fetched (offline, or a partial deploy): 2D, and the only noise is the browser's own failed-load line.
    ctx, pg, errors, reqs = run_3d_case(b, TEST_PAGE + '?3d=1', route='**/three.min.js', allow_load_errors=True)
    pg.wait_for_timeout(500)
    pg.evaluate('localStorage.clear();Save.load()')
    r = pg.evaluate(FIGHT)
    checks['missing_bundle_inactive'] = pg.evaluate('typeof Gate3D!=="undefined"&&Gate3D.active()===false')
    checks['missing_bundle_draws_2d'] = r['state'] == 'RESULT' and r['carl'] > 0 and r['goblin'] > 0
    checks['missing_bundle_no_errors'] = not errors
    details['missing_bundle'] = dict(r, errors=errors)
    ctx.close()
    # A phone can drop the GL context at any time: the fighters must come back in 2D on the next frame.
    ctx, pg, errors, reqs = run_3d_case(b, TEST_PAGE + '?3d=1')
    if wait_3d(pg):
        r = pg.evaluate("""(()=>{G.sim=true;G.startFight({seed:1,p1:'carl',encounter:'f1_goblin'});Render.frame(G.fight);
          const gl=Render3D.canvas.getContext('webgl2');window.__lose=gl.getExtension('WEBGL_lose_context');
          window.__lose.loseContext();return true})()""")
        settles(pg, 'Gate3D.lost===true')
        r = pg.evaluate("""(()=>{const rig=[];const orig=Rig.draw;Rig.draw=function(c,F,...r){rig.push(F.def.id);return orig.call(this,c,F,...r)};
          Render.frame(G.fight);Rig.draw=orig;return{active:Gate3D.active(),rig}})()""")
        checks['context_lost_falls_back'] = (not r['active']) and 'carl' in r['rig'] and 'goblin' in r['rig']
        pg.evaluate('window.__lose.restoreContext()')
        settles(pg, 'Gate3D.lost===false')
        r2 = pg.evaluate("""(()=>{const rig=[];const orig=Rig.draw;Rig.draw=function(c,F,...r){rig.push(F.def.id);return orig.call(this,c,F,...r)};
          Render.frame(G.fight);Rig.draw=orig;return{active:Gate3D.active(),rig}})()""")
        checks['context_restored_returns'] = r2['active'] and not r2['rig']
    else:
        checks['context_lost_falls_back'] = False
        checks['context_restored_returns'] = False
    checks['context_lost_no_errors'] = not errors
    details['context_lost_errors'] = errors
    ctx.close()
    # Per-look fallback: a quad stays 2D, reflection included, next to a 3D Carl.
    ctx, pg, errors, reqs = run_3d_case(b, TEST_PAGE + '?3d=1')
    if wait_3d(pg):
        pg.evaluate(SMOKE3D_JS)
        r = pg.evaluate("""(()=>{const o=S3.spy();G.sim=true;G.startFight({seed:1,p1:'carl',p2:'donut',ai:'brawl'});const f=G.fight;S3.apart(f);
          Render.frame(f);return{rig:o.rig,carl:S3.around(f.p1).frac,donut:S3.around(f.p2).frac,handlesDonut:Gate3D.handles(f.p2),handlesCarl:Gate3D.handles(f.p1)}})()""")
        checks['quad_draws_2d_with_reflection'] = r['rig'].count('donut') == 2 and 'carl' not in r['rig']
        checks['quad_not_on_webgl'] = r['donut'] == 0 and r['carl'] > 0.02 and r['handlesCarl'] and not r['handlesDonut']
        details['quad'] = r
    else:
        checks['quad_draws_2d_with_reflection'] = False
        checks['quad_not_on_webgl'] = False
    checks['quad_no_errors'] = not errors
    ctx.close()
    # The Settings toggle, by click: on loads and draws in 3D without a reload, off goes straight back to 2D.
    ctx, pg, errors, reqs = run_3d_case(b, TEST_PAGE)
    pg.evaluate('localStorage.clear();Save.load();Screens.settings()')
    has_btn = pg.evaluate("!!document.getElementById('set_fighters3d')")
    checks['toggle_row_exists'] = has_btn
    if has_btn:
        pg.click('#set_fighters3d')
        on = wait_3d(pg)
        checks['toggle_on_loads_3d'] = on
        if on:
            r = pg.evaluate("""(()=>{G.sim=true;G.startFight({seed:1,p1:'carl',encounter:'f1_goblin'});const rig=[];const orig=Rig.draw;
              Rig.draw=function(c,F,...r){rig.push(F.def.id);return orig.call(this,c,F,...r)};Render.frame(G.fight);const on3d=rig.length;
              G.toTitle();Screens.settings();document.getElementById('set_fighters3d').click();
              G.startFight({seed:1,p1:'carl',encounter:'f1_goblin'});rig.length=0;Render.frame(G.fight);const off2d=rig.length;
              const hidden=getComputedStyle(Render3D.canvas).display==='none'||!Render3D.canvas.isConnected;
              Rig.draw=orig;return{on3d,off2d,hidden,active:Gate3D.active()}})()""")
            checks['toggle_on_no_2d_bodies'] = r['on3d'] == 0
            checks['toggle_off_back_to_2d'] = r['off2d'] > 0 and r['hidden'] and not r['active']
            details['toggle'] = r
    else:
        checks['toggle_on_loads_3d'] = False
    checks['toggle_no_errors'] = not errors
    ctx.close()
    # The player page itself plays a whole fight in 3D, with no test helpers around it.
    ctx, pg, errors, reqs = run_3d_case(b, INDEX + '?3d=1')
    on = wait_3d(pg)
    checks['player_page_3d_active'] = on
    if on:
        r = pg.evaluate(FIGHT)
        checks['player_page_3d_reaches_result'] = r['state'] == 'RESULT' and r['carl'] == 0 and r['goblin'] == 0
        details['player_page_3d'] = r
    checks['player_page_3d_no_errors'] = not errors
    ctx.close()
    return checks, details

def run_3d_frame_times(b, frames, angle, phone=False):
    """ms/frame for the same seeded fight down both paths. Canvas readback would swamp the numbers on a real GPU, so there are
    three plain ones: JS time in Render.frame, the extra wait for WebGL to finish (3D only), and real rAF pacing with the
    browser compositing every layer, which is the one that includes the 2D canvas's own raster."""
    STEP_JS = """([n,three])=>{G.sim=true;let s=1,t=0,tGl=0;
      const start=seed=>G.startFight({seed,p1:'carl',encounter:'f1_goblin',ctrl1:Ctrl.competent(seed)});
      start(s);const gl=three?Render3D.canvas.getContext('webgl2'):null,px=new Uint8Array(4);
      for(let i=0;i<n;i++){G.tick();
        const a=performance.now();Render.frame(G.fight);const c=performance.now();
        if(gl)gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
        const e=performance.now();t+=c-a;tGl+=e-c;
        if(G.state==='RESULT'){s++;start(s)}}
      let renderer=null;if(gl){const x=gl.getExtension('WEBGL_debug_renderer_info');renderer=x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):'?'}
      return{ms_render_js:t/n,ms_webgl_finish:tGl/n,ms_cpu_gpu:(t+tGl)/n,renderer}}"""
    RAF_JS = """n=>new Promise(done=>{G.sim=true;let s=100,last=0,count=0,sum=0,long=0;
      const start=seed=>G.startFight({seed,p1:'carl',encounter:'f1_goblin',ctrl1:Ctrl.competent(seed)});
      start(s);
      const step=t=>{if(last){const d=t-last;sum+=d;count++;if(d>20)long++}last=t;
        G.tick();if(G.state==='RESULT'){s++;start(s)}
        if(count<n)requestAnimationFrame(step);else done({raf_ms:sum/count,raf_frames_over_20ms:long,raf_frames:count})};
      requestAnimationFrame(step)})"""
    out = {'frames': frames, 'angle': angle}
    # phone=True is a landscape phone at 2x: the WebGL buffer a real one would fill, which is where the 3D path pays.
    size, density = ((844, 390), 2) if phone else ((854, 480), 1)
    out['viewport'] = [size[0], size[1], density]
    ctx, pg, errors, _ = run_3d_case(b, TEST_PAGE, viewport=size, density=density)
    pg.evaluate('localStorage.clear();Save.load()')
    out['2d'] = pg.evaluate(STEP_JS, [frames, False])
    out['2d'].update(pg.evaluate(RAF_JS, frames))
    errs2 = list(errors)
    ctx.close()
    ctx, pg, errors, _ = run_3d_case(b, TEST_PAGE + '?3d=1', viewport=size, density=density)
    ok = wait_3d(pg)
    if ok:
        pg.evaluate('localStorage.clear();Save.load()')
        out['3d'] = pg.evaluate(STEP_JS, [frames, True])
        out['3d'].update(pg.evaluate(RAF_JS, frames))
        out['3d_info'] = pg.evaluate('(()=>{const c=Render3D.canvas;return{buffer:[c.width,c.height],calls:Render3D.renderer.info.render.calls,triangles:Render3D.renderer.info.render.triangles}})()')
    ctx.close()
    # GL driver chatter about the deliberate readback is not a game error.
    out['errors'] = [e for e in errs2 + errors if 'GPU stall due to ReadPixels' not in e]
    return out, ok

def run_3d_smoke(frames=300):
    report = {'viewports': {}}
    failed = []
    missing = [n for n in FILES_3D if not os.path.exists(os.path.join(ROOT, n))]
    report['files'] = {n: (os.path.getsize(os.path.join(ROOT, n)) if n not in missing else None) for n in FILES_3D}
    if missing:
        failed.append('files_exist: ' + ','.join(missing))
    with sync_playwright() as p:
        b = p.chromium.launch(args=angle_args())
        for size in ((854, 480), (844, 390)):
            c, d = smoke_viewport(b, size)
            key = '%dx%d' % size
            report['viewports'][key] = {'checks': c, 'details': d}
            failed += ['%s: %s' % (key, k) for k, v in c.items() if not v]
        c, d = smoke_fallbacks(b)
        report['fallbacks'] = {'checks': c, 'details': d}
        failed += ['fallbacks: %s' % k for k, v in c.items() if not v]
        times, ok = run_3d_frame_times(b, frames, 'swiftshader')
        report['frame_time'] = times
        if not ok or times['errors']:
            failed.append('frame_time')
        b.close()
    report['failed'] = failed
    print(json.dumps(report, indent=1))
    return 1 if failed else 0

def run_3d_perf(frames, angle):
    with sync_playwright() as p:
        b = p.chromium.launch(args=angle_args(angle))
        desk, ok = run_3d_frame_times(b, frames, angle)
        phone, ok2 = run_3d_frame_times(b, frames, angle, phone=True)
        b.close()
    print(json.dumps({'desktop_854x480': desk, 'phone_844x390_2x': phone}, indent=1))
    return 0 if ok and ok2 and not desk['errors'] and not phone['errors'] else 1

# Scripted so the 2D and 3D shots land on the same frames of the same fight: the sim doesn't read which renderer is on.
SHOT3D_JS = """which=>{localStorage.clear();Save.load();G.sim=true;
  G.startFight({seed:3,p1:'carl',encounter:'f1_goblin',ctrl1:Ctrl.script([{f:40,until:1800,intent:{light:true}}])});
  const f=G.fight;f.p1.x=G.cam.x-62;f.p2.x=G.cam.x+62;
  const snap=()=>{FX.flash=0};
  if(which==='idle'){for(let i=0;i<30;i++)G.tick();f.p2.state='IDLE';f.p2.f=8;snap();return{p1:f.p1.state,p2:f.p2.state,frame:f.frame}}
  for(let i=0;i<400;i++){G.tick();if(f.p2.state==='HITSTUN'&&f.p2.f>=1&&f.p2.f<3&&f.p1.state==='ATTACK')break}
  snap();return{p1:f.p1.state,p2:f.p2.state,frame:f.frame}}"""

def run_3d_shots(out_dir):
    results = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=angle_args())
        for name, url, which, three in (('carls-3d-idle.png', TEST_PAGE + '?3d=1', 'idle', True),
                                        ('carls-3d-hit.png', TEST_PAGE + '?3d=1', 'hit', True),
                                        ('carls-2d-idle.png', TEST_PAGE, 'idle', False),
                                        ('carls-2d-hit.png', TEST_PAGE, 'hit', False)):
            ctx, pg, errors, _ = run_3d_case(b, url)
            if three and not wait_3d(pg):
                results[name] = 'no 3D'
                ctx.close()
                continue
            info = pg.evaluate(SHOT3D_JS, which)
            pg.wait_for_timeout(250)  # G.loop keeps redrawing the frozen sim, so the screenshot has a fresh frame
            path = os.path.join(out_dir, name)
            pg.screenshot(path=path)
            results[name] = dict(info, path=path, errors=errors)
            ctx.close()
        b.close()
    print(json.dumps(results, indent=1))
    return 1 if any(isinstance(r, str) or r['errors'] for r in results.values()) else 0

def score(sm):
    """Ranks one attempt: lesson done > a heavy that started on a parry-stunned foe > any heavy > a parry."""
    ev = sm['events']
    parried = any(e['type'] == 'parry' and e['by'] == 'p1' for e in ev)
    heavies = [m for m in sm['moves'] if m['move'] == 'heavy']
    on_stunned = [m for m in heavies if m['p2ParryStunnedAtStart']]
    return (int(sm['lessonStep'] >= 3), int(bool(on_stunned)), int(bool(heavies)), int(parried))

def digest(params, sm):
    ev = sm['events']
    first = lambda ty, by: next((e['t'] for e in ev if e['type'] == ty and e['by'] == by), None)
    heavies = [m for m in sm['moves'] if m['move'] == 'heavy']
    return {'params': params,
            'playerMoves': [{'t': m['t'], 'move': m['move']} for m in sm['moves']],
            'dummyHitPlayerT': first('hit', 'p2'), 'parryT': first('parry', 'p1'),
            'heavyStartT': heavies[0]['t'] if heavies else None,
            'parryStunnedWhenHeavyStarted': heavies[0]['p2ParryStunnedAtStart'] if heavies else None,
            'stunFramesLeftWhenHeavyStarted': heavies[0]['p2StunFramesLeft'] if heavies else None,
            'playerHits': [{'t': e['t'], 'move': e['move']} for e in ev if e['type'] == 'hit' and e['by'] == 'p1'],
            'punishT': first('punish', 'p1'), 'lessonDone': sm['lessonStep'] >= 3,
            'lessonStep': sm['lessonStep'] + 1}

def run_touch_heavy():
    errors = []
    results = {}
    SPOT = (250, 300)   # canvas px, open floor left of the fighters; no overlay sits on it
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 844, 'height': 390})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto(TEST_PAGE)
        pg.wait_for_function('typeof G!=="undefined"')

        def fresh(show_buttons=False):
            return Touch(pg, show_buttons)

        # Calibration: with no input the dummy's first scripted kick connects on the player at frame H.
        t = fresh(); t.tick(200); cal = t.summary()
        H = next((e['t'] for e in cal['events'] if e['type'] == 'hit' and e['by'] == 'p2'), None)
        spot_xy = t.xy(*SPOT)
        results['calibration'] = {'dummyKickConnectsAtFrame': H, 'viewport': '844x390',
                                  'canvasCssRect': t.rect, 'elementUnderThumbSpot': t.top_element(*spot_xy),
                                  'lesson3ForcesButtons': t.setup['forceButtons'],
                                  'elementUnderButtonCentres': {i: t.top_element(*t.btn_xy(i)) for i in
                                                                ('btnBlock', 'btnHeavy', 'btnKick', 'btnPower')},
                                  'hint': 'frames are sim ticks since lesson 3 began; 60 per second'}

        def attempts(label, runs, passed):
            """runs: list of (params, fn(touch)->None). Keeps every digest's counts and the best run."""
            tally = {'tried': len(runs), 'parried': 0, 'heavyStarted': 0, 'heavyOnStunnedFoe': 0, 'punished': 0}
            by_variant = {}
            best = None
            for params, fn in runs:
                t = fresh()
                fn(t)
                sm = t.summary()
                d = digest(params, sm)
                tally['parried'] += d['parryT'] is not None
                tally['heavyStarted'] += d['heavyStartT'] is not None
                tally['heavyOnStunnedFoe'] += bool(d['parryStunnedWhenHeavyStarted'])
                tally['punished'] += d['punishT'] is not None
                v = by_variant.setdefault(params.get('variant', 'all'), {'tried': 0, 'parried': 0, 'heavyStarted': 0, 'punished': 0})
                v['tried'] += 1; v['parried'] += d['parryT'] is not None
                v['heavyStarted'] += d['heavyStartT'] is not None; v['punished'] += d['punishT'] is not None
                if best is None or score(sm) > best[0]:
                    best = (score(sm), d)
            results[label] = dict(tally, byVariant=by_variant, passed=bool(passed(best[1])), best=best[1])

        # (a) a heavy from standing: the HEAVY button, and the older swipe right and keep holding.
        def run_a_button(hold):
            def fn(t):
                t.tick(10); t.down(*t.btn_xy('btnHeavy')); t.tick(hold); t.up(); t.tick(40)
            return fn
        def run_a_swipe(px, frames):
            def fn(t):
                t.tick(10); t.down(*t.xy(*SPOT)); t.swipe_right(*SPOT, px, frames); t.tick(70); t.up(); t.tick(5)
            return fn
        runs_a = [({'variant': 'heavy_button', 'holdFrames': h}, run_a_button(h)) for h in (12, 30, 60)]
        runs_a += [({'variant': 'swipe_right_and_hold', 'swipePx': px, 'swipeFrames': fr}, run_a_swipe(px, fr))
                   for px, fr in ((50, 2), (90, 4), (150, 8))]
        attempts('a_heavy_from_standing', runs_a, lambda d: d['heavyStartT'] is not None)
        va = results['a_heavy_from_standing']['byVariant']
        results['a_heavy_from_standing']['passed'] = all(v['heavyStarted'] == v['tried'] for v in va.values())

        def punished(d):
            return d['lessonDone'] and d['punishT'] is not None

        # (b) lesson 3 as its prompt says, with the buttons: BLOCK as the kick connects, then hold HEAVY.
        def run_b(k, g, hold):
            def fn(t):
                bx, by = t.btn_xy('btnBlock'); hx, hy = t.btn_xy('btnHeavy')
                t.tick(H - k); t.down(bx, by)
                if t.until('parry', 'p1', k + 30):
                    t.tick(g); t.up(); t.tick(1); t.down(hx, hy); t.tick(hold)
                t.up(); t.tick(5)
            return fn
        attempts('b_block_button_then_heavy_button',
                 [({'pressFramesBeforeHit': k, 'framesAfterParry': g, 'heavyHoldFrames': hold}, run_b(k, g, hold))
                  for k in range(1, 9) for g in (0, 3) for hold in (40, 70)], punished)

        # (c) a gesture parry (hold on the canvas), then the HEAVY button.
        def run_c(k, g, hold):
            def fn(t):
                hx, hy = t.btn_xy('btnHeavy')
                t.tick(H - k); t.down(*t.xy(*SPOT))
                if t.until('parry', 'p1', k + 30):
                    t.tick(g); t.up(); t.tick(1); t.down(hx, hy); t.tick(hold)
                t.up(); t.tick(5)
            return fn
        attempts('c_canvas_hold_parry_then_heavy_button',
                 [({'pressFramesBeforeHit': k, 'framesAfterParry': g, 'heavyHoldFrames': hold}, run_c(k, g, hold))
                  for k in range(9, 17) for g in (0, 3) for hold in (40, 70)], punished)
        # (d) press HEAVY, drag off onto the canvas and let go there: the hold must end with the touch.
        def run_d(t):
            hx, hy = t.btn_xy('btnHeavy')
            t.tick(10); t.down(hx, hy); t.tick(3); t.move(*t.xy(*SPOT)); t.up()
            t.stuck = t.pg.evaluate('Input.held.heavy'); t.tick(40)
        t = fresh(); run_d(t); sm = t.summary()
        d = digest({'variant': 'press_heavy_drag_off_release_on_canvas'}, sm)
        results['d_heavy_drag_off_button'] = {'heldHeavyAfterRelease': t.stuck, 'passed': not t.stuck, 'best': d}
        b.close()
    out = {'errors': errors, 'results': results}
    print(json.dumps(out, indent=1))
    ok = all(v['passed'] for k, v in results.items() if k != 'calibration')
    return 1 if errors or not ok else 0

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
    ap.add_argument('--journey', action='store_true',
                     help="reset the save and earn every resource the way a player does (tutorial, "
                          "campaign, arena streaks, crystals, shop catalyst, no debug grants) until "
                          "each champion has ranked up once; see build_journey_js")
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
    ap.add_argument('--player-smoke', action='store_true',
                     help="load the player page (index.html): no test code in it, the game starts on "
                          "the title screen, one real fight plays to RESULT, no page/console errors")
    ap.add_argument('--3d-smoke', dest='smoke3d', action='store_true',
                    help='the opt-in 3D fighters: real fights, fallbacks, no-flag no-request check, ms/frame; exit 1 on any failure')
    ap.add_argument('--3d-perf', dest='perf3d', type=int, default=None, metavar='N',
                    help='ms/frame over N frames for the 2D path next to the 3D path')
    ap.add_argument('--3d-shots', dest='shots3d', default=None, metavar='DIR',
                    help='write the 2D and 3D comparison screenshots into DIR')
    ap.add_argument('--angle', default='swiftshader', help='ANGLE backend for --3d-perf (metal uses a real GPU on a Mac)')
    ap.add_argument('--saves', action='store_true',
                     help="seed damaged saves into localStorage before any game script runs and check "
                          "the game starts, only the broken record is repaired, unreadable saves are "
                          "backed up, and a failed backup leaves the original untouched; prints JSON "
                          "and exits 1 on any failed case or page/console error")
    ap.add_argument('--touch-heavy', action='store_true',
                     help="drives real mouse input (canvas gestures and the on-screen buttons) through a "
                          "live lesson 3 at 844x390 and reports, for three attempts (heavy from standing "
                          "by the HEAVY button and by swipe-and-hold; BLOCK button then HEAVY button; "
                          "canvas-hold parry then HEAVY button), what the player did, whether the foe "
                          "was still parry-stunned when a heavy started and whether 'punish' fired; "
                          "exits 1 if either lesson attempt cannot finish lesson 3 with a punish")
    ap.add_argument('--tutorial-fit', action='store_true',
                     help="at 854x480, 844x390, 667x375 and 568x320 CSS px, shows every tutorial prompt "
                          "(plain, and with its stall hint appended as the game does) in a real tutorial "
                          "fight and asserts #tutorialPrompt sits fully inside the canvas and viewport "
                          "and clear of #tutorialLesson; --shot PATH screenshots lesson 3 + hint at the "
                          "smallest viewport; prints JSON and exits 1 on any failure")
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
                          "fix round 1, corrected by the Phase 8 final review: seeds the roster with "
                          "the four-champion fixture (a fresh save has one champion, which made every "
                          "roster assertion vacuous), then asserts -- for #mapPath .node and "
                          "#rosterCards .card alike -- that no two rows' ART children (canvas.doorcard "
                          "/ canvas.pcard) overlap, that no row's own box is shorter than that child "
                          "(the flex-shrink bug itself, caught at the row it happens on), and that the "
                          "first card of each list is fully inside both the viewport and its own "
                          "scroll container while the last one stays reachable at max scroll. Prints a "
                          "JSON summary and exits 1 on any check failure or page/console error")
    a = ap.parse_args()
    if a.floor is not None and a.node is None:
        ap.error('--floor requires --node (an index or "boss")')  # prints usage + exits 2
    if a.matrix:
        sys.exit(run_matrix())
    if a.saves:
        sys.exit(run_saves())
    if a.player_smoke:
        sys.exit(run_player_smoke())
    if a.smoke3d:
        sys.exit(run_3d_smoke())
    if a.perf3d is not None:
        sys.exit(run_3d_perf(a.perf3d, a.angle))
    if a.shots3d:
        sys.exit(run_3d_shots(a.shots3d))
    if a.touch_heavy:
        sys.exit(run_touch_heavy())
    if a.perf is not None:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            perf_errors = []
            pg.on('pageerror', lambda e: perf_errors.append(str(e)))
            pg.on('console', lambda m: perf_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(TEST_PAGE)
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
            pg.goto(TEST_PAGE)
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
    if a.journey:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            journey_errors = []
            pg.on('pageerror', lambda e: journey_errors.append(str(e)))
            pg.on('console', lambda m: journey_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(TEST_PAGE)
            pg.wait_for_function('typeof G!=="undefined"')
            pg.evaluate('localStorage.clear();Save.load()')
            r = pg.evaluate(build_journey_js(a.seed))
            b.close()
        print(json.dumps({'page_errors': journey_errors, 'summary': r}, indent=1))
        sys.exit(1 if journey_errors or r.get('errors') else 0)
    if a.share:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            share_errors = []
            pg.on('pageerror', lambda e: share_errors.append(str(e)))
            pg.on('console', lambda m: share_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(TEST_PAGE)
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
            pg.goto(TEST_PAGE)
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
            pg.goto(TEST_PAGE)
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
            pg.goto(TEST_PAGE)
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
            visit('campaignComplete', "Screens.campaignComplete()")
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
    if a.tutorial_fit:
        VIEWPORTS = [(854, 480), (844, 390), (667, 375), (568, 320)]
        probe_js = """(()=>{
          const rc=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
          const p=document.getElementById('tutorialPrompt'),l=document.getElementById('tutorialLesson');
          return{text:p.textContent,shown:p.classList.contains('show'),prompt:rc(p),lesson:rc(l),
            canvas:rc(canvas),vw:innerWidth,vh:innerHeight,
            fontSize:parseFloat(getComputedStyle(p).fontSize),
            lines:(cs=>Math.round((p.getBoundingClientRect().height-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom))/(parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2)))(getComputedStyle(p)),
            buttons:[...document.querySelectorAll('.cbtn')].filter(b=>getComputedStyle(b).display!=='none')
              .map(b=>Object.assign({id:b.id},rc(b)))}})()"""
        failures, rows, errs = [], [], []
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.goto(TEST_PAGE)
            pg.wait_for_function('typeof G!=="undefined"')
            pg.evaluate('localStorage.clear();Save.load()')
            n_steps = pg.evaluate('Tutorial.steps.length')
            for vw, vh in VIEWPORTS:
                pg.set_viewport_size({'width': vw, 'height': vh})
                for step in range(n_steps):
                    for hinted in (False, True):
                        # A real tutorial fight, one tick per probe: the hinted text comes from the
                        # game's own stall path in Tutorial.tick, not from a string built here.
                        pg.evaluate("""([step,hinted])=>{
                          G.startTutorial({seed:1,ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()});
                          Tutorial.state.step=step;Tutorial.prompt=Tutorial.steps[step].prompt;
                          Tutorial._stepFrames=hinted?Tutorial.STALL_FRAMES-1:0;
                          G.forceButtons=step<=2;G.applySettings();
                          G.fit();G.tick()}""", [step, hinted])
                        r = pg.evaluate(probe_js)
                        want = pg.evaluate("([s,h])=>Tutorial.steps[s].prompt+(h?' \u2014 '+Tutorial.HINTS[s]:'')", [step, hinted])
                        pr, cv, ln = r['prompt'], r['canvas'], r['lesson']
                        inside_canvas = (pr['left'] >= cv['left'] - 0.5 and pr['right'] <= cv['right'] + 0.5 and
                                         pr['top'] >= cv['top'] - 0.5 and pr['bottom'] <= cv['bottom'] + 0.5)
                        inside_view = (pr['left'] >= -0.5 and pr['top'] >= -0.5 and
                                       pr['right'] <= r['vw'] + 0.5 and pr['bottom'] <= r['vh'] + 0.5)
                        clear = (pr['top'] >= ln['bottom'] - 0.5 or pr['bottom'] <= ln['top'] + 0.5 or
                                 pr['left'] >= ln['right'] - 0.5 or pr['right'] <= ln['left'] + 0.5)
                        hits = [bt['id'] for bt in r['buttons']
                                if pr['left'] < bt['right'] and bt['left'] < pr['right'] and
                                pr['top'] < bt['bottom'] and bt['top'] < pr['bottom']]
                        two_lines = hinted or r['lines'] <= 2
                        row = {'viewport': f'{vw}x{vh}', 'step': step + 1, 'hinted': hinted, 'text': r['text'],
                               'lines': r['lines'], 'overlapsButtons': hits,
                               'shown': r['shown'], 'textIsGameText': r['text'] == want,
                               'insideCanvas': inside_canvas, 'insideViewport': inside_view,
                               'clearOfLesson': clear, 'fontSize': r['fontSize'], 'prompt': pr,
                               'canvas': cv, 'lesson': ln}
                        rows.append(row)
                        if not (r['shown'] and row['textIsGameText'] and inside_canvas and inside_view
                                and clear and r['fontSize'] >= 12 and not hits and two_lines):
                            failures.append({k: row[k] for k in ('viewport', 'step', 'hinted', 'lines', 'overlapsButtons', 'insideCanvas',
                                                                 'insideViewport', 'clearOfLesson', 'prompt', 'canvas', 'lesson')})
            if a.shot:
                pg.set_viewport_size({'width': 568, 'height': 320})
                pg.evaluate("""()=>{G.startTutorial({seed:1,ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()});
                  Tutorial.state.step=2;Tutorial.prompt=Tutorial.steps[2].prompt;
                  Tutorial._stepFrames=Tutorial.STALL_FRAMES-1;G.fit();G.tick()}""")
                pg.screenshot(path=a.shot)
            b.close()
        print(json.dumps({'checked': len(rows), 'failures': failures, 'errors': errs}, indent=1))
        sys.exit(1 if failures or errs else 0)
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
            pg.goto(TEST_PAGE)
            pg.wait_for_function('typeof G!=="undefined"')
            pg.evaluate('localStorage.clear();Save.load()')
            pg.evaluate("G.startFight({seed:1,p1:'carl',p2:'donut',ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()})")

            def capture():
                return pg.evaluate("""(()=>{
                  const cr=canvas.getBoundingClientRect();
                  const btnIds=['btnBlock','btnPunch','btnKick','btnHeavy','btnPower'];
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
        always_hidden = [c for c in hidden_out['buttons'] if c['id'] in ('btnPower', 'btnHeavy')]
        atk_hidden = [c for c in hidden_out['buttons'] if c['id'] not in ('btnPower', 'btnHeavy')]
        power_hidden = always_hidden[0]
        wiring_ok = all(c['visible'] for c in always_hidden) and not any(c['visible'] for c in atk_hidden) and \
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
            pg2.goto(TEST_PAGE)
            pg2.wait_for_function('typeof G!=="undefined"')
            pg2.evaluate('localStorage.clear();Save.load()')
            # Phase 8 final review, Important #5: a FRESH save has exactly one champion, so the
            # roster half of the card checks below ran against a single rect -- one rect cannot
            # overlap another, and one card cannot be pushed out of view by the ones above it, so
            # the roster assertions proved nothing at all (the reviewer measured
            # cardOverlap.roster.count == 1). Seeded here with the SAME four-champion fixture
            # tools/shots.sh already uses for docs/shots/p8-roster.png, so the check runs against
            # the densest roster the game can actually show today -- which is the density the
            # Critical it now guards (the first card clipped above an unreachable scroll range)
            # only appears at.
            pg2.evaluate(ROSTER_PRE)

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
                       ('settings', "Screens.settings()"),
                       ('campaignComplete', "Screens.campaignComplete()"),
                       ('map-complete', "Object.keys(ENCOUNTERS).forEach(k=>Save.data.cleared[k]=true);Screens.map(2)")]
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
            # overlapping its neighbor).
            #
            # Phase 8 final review, Important #5 / Task 8.5 review Critical #1: the first version of
            # this check sampled the .node/.card PARENT rects, which is the one thing that provably
            # could NOT see that bug -- at the broken commit (ab73246) every .node had shrunk to
            # exactly its 44px min-height, so the parents were touching-but-never-overlapping and the
            # assertion reported `bad_pairs: []` on the known-broken tree. Only the canvas CHILDREN
            # overlapped. Two assertions replace it, both aimed at the actual failure mode:
            #   * ART OVERLAP -- the same pairwise test, run on the visual content itself
            #     (canvas.doorcard / canvas.pcard), which is what a reader of the screenshot sees;
            #   * SHRUNK -- every .node/.card's own bounding height must be >= its art child's
            #     rendered height. This catches the shrink DIRECTLY, at the one row it happens on,
            #     without needing a neighbour to bleed into, so it fails even on a one-row list.
            # A small 0.5px tolerance absorbs sub-pixel layout rounding between genuinely-adjacent
            # (touching, zero-gap) rects without masking a real double-digit-pixel overlap.
            def card_rects(selector, art_selector):
                return pg2.evaluate("""(a=>[...document.querySelectorAll(a[0])].map(el=>{
                  const r=el.getBoundingClientRect(),art=el.querySelector(a[1]);
                  const ar=art?art.getBoundingClientRect():null;
                  const box=q=>({left:q.left,top:q.top,right:q.right,bottom:q.bottom,height:q.height});
                  return{parent:box(r),art:ar?box(ar):null};
                }))(%s)""" % json.dumps([selector, art_selector]))

            def overlap_pairs(rects):
                pairs = []
                for i in range(len(rects)):
                    for j in range(i + 1, len(rects)):
                        ra, rb = rects[i], rects[j]
                        if (ra['left'] < rb['right'] - 0.5 and rb['left'] < ra['right'] - 0.5 and
                                ra['top'] < rb['bottom'] - 0.5 and rb['top'] < ra['bottom'] - 0.5):
                            pairs.append([i, j])
                return pairs

            # Phase 8 final review, Critical #1: "the first card must be fully visible without
            # scrolling" was asserted for the map only, and the roster shipped a first card that was
            # cut off at EVERY reachable scroll position (justify-content:center puts an overflowing
            # flex column's start-side overflow outside the scroll range). Checked here for both
            # lists, against two separate properties, because the map bug and the roster bug failed
            # differently: `insideViewport` is the original map assertion; `insideScroller` is the
            # roster one (a card can sit inside the viewport and still be clipped by its own
            # overflow-y:auto ancestor). `lastReachable` is the other half of the same ruling -- a
            # long list is ALLOWED to scroll (Phase 6), so the fix for the first card must not push
            # the last one past the end of the scroll range; scrollTop is restored afterwards so the
            # measurement never changes what a later check or a screenshot sees.
            def first_card_state(sel):
                return pg2.evaluate("""(sel=>{
                  const all=[...document.querySelectorAll(sel)];
                  if(!all.length)return null;
                  const el=document.querySelector(sel+'.open')||all[0],last=all[all.length-1];
                  let sc=el.parentElement;
                  while(sc&&sc!==document.documentElement&&
                        !/(auto|scroll)/.test(getComputedStyle(sc).overflowY))sc=sc.parentElement;
                  const r=el.getBoundingClientRect();
                  const box=q=>({left:q.left,top:q.top,right:q.right,bottom:q.bottom});
                  let insideScroller=true,lastReachable=true,scrollRange=null;
                  if(sc&&sc!==document.documentElement){
                    const sr=sc.getBoundingClientRect();
                    insideScroller=r.top>=sr.top-0.5&&r.bottom<=sr.bottom+0.5;
                    const was=sc.scrollTop;
                    // .path is flex-direction:column-reverse, so ITS scroll range runs from a
                    // negative minimum up to 0 while .cards' runs 0..max -- probe both ends rather
                    // than assuming a direction, and count the last row reachable if EITHER extreme
                    // brings it fully inside.
                    sc.scrollTop=-1e6;const min=sc.scrollTop;
                    const fits=()=>{const lr=last.getBoundingClientRect(),s2=sc.getBoundingClientRect();
                      return lr.top>=s2.top-0.5&&lr.bottom<=s2.bottom+0.5};
                    lastReachable=fits();
                    sc.scrollTop=1e6;const max=sc.scrollTop;
                    lastReachable=lastReachable||fits();
                    sc.scrollTop=was;
                    scrollRange=[min,max]}
                  return{rect:box(r),count:all.length,insideScroller,lastReachable,scrollRange};
                })(%s)""" % json.dumps(sel))

            overlap_results, first_cards = {}, {}
            nav_by_name = dict(SCREENS)
            vw2, vh2 = pg2.evaluate('innerWidth'), pg2.evaluate('innerHeight')
            for scr_name, sel, art_sel in (('map', '#mapPath .node', 'canvas.doorcard'),
                                           ('roster', '#rosterCards .card', 'canvas.pcard')):
                pg2.evaluate(nav_by_name[scr_name])
                entries = card_rects(sel, art_sel)
                arts = [e['art'] for e in entries if e['art']]
                shrunk = [i for i, e in enumerate(entries)
                          if e['art'] and e['parent']['height'] < e['art']['height'] - 0.5]
                overlap_results[scr_name] = {'count': len(entries), 'artCount': len(arts),
                                             'bad_pairs': overlap_pairs(arts), 'shrunk': shrunk}
                st = first_card_state(sel)
                if st:
                    r = st['rect']
                    st['insideViewport'] = (r['top'] >= -0.5 and r['left'] >= -0.5 and
                                            r['bottom'] <= vh2 + 0.5 and r['right'] <= vw2 + 0.5)
                    st['ok'] = st['insideViewport'] and st['insideScroller'] and st['lastReachable']
                first_cards[scr_name] = st

            # firstDoor/firstDoorOk kept under their original names: docs/ARENA.md and the Task 8.5
            # reports quote them, and the map half of the ruling is unchanged.
            first_door = first_cards['map']['rect'] if first_cards['map'] else None
            first_door_ok = bool(first_cards['map']) and first_cards['map']['ok']
            b2.close()
        # HEAVY is always shown: at every phone size (and mirrored) it must be a real >=44px target inside
        # the viewport that overlaps no other button or the open power picker, with showButtons on.
        heavy_fit = []
        with sync_playwright() as p3:
            b3 = p3.chromium.launch()
            pg3 = b3.new_page(viewport={'width': 854, 'height': 480})
            heavy_errs = []
            pg3.on('pageerror', lambda e: heavy_errs.append(str(e)))
            pg3.goto(TEST_PAGE)
            pg3.wait_for_function('typeof G!=="undefined"')
            pg3.evaluate('localStorage.clear();Save.load()')
            pg3.evaluate("Save.data.settings.showButtons=true;G.startFight({seed:1,p1:'carl',p2:'donut',"
                         "ctrl1:Ctrl.idle(),ctrl2:Ctrl.idle()});document.getElementById('powerPicker').classList.add('show')")
            for vw, vh in [(854, 480), (844, 390), (667, 375), (568, 320)]:
                for lh in (False, True):
                    pg3.set_viewport_size({'width': vw, 'height': vh})
                    r = pg3.evaluate("""lh=>{document.body.classList.toggle('left-handed',lh);G.fit();
                      const rc=id=>{const r=document.getElementById(id).getBoundingClientRect();
                        return{id,left:r.left,top:r.top,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
                      const h=rc('btnHeavy');
                      const hit=o=>h.left<o.right&&o.left<h.right&&h.top<o.bottom&&o.top<h.bottom;
                      const others=['btnBlock','btnPunch','btnKick','btnPower','pk1','pk2','pk3'].map(rc);
                      const cv=canvas.getBoundingClientRect(),hudBottom=cv.top+HUD_LINE*cv.height/H;
                      const pks=['pk1','pk2','pk3'].map(rc),btns=['btnBlock','btnPunch','btnKick','btnHeavy','btnPower'].map(rc);
                      const pickerHits=[];
                      for(const k of pks){if(k.top<hudBottom)pickerHits.push(k.id+':HUD');
                        for(const b of btns)if(k.left<b.right&&b.left<k.right&&k.top<b.bottom&&b.top<k.bottom)pickerHits.push(k.id+':'+b.id)}
                      return{pickerHits,w:h.w,h:h.h,inside:h.left>=0&&h.top>=0&&h.right<=innerWidth+.5&&h.bottom<=innerHeight+.5,
                        overlaps:others.filter(hit).map(o=>o.id)}}""", lh)
                    ok_ = r['w'] >= 44 and r['h'] >= 44 and r['inside'] and not r['overlaps'] and not r['pickerHits']
                    heavy_fit.append({'viewport': f'{vw}x{vh}', 'leftHanded': lh, 'ok': ok_, **r})
            b3.close()
        heavy_bad = [f for f in heavy_fit if not f['ok']]
        screens_bad = [r['screen'] for r in screen_results if r['bad']]
        overlap_bad = [name for name, v in overlap_results.items() if v['bad_pairs'] or v['shrunk']]
        first_card_bad = [name for name, v in first_cards.items() if not v or not v['ok']]

        out = {'errors': errs, 'attackButtonsHidden': hidden_out, 'attackButtonsShown': shown_out,
               'wiring_ok': wiring_ok, 'screens': screen_results, 'screenErrors': screen_errs,
               'cardOverlap': overlap_results, 'firstCard': first_cards,
               'firstDoor': first_door, 'firstDoorOk': first_door_ok, 'heavyFit': heavy_fit}
        print(json.dumps(out, indent=1))
        bad = (errs or not hidden_out['aspect_ok'] or not hidden_out['fits_ok'] or hidden_out['bad_btns']
               or not hidden_out['no_hscroll'] or not shown_out['aspect_ok'] or not shown_out['fits_ok']
               or shown_out['bad_btns'] or not shown_out['no_hscroll'] or not wiring_ok
               or screen_errs or screens_bad or overlap_bad or first_card_bad or heavy_bad)
        sys.exit(1 if bad else 0)
    errors, console = [], []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 854, 'height': 480})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: console.append(m.text) if m.type == 'error' else None)
        pg.goto(TEST_PAGE)
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
            sys.exit(0 if r['fail'] == 0 and not errors and not console else 1)
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

#!/usr/bin/env python3
"""Headless harness for Carl's Doorway Brawl (Python Playwright, no npm).

  python3 tests/harness.py --unit                                   # in-page unit tests; exit 1 on any failure
  python3 tests/harness.py --sim --seconds 60 --bot random --ai basic --seed 7
  python3 tests/harness.py --seconds 20 --shot /tmp/fight.png --eval 'G.fight.p1.hp'
  python3 tests/harness.py --sim --seconds 30 --probe 'G.fight.p1.combo'
  python3 tests/harness.py --matrix                                  # AI/content soak matrix; exit 1 on any error

Exit 1 on any page error, console error, or if the game never left TITLE.
"""
import argparse, json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = 'file://' + os.path.join(ROOT, 'index.html')

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
    js = ("(()=>{G.sim=true;let s=%d,fights=1,framesTotal=0,p1wins=0,ticks=%d;"
          "const start=seed=>G.startFight({seed,p1:'%s',p2:'%s',ai:'%s',ctrl1:Ctrl.random(seed)});"
          "start(s);"
          "for(let i=0;i<ticks;i++){G.tick();"
          "if(G.state==='RESULT'){framesTotal+=G.fight.frame;"
          "if(G.fight.winner&&G.fight.winner.side===1)p1wins++;"
          "s++;fights++;start(s)}}"
          "framesTotal+=G.fight.frame;"
          "return{fights,framesTotal,p1wins}})()"
          ) % (seed, int(sim_seconds * 60), p1n, p2n, ain)
    r = pg.evaluate(js)
    pg.close()
    return {'p1': p1n, 'p2': p2n, 'ai': ain, 'seed': seed, 'fights': r['fights'], 'p1wins': r['p1wins'],
            'frames_total': r['framesTotal'], 'errors': len(cell_errors),
            'req_frames': sim_seconds * 60}

def run_matrix():
    P1S, P2S, AIS, SEEDS = ['carl', 'katia'], ['goblin', 'hobgoblin', 'carl'], ['basic', 'brawl', 'brute'], [1, 2]
    cells = [(p1n, p2n, ain, sd) for p1n in P1S for p2n in P2S for ain in AIS for sd in SEEDS]
    sim_seconds = 120
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for i, (p1n, p2n, ain, sd) in enumerate(cells):
            t0 = time.time()
            row = run_matrix_cell(b, p1n, p2n, ain, sd, sim_seconds)
            row['wall'] = time.time() - t0
            rows.append(row)
            if i == 0 and row['wall'] > 40:
                print('# first cell took %.1fs wall (> 40s); reducing remaining cells to 60s sim'
                      % row['wall'], file=sys.stderr)
                sim_seconds = 60
        b.close()
    hdr = '%-6s %-10s %-6s %-5s %-7s %-7s %-13s %-7s' % (
        'p1', 'p2', 'ai', 'seed', 'fights', 'p1wins', 'frames_total', 'errors')
    lines = [hdr]
    bad = False
    for r in rows:
        lines.append('%-6s %-10s %-6s %-5d %-7d %-7d %-13d %-7d' % (
            r['p1'], r['p2'], r['ai'], r['seed'], r['fights'], r['p1wins'], r['frames_total'], r['errors']))
        if r['errors'] or r['frames_total'] < r['req_frames'] * 0.9:
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
                          "in the page-evaluate only; prints {ms_per_frame, ms_step, ms_render} and "
                          "exits 1 if ms_per_frame >= 6")
    a = ap.parse_args()
    if a.matrix:
        sys.exit(run_matrix())
    if a.perf:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 854, 'height': 480})
            perf_errors = []
            pg.on('pageerror', lambda e: perf_errors.append(str(e)))
            pg.on('console', lambda m: perf_errors.append(m.text) if m.type == 'error' else None)
            pg.goto(INDEX)
            pg.wait_for_function('typeof G!=="undefined"')
            js = ("(()=>{G.sim=true;G.startFight({seed:1,p1:'carl',p2:'donut',ai:'brawl',ctrl1:Ctrl.random(1)});"
                  "const N=%d;let tStep=0,tRender=0;"
                  "for(let i=0;i<N;i++){"
                  "const a=performance.now();G.stepFrame();const b=performance.now();"
                  "Render.frame(G.fight);const c=performance.now();"
                  "tStep+=(b-a);tRender+=(c-b);}"
                  "return{ms_per_frame:(tStep+tRender)/N,ms_step:tStep/N,ms_render:tRender/N}})()"
                  ) % a.perf
            r = pg.evaluate(js)
            b.close()
        print(json.dumps(r, indent=1))
        sys.exit(1 if perf_errors or r['ms_per_frame'] >= 6 else 0)
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
        ctrl = 'Ctrl.random(%d)' % a.seed if a.bot == 'random' else 'Ctrl.idle()'
        enc = ",encounter:'%s'" % a.encounter if a.encounter else ''
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
            # G.state goes to RESULT on KO and stepFrame() is a no-op unless state is FIGHT, so a
            # long soak that KOs early would otherwise spend the rest of its budget doing nothing.
            # Keep restarting with a fresh seed and accumulate real simulated frames across fights.
            seed = a.seed
            fights = 1
            frames_total = 0
            for _ in range(int(a.seconds)):
                pg.evaluate('G.simFrames(60)')
                for e in a.probe:
                    probes[e].append(pg.evaluate(e))
                if pg.evaluate('G.state') == 'RESULT':
                    frames_total += pg.evaluate('G.fight.frame')
                    seed += 1
                    fights += 1
                    ctrl2 = 'Ctrl.random(%d)' % seed if a.bot == 'random' else 'Ctrl.idle()'
                    pg.evaluate("G.startFight({seed:%d,p1:'%s',p2:'%s',ai:'%s',ctrl1:%s%s})"
                                % (seed, a.p1, a.p2, a.ai, ctrl2, enc))
            frames_total += pg.evaluate('G.fight.frame')
            out['frames_total'] = frames_total
            out['fights'] = fights
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
    short_soak = a.sim and out.get('frames_total', 0) < a.seconds * 60 * 0.9
    sys.exit(1 if errors or console or out['state'] == 'TITLE' or short_soak else 0)

if __name__ == '__main__':
    main()

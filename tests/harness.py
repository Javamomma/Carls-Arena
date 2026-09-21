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
    ap.add_argument('--pose', default=None, help='freeze p1 in a named Rig pose (via G.debugPose) and screenshot')
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
                    pg.evaluate("G.startFight({seed:%d,p1:'%s',p2:'%s',ai:'%s',ctrl1:%s})"
                                % (seed, a.p1, a.p2, a.ai, ctrl2))
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

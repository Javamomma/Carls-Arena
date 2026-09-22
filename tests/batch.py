#!/usr/bin/env python3
"""Win-rate batch tool for Carl's Doorway Brawl (Python Playwright, no npm).

  python3 tests/batch.py --n 30 --p1 carl --ai t1,t2,t3,t4,t5
      # sweeps AI.TIERS t1..t5 vs a scripted 'competent' bot (Ctrl.competent), n seeded fights each;
      # prints a table (tier, fights, win rate, avg fight length) and exits 1 unless the bot's win
      # rate is monotone non-increasing t1->t5, t1 >= 80%, t5 <= 30%.
  python3 tests/batch.py --n 30 --p1 carl --encounter f1_grull
      # runs one specific encounter (its own tier/enemy/hpMul/atkMul) instead of the tier sweep.
  python3 tests/batch.py --n 30 --no-floors
      # skip the per-floor-node/boss sweep (it runs by default alongside the tier sweep).
  python3 tests/batch.py --selftest
      # smoke test: runs one tiny batch cell and asserts the JS builder's returned object has the
      # fields callers depend on (wins, fights, framesTotal per result). Exit 1 on any mismatch.

Exit 1 on any page/console error, or (tier-sweep mode) a failed monotonicity/bound gate.
"""
import argparse, json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = 'file://' + os.path.join(ROOT, 'index.html')

# A generous per-fight tick cap: Fight's own clock (120s default -> 7200 ticks) always forces a
# timeout decision, and the post-KO slow-mo grace period (90 frames, stepped one per 4 ticks) adds
# up to 360 more ticks beyond that before G.state flips to RESULT. 9000 leaves comfortable headroom.
CAP_TICKS = 9000

def build_batch_js(n, seed_base, p1n, ctrl_kind, p2n=None, ain=None, encounter=None, cap_ticks=CAP_TICKS):
    """One in-page evaluate() that runs `n` independent seeded fights back to back (not a single
    restart-on-KO soak — each fight gets its own fresh G.startFight with seed_base+i, so batch.py's
    per-seed win/loss table matches exactly what the frozen interface asks for) and returns
    {results:[{win,frames},...]}. `ctrl_kind` selects p1's controller ('auto' -> Ctrl.competent(seed),
    'random' -> Ctrl.random(seed)); p2/ai is either a plain {p2,ai} pair or a single `encounter` id,
    mirroring G.startFight's own two ways to pick an opponent (tests/harness.py's --encounter vs
    --p2/--ai does the same split).
    """
    ctrl_expr = 'Ctrl.competent(seed)' if ctrl_kind == 'auto' else 'Ctrl.random(seed)'
    if encounter is not None:
        opp = ",encounter:%s" % json.dumps(encounter)
    else:
        opp = ",p2:%s,ai:%s" % (json.dumps(p2n), json.dumps(ain))
    return ("(()=>{G.sim=true;const n=%d,seedBase=%d,results=[];"
            "for(let i=0;i<n;i++){const seed=seedBase+i;"
            "G.startFight({seed,p1:%s%s,ctrl1:%s});"
            "let ticks=0;while(G.state==='FIGHT'&&ticks<%d){G.tick();ticks++}"
            "results.push({win:!!(G.fight.winner&&G.fight.winner.side===1),frames:G.fight.frame,ticks})}"
            "return{results}})()"
            ) % (n, seed_base, json.dumps(p1n), opp, ctrl_expr, cap_ticks)

def run_batch_cell(pg, n, seed_base, p1n, ctrl_kind, p2n=None, ain=None, encounter=None, errors=None):
    js = build_batch_js(n, seed_base, p1n, ctrl_kind, p2n=p2n, ain=ain, encounter=encounter)
    r = pg.evaluate(js)
    results = r['results']
    wins = sum(1 for x in results if x['win'])
    winrate = 100.0 * wins / len(results) if results else 0.0
    avg_len = sum(x['frames'] for x in results) / len(results) / 60.0 if results else 0.0
    stalled = sum(1 for x in results if x['ticks'] >= CAP_TICKS)
    return {'p1': p1n, 'label': ain or encounter, 'fights': len(results), 'wins': wins,
            'winrate': winrate, 'avg_len_s': avg_len, 'stalled': stalled}

def print_table(rows, label_hdr):
    hdr = '%-14s %-7s %-9s %-10s %-8s' % (label_hdr, 'fights', 'winrate%', 'avglen(s)', 'stalled')
    print(hdr)
    for r in rows:
        print('%-14s %-7d %-9.1f %-10.2f %-8d' % (r['label'], r['fights'], r['winrate'], r['avg_len_s'], r['stalled']))

def selftest():
    ok = True
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 854, 'height': 480})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(INDEX)
        pg.wait_for_function('typeof G!=="undefined"')
        js = build_batch_js(1, 1, 'carl', 'auto', p2n='donut', ain='t1', cap_ticks=CAP_TICKS)
        r = pg.evaluate(js)
        b.close()
    results = r.get('results')
    if not (isinstance(results, list) and len(results) == 1):
        print('# SELFTEST FAIL: results must be a length-1 list, got %r' % (results,)); ok = False
    else:
        row = results[0]
        for field in ('win', 'frames', 'ticks'):
            if field not in row:
                print('# SELFTEST FAIL: result missing field %r: %r' % (field, row)); ok = False
        if ok and not isinstance(row['win'], bool):
            print('# SELFTEST FAIL: win must be a bool, got %r' % (row['win'],)); ok = False
        if ok and not (isinstance(row['frames'], (int, float)) and row['frames'] > 0):
            print('# SELFTEST FAIL: frames must be a positive number, got %r' % (row['frames'],)); ok = False
    errs_found = len(errs) > 0
    if errs_found:
        print('# SELFTEST FAIL: page/console errors: %r' % (errs,)); ok = False
    if ok:
        print('# SELFTEST OK: batch JS builder returns {results:[{win,frames,ticks}, ...]}')
    return 0 if ok else 1

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--n', type=int, default=30, help='seeded fights per tier/encounter cell')
    ap.add_argument('--p1', default='carl')
    ap.add_argument('--p2', default='donut', help='opponent champ/mob for the --ai tier sweep (ignored by --encounter)')
    ap.add_argument('--ai', default='t1,t2,t3,t4,t5', help='comma list of AI tiers to sweep')
    ap.add_argument('--encounter', default=None, help='run one encounter id instead of the tier sweep')
    ap.add_argument('--bot', default='auto', choices=['auto', 'random'],
                     help="p1's controller: 'auto' is the scripted Ctrl.competent bot (default), "
                          "'random' is the existing seeded chaos-monkey Ctrl.random")
    ap.add_argument('--seed-base', type=int, default=1)
    ap.add_argument('--no-floors', action='store_true',
                     help='skip the per-FLOORS-node/boss win-rate sweep (runs by default)')
    ap.add_argument('--selftest', action='store_true',
                     help='smoke test the JS builder itself and exit (no tier/floor sweep)')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())

    bad = False
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 854, 'height': 480})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto(INDEX)
        pg.wait_for_function('typeof G!=="undefined"')

        if a.encounter:
            row = run_batch_cell(pg, a.n, a.seed_base, a.p1, a.bot, encounter=a.encounter)
            print_table([row], 'encounter')
        else:
            tiers = a.ai.split(',')
            rows = []
            for tier in tiers:
                t0 = time.time()
                row = run_batch_cell(pg, a.n, a.seed_base, a.p1, a.bot, p2n=a.p2, ain=tier)
                row['wall'] = time.time() - t0
                rows.append(row)
            print_table(rows, 'tier')
            rates = [r['winrate'] for r in rows]
            monotone = all(rates[i] >= rates[i + 1] - 1e-9 for i in range(len(rates) - 1))
            if not monotone:
                print('# FAIL: win rate is not monotone non-increasing across tiers: %r' % (rates,)); bad = True
            if rates and rates[0] < 80:
                print('# FAIL: t1 win rate %.1f must be >= 80' % rates[0]); bad = True
            if rates and rates[-1] > 30:
                print('# FAIL: last-tier win rate %.1f must be <= 30' % rates[-1]); bad = True
            if not bad:
                print('# OK: monotone non-increasing, t1=%.1f (>=80), last=%.1f (<=30)' % (rates[0], rates[-1]))

        if not a.no_floors:
            floors = pg.evaluate('FLOORS')
            node_rows = []
            for fl in floors:
                for nid in fl['nodes']:
                    node_rows.append(run_batch_cell(pg, a.n, a.seed_base, a.p1, a.bot, encounter=nid))
                node_rows.append(run_batch_cell(pg, a.n, a.seed_base, a.p1, a.bot, encounter=fl['boss']))
            print('\n# per-floor-node/boss win rates (%s vs %s, n=%d each)' % (a.p1, a.bot, a.n))
            print_table(node_rows, 'encounter')
        b.close()

    if errors:
        print('# page/console errors: %r' % (errors,)); bad = True
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()

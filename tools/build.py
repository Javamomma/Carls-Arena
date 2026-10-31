#!/usr/bin/env python3
"""Build the two pages from src/* (sorted by filename).

  index.html  the player page: every src file except 90_tests.js (what GitHub Pages serves)
  test.html   the test page: every src file, loaded by tests/harness.py and tests/batch.py

  python3 tools/build.py          # write both
  python3 tools/build.py --check  # exit 1 and name each file that differs from a fresh build
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_SRC = '90_tests.js'
files = sorted(glob.glob(os.path.join(ROOT, 'src', '*')))
outputs = {
    'index.html': '\n'.join(open(p, encoding='utf-8').read() for p in files if os.path.basename(p) != TEST_SRC),
    'test.html': '\n'.join(open(p, encoding='utf-8').read() for p in files),
}
stale = []
for name, text in outputs.items():
    path = os.path.join(ROOT, name)
    if '--check' in sys.argv:
        cur = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if cur != text:
            stale.append(name)
    else:
        open(path, 'w', encoding='utf-8').write(text)
        print(f'wrote {name} ({len(text.encode("utf-8"))} bytes)')
if stale:
    print('stale: ' + ', '.join(stale), file=sys.stderr)
    sys.exit(1)

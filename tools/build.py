#!/usr/bin/env python3
"""Build the pages and the opt-in 3D files from src/* (sorted by filename).

  index.html    the player page: every src file except 90_tests.js and 71_render3d.js (what GitHub Pages serves)
  test.html     the test page: the same plus 90_tests.js, loaded by tests/harness.py and tests/batch.py
  render3d.js   the 3D fighters renderer (src/71_render3d.js), loaded only when 3D is switched on
  three.min.js  the three.js bundle (tools/three/three.min.js, rebuilt by tools/three/build.sh), same

  python3 tools/build.py          # write all four
  python3 tools/build.py --check  # exit 1 and name each file that differs from a fresh build
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_SRC = '90_tests.js'
RENDER3D_SRC = '71_render3d.js'
files = [p for p in sorted(glob.glob(os.path.join(ROOT, 'src', '*'))) if os.path.basename(p) != RENDER3D_SRC]
read = lambda *parts: open(os.path.join(ROOT, *parts), encoding='utf-8').read()
outputs = {
    'index.html': '\n'.join(open(p, encoding='utf-8').read() for p in files if os.path.basename(p) != TEST_SRC),
    'test.html': '\n'.join(open(p, encoding='utf-8').read() for p in files),
    'render3d.js': read('src', RENDER3D_SRC),
    'three.min.js': read('tools', 'three', 'three.min.js'),
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

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

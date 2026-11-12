#!/bin/sh
# Rebuilds tools/three/three.min.js from three@0.170.0, integrity sha512-FQK+LEpYc0fBD+J8g6oSEyyNzjp+Q7Ks1C568WWaoMRLW+TkNNWmenWeGgJjV105Gd+p/2ql1ZcjYvNiPZBhuQ== (also in bun.lock); then run python3 tools/build.py.
cd "$(dirname "$0")" && bun install --frozen-lockfile && bun build entry.js --minify --target=browser --format=iife --banner='/** @license Copyright 2010-2024 Three.js Authors. SPDX-License-Identifier: MIT. https://github.com/mrdoob/three.js (three@0.170.0, tree-shaken). */' --outfile=three.min.js

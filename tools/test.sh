#!/bin/sh
# Node 26 treats `node --test test/` as a module path, not a directory.
cd "$(dirname "$0")/.." && exec node --test test/*.test.js

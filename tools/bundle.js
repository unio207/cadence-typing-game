#!/usr/bin/env node
'use strict';
// Inlines every <script src="src/*.js"> into one self-contained cadence.html.
// Playing never requires this - index.html runs directly - but a single file is
// what you send someone, and it sidesteps any browser that is fussy about
// loading sibling scripts over file://.

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let inlined = 0;
const out = html.replace(/[ \t]*<script src="(src\/[^"]+)"><\/script>\n?/g, (_m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  inlined++;
  return '<script>\n/* ' + src + ' */\n' + code + '</script>\n';
});

if (inlined === 0) {
  console.error('bundle: no <script src="src/..."> tags found');
  process.exit(1);
}
if (/<script src="src\//.test(out)) {
  console.error('bundle: some script tags were not inlined');
  process.exit(1);
}

const dest = path.join(root, 'cadence.html');
fs.writeFileSync(dest, out);
console.log('bundle: inlined ' + inlined + ' files -> cadence.html (' +
  (Buffer.byteLength(out) / 1024).toFixed(1) + ' kB)');

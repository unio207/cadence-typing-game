# cadence

A typing game for fast typists, in three drafts. No build step, no server, no
dependencies, no sound.

**Play it:** open `cadence.html` (one self-contained file), or `index.html` from
this folder. Pick a draft with `1` `2` `3`, then type any letter to begin.

```
1 2 3   choose a draft        tab   restart instantly
esc     back to the drafts    c     copy your score (result screen)
```

## The three drafts

All three share one engine: the same word generator, the same rising **demand**,
the same rhythm metric, the same scoring. They differ only in where the pressure
comes from.

| | pressure | how a run ends |
|---|---|---|
| **A — drying ink** | legibility | three wrong guesses on ink you couldn't read |
| **B — the lock** | deadlines | three bars dropped |
| **C — branches** | a chaser | the edge catches you three times |

**A — drying ink.** The ink dries ahead of your caret at a rate the demand sets.
Keep up and the page stays readable; fall below 94% of the demand and a hole opens
just past the caret and you type across it from memory. A typo on legible ink
costs only your combo — you can only be killed by being wrong about something you
couldn't see.

**B — the lock.** Text arrives in three-word bars, each with a deadline. Finish one
clean and in rhythm and it *locks*: banked at double and untakeable, with a solid
rule under it. Miss the deadline and the bar is skipped like a missed note. This is
the draft where rhythm decides what you keep, not just what you score.

**C — branches.** An edge advances from the left, eating the page. At every junction
two lines are valid and the harder one pays **double** — but the edge moves 25%
faster while you're on it. Your fingers choose: the first character you type
commits you, because the two lines always diverge on their first letter.

## Scoring

Survival is a speed question. **Rhythm** — the evenness of your keystroke intervals —
is the multiplier, so two players who die at the same moment are separated by how
smoothly they got there. Nothing else scores this.

```
per correct character:  10 × speed × rhythm × combo
```

The result screen reprints the end of your run with each character inked at the
weight of your rhythm when you struck it. Smooth stretches print dark and solid;
stumbles print pale. Errors are red.

## Measured

Produced by `node tools/balance.js`, which plays every draft with a synthetic
typist whose keystroke intervals depend on hand and finger transitions and whose
error rate depends on how legible the character is. Averages over five seeds.

```
A - drying ink   (pressure: legibility)
---------------------------------------
  metronome 200   106s      77,520   strikes     strikes 3 combo 220
  tight 150        86s      36,926   strikes     strikes 3 combo 259
  normal 110       78s      17,176   strikes     strikes 3 combo 199
  ragged 110       70s      10,511   strikes     strikes 3 combo 82
  slow 70          60s       5,623   strikes     strikes 3 combo 189

B - the lock   (pressure: deadlines)
------------------------------------
  metronome 200   163s     193,545   dropped     locked 80 loose 53 dropped 3
  tight 150       115s      61,359   dropped     locked 20 loose 52 dropped 3
  normal 110      105s      26,279   dropped     locked 14 loose 44 dropped 3
  ragged 110       93s      13,337   dropped     locked 0 loose 51 dropped 3
  slow 70          81s       8,230   dropped     locked 4 loose 19 dropped 3

C - branches [safe]   (pressure: a chaser)
------------------------------------------
  metronome 200   171s     130,921   caught      safe 139 greedy 0 touches 3
  tight 150       132s      55,648   caught      safe 88 greedy 0 touches 3
  normal 110      122s      26,182   caught      safe 70 greedy 0 touches 3
  ragged 110      121s      17,996   caught      safe 66 greedy 0 touches 3
  slow 70         105s      10,116   caught      safe 37 greedy 0 touches 3

C - branches [greedy]   (pressure: a chaser)
--------------------------------------------
  metronome 200    82s     120,384   caught      safe 1 greedy 54 touches 3
  tight 150        79s      60,127   caught      safe 0 greedy 42 touches 3
  normal 110       79s      30,850   caught      safe 1 greedy 31 touches 3
  ragged 110       78s      20,212   caught      safe 0 greedy 28 touches 3
  slow 70          68s      11,357   caught      safe 0 greedy 18 touches 3

C - branches [adaptive]   (pressure: a chaser)
----------------------------------------------
  metronome 200   167s     175,742   caught      safe 83 greedy 46 touches 3
  tight 150       131s      75,781   caught      safe 40 greedy 34 touches 3
  normal 110      122s      36,414   caught      safe 40 greedy 22 touches 3
  ragged 110      121s      24,965   caught      safe 41 greedy 20 touches 3
  slow 70          98s      12,600   caught      safe 18 greedy 12 touches 3
```

Draft C is shown under three strategies. That an **adaptive** player — one who takes
the hard line only when the gap is wide — beats both pure strategies is the test
that the junction is a real decision rather than decoration.

## Development

```
./tools/test.sh          # 88 tests, no runner or package manager needed
node tools/balance.js    # play every draft with synthetic typists
node tools/sweep-c.js    # sweep draft C's two balance constants
node tools/bundle.js     # rebuild the single-file cadence.html
python3 tools/serve.py   # dev server that refuses to cache
```

`src/` splits into a shared core (`keymap`, `words`, `generator`, `metrics`,
`survival`) and one file per draft, plus the DOM layer (`render`, `rail`,
`screens`, `shell`). Everything in the core is a pure function, which is why it
can be tested under `node --test` without a browser.

In the browser, `cadenceApp.replay(draftId, opts)` deterministically plays a
scripted run and draws one frame — useful for seeing a draft at a chosen point in
its difficulty curve without waiting.

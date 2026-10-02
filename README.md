# cadence

A typing game for fast typists, in two drafts. No build step, no server, no
dependencies, no sound.

**Play it:** open `cadence.html` (one self-contained file), or `index.html` from
this folder. Pick a draft with `1` `2`, set a goal with `←` `→`, then type any
letter to begin.

```
1 2       choose a draft         tab       restart instantly
← →       set your goal wpm      esc       back to the drafts
shift+T   light / dark           c         copy your score
↓ ↑       show / hide full stats (result screen)
```

## The two drafts

Both share one engine: the same word generator, the same rhythm metric, the same
scoring, the same drying ink. They differ in where the pressure comes from and in
what sets the pace — draft A paces you against a goal you chose, draft C against a
chaser that follows your own demonstrated speed.

| | pressure | how a run ends |
|---|---|---|
| **A — drying ink** | legibility | three wrong guesses on ink you couldn't read |
| **C — branches** | a chaser | the edge catches you three times |

**A — drying ink.** You pick a **goal WPM** from a ladder — 40, 55, 70, 85, 100,
115, 130, 150, 170, 190 — and the drying ink is your pacer against it. The demand
eases up to your goal over ten seconds and then holds there, so the page is
visibly drying within about eight seconds whoever you are. Keep up and it stays
readable; fall below 94% of your goal and a hole opens just past the caret and you
type across it from memory. Hold your goal for ten seconds and you've **reached**
it: the rung is banked for good and the ladder steps up, so a run is a climb until
you can't. A typo on legible ink costs only your combo — you can only be killed by
being wrong about something you couldn't see.

Each keystroke also lends a little ink to the characters just ahead, and it decays,
so typing keeps the page lit and stopping lets it go out.

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

Produced by `node tools/balance.js`, which plays each draft with a synthetic
typist whose keystroke intervals depend on hand and finger transitions and whose
error rate depends on how legible the character is. Averages over five seeds.

```
A - drying ink   (pressure: legibility, paced by a goal wpm)
------------------------------------------------------------
  typist                     goal    wpm   fade    hole    strike  reached   ends       ending
  metronome 200 on goal        196    185  8s    18s     18s     0.0         27s   strikes      16,628
  metronome 200 10% under      216    187  7s    9s      10s     0.0         10s   strikes       6,649
  metronome 200 10% over       171    179  10s   24s     24s     1.0 @11s    25s   strikes      15,896
  tight 150 on goal            142    137  9s    26s     78s     0.0        121s   strikes      40,353
  tight 150 10% under          156    138  7s    10s     11s     0.0         13s   strikes       4,345
  tight 150 10% over           127    137  10s   34s     35s     2.0 @11s    37s   strikes      13,501
  normal 110 on goal           108    107  9s    68s     85s     0.6 @56s    97s   strikes      19,092
  normal 110 10% under         119    106  7s    12s     14s     0.0         17s   strikes       3,262
  normal 110 10% over           97    107  13s   40s     44s     2.0 @11s    49s   strikes      10,200
  ragged 110 on goal           108    106  9s    32s     34s     0.2 @58s    65s   strikes       9,231
  ragged 110 10% under         119    106  7s    12s     12s     0.0         16s   strikes       2,239
  ragged 110 10% over           97    107  14s   67s     68s     2.0 @16s    69s   strikes       9,773
  slow 70 on goal               71     71  9s    33s     33s     0.2 @229s  106s   strikes       9,405
  slow 70 10% under             78     71  7s    11s     14s     0.0         20s   strikes       1,600
  slow 70 10% over              64     72  13s   36s     38s     2.0 @17s    49s   strikes       4,407
  (ends at 240s = survived; `reached` is levels cleared in a run)

C - branches [safe]   (pressure: a chaser)
------------------------------------------
  metronome 200   172s     131,060   caught      safe 122 greedy 0 touches 3
  tight 150       134s      56,363   caught      safe 74 greedy 0 touches 3
  normal 110      124s      26,947   caught      safe 52 greedy 0 touches 3
  ragged 110      123s      18,028   caught      safe 52 greedy 0 touches 3
  slow 70         105s       9,667   caught      safe 28 greedy 0 touches 3

C - branches [greedy]   (pressure: a chaser)
--------------------------------------------
  metronome 200    82s     116,944   caught      safe 2 greedy 52 touches 3
  tight 150        81s      62,675   caught      safe 0 greedy 44 touches 3
  normal 110       77s      29,699   caught      safe 1 greedy 28 touches 3
  ragged 110       77s      20,270   caught      safe 1 greedy 25 touches 3
  slow 70          68s      11,066   caught      safe 1 greedy 17 touches 3

C - branches [adaptive]   (pressure: a chaser)
----------------------------------------------
  metronome 200   165s     171,546   caught      safe 71 greedy 45 touches 3
  tight 150       135s      78,855   caught      safe 36 greedy 35 touches 3
  normal 110      121s      35,837   caught      safe 29 greedy 20 touches 3
  ragged 110      118s      24,300   caught      safe 28 greedy 17 touches 3
  slow 70          97s      12,275   caught      safe 14 greedy 11 touches 3
```

Draft C is shown under three strategies. That an **adaptive** player — one who takes
the hard line only when the gap is wide — beats both pure strategies is the test
that the junction is a real decision rather than decoration.

Two things the draft A table is there to prove. The ink starts drying at **7–14
seconds at every speed and every goal**, because that is a property of the ramp
rather than of the player — it cannot drift with skill. And the survivable band is
narrow: 10% under your goal puts a hole in the page at about ten seconds and ends
the run inside twenty, so the rung you pick is the whole game.

## Development

```
./tools/test.sh          # 88 tests, no runner or package manager needed
node tools/balance.js    # play every draft with synthetic typists
node tools/sweep-c.js    # sweep draft C's two balance constants
node tools/profile.js    # per-frame DOM mutation counts, bucketed by run time
node tools/bundle.js     # rebuild the single-file cadence.html
python3 tools/serve.py   # dev server that refuses to cache
```

`src/` splits into a shared core (`keymap`, `words`, `generator`, `metrics`,
`survival`) and one file per draft, plus the DOM layer (`render`, `rail`,
`screens`, `shell`). Everything in the core is a pure function, which is why it
can be tested under `node --test` without a browser.

`tools/profile.js` drives a run headlessly and counts **DOM mutations per frame**
rather than CPU, because browser layout cost tracks mutations and the renderer's
own compute turned out to be flat. It is what found the two scrolling bugs
described at the top of `src/render.js`.

In the browser, `cadenceApp.replay(draftId, opts)` deterministically plays a
scripted run and draws one frame — useful for seeing a draft at a chosen point in
its difficulty curve without waiting.

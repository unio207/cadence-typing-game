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

One number worth knowing before you set a goal: **chapter texture swings real
throughput by about 7%** — a nominal 120 wpm typist gets 123 on `open field` but
114 on `long form` and `one hand` — while the survivable band is 6%. Set your goal
to what you can hold on the *hardest* chapter, not your best one.

```
A - drying ink   (pressure: legibility, paced by a goal wpm)
------------------------------------------------------------
  typist                     goal    wpm   fade    hole    strike  reached   ends       ending
  metronome 200 on goal        206    192  8s    13s     15s     0.0         16s   strikes      11,271
  metronome 200 10% under      226    193  7s    9s      10s     0.0         11s   strikes       7,560
  metronome 200 10% over       185    191  10s   56s     56s     2.0 @11s    57s   strikes      42,848
  tight 150 on goal            145    139  8s    24s     35s     0.0         72s   strikes      24,277
  tight 150 10% under          159    139  7s    10s     11s     0.0         12s   strikes       4,171
  tight 150 10% over           130    140  11s   23s     23s     1.0 @11s    30s   strikes      10,797
  normal 110 on goal           111    110  9s    46s     109s    0.2 @14s   182s   strikes      38,314
  normal 110 10% under         117    110  8s    15s     21s     0.0         28s   strikes       5,835
  normal 110 10% over          101    110  12s   29s     39s     1.0 @11s    80s   strikes      16,422
  ragged 110 on goal           111    109  9s    24s     52s     0.2 @13s    74s   strikes      11,215
  ragged 110 10% under         117    107  8s    14s     17s     0.0         20s   strikes       2,825
  ragged 110 10% over          101    110  12s   31s     33s     1.0 @16s    52s   strikes       8,041
  slow 70 on goal               71     72  9s    45s     55s     0.6 @120s  132s   strikes      12,119
  slow 70 10% under             79     71  8s    12s     14s     0.0         21s   strikes       1,736
  slow 70 10% over              64     72  15s   64s     65s     2.0 @15s    74s   strikes       6,884
  (ends at 240s = survived; `reached` is levels cleared in a run)

C - branches [safe]   (pressure: a chaser)
------------------------------------------
  metronome 200   173s     137,417   caught      safe 129 greedy 0 touches 3
  tight 150       129s      55,551   caught      safe 73 greedy 0 touches 3
  normal 110      123s      28,305   caught      safe 55 greedy 0 touches 3
  ragged 110      120s      18,516   caught      safe 53 greedy 0 touches 3
  slow 70         104s      10,216   caught      safe 29 greedy 0 touches 3

C - branches [greedy]   (pressure: a chaser)
--------------------------------------------
  metronome 200    81s     117,610   caught      safe 1 greedy 57 touches 3
  tight 150        82s      64,026   caught      safe 0 greedy 46 touches 3
  normal 110       80s      31,201   caught      safe 0 greedy 33 touches 3
  ragged 110       80s      21,256   caught      safe 1 greedy 29 touches 3
  slow 70          68s      11,191   caught      safe 0 greedy 18 touches 3

C - branches [adaptive]   (pressure: a chaser)
----------------------------------------------
  metronome 200   173s     183,523   caught      safe 80 greedy 50 touches 3
  tight 150       135s      79,518   caught      safe 38 greedy 37 touches 3
  normal 110      123s      37,793   caught      safe 28 greedy 25 touches 3
  ragged 110      124s      25,707   caught      safe 32 greedy 23 touches 3
  slow 70          97s      12,787   caught      safe 14 greedy 12 touches 3
```

Draft C is shown under three strategies. That an **adaptive** player — one who takes
the hard line only when the gap is wide — beats both pure strategies is the test
that the junction is a real decision rather than decoration.

Two things the draft A table is there to prove. The ink starts drying at **7–14
seconds at every speed and every goal**, because that is a property of the ramp
rather than of the player — it cannot drift with skill. And the survivable band is
narrow: 10% under your goal puts a hole in the page at about ten seconds and ends
the run inside twenty, so the rung you pick is the whole game.

## The words

Everyday English, about 960 words, held in rough frequency order — a word's
position in `src/words.js` is how often it turns up, because the generator samples
the front of the list more than the back. The bar is *a fast typist never has to
think about it*: you cannot hold a rhythm through a word you are still reading.

An earlier pool was grown to 3142 words for variety and started serving up
`wield`, `keel`, `phantom`, `torment` and `situate`. That was a vocabulary test,
not a typing game, and the fix was to shrink the pool rather than to filter it.
Variety now comes from the sampler and the chapter filters.

Within that, easily typed words are favoured explicitly: `easeOf()` prices a word
from the same hand-and-finger facts the typist model uses — a same finger moving
to a new key is expensive, a hand-off is cheap, long words cost rhythm to hold —
and candidates are scored on it. There is a test asserting generated text is
measurably easier than drawing from the same pool uniformly would be, so the
weighting cannot quietly stop working.

Excluded on purpose: anything with a UK/US spelling split, anything capitalised in
real use, anything outside 2–9 letters.

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

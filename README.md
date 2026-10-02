# cadence

The ink dries while you type. Keep up with your goal or type from memory.

No build step, no server, no dependencies, no sound.

**Play it:** open `cadence.html` (one self-contained file), or `index.html` from
this folder. Set a goal with `←` `→`, then type any letter to begin.

```
← →       set your goal wpm      tab       restart instantly
shift+T   light / dark           esc       back to the title
↓ ↑       show / hide full stats (result screen)      c   copy your score
```

## How it works

You pick a **goal WPM** from a ladder — 40, 55, 70, 85, 100, 115, 130, 150, 170,
190 — and the drying ink is your pacer against it. The demand eases up to your goal
over ten seconds and then holds there, so the page is visibly drying within about
eight seconds whoever you are.

Keep up and it stays readable. Fall below 94% of your goal and a hole opens just
past the caret, and you type across it from memory. Each keystroke lends a little
ink to the characters just ahead and it decays, so typing keeps the page lit and
stopping lets it go out — a race against your own fading page.

Hold your goal for ten seconds and you've **reached** it: the rung is banked for
good and the ladder steps up, so a run is a climb until you can't.

A typo on legible ink costs only your combo. **You can only be killed by being
wrong about something you couldn't see** — three of those, or two seconds sat in
the dark, and the run is over.

The run walks through eight chapters as the ladder climbs, each changing what your
hands are doing: alternating hands, home row, the commonest words, short words,
same-hand rolls, long words, single-hand runs, and the top row.

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
```

Two things that table is there to prove. The ink starts drying at **7–14
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
node tools/balance.js    # play the game with synthetic typists
node tools/profile.js    # per-frame DOM mutation counts, bucketed by run time
node tools/bundle.js     # rebuild the single-file cadence.html
python3 tools/serve.py   # dev server that refuses to cache
```

`src/` splits into a core (`keymap`, `words`, `generator`, `metrics`, `survival`),
the game itself (`draft-a`), and the DOM layer (`render`, `rail`, `screens`,
`shell`). Everything in the core is a pure function, which is why it
can be tested under `node --test` without a browser.

`tools/profile.js` drives a run headlessly and counts **DOM mutations per frame**
rather than CPU, because browser layout cost tracks mutations and the renderer's
own compute turned out to be flat. It is what found the two scrolling bugs
described at the top of `src/render.js`.

In the browser, `cadenceApp.replay(opts)` deterministically plays a scripted run
and draws one frame — useful for seeing the game at a chosen point in its
difficulty curve without waiting.

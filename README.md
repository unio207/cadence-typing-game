# cadence

A typing game for fast typists, in two drafts. No build step, no server, no
dependencies, no sound.

**Play it:** open `cadence.html` (one self-contained file), or `index.html` from
this folder. Pick a draft with `1` `2`, then type any letter to begin.

```
1 2     choose a draft        tab   restart instantly
esc     back to the drafts    c     copy your score (result screen)
```

## The two drafts

Both share one engine: the same word generator, the same rising **demand**,
the same rhythm metric, the same scoring. They differ only in where the pressure
comes from.

| | pressure | how a run ends |
|---|---|---|
| **A — drying ink** | legibility | three wrong guesses on ink you couldn't read |
| **C — branches** | a chaser | the edge catches you three times |

**A — drying ink.** The ink dries ahead of your caret at a rate the demand sets.
Keep up and the page stays readable; fall below 94% of the demand and a hole opens
just past the caret and you type across it from memory. A typo on legible ink
costs only your combo — you can only be killed by being wrong about something you
couldn't see.

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

<!--BALANCE-->

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

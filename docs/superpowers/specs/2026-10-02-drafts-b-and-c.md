# cadence — drafts B and C

Date: 2026-10-02

Two further drafts over the engine specified in
`2026-10-01-cadence-typing-game-design.md`. They reuse that document's visual
system (§5), motion system (§6), input and error handling (§7.1–7.2), rhythm
metric (§7.3), scoring (§7.4), rail (§7.5), renderer (§7.6), chapters (§8) and
content generation (§9) **unchanged**, and the demand ratchet (§3) unchanged.

Only one thing differs between drafts: **where the pressure comes from.**

| | pressure | run ends when |
|---|---|---|
| A — drying ink | legibility | three wrong guesses on illegible ink |
| B — the lock | deadlines | three bars dropped |
| C — branches | a chaser | the edge catches you three times |

Each draft is a module exposing the same interface — `createRun`, `onKey`, `tick`,
`inkAhead`, `strikesOf`, `endLabel`, `META` — so the shell, renderer and records
are written once.

---

## Draft B — "the lock"

### Premise

Text arrives in three-word **bars**, each with a deadline derived from the demand.
Finish a bar clean and in rhythm and it *locks*: banked at double, untakeable, with
a solid rule drawn under it. Finish it late or sloppy and it banks at base. Miss
the deadline entirely and the bar is **skipped like a missed note** — the cursor
jumps past it and those characters are marked as missed.

Draft A makes rhythm a multiplier on score. Draft B makes rhythm decide *what you
keep*, which is a stronger claim on the player's attention.

The page never fades. Legibility is not the pressure here, so `inkAhead` returns 1.

### Rules

```
WORDS_PER_BAR  = 3
SLACK          = 1.15          grace on each deadline
LOCK_RHYTHM    = 70            rhythm needed at bar close to lock it
LOCK_BONUS     = 2.0
MAX_DROPS      = 3
IDLE_DROP_MS   = 1500

on activation:  allowedMs = (barChars / (demand * 5 / 60)) * 1000 * SLACK
on close:       locked  if errors == 0 and rhythm >= LOCK_RHYTHM
                loose   otherwise
on expiry:      dropped - remaining characters marked 'miss', cursor skips to the
                next bar, combo resets
```

**Idle costs one bar per 1500ms of continued idleness.** Waiting out each bar's own
deadline instead made a full stop take 15 seconds; dropping all three at once ended
it in 1.6s. One per interval puts a hands-off run at 4.5s, in line with draft A's
two.

### Presentation

Bars behind the cursor carry their verdict as a rule: 2px ink for locked, a hairline
for loose, red for dropped. **Bars ahead of the cursor carry a faint rule too** —
the grouping you are about to type is the thing you are playing against, and in the
first build it was invisible, which hid the mechanic. The active bar's deadline is a
separate rule beneath it whose ink drains left as the time goes.

---

## Draft C — "branches"

### Premise

An **edge** advances from the left at the demand's pace, consuming the page behind
you. Stay ahead of it. At every junction two lines are valid, both displayed, and
the harder one pays **double** — but the edge moves 25% faster while you are on it.

You do not press anything to choose. The generator guarantees the two lines diverge
on their very first character, so the first key you type commits you and the other
line withers.

### Rules

```
MAX_TOUCHES          = 3
START_LEAD           = 26 characters
MAX_GAP              = 40 characters
REPRIEVE             = 16 characters, when the edge catches you
greedyPayout         = 2.0
edgeGreedyMult       = 1.25
IDLE_SURGE_AFTER_MS  = 1200, then the edge moves 4x

edge advances at:  (demand * 5 / 60) * (greedy ? 1.25 : 1) * (idle ? 4 : 1)
caught when:       cursor - edge <= 0   ->   touch, edge pushed back by REPRIEVE
```

### Three findings that shaped it

**The greedy line needs an explicit cost.** In character coordinates a longer branch
is free: the edge has to traverse those extra characters too, so the gap closes at
`(yourCps - edgeCps)` regardless of path length. And measured against the typist
model, the denser greedy text is only ~5% slower to type, which a 2× payout dwarfs.
Without the edge quickening, always-greedy is strictly better and the junction is
decoration.

**The gap must be capped.** Outpacing the demand let it grow without bound — 116
characters observed — pushing the edge off screen entirely, so the pressure vanished
for any competent player. Capping at 40 made the junction a *deeper* decision rather
than a shallower one, because it turned the gap into a scarce resource worth
spending: adaptive play went from beating the pure strategies by 8–12% to beating
them by 20–42%.

**Draft C's caret sits at 62% of the stage, not 34%.** Its threat comes from behind,
so it needs room to show the edge; at 34% only ~22 characters were visible behind
the caret and the edge stayed clamped off-screen even at the cap.

### Presentation

The edge is a red hairline with a short paper-coloured gradient trailing it;
everything behind it is blanked. At an open junction the two candidate lines appear
above and below the caret with their payout tags.

---

## Verification

Both drafts are covered by the same regression suite as A (`test/drafts.test.js`),
which asserts per draft that: the first two seconds cost nothing at any speed; every
run ends for every skill level; a full stop ends it within 6s; faster players last
longer and score more; and **two players of identical speed are separated by
rhythm**, which is the premise the whole game rests on.

Balance is measured rather than felt, by `tools/balance.js`, which plays each draft
with a synthetic typist whose keystroke intervals depend on hand and finger
transitions and whose error rate depends on how legible the character is. Both
properties were necessary: a fixed-interval typist cannot see typing difficulty at
all, and one with oracle knowledge of the text never errs, which made draft A
unloseable in simulation.

`tools/sweep-c.js` sweeps draft C's two constants against the standard that an
adaptive player must out-score both pure strategies.

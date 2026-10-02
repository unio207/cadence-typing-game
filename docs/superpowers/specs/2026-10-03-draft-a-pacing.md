# cadence — draft A: the goal pacer

Date: 2026-10-03

Replaces §3 and §8 of `2026-10-01-cadence-typing-game-design.md` **for draft A
only**. Draft C keeps the self-adjusting demand that document specifies, unchanged
and still tuned against it. Everything else in draft A — the opacity equation, the
fairness guarantee, three blind guesses, the dried-out rule, the rhythm metric,
scoring — is untouched.

## 1. The complaint

> "for A it takes too long for the dissappearing to happen"

Correct, and it was arithmetic rather than taste. Measured on the old model with
`node tools/balance.js` (five seeds, five typist profiles):

| typist | ink half-dried at | first hole at | run ends |
|---|---|---|---|
| metronome 200 | 48s | 98s | 111s |
| tight 150 | 53s | 83s | 92s |
| normal 110 | 40s | 75s | 81s |
| ragged 110 | 28s | 67s | 76s |
| slow 70 | 28s | 45s | 56s |

Two thirds of every run had no visible state change. The cause:

```
demand += max(0.5, (0.85 * sustained - demand) * 0.07) * dt
```

- The eased term **converges to `0.85 * v` and stops.** It cannot carry the demand
  past there, ever.
- The ink only visibly dries at `ratio = 1.125` (`demand = 0.89 * v`) and the hole
  only opens at `ratio = 0.94` (`demand = 1.064 * v`). **Both are above where the
  eased term converges.**
- So the whole interesting part of the climb — the last `0.21 * v` wpm — was
  covered by the `0.5 wpm/s` *floor* alone: `~0.43 * v` seconds, which gets
  **worse the better you are**. That is the table above.
- The `0.07` ease (a ~15s time constant) then spent another ~30s just getting the
  demand up to the player's doorstep.

Two separable faults: *where* the demand converged, and *how slowly* it got there.

## 2. Options considered

Judged against: does the pressure arrive inside ~10s at *any* speed; is it still
fair (`opacity(W) == 1`, no unseen death); is it still legible as a mechanic; is it
measurable; and does the player have something to work toward.

### A. Shorten the ease time constant (0.07 → 0.6)

The one-line fix. Rejected on its own: it only moves the start of the dead zone
earlier, because the demand still converges below the drying band. Measured: fade
13–15s, first hole 28–57s.

### B. Raise where the demand converges (`0.85 → 0.88–0.95` of sustained)

Parks the resting ratio inside the drying band, so the ink is permanently half-dry
and any dip in your own speed opens a hole. Measured, with ease 0.6: at 0.88, fade
6–9s, hole 23–48s, runs 34–53s; at 0.95, fade 5–7s, hole 18–26s, runs 27–34s.

Worked, and was implemented and measured before the direction changed. Two things
were wrong with it as a destination: above 0.88 the run-length spread collapsed
(draft C shares the ratchet, and at 0.92 its durations went flat at 68–70s for 75,
115 and 165 wpm — skill stopped buying depth), and more importantly the pressure
was still defined by the player's own past performance, so there was nothing to
work *toward*. It is kept here as the measurement that proves the diagnosis in §1.

### C. A compounding ratchet: `demand += r * demand * dt`

Scale-free, so the squeeze arrives at the same second whatever your speed.
**Rejected, measured.** At `r = 0.025` pressure arrived at 15–18s for every
profile as designed, but scale-freedom cuts both ways: the demand doubles every
28s, the hole deepens as fast as it opened, and every run — 70 wpm or 200 — ended
at 18–20s. It turns a difficulty curve into a timer. Recorded in `survival.js`.

### D. Calibrate off the player's first few seconds and start immediately

Watch 3–4s, set the demand to a fixed fraction of the measured speed, ratchet from
there. Rejected: it makes the opening a calibration the player can game — type
slowly for four seconds, get a low bar for the whole run — and it needs a special
case for "the first four seconds" where the rest of the curve has no seams.

### E. Per-character dwell timer

Each character fades from when it entered view: `opacity = g(now - enteredAt)`.
Rejected, as the original spec already argued: perceptually near-identical to the
ratio form (a pause makes `v` decay, which fades everything), costs per-character
state, and tunable only by feel. The one real difference is that it would dry the
page during a pause before the rolling average had moved — slightly more
responsive, at the cost of `opacity(W) == 1` becoming a thing you maintain rather
than a thing that is true.

### F. Demand as a function of distance typed

Rejected: it inverts the incentive. Typing fast would bring the squeeze on sooner
in wall-clock terms, so slowing down would buy time — exactly the sandbagging the
design excludes.

### G. Ramp within a chapter, reset slightly at each boundary

Rejected on the hard constraint: the demand must never decrease. It would also
reward *arriving* at a boundary rather than playing well.

### H. **A goal wpm the player chose, which the ink paces them against** ← chosen

The demand is not a chaser at all. The player picks a goal, the demand ramps from a
gentle opening to it over ten seconds, and then **holds there forever**.

This is what the player asked for, and it happens to fix the complaint exactly:
because the ramp is a *fraction of the goal*, the time to the ink visibly drying is
the same at every speed — it cannot get worse the faster you type, which was the
old model's structural fault. It also gives the pressure a meaning the old curve
could not have: the drying ink is a **pacer**, and the number it is pacing you
against is one you chose and can work toward.

The existing opacity curve already produces the feel without being touched:

| your speed vs the goal | ink under the caret | what it is |
|---|---|---|
| 1.35 × goal or more | 1.00 | crisp — you are well clear |
| 1.10 × | 0.50 | drying, plainly |
| 1.00 × | 0.30 | readable, but only just: you are on the line |
| 0.94 × | 0.18 | the hole opens |
| 0.90 × | 0.10 | ~5 characters unreadable |

## 3. The model (implemented)

### 3.1 The pacer

In `src/survival.js`:

```js
LEVELS   = [40, 55, 70, 85, 100, 115, 130, 150, 170, 190]   // +20 per rung past the top
RAMP_SECONDS     = 10
OPENING_FRACTION = 0.5       // the ramp starts at half the goal
HOLD_SECONDS     = 10        // time at or above the goal to have REACHED it
HOLD_RELEASE     = 0.97      // a dip inside this pauses the hold, it does not reset it

demand(t) = from + (goal - from) * smoothstep(clamp(t / RAMP_SECONDS, 0, 1))
ratio     = v / demand                                      // unchanged
```

- **Why a ramp rather than starting at the goal.** Rolling wpm means nothing for
  the first ten keystrokes (`metrics.isWarm`), and a cold page already at the goal
  would spend strikes before the player had read a word.
- **Why smoothstep rather than linear.** The opening stays gentle and the curve
  lands on the goal without a corner, so there is no moment where the drying
  visibly changes rate.
- **The value only ever rises.** Monotone within a level, and a level is only ever
  stepped *up*, from wherever the value had reached.

### 3.2 Reaching a goal, and the ladder

Hold your rolling wpm at or above the goal for ten continuous seconds and you have
**reached** it. Dips shallower than `HOLD_RELEASE` pause the hold rather than
resetting it, because rolling wpm over 3s wobbles by a few per cent even for a
metronome and a hold that any wobble resets is a hold nobody can finish.

Reaching does **not** end the run: the goal steps to the next rung, the ramp runs
again from the current demand, and the chapter texture steps with it. One run can
therefore clear several levels and the mode stays endless. Cleared rungs persist in
`localStorage` under `cadence.goal.v1`, along with the chosen goal and the best
goal ever reached, so the ladder is progression across sessions.

Chapters key off the **goal**, not the ramping demand, so the level ladder and the
texture ladder line up — clearing a level is also what changes what your hands are
doing. Keying them off the demand would walk a player through three textures in the
first ten seconds of every run.

### 3.3 The drying lag — `DRY_TAU = 1.6s`

One constant had to be added to make goal-matching play survivable, and it is a
measured fix rather than a taste one.

Rolling wpm over 3s wobbles by 4–8% even for a metronome, because the text's hand
and finger transitions are not uniform. The hole opens below 94% of the goal, so a
player typing *exactly at* their goal was flickering in and out of blindness, and a
blind character is wrong about a third of the time. Measured: on-goal runs ended in
**16–44s** — a slow death, not a line you could sit on.

So the ratio the page is drawn from lags the estimator:

```js
ratio = target >= ratio ? target                                   // catching up is instant
                        : ratio + (target - ratio) * (1 - exp(-dt / DRY_TAU));
```

Asymmetric on purpose. Catching up is instant, because pushing hard has to be
rewarded immediately and a player who speeds up should see the page clear under
their fingers. Falling behind takes 1.6s to register, so a 300ms stumble barely
moves the ink while a real slowdown dries the page within a couple of seconds. It
is also the literal reading of the premise: ink takes a moment to dry.

Measured at 0.9s, 1.6s and 2.5s. 0.9s left `normal 110` and `slow 70` dying on
their own goal; 2.5s softened the ten-per-cent-under death from 10–20s to 13–22s
and pushed the fade out to 8–9s. 1.6s is the setting where on-goal play is
survivable for every steady typist and under-goal play still kills promptly.

## 4. Measured

`node tools/balance.js` now solves for each typist's goal rather than assuming it,
because in draft A *what* you type depends on the goal (chapters key off it), and a
nominal 200 wpm typist types generated text at 178 and top-row text at ~150. Three
bands per profile: on the goal, 10% under it, 10% over it. `fade` is the first
moment the ink under the caret is below 0.55, `hole` the first moment the page is
unreadable there, `strike` the first strike.

```
  typist                     goal    wpm   fade    hole    strike  reached   ends      score
  metronome 200 on goal        196    185  8s    18s     18s     0.0         27s      16,628
  metronome 200 10% under      216    187  7s    9s      10s     0.0         10s       6,649
  metronome 200 10% over       171    179  10s   24s     24s     1.0 @11s    25s      15,896
  tight 150 on goal            142    137  9s    26s     78s     0.0        121s      40,353
  tight 150 10% under          156    138  7s    10s     11s     0.0         13s       4,345
  tight 150 10% over           127    137  10s   34s     35s     2.0 @11s    37s      13,501
  normal 110 on goal           108    107  9s    68s     85s     0.6 @56s    97s      19,092
  normal 110 10% under         119    106  7s    12s     14s     0.0         17s       3,262
  normal 110 10% over           97    107  13s   40s     44s     2.0 @11s    49s      10,200
  ragged 110 on goal           108    106  9s    32s     34s     0.2 @58s    65s       9,231
  ragged 110 10% under         119    106  7s    12s     12s     0.0         16s       2,239
  ragged 110 10% over           97    107  14s   67s     68s     2.0 @16s    69s       9,773
  slow 70 on goal               71     71  9s    33s     33s     0.2 @229s  106s       9,405
  slow 70 10% under             78     71  7s    11s     14s     0.0         20s       1,600
  slow 70 10% over              64     72  13s   36s     38s     2.0 @17s    49s       4,407
```

**Pressure arrives in 7–10s at every speed and at every goal.** That is the whole
point of the change, and the number is now a property of the ramp rather than of
the player: it cannot drift with skill. It was 28–53s, worse the faster you typed.

**A player 10% under their goal dies in 10–20s**, having gone blind at 9–12s. The
survivable band is `0.94 × goal` and up: six per cent, which is what "slightly
below and you can barely keep up" has to mean if the hole is to mean anything.

**Typing at your goal is sustainable, with one honest exception.** Solved so that
each profile's goal equals its own mean rolling wpm, with the ladder step-up
suppressed, over five seeds and a 240s cap:

| typist | solved goal | lasts | survived the full 240s |
|---|---|---|---|
| metronome 200 | 187 | 240s | 5 / 5 |
| tight 150 | 137 | 240s | 5 / 5 |
| normal 110 (jitter 0.22) | 107 | 227s | 4 / 5 |
| slow 70 (jitter 0.25) | 71 | 107s | 1 / 5 |
| ragged 110 (jitter 0.55) | 108 | 68s | 0 / 5 |

So goal-matching play is survivable for a *steady* typist and not for a ragged one.
That is the game's own axis doing its job rather than a bug — the hole opens on
sustained dips, and raggedness is a machine for producing them — but it is worth
stating plainly: **the goal is a rhythm test as much as a speed test.** If that
reads as too harsh in the browser, the dial is `DRY_TAU`, and 2.5s brings `slow 70`
to 3/5 and `normal 110` to 5/5 at the cost of softening the under-goal death.

With the ladder live, on-goal runs end sooner than the table above (27–121s)
because clearing a level raises the goal by 10–15% and a player who cannot
immediately find that extra 15% is then under their goal — which is exactly the
10%-under row, i.e. ~15s. **That is the arc: you climb until you cannot.** The
level you cleared is banked before the run ends, so the progression keeps what you
earned. If stepping up mid-run reads as a punishment rather than a promotion in the
browser, the alternative is to end the run in success on reaching the goal, and the
only change needed is in draft A's `tick`.

Draft C is unaffected by all of this. Its balance against the self-adjusting demand
is unchanged (`node tools/sweep-c.js`: safe 46,059, greedy 50,961, adaptive 62,082
— adaptive beats the best pure strategy by 21.8%).

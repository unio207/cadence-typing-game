# cadence — design (draft A, "drying ink")

A locally-played typing game for fast typists. No build step, no server, no audio.

Date: 2026-10-01

> **This spec describes draft A only.** Two further drafts were built over the same
> engine and are specified in `2026-10-02-drafts-b-and-c.md`. Where the two documents
> disagree, the second is newer. Sections 5–7 and 9 (visual system, motion, engine,
> content) are shared by all three drafts; sections 1, 3, 4 and 8 are draft A's own.
>
> Implementation note: the shipped build is `index.html` plus `src/*.js` classic
> scripts, with `node tools/bundle.js` producing a single-file `cadence.html`. §12's
> "one `index.html`" was relaxed so the pure logic could be unit-tested without a
> bundler.

## 1. Premise

The ink dries while you type. Every character begins crisp when it enters your view
and fades from that moment on, so by the time your caret arrives it is only as
legible as your speed earned. The game raises the drying rate for as long as you
survive. Fall behind and a hole opens in the page just ahead of your fingers, and
you type across it from memory or you don't.

One endless mode. You are trying to keep up with the page; the page never meets you
halfway.

Monkeytype measures speed and accuracy. A metronomic 120 WPM and a lurching 120 WPM
score identically there, but they feel nothing alike to type. cadence scores the
third axis — **rhythm**, the evenness of your keystroke intervals — as the score
multiplier, while survival is a pure speed question.

## 2. Design principles

1. **Retry in under 200ms.** `tab` restarts instantly from anywhere, including
   mid-run. The result screen is never a gate.
2. **The page is the HUD.** How well you are doing is legible in the ink itself,
   without looking away from the text you are typing.
3. **Every death is attributable.** You can only be killed by being wrong about
   something you could not see — which only happens if you fell behind, which you
   felt happening several seconds earlier.
4. **Protect flow.** No stop-on-error, no backspace, no flashing, no shake, no
   sound. Pressure comes from momentum, not from threat.
5. **Difficulty discloses itself.** The drying, the hole, the dark — none of it
   appears until you are fast enough to meet it. There is no tutorial because
   there is nothing to explain at 40 WPM.
6. **Reward is information.** Playing well makes the page readable, which makes
   playing well easier. Decoration is never the prize.
7. **No input latency.** Keystrokes are timestamped in the `keydown` handler;
   rendering never blocks input.

## 3. The survival model

This is the whole game and it is one equation.

```
W         = 40                             // read-ahead window, characters
v         = rolling WPM over the last 3.0s
sustained = median of v sampled every 250ms over the last 20s
                                           // < 4 samples yet → target = 40

// demand is a state variable, not a function of t. it only ever rises.
demand(0) = 40
each frame:  demand += max(0.5, (0.85 * sustained - demand) * 0.07) * dt

ratio = v / demand

base       = clamp((ratio - 0.85) / 0.50, 0, 1)   // ink at the caret
f          = 0.85 * W * clamp((0.94 - ratio) / 0.40, 0, 1)
                                                  // blank front, 0 – 34 chars
opacity(d) = base + (1 - base) * clamp((d - f) / (W - f), 0, 1)^0.8
blind      = opacity(0) < 0.18                    // i.e. ratio < 0.94
```

Properties worth stating explicitly, because they are the design:

- **The newest characters are always crisp.** `opacity(W) = 1` unconditionally, so
  text entering your view is fully legible no matter how badly you are doing. You
  always get a fair look at everything before it dries. Without this the mechanic
  is just cruelty.
- **The oldest characters are the ones under your fingers.** A character at the
  caret entered your view 40 characters ago and has been drying the whole time, so
  the pale region is immediately ahead of the caret and the crisp region is further
  out. You read the future and recite the present.
- **You go blind below 94% of the demand**, and the width of the unreadable hole is
  a direct, continuous readout of how far behind you are. The `f` term is what
  makes the hole a hole: without it `base` bottoms out at 0 and the gradient alone
  caps the unreadable region at under five characters — less than one word, which
  cannot carry the "reciting from memory" state the game is built on. At
  `ratio = 0.74`, `f` is 17 characters fully blank and about 20 below legible.
- **The demand only ever rises, and it eases toward you rather than snapping.**
  `demand` is a state variable whose rate is `max(0.5, (target - demand) * 0.07)`,
  so it climbs at least 0.5 WPM/s always and faster when you are well ahead of it —
  a ~15s time constant. Two earlier formulations were wrong and are recorded here so
  they are not reintroduced: a pure clock term left a 100 WPM typist with 68
  seconds of no visual change and 2:13 of invulnerability; adding a hard
  `max(clock, 0.85 * sustained)` fixed the opening but froze the demand at 85 for
  the 89 seconds it took the clock to overtake it. The eased form has neither dead
  spot.
- **The target is 85% of your *sustained* speed** — the median of `v` over 20s, not
  the peak — so a one-second burst does not permanently raise the bar and punish
  you for it.
- **Pushing hard is always correct.** The target sits *below* your demonstrated
  speed, so raising it never outruns you, and points per second scale with `v²`
  (more characters, each worth more). A slow run scores less per second *and* ends
  sooner. There is no sandbagging strategy, and therefore no need to scale points
  by demand to prevent one.
- **Runs land between about one and two minutes**, longer the better you are:
  70 WPM falls off near 1:00 (demand ~75), 100 WPM near 1:25 (demand ~106), 160 WPM
  near 2:00 (demand ~170). Skill buys depth, not a different game.

Opacity is computed from `ratio` rather than by simulating a per-character drying
timer. The two are perceptually identical — a pause makes `v` decay, which fades
everything, exactly as a timer would — and the direct form is cheaper, has no
per-character state, and is tunable by three constants instead of by feel.

## 4. How a run ends

Two rules, both the same idea, both expressed in ink rather than in UI.

**Three blind guesses.** A wrong key while `blind` is a strike. Three strikes ends
the run. A wrong key on legible ink is *not* a strike — it costs combo and score
and nothing else. So the only way to lose is to be wrong about something you had
fallen behind on.

**Or the page dries out.** If `blind` holds continuously for 2.0s with no correct
keystroke, the run ends. This covers stalling, hesitating, and taking your hands
off the keyboard, and it needs no separate idle timer — it is the same ink, just
fully gone.

Strikes render as three smudges in the top-right corner. They and the demand notch
are the only red on screen besides error characters.

## 5. Visual system

Accent-free ink on warm paper.

```
--paper        #f7f4ec   warm cream
--ink          #17171a
--ink-done     #c2bdb0   characters already typed
--mute         #a3a098   labels
--rule         #e6e2d7   hairlines
--red          #b4412f   error characters, strikes, demand notch, new record
```

Type is IBM Plex Mono at weights **400 and 500 only** (Google Fonts ships static
weights; 450 is not a real weight and would be synthesised). The face is
monospaced, so a 400→500 shift does not change advance width and causes no reflow.

Labels are 9–10px, uppercase, `letter-spacing: .2em`, `--mute`. All numerals are
`font-variant-numeric: tabular-nums` so they do not jitter while counting.

The caret is an **inverting block**: a solid `--ink` rectangle one character wide
with the glyph inside rendered in `--paper`. It is the highest-contrast element on
screen and sits on exactly the character that matters — which is also the character
that is hardest to read, so the block is doing mechanical work, not just marking
position.

Palette lives in CSS custom properties on `:root`, so a night theme is a later
one-file change (§11).

## 6. Motion system

One `requestAnimationFrame` loop drives everything. Two curves only:
`cubic-bezier(.33,1,.68,1)` for UI, and a critically-damped spring for the caret
and scroll. Nothing blinks, flashes, shakes, or glows.

Scroll position is a **continuous float**, not a character index:

```
targetX = caretIndex * charWidth
x      += (targetX - x) * (1 - exp(-k * dt))     // k ≈ 14
```

The block caret springs on the same model with a lower `k`, so it stretches toward
its target rather than stepping between characters. The resulting lag during a
burst is kept deliberately, as evidence you are outrunning the page.

Displayed score, WPM and rhythm interpolate toward their true values, so the
numbers read as counting rather than ticking.

`@media (prefers-reduced-motion: reduce)` sets springs to immediate.

## 7. Engine

### 7.1 Input

`keydown` on `window`. Ignore events with `ctrlKey`/`metaKey`/`altKey` and any
`e.key.length > 1` except `' '`. `preventDefault()` on `Tab` and `' '`. Record
`performance.now()` immediately, before any rendering work.

Content is lowercase with no punctuation and no capitals, so the comparison is a
plain `key === expectedChar`. Shift and caps lock are never required.

### 7.2 Errors

A wrong key **is let through**: the character is marked as an error, the cursor
advances, combo resets to 0, that character earns no points, and — if `blind` — a
strike is spent. No freeze, no backspace, no desync. Error characters render in
`--red` at 55% opacity in the trail behind the caret.

Error keystrokes still count as keystrokes for rhythm: rhythm measures hand motion,
not correctness.

`accuracy = correct / total` keystrokes.

### 7.3 Rhythm

```
intervals: d[i] = t[i] - t[i-1], each clamped to 600ms max
window:    last 16 intervals
m    = median(d)
devs = sort(|d[i] - m|)
devs.pop()                      // forgive the worst single slip, explicitly
cv   = clamp(mean(devs) / m, 0, 1)
rhythm = round(100 * (1 - clamp(cv / 0.35, 0, 1)))
```

**This is deliberately not median absolute deviation**, which the first draft of
this spec specified and which was wrong. MAD has a 50% breakdown point: ten even
intervals among sixteen hold the median deviation at exactly zero, so a badly
lurching 10/6 split scored a perfect 100 and the metric only responded once *more*
than half the window deviated. Dropping the single largest deviation and taking the
mean of the rest keeps the one-hiccup forgiveness — now an explicit rule rather
than an accident of the estimator — while responding to clusters.

Fewer than 8 intervals yields `rhythm = 50` and `rhythmMult = 1.0`, so the opening
keystrokes never produce a wild number.

Measured response, pinned by tests:

| pattern | rhythm |
|---|---|
| perfectly even | 100 |
| one slip of any size | 100 |
| two gentle slips (180ms against a 100ms median) | 85 |
| intervals within ±5% | 91 |
| intervals within ±15% | 74 |
| two hard stalls (400ms+) | 43 |
| ten even, six slow | 0 |
| alternating fast/slow | 0 |

### 7.4 Score

```
speedMult  = clamp(v / 60, 0.5, 3.0)
rhythmMult = 0.6 + 0.9 * rhythm / 100       // 0.6 – 1.5
comboMult  = 1 + min(combo, 300) / 300      // 1.0 – 2.0

per correct char:  score += 10 * speedMult * rhythmMult * comboMult
per wrong char:    combo = 0, no points
```

Accumulated as a float, displayed rounded. Survival is pure speed, so rhythm is
what separates two players who both died at 4:00.

### 7.5 The rhythm rail

A hairline tick per keystroke on a `<canvas>` below the text, scrolling leftward at
a fixed px/ms. Even cadence draws a comb; lurching draws something ragged. Tick
opacity is `0.3 + 0.55 * (rhythm/100)`. Canvas rather than DOM because it is a few
hundred 1px marks redrawn every frame; keep the last ~400 timestamps in a ring
buffer.

### 7.6 Render

- A window of ~120 characters around the caret is rendered as `<span>`s inside a
  transform-animated container. Spans are **reused**; only the inline opacity and
  class of indices that changed are touched. No node creation per keystroke.
- Per-character opacity is recomputed each frame for the ~40 characters ahead of
  the caret only. Everything behind the caret is `--ink-done` or `--red` and is
  touched once, when it is passed.
- `charWidth` is measured once from a hidden sample after `document.fonts.ready`,
  and re-measured on `resize`.
- The block caret is a separate overlay: a 1ch-wide `overflow:hidden` element
  holding a clipped copy of the character window in `--paper`, sharing the scroll
  transform so the glyph stays registered.

## 8. Chapters

The run walks through eight textures while the demand climbs underneath. Each
chapter changes what your hands are doing; none of them changes the rules.

**Chapters advance on `demand`, not on elapsed time.** Since `demand` is monotonic
(§3) the sequence can only move forward, and keying it this way means a fast player
passes through more chapters than a slow one — progression measures skill rather
than patience. Keying on time instead would mean a 70 WPM player and a 160 WPM
player see the same two chapters before dying, which wastes the content.

| from demand | chapter | texture |
|---|---|---|
| 40 WPM | open field | alternating hands |
| 60 | home ground | home row dominant |
| 80 | common tongue | top-200 words only |
| 100 | short work | 2–4 letter words |
| 120 | inward roll | same-hand inward rolls |
| 140 | long form | 6–9 letter words |
| 160 | one hand | long single-hand runs |
| 180 | thin air | top row |

Because the demand eases up from 40 for everyone, every run opens on `open field`
regardless of how fast you are — a 160 WPM typist is not dropped into chapter six.
With the run lengths in §3, a 70 WPM player dies in `home ground`, 100 WPM in
`short work`, 160 WPM in `one hand`; `thin air` is reserved for players above
roughly 190 WPM, and past it the chapter holds while the demand keeps rising.

A chapter change switches only the generator's filter, and only at the next word
boundary. It is not announced by any animation — the words simply change character,
and the chapter name sits in the corner of the HUD for anyone who looks.

## 9. Content

Lowercase only. No punctuation, no capitals, no digits.

**Pool:** ~600 common English words, 2–9 letters, each tagged at build time with
its per-letter hand sequence, row profile and finger sequence, derived from a
QWERTY key map.

**Assembly:** sample a candidate from the chapter-filtered pool, score it, accept
or reject. Rejection rules:

- the word appeared within the last 12 words
- three consecutive words starting with the same letter
- same finger across the word boundary with no travel (e.g. `my gym`)
- more than two consecutive same-hand words — *except* in `one hand`, where that
  is the requirement rather than the fault

Scoring prefers alternating-hand transitions, and known rolling bigrams in
`inward roll`. Chapter filters are predicates over the tags (e.g. `short work`:
`len <= 4`; `home ground`: ≥80% of letters in the home-row-adjacent set;
`thin air`: ≥70% top-row letters).

Text is generated live in chunks ahead of the caret with a random seed per run. The
generator is deterministic given a seed, which is what makes it testable (§13).

## 10. Screens, keys and records

Three screens: **title**, **run**, **result**.

The title screen shows the two records and nothing else. There is no menu and no
start button — **typing any letter begins the run**, and that letter counts as your
first keystroke.

```
title    any letter  begin
run      tab  restart instantly        esc  back to title
result   tab  again    c  copy score   esc  title
```

Records, in `localStorage` under one key:

```json
{
  "v": 1,
  "longest": { "ms": 252000, "score": 182400, "wpm": 148, "rhythm": 91 },
  "highest": { "ms": 231000, "score": 194800, "wpm": 156, "rhythm": 94 }
}
```

Longest run and best score are tracked as two separate records, because they are
genuinely different achievements — a cautious run survives longer and a reckless
one scores higher, and you can beat one without the other. A malformed or absent value resets to defaults rather than throwing.

`c` copies one line:

```
cadence · 4:12 · 182,400 · 148wpm · r91 · chapter 7
```

The result screen shows the duration at ~92px, the score beneath it, `new record`
in `--red` when applicable, then WPM (avg), peak WPM, rhythm and accuracy, and a
hairline strip of the run's WPM curve against the demand curve — the one chart in
the game, and it shows you exactly where the demand caught you.

Beneath that, **the page**: the last ~200 characters of the run reprinted with each
character inked at the weight of your rhythm when you struck it, and errors marked
in red. Smooth stretches print solid; stumbles print pale. It is a readable record
of how you typed, not just what — the game's premise as a single image.

## 11. Out of scope for v1

Fixed authored levels and per-level PBs (`passage`), timed runs (`sprint`), night
theme, sound, run history, lifetime rank, online leaderboards, shareable ghost
replays, mobile and touch support, custom text import, multiplayer.

`passage` and `sprint` were specified and cut deliberately: a fixed-length level is
incompatible with a demand curve that only makes sense over minutes. They remain
plausible later additions and the engine does not foreclose them — the demand rule and
the text source are the only two things they would need to override.

## 12. Implementation

**One `index.html`.** No build step, no modules (ES modules are blocked under
`file://`), no dependencies. Sections in order, separated by banner comments:

```
1  palette + type + layout      (CSS)
2  key map + word pool          (data)
3  generator                    (pure, seeded)
4  rhythm + scoring             (pure)
5  survival model               (pure: demand, opacity, blind)
6  renderer: text, caret, rail
7  input
8  screens + persistence
9  rAF loop
```

Sections 3–5 are pure functions with no DOM access, which is what makes them
testable. Fonts load from Google Fonts with a `ui-monospace, "SF Mono", Menlo,
monospace` fallback and `font-display: swap`. Inlining the two weights as base64 for
full offline use is a later one-line change, noted and not done.

Desktop only. Keyboard required.

## 13. Verification

The load-bearing pieces are pure functions, so they are checked directly rather
than by playing. All of it runs behind a `?test=1` flag that replaces the title
screen with a results list — no test runner, no package manager.

- **Survival model.** Assert `opacity(W) == 1` for every value of `ratio` including
  `ratio = 0` (the fair-look guarantee — if this fails the game is unfair and the
  mechanic is dead; the `0.85 *` cap on `f` is the only thing holding it). Assert
  `blind` is true at `ratio = 0.93` and false at `ratio = 0.95`. Assert the
  unreadable region is about 5 characters (5.2) at `ratio = 0.90` and about 20
  (19.7) at `ratio = 0.74` — the hole has to actually open, which is the bug the
  `f` term exists to fix.
- **The demand.** Feed synthetic speed histories and assert: it never decreases,
  however the input varies, including when the player stops entirely; it rises at
  no less than 0.5 WPM/s when the target is below it; a sustained 100 WPM reaches
  ~78 within 30s and crosses the blind threshold near 1:25; a one-second burst to
  180 inside an otherwise 100 WPM run does *not* move it (median, not peak); and it
  never plateaus — no 5-second span passes with zero increase. That last assertion
  is the regression test for both formulations that failed.
- **Strike rule.** Replay a scripted keystroke sequence and assert a typo at
  `ratio = 1.2` spends no strike while a typo at `ratio = 0.8` spends one, and that
  three of the latter end the run. This is the rule the whole fail state rests on.
- **Rhythm.** Feed synthetic interval arrays and pin every row of the response
  table in §7.3. The two load-bearing rows are opposite failure modes: one slip of
  any size must score 100 (a metric that punishes an involuntary stumble makes the
  game unplayable) and the ten-even/six-slow split must score 0 (this is the case
  the original MAD formulation got wrong, scoring it 100).
- **Score.** Replay a scripted `(char, timestamp)` sequence and assert the total is
  deterministic and matches a hand-computed value for a short sequence.
- **Generator.** Generate 200 chunks per chapter and assert no rejection rule fires
  in any of them, and that the same seed always produces the same text.
- **Frame cost.** Log frame time during a 160 WPM synthetic keystroke replay and
  confirm the rAF loop stays under 8ms per frame. Input latency is the one thing
  that cannot be allowed to regress.

# Why cadence feels the way it does

This records the reasoning behind the October 2026 "feel" pass (commit `863e492`):
what was changed, what it was based on, what was measured, and what was tried and
dropped. The original design spec is in `docs/superpowers/specs/`; this file is
about the decisions made after it. The full research is in
`reports/Satisfying typing game design.md`, with the source notes in
`research_notes/Satisfying typing game design/`.

Every number below was read from a command or file during that pass. Where a
choice is a judgment call and not backed by a source, it says **inference**.

## The idea

Research on game feel points at one thing: an action should get a clear, immediate
result, bigger events should get bigger responses, and the response should depend
on how well the player did, not just fire every time. The strongest support is
Kao et al. (CHI '24, n=1,699, preregistered): feedback that only amplified lowered
motivation, while feedback tied to success raised it.

Cadence already did the keystroke-level work well. The caret spring (about 111 ms)
and scroll spring (about 71 ms) sit inside the 85 to 150 ms caret glide Monkeytype
ships, so they were **left alone**. The weak spots were the edges of a run and the
rare big moments: death was a same-frame hard cut, clearing a goal only swapped a
label, and strikes got almost no response. Those are what changed.

Sound stayed out. Design principle 4 in the spec excludes it on purpose.

## What shipped, and why

### Three bugs, fixed first

- **The rhythm rail was not drawing at all.** Commit `5ad6141` deleted the `.branch`
  selector but left its body (`letter-spacing: -.01em; color: var(--ink);
  display: none; }`) behind. CSS parsing folded that into the next rule's selector
  and dropped `#rail`, so the canvas was 0x0. Seen in the browser before the fix
  (rail 0 px wide) and after (1180x22). No test parses the CSS, so it had gone
  unnoticed.
- **Reduced motion only reached CSS.** Nearly all of cadence's motion is JS (the
  springs and the typing pulse), so the media query did nothing for it. `render.js`
  now reads the preference once: springs snap to target and the pulse is 0. The
  shell reads it once for the death and goal animations. It is read at load, so a
  change mid-session needs a reload. Verified in Node; the real OS setting has not
  been tried in a live tab.
- **The result screen could be skipped.** Any letter on a non-run screen started a
  run, so a player still typing when they died started a new run on the next key
  (reproduced in the browser). Now only Tab and Enter restart from the result
  screen, and the key that starts a run from the title is not counted as
  keystroke one (the text was not on screen yet). Tab still restarts from anywhere,
  so retrying is still one key.

The stale "esc drafts" hint on the result screen now says "esc title".

### Death holds for a beat

On the killing keystroke the line freezes exactly as it was, so the gap that killed
you stays on screen. The struck glyph (strikes) or the caret (dried) is marked in
red with an underline. After 400 ms the run fades out over 200 ms (ease-in), then
the result fades in over 300 ms (`--ease`). About 900 ms total, under Nielsen's 1 s
limit for keeping a flow of thought. Tab skips it on any frame.

- The 200 and 300 ms values and their easing directions come from NN/g's guidance
  (exit 200 to 250 ms ease-in, entrance about 300 ms ease-out).
- The 400 ms hold is **inference**. No source gives a death-pause length. Hitstop
  research (Nijman's 10 to 20 ms) is about repeated hits, not a run ending.
- Why: the spec promises "every death is attributable", and a hard cut gave the
  player no moment to see why. The flow research also says restart time is the real
  death penalty (the Super Meat Boy argument), so the beat is skippable.
- Four tests in `test/shell.test.js` cover the routing and timing points. The real
  fade was not watched at speed (see "What is not verified").

### A new chapter's words arrive in seconds

The HUD showed the new chapter immediately, but 200 to 330 characters of old-chapter
text were already buffered. Measured with the synthetic typist: the first
new-chapter character arrived a mean of **23.9 s** after a step-up. Worse, in **17
of 45** chapter changes the new chapter was never typed at all, because a level
lasts about 10 s and no new chunk was generated in that time.

Now, on a chapter change, the text past the visible edge is cut at a space and
regenerated from the new chapter. Mean lag is **6.6 s** and 0 chapters are skipped
(5 profiles, 5 seeds, 240 s cap).

- The cut is at least 60 characters past the caret (`KEEP_AHEAD`). Measured in
  Chrome, at most 43 characters are visible right of the caret (stage capped at
  1180 px, 30 px Plex Mono at 17.7 px a glyph), so the swap happens off screen.
  This is a pixel fact written into game logic: if the font size, stage width or
  caret position change, 43 has to be measured again.
- The generator's no-repeat memory is rebuilt from the words actually kept
  (`rewind`), so the first new word is judged against what is on the page.
- The renderer repairs the stale slots 4 per frame, nearest the caret first.
  Recycling them all at once was a 47-write frame, which the existing burst test
  (budget 40) rejected. The repair takes about 13 frames.
- Over 477 keys and two cuts in Chrome, 0 frames showed a wrong glyph. The same seed
  now gives different text after the first chapter change.

### Reaching a goal is an event

Clearing a goal is the only progression moment and it was a label change. Now:

- The "holding n/10" label is replaced by a 1 px hairline under the goal number
  that fills over the 10 s hold. It does exactly what the hold clock does (pauses on
  dips inside `HOLD_RELEASE`, resets below). The goal-gradient effect (Kivetz et
  al.) says a visible filling target increases effort near the end.
- On a step-up the line holds full for 150 ms and fades over 300 ms, the goal counts
  up over 300 ms (ease-out cubic), the chapter name crossfades over 250 ms, and the
  rail gets one full-height tick that scrolls with the keystroke marks. Nothing
  flashes or shakes, which fits the "nothing glows" rule.
- Timings are NN/g's 100 to 400 ms range applied by judgment (**inference**).
  Measured in Chrome: the number went 40 to 55 in about 207 ms, and the line was
  0.451 full at 4.5 s into the hold.
- The spec's pacing note worried that a step-up could read as a punishment. This is
  the cheapest way to make it read as a promotion.

### The breather

A step-up now ramps from `0.92 x` the old goal, so the page refills for a moment
before the pressure climbs again (`BREATHER` in `src/survival.js`). The pacing
practice in the research is a rising sawtooth with short relief after peaks, not a
flat ramp.

- The ink math: caret ink at ratio 1.0 is 0.30. After the breather the ratio is
  1/0.92 = 1.087, so ink jumps to (1.087 - 0.85) / 0.5 = 0.474. Measured 0.474.
  It lands one frame after the step-up, not on the same frame.
- Balance effect is tiny. A sweep over k = 1.00, 0.95, 0.92, 0.88 moved summed
  on-goal plus over-goal run length from 769 s to 776 s at 0.92 (the best case,
  0.88, was 779 s, +1.3%). No row moved more than 3 s. Typists below their goal
  never clear a level, so the breather cannot help them survive.
- Why 0.92 and not the sweep's pick of 0.95: the sweep's stated tie-break chose the
  value closest to 1.00, which would equally have kept 1.00. The balance data gives
  no reason either way, so the case rests on feel, and 0.92 gives the visible
  refill (+0.174 against +0.105 at 0.95). That is a **judgment**. If playtesting
  says it is too strong or too subtle, it is one constant.
- The README balance table was rerun with this and the chapter change in place.

### Strikes land

The spent strike dot scales in from 0.4 over 150 ms. The struck glyph is full red
and sits on a small ink blot (a red tint, `color-mix` at 24%) that grows in over
120 ms behind it. The blot is a blob and not a text-shadow because nothing glows
and the text never moves.

- The "instant change, then settle in 100 to 200 ms" shape is from NN/g and from
  Nijman's flash-then-hold hit state. The blot itself, its size and its tint are
  **inference**: the research found no sourced craft for ink or brush effects.
- On the dark theme it reads as a stain under the letter. On the light theme it
  looked more like a highlighter dot than ink, and two strikes in a row merge into
  a figure-8. Not yet tuned.
- `color-mix` needs Chrome 111, Safari 16.2 or Firefox 113. Older browsers get the
  full-red glyph without the disc. The blot depends on `#line` staying a stacking
  context (`will-change: transform`).

## Tried and not shipped

Each of these was built in an isolated worktree and measured. They are not in the
code; this is why.

| Idea | Result | Why it was dropped |
|---|---|---|
| Live rhythm trail (page-print rule applied behind the caret) | 47.7% of a normal 110 wpm typist's trail went pale (opacity under 0.5); 48.0% for 70 wpm; 99.3% for ragged | It tells a normal typist they are ragged. Even a perfect metronome reached only median rhythm 74, because natural letter-pair timing spreads the gaps. A gentler map (`0.45 + 0.55 r/100`) fixed that (0% pale for normal) but the trail also outweighed the text ahead. Revisit with that map and a cap below full ink. |
| Finished words dry as a unit | 82 of 83 tests: the burst test failed (worst frame 56 writes against a 17.7 mean, 3.2x; baseline worst was 48) | Drying a word in one frame moves its writes into one frame. The word being typed also stayed full ink, the same colour as unread text, so only the caret marked where you were. |
| Typed glyph flashes then settles (120 ms) | No measurable cost, probably reads as a faint tail | At 200 wpm about two glyphs are mid-fade, so it is a tail and not a flash. Needed recycle handling, and every glyph cross-fades on a theme toggle. The proposal itself called it optional. |
| Screen fades (250 ms in, 200 ms out) and hiding the cursor while typing | Works; Tab then next key accepted in 0.9 ms median (n=20, hidden tab) | Impact was modest and the overlap (both screens visible for about 200 ms) is a matter of taste. The death beat already covers the one screen change that mattered. Cheap to bring back. |
| Counting HUD numbers | Cut HUD text writes 81% at 100 wpm (7.02 to 1.33 per frame) | The score never settles while you type, so it rolls constantly and lags 0.1 to 0.4 s. Smoother, but the HUD sits at the edge of attention. The write saving alone did not justify it. |

## What is not verified

- **Nobody has played this.** All balance numbers come from the synthetic typist in
  `tools/typist.js`. No real-player data exists. Real hands will differ.
- **The fades were not watched at real speed.** The shared Chrome kept most agent
  tabs in the background, which pauses animation, so most checks used synthetic
  clocks, the computed CSS and end-state screenshots. A foreground run confirmed
  the goal event timings and the key routing. The 400/200/300 ms death fade is
  covered by tests, not by eye.
- **Reduced motion** was checked in Node, not with the real OS setting.
- **The pacing practice is designer lore.** The sawtooth intensity model comes from
  practitioner write-ups (Left 4 Dead's AI Director). The research found no
  controlled study showing a breather beats a flat ramp. It also found no study of
  typing-game feel in particular.
- **Ink craft is inference.** No sourced numbers exist for ink or brush effects,
  or for pause lengths after a death or level-up.

## Not done, on purpose

These were in the report but are not built. Each is a candidate for later.

- A result screen showing the gap to your best and where you died without
  expanding it.
- Keeping cleared goals when you quit mid-run with Tab or Esc (today nothing is
  saved until a run ends).
- Per-goal personal bests and a suggested rung on the ladder.
- A combo that halves on a mistake instead of resetting to zero.
- Checking whether the rhythm score penalizes normal typing, from the data above.
- Optional sound, off by default. The research found no sourced pitch values.

## Tooling notes

- `tools/profile.js` crashes when run with no flags, because its default draft list
  still includes the removed draft C. Use `--draft a`. Its numbers cover
  `render.js` and `draft-a.js` only, so HUD and rail cost is outside it.
- The README says 88 tests, and the suite now has 88.

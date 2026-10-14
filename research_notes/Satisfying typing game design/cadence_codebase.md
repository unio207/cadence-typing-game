# cadence codebase: how the drying-ink game currently works

Scope: local repo `/Users/zou/Desktop/typing_game` at commit `5ad6141` (clean tree). All citations are repo-relative `file:line`. Source of truth is `index.html` + `src/*.js`; `cadence.html` is a bundle produced by `tools/bundle.js` (inlines every `<script src="src/...">`, [tools/bundle.js:15-19]). Re-running the bundler during this research produced no git diff, so `cadence.html` is byte-identical to the src build (line numbers below for CSS/markup are the same in both files, since the bundle only replaces script tags at the end). `./tools/test.sh` ran in this session: 83 tests, 83 pass (README claims 88, [README.md:117]).

Weighting per coordinator: flow, aesthetics, animation, ink visual, and pacing go deep; scoring and word pool stay brief.

## 1. Run flow: title -> play -> end -> restart (screens, transitions, dead time, keypresses)

### Takeaway
There are three screens, switched instantly with `display:none/block` and no transition of any kind. Restart costs one keypress from anywhere (`Tab`, or any letter on the title/result screens, which also counts as keystroke one). Death cuts straight to the result screen on the same frame with no beat. Because any letter on the result screen starts a new run, a player still typing when they die will very likely skip their own result screen.

### Cited Findings
- Screens are three `<section>`s: `#screen-title`, `#screen-run`, `#screen-result` — [index.html:211-244](index.html). `.screen { display:none }`, `.screen.is-active { display:block }`, with no transition or animation on either — [index.html:74-75](index.html).
- `show(name)` only swaps `className` on the three sections — [src/shell.js:110-115](src/shell.js). Every screen change is a hard cut.
- **Title screen** contents: wordmark "cadence · the ink dries while you type", a "best" line (high score · longest duration), the goal-wpm ladder, and the hint "← → goal / any letter begin" — [index.html:211-220](index.html); populated by `renderTitle()` [src/shell.js:119-127](src/shell.js) and `renderLevels()` [src/shell.js:76-94](src/shell.js).
- Goal ladder: `LEVELS = [40,55,70,85,100,115,130,150,170,190]`, past the top it steps +20 — [src/survival.js:83-84](src/survival.js). ←/→ move a rung (title screen only); shift+←/→ moves ±5 off-ladder (`CUSTOM_STEP`), clamped 20-400 — [src/shell.js:23, 61-74, 269-273](src/shell.js). Rungs are also clickable — [src/shell.js:85-87](src/shell.js). Goal, cleared rungs and best goal persist in `localStorage['cadence.goal.v1']` — [src/shell.js:22-42](src/shell.js).
- **Starting a run**: any `[a-z]` or space on a non-run screen calls `startRun()` and then feeds that same key into the engine as keystroke one — [src/shell.js:282-289](src/shell.js); typing keys are `' '` or `/^[a-z]$/` with no ctrl/meta/alt — [src/shell.js:254-257](src/shell.js).
- `startRun()` creates a run with a random seed and the chosen goal, resets renderer and rail, shows the run screen, then measures (rail canvas and char width are only measurable once visible) — [src/shell.js:131-142](src/shell.js).
- **Tab** restarts from any screen, including mid-run: `preventDefault(); startRun()` — [src/shell.js:262](src/shell.js). After Tab the run screen is shown but the clock has not started: `tick` returns early while `startedAt === null` — [src/draft-a.js:134](src/draft-a.js); `startedAt` is set on the first key — [src/draft-a.js:91](src/draft-a.js). So Tab -> idle run screen -> the first letter starts the ramp.
- **Esc** returns to the title from anywhere — [src/shell.js:263](src/shell.js). Mid-run Esc and mid-run Tab both discard the current run without `finishRun()`, so nothing is banked or recorded (inferred from the code path: neither calls `bankGoals`/`recordRun`, which only run inside `finishRun`/`showResult` [src/shell.js:144-156, 220-222](src/shell.js)).
- **Death**: two end reasons — `'strikes'` (3 blind wrong keys, `MAX_STRIKES=3`) and `'dried'` (blind continuously for `STALL_MS=2000`) — [src/draft-a.js:25-26, 122-126, 164-169](src/draft-a.js). Labels: "three blind guesses" / "the page dried out" — [src/draft-a.js:176-178](src/draft-a.js).
- On death, `finishRun()` runs synchronously in the same frame (from `frame()` [src/shell.js:215](src/shell.js), or from `onKeyDown` [src/shell.js:289](src/shell.js)): banks goals, computes duration and average wpm, writes the result sheet, collapses it, shows the result screen — [src/shell.js:144-156](src/shell.js). There is no `setTimeout`, delay, freeze frame or death animation anywhere in `src/` (grep for timers and animation found none besides rAF).
- **Result screen** markup: wordmark "drying ink · <end reason>", duration as the big number, score beneath, "new record" flag in red if longest or highest fell, then a stats row (wpm, peak, rhythm %, accuracy %, goal reached/missed, best combo, chapter reached) and a "page print" of the last 260 chars — [src/shell.js:220-250](src/shell.js). Collapsed by default: `.stats` and `#page-print` are moved into a hidden `.more` wrapper, and a "↓ all stats" hint control is added — [src/screens.js:121-159](src/screens.js). ↓/↑ open/close it — [index.html:287-293](index.html). `c` copies a score line — [src/shell.js:276-280](src/shell.js), [src/screens.js:70-75](src/screens.js).
- Result hint row reads "tab again · c copy · esc drafts" — [src/shell.js:243-244](src/shell.js). "drafts" is stale: the draft chooser was removed in 5ad6141 (commit message).
- **Result screen accepts any letter as "start new run"**: `if (app.screen !== 'run') { startRun(); ... }` applies on the result screen too; only `c`/`C` is intercepted first — [src/shell.js:276-285](src/shell.js).
- Records: `localStorage['cadence.v2']` stores `longest` and `highest` per draft — [src/screens.js:7-63](src/screens.js). Title shows `highest.score · longest duration` — [src/shell.js:120-125](src/shell.js). No run history.
- Design intent: "Retry in under 200ms. `tab` restarts instantly from anywhere... The result screen is never a gate." — [docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md:41-42](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md).

### Inferences
- Keypresses to restart: 1 (Tab, or any letter from title/result). The letter route also spends that letter as keystroke one of the new run, against the first character of fresh text, so it is usually a typo or a lucky match.
- The death -> result cut happens mid-typing for a `'strikes'` death (it is triggered by a keystroke). At 100+ wpm the next keydown arrives ~60-120ms later and, being a letter, immediately starts a new run. The result screen, "new record" flag and stats can flash for one frame and vanish. This contradicts the README's framing of a result screen worth reading and is the most concrete flow bug. A short input-ignore window after death, or requiring Tab/Space/Enter on the result screen, would fix it.
- With no death beat, no freeze and no transition, the end of a run reads as a page swap rather than a moment. Nothing marks *where* on the page you died (the page print shows the last 260 chars but only behind "all stats").
- Mid-run Tab/Esc silently throwing away a goal you held for 10s (`reached` is only banked in `finishRun`) is a minor loss-of-progress risk.

### Gaps
- Not verified in a real browser how many frames the result screen survives under real momentum typing. The claim follows from the key handler code path, not from observation.

## 2. Every animation, motion and per-frame visual (triggers, durations, easing)

### Takeaway
Motion is almost entirely JS-driven per frame from one rAF loop: two exponential springs (scroll and caret), the per-character ink opacity, a decaying "typing pulse", and the canvas rhythm rail. The only CSS animation in the whole game is a 0.3s reveal on the expanded result stats. There are no CSS transitions on game elements, no screen transitions, no keystroke or word-completion effects, no strike animation, no sound. This follows the stated principle "No flashing, no shake, no sound."

### Cited Findings
- **Main loop**: one `requestAnimationFrame(frame)`; `dt` clamped to 0.05s; per frame: `D.tick` (engine), `renderer.draw`, `rail.draw`, `updateHud`, then the end check — [src/shell.js:204-216](src/shell.js).
- **Scroll spring**: text line translateX tracks `target = -cursor * charWidth` with `x += (target - x)(1 - e^{-14·dt})` (`SCROLL_K = 14`, time constant ≈ 71ms) — [src/render.js:7, 165-169](src/render.js).
- **Caret spring**: `CARET_K = 9` (time constant ≈ 111ms), "the caret lags a little, deliberately" — [src/render.js:8, 167, 170](src/render.js). Spec: "The resulting lag during a burst is kept deliberately, as evidence you are outrunning the page." — [docs/.../2026-10-01-cadence-typing-game-design.md:182-183](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md).
- **Caret twin**: the caret is an inverting block (ink background, paper glyph); a 14-char substring (`TWIN_SPAN`, 4 behind) is rendered inside the 1ch `overflow:hidden` caret and shifted by `(twinFirst - cursor)·cw + (x - caretX)` so the glyph stays registered with the main line while the block lags — [src/render.js:53-54, 172-185](src/render.js); CSS [index.html:112-119](index.html).
- **Typing pulse** (presentation only, added 672973c): each typed char adds `PULSE_GAIN = 0.5` to a pulse (cap 1); the pulse decays `×e^{-dt/0.26}` (`PULSE_TAU = 0.26s`); it adds up to `PULSE_MAX = 0.12` opacity to the next `PULSE_REACH = 12` chars, falling off linearly with distance — [src/render.js:41-51, 108-116, 153-155](src/render.js). Capped below the 0.18 legibility threshold so it "cannot light a dark character into a readable one" — [src/render.js:43-47](src/render.js).
- **Per-char state classes** behind the caret: `.done` (`--ink-done`), `.err` (red, opacity .55), `.miss` (red, .16) — [src/render.js:147-150](src/render.js), [index.html:107-109](index.html). `#line span { transition: none; }` — [index.html:106](index.html). Class changes are instant; a correct keystroke produces no flash, and an error just turns the passed glyph red.
- **Ink ahead of the caret**: opacity recomputed every frame for every in-window char ahead via `draft.inkAhead(run, d)` — [src/render.js:150-156](src/render.js) (formula in section 3).
- **Rhythm rail** (canvas `#rail`, under the text): one 2px-wide mark per keystroke, scrolling left at `PX_PER_MS = 0.2` (200 px/s, about 6s visible); mark length 4px (`STUB`, on the local median) to 17px (`SPIKE`) by |interval/median − 1|/0.35 over a 16-interval window; marks hang from a 1px rule at the top; alpha = `steady·(0.15 + 0.85·age^0.8)` with newest darkest and `steady = 0.55 + 0.45·rhythm/100`; capacity 500 marks; no red ever — [src/rail.js:4-58, 89-104, 117-147](src/rail.js). Mark is pushed on every keydown — [src/shell.js:288](src/shell.js).
- **Rail resize**: a `ResizeObserver` sets a dirty flag instead of reading `clientWidth` every frame (0905113) — [src/rail.js:106-124](src/rail.js). Colours are read from CSS vars and re-read on theme toggle — [src/rail.js:70-74](src/rail.js), [index.html:273-279](index.html).
- **Speed bar** (bottom, 3px): `#bar-fill` width = `v/220`, red `#bar-notch` at `demand/220` with a 7.5px "DEMAND" label; both set inline every frame, no transition — [src/shell.js:199-201](src/shell.js), [index.html:127-132](index.html).
- **HUD** numbers (score, wpm, demand, rhythm, chapter, goal/"holding n/10") written as `textContent` every frame, no interpolation — [src/shell.js:169-202](src/shell.js).
- **Strikes**: three 11px blob-shaped `<i>` (border-radius `50% 40% 55% 45%`), turned solid red by class swap `spent`, no animation — [index.html:92-94](index.html), [src/shell.js:192-197](src/shell.js).
- **Result reveal**: `.more` animates `reveal .3s var(--ease)` from opacity 0 / translateY(5px) — [index.html:190-192](index.html). `--ease: cubic-bezier(.33, 1, .68, 1)` — [index.html:38](index.html). This is the only `@keyframes` in the game.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce) { * { transition:none!important; animation:none!important } }` — [index.html:204-206](index.html). JS springs and the pulse are not affected (no `matchMedia('(prefers-reduced-motion...)')` anywhere in src/), although the spec says "`prefers-reduced-motion: reduce` sets springs to immediate" — [docs/.../2026-10-01-cadence-typing-game-design.md:188](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md).
- Spec motion system: "Two curves only: `cubic-bezier(.33,1,.68,1)` for UI, and a critically-damped spring for the caret and scroll. Nothing blinks, flashes, shakes, or glows." — [design.md:169-173](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md). Principle 4: "Protect flow. No stop-on-error, no backspace, no flashing, no shake, no sound." — [design.md:47-48](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md). README: "no sound" — [README.md:5](README.md).
- Spec items **not implemented**: "Displayed score, WPM and rhythm interpolate toward their true values, so the numbers read as counting rather than ticking" — [design.md:185-186](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md) vs direct writes at [src/shell.js:170-173](src/shell.js). The result-screen "hairline strip of the run's WPM curve against the demand curve" — [design.md:375-377](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md); no such chart exists in `showResult` [src/shell.js:220-250](src/shell.js), and per 3220a4c `wpmTrace` was removed as unread.
- Renderer perf design: 180-span ring buffer (`WINDOW_BEHIND 70 + WINDOW_AHEAD 110`), each span fixed at `left = idx·charWidth` for its life, so about one DOM write per keystroke. Measured in 672973c: mean writes 45 -> 3.9 per frame, worst frame 433 -> 7, `draw()` 8.7µs -> 4.6µs — [src/render.js:4-39](src/render.js) and commit message.

### Inferences
- Per-keystroke feedback is: caret/scroll spring advance, a faint (max +0.12 opacity) brightening of the next 12 chars, a rail tick, and on error a red glyph. There is no per-word feedback (word completion is not detected anywhere), no combo display during the run (combo is computed [src/draft-a.js:116-121] but not shown in the HUD), no milestone feedback when a goal is reached beyond the HUD label switching from "holding 9/10" to "1 cleared" [src/shell.js:179-185], and no chapter-change announcement beyond the HUD label text.
- Strikes are the highest-stakes event and get the least motion: a dot fills red. Given the no-shake principle, a non-violent emphasis (a short ink bleed at the struck glyph, a strike dot that draws in over ~150ms) would fit the house style.
- The HUD writes 6-8 `textContent`s per frame even when unchanged ([src/shell.js:170-190]), unlike the renderer's careful diffing. Minor, but it is the one place the perf discipline lapses.

### Gaps
- No browser profiling was done in this session. Perf figures are from commit messages and code comments, not re-measured.

## 3. The ink-drying visual and the survival model

### Takeaway
Each char ahead of the caret gets an opacity from one closed-form curve of `ratio = smoothed(v)/demand` and distance `d`. At ratio 1.0 the char under the caret is at 0.30 opacity. Below 0.94 the caret char drops under the 0.18 legibility line and a fully blank "front" of up to 34 chars opens. Chars 40+ ahead are always fully inked. Falling behind registers with a 1.6s lag; catching up is instant.

### Cited Findings
- Constants: `W = 40` (read-ahead window, chars), `LEGIBLE = 0.18` — [src/survival.js:9-10](src/survival.js).
- `baseInk(r) = clamp((r − 0.85)/0.50, 0, 1)` (ink at the caret); `frontWidth(r) = 0.85·W·clamp((0.94 − r)/0.40, 0, 1)` (blank front, 0-34 chars); `opacityAt(d, r) = base + (1 − base)·clamp((d − f)/(W − f), 0, 1)^0.8`; `isBlind(r) = opacityAt(0, r) < 0.18` — [src/survival.js:141-152](src/survival.js). `inkAhead` returns 1 for `d ≥ W` — [src/draft-a.js:174](src/draft-a.js).
- Worked values (derived from those formulas): r = 1.35 -> base 1.0 (caret char fully inked); r = 1.0 -> base 0.30; r = 0.94 -> base 0.18 and f = 0, so this is the blind threshold; r = 0.74 -> base 0, f = 17 chars blank; r ≤ 0.54 -> f = 34 chars blank. For `d < f`, t = 0 so opacity = base, which is 0 once r ≤ 0.85.
- Ratio smoothing: during warm-up (fewer than 10 keystrokes, `WARM_KEYS`) the ratio is pinned at `WARMUP_RATIO = 1.2` (base ink 0.70) — [src/draft-a.js:30, 144-145](src/draft-a.js), [src/metrics.js:42-46](src/metrics.js). After that, `ratio = target` when `target ≥ ratio` (instant), else `ratio += (target − ratio)(1 − e^{−dt/1.6})` (`DRY_TAU = 1.6s`) — [src/draft-a.js:48, 146-150](src/draft-a.js). Rationale: rolling wpm wobbles 4-8% even for a metronome, so without the lag on-goal players flickered blind — [src/draft-a.js:32-47](src/draft-a.js), [docs/.../2026-10-03-draft-a-pacing.md:172-199](docs/superpowers/specs/2026-10-03-draft-a-pacing.md).
- `v` is rolling wpm over a 3s window, dividing by the actually elapsed window (minimum 600ms) — [src/metrics.js:8, 53-70](src/metrics.js).
- Fairness rule: a wrong key costs a strike only if the caret char was blind at that moment (`wasBlind` sampled before the key) — [src/draft-a.js:94, 120-126](src/draft-a.js). A wrong key on legible ink only resets combo. Errors advance the cursor (no backspace, no stop-on-error) — [src/draft-a.js:108-111](src/draft-a.js).
- "Dried" death: blind for 2000ms continuously; a correct keystroke while blind resets `blindSince` to now, not null — [src/draft-a.js:119, 164-169](src/draft-a.js).
- Visual intent: "The page is the HUD. How well you are doing is legible in the ink itself" and "Every death is attributable" — [design.md:43-46](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md).

### Inferences
- The drying is purely an opacity fade on solid glyphs. There is no "ink" texture, bleed, colour shift or blur: the "ink" metaphor lives in the opacity curve and the palette. That leaves room for richer ink-specific visuals (wet-to-dry colour shift, feathered edges in the blank front) without touching the survival model, since only opacity feeds `isBlind`.
- The pulse cap (0.12) plus base ink near the threshold means that in the danger band the pulse is a visible "lamp" effect only on chars that are already readable or almost so. In the blank front (opacity 0) the pulse lights chars to at most 0.12, which shows faint shapes but stays below legibility by design.

### Gaps
- Not visually inspected in a browser. How the gradient reads at 30px Plex Mono in both themes is not observed here.

## 4. Pacing and difficulty ramp over a run

### Takeaway
Demand eases (smoothstep) from 50% of the goal to the goal over 10s after the first keystroke and then holds. Holding ≥ goal for 10s banks it and steps the goal up a rung, with a new 10s ramp from the current value. Chapters (word textures) key off the goal. Measured by the repo's own synthetic-typist tool, visible fading arrives at 7-15s for every profile, and a player 10% under goal dies inside ~10-28s.

### Cited Findings
- Pacer: `RAMP_SECONDS = 10`, `OPENING_FRACTION = 0.5`, `HOLD_SECONDS = 10`, `HOLD_RELEASE = 0.97` (dips above 97% of goal pause rather than reset the hold) — [src/survival.js:83-88, 103-128](src/survival.js). `value = from + (goal − from)·smoothstep(rampT/10)` — [src/survival.js:113-118](src/survival.js). `stepUp`: `from = value`, goal = next rung, ramp and hold reset — [src/survival.js:133-139](src/survival.js), called from [src/draft-a.js:151-154](src/draft-a.js).
- Chapters, by goal: open field 40, home ground 60, common tongue 80, short work 100, inward roll 120, long form 140, one hand 160, thin air 180 — [src/generator.js:28-37](src/generator.js); chapter index never decreases in a run — [src/draft-a.js:157-162](src/draft-a.js).
- Text is generated in 40-word chunks whenever fewer than 200 chars remain ahead of the cursor (`LOOKAHEAD = 200`, `CHUNK_WORDS = 40`) — [src/draft-a.js:27-28, 57-62](src/draft-a.js). New chunks use the current `chapterIndex`.
- HUD shows goal and "holding n/10" once ≥ 0.4s is held, else "N cleared" or "goal" — [src/shell.js:179-185](src/shell.js).
- Measured table (README, `node tools/balance.js`, 5 seeds, synthetic typists): fade (caret ink < 0.55) at 7-15s for all rows; on-goal runs end at 16-182s; 10% under ends at 11-28s; 10%-over runs clear 1-2 levels at ~11-16s — [README.md:64-83](README.md). Note this README table differs from the one in the pacing spec ([pacing.md:211-227](docs/superpowers/specs/2026-10-03-draft-a-pacing.md)); the README one is newer (the word pool was rebuilt in d81d058 after the spec).
- Spec's own caveat: "If stepping up mid-run reads as a punishment rather than a promotion in the browser, the alternative is to end the run in success on reaching the goal" — [pacing.md:257-262](docs/superpowers/specs/2026-10-03-draft-a-pacing.md). And "the goal is a rhythm test as much as a speed test", with ragged 110 surviving 0/5 at its own goal; the stated dial is `DRY_TAU` — [pacing.md:245-252](docs/superpowers/specs/2026-10-03-draft-a-pacing.md).
- History of the ramp: originally demand chased the player's sustained speed and the first hole came at 45-98s ("for A it takes too long for the dissappearing to happen"), replaced by the goal pacer in 3220a4c — [pacing.md:11-43](docs/superpowers/specs/2026-10-03-draft-a-pacing.md); the old `createDemand/stepDemand` is still in [src/survival.js:13-61](src/survival.js), labelled "DRAFT C ONLY", though draft C is gone.

### Inferences
- Chapter texture lags the goal. After a step-up the buffer still holds 200 to ~420 chars of old-chapter text (200 minimum plus one ~40-word chunk), about 25-50s at 100 wpm (500 chars/min). The HUD chapter name changes immediately while the words on screen do not, so "clearing a level is also what changes what your hands are doing" ([src/draft-a.js:157-160]) arrives late.
- The arc is: 10s gentle ramp, then flat pressure at goal, then a ~10-15% jump on each clear that a player at their limit cannot meet, so a run usually ends ~10-20s after the first clear (pacing.md's "you climb until you cannot"). For a satisfying-feel pass, the step-up moment is the obvious place for celebration and a breather, and it currently has neither.
- Choosing the goal is the whole difficulty (the README says so, [README.md:86-90]), and it is made on the title screen before any feedback. There is no suggestion of a goal from past runs (peak/avg wpm are recorded only inside `highest`/`longest` summaries).

### Gaps
- No real-player data exists in the repo. All balance figures come from the synthetic typist in `tools/typist.js` / `tools/balance.js`.

## 5. Visual style, typography, colour, layout tokens, tech stack

### Takeaway
Vanilla JS (IIFE modules on `root.cadence`), DOM spans for text, one 2D canvas for the rail, no libraries, no build step except the optional bundler. Warm-paper monochrome with one red accent, IBM Plex Mono 400/500 from Google Fonts, uppercase letter-spaced micro-labels, a centered 1180px stage.

### Cited Findings
- Stack: classic scripts loaded in order keymap -> words -> generator -> metrics -> survival -> draft-a -> rail -> render -> screens -> shell — [index.html:248-257](index.html); each module is a UMD-ish IIFE exporting to `module.exports` or `root.cadence` — e.g. [src/draft-a.js:17-24, 190-192](src/draft-a.js). Only external resource: Google Fonts IBM Plex Mono 400;500 — [index.html:7-9](index.html). README: "No build step, no server, no dependencies, no sound." — [README.md:5](README.md).
- Light tokens: `--paper #f7f4ec`, `--ink #17171a`, `--ink-done #c2bdb0`, `--mute #a3a098`, `--rule #e6e2d7`, `--red #b4412f`, `--faint #cfc9ba`, `--body #7d7a72`, `--mono "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace`, `--ease cubic-bezier(.33,1,.68,1)`, `--size 30px`, `--caret-x 34%` — [index.html:28-43](index.html).
- Dark ("warm dark, lamplight"): `--paper #19150f`, `--ink #f0e7d4`, `--ink-done #544d41`, `--mute #8b8373`, `--rule #2c261c`, `--red #d4594a`, `--faint #463f32`, `--body #9c9381` — [index.html:45-61](index.html). Theme is resolved before first paint by an inline head script — [index.html:10-26](index.html); toggled with shift+T or the fixed bottom-left control — [index.html:246, 281-289](index.html).
- Red is reserved for error chars, strikes, the demand notch and "new record" — [index.html:49-51](index.html); the rail never uses red — [src/rail.js:39](src/rail.js).
- Typography: body Plex Mono 400, `tabular-nums`, antialiased — [index.html:65-72](index.html). Running text 30px, line-height 1, letter-spacing −.01em — [index.html:100-104](index.html). Labels 9px, .22em, uppercase, `--mute` — [index.html:77](index.html). HUD values 27px −.02em — [index.html:86](index.html). Result big number `clamp(54px, 9vw, 92px)` −.045em; score 30px — [index.html:174-175](index.html). Hints 10px .2em uppercase — [index.html:170-172](index.html).
- Run layout: HUD row 34px from top, max-width 1180px, gap 40px (score, wpm/demand, rhythm, spacer, goal, chapter, strikes) — [index.html:83-94, 223-231](index.html). `#stage` 190px tall, centred; `#track` at top 46px, 58px tall, overflow hidden; caret block 58px tall × 1ch at `--caret-x` (34%) — [index.html:97-119](index.html). Rail `top:120px; height:22px` — [index.html:125](index.html). Speed bar pinned to the bottom, 3px — [index.html:127-132](index.html).
- Only one line of text is visible (single-line horizontal scroll); 70 chars behind and 110 ahead are in the DOM window — [src/render.js:4-6](src/render.js).
- `html, body { overflow:hidden }`, no mobile/touch support (out of scope per [design.md:387-390](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md)).

### Inferences
- **Probable CSS bug, introduced in 5ad6141**: removing the draft-C `.branch` rule left its second line orphaned: `letter-spacing: -.01em; color: var(--ink); display: none; }` at [index.html:123](index.html) (also `cadence.html:123`), with no selector (confirmed via `git show 5ad6141 -- index.html`). Under CSS Syntax parsing, a top-level qualified rule's prelude swallows tokens, including that stray `}`, up to the next `{`. So the following `#rail { position:absolute; top:120px; width:100%; height:22px; display:block }` rule ([index.html:125]) would get an invalid selector and be dropped. The canvas would then fall back to inline 300×150 defaults placed after `#caret` in the stage. Not verified in a browser; worth a 10-second check in devtools. It would also explain any rail placement oddity seen in play.
- The aesthetic is restrained and editorial (paper, ink, hairlines). Feedback additions that fit it: ink-like effects (bleed, settle, wet sheen), typographic motion (weight 400 -> 500 on good rhythm, already used in the result page print [src/screens.js:87]), and paper-and-pen sound if sound is ever allowed. The game has a strong explicit anti-juice stance (principle 4), so any proposal adding feedback has to argue against it.

### Gaps
- Actual rendered appearance was not screenshotted in this session.

## 6. Scoring, wpm, combo, word pool (brief)

### Takeaway
Score per correct char = `10 × speed × rhythm × combo`, with rhythm (keystroke-interval evenness) as the distinctive axis. Combo is computed but shown only on the result screen. The word pool is about 960 common words in frequency order, chapter-filtered and ease-weighted.

### Cited Findings
- `pointsFor`: `speedMult = clamp(v/60, 0.5, 3)`, `rhythmMult = 0.6 + 0.9·rhythm/100`, `comboMult = 1 + min(combo,300)/300` — [src/metrics.js:80-85](src/metrics.js). Applied per correct key — [src/draft-a.js:114-118](src/draft-a.js).
- Rhythm: last 16 intervals clamped to 600ms; mean absolute deviation from the median after dropping the single worst; `cv/0.35` maps to 0-100; 50 until 8 samples — [src/metrics.js:4-40](src/metrics.js).
- Result wpm = correct chars/5 per minute of run time — [src/shell.js:148](src/shell.js); peak = max rolling v — [src/draft-a.js:105](src/draft-a.js).
- Result page print: last 260 chars, opacity `0.18 + 0.82·(r/100)^1.9`, weight 500 if rhythm > 72, errors red — [src/screens.js:78-104](src/screens.js), [src/shell.js:242](src/shell.js).
- Word pool: 960 words (counted via node in this session), `src/words.js:21-110`; `TOP200` is actually the first 150 — [src/words.js:112](src/words.js). Generator: rank-biased sampling `RANK_EXP = 1.25`, 16-word no-repeat window, rejects same-start triples, same-finger word boundaries and same-hand triples; scores candidates on ease (`easeOf`), hand alternation and rank — [src/generator.js:14, 55-129](src/generator.js). Content is lowercase a-z and space only — [design.md:197-199](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md).

### Inferences
- Combo drives up to a 2× multiplier but is invisible during play, so its effect on feel is close to zero. Showing it, or tying it to the ink, is a cheap lever.

### Gaps
- None material.

## 7. Design history (git log)

### Takeaway
The game started as three drafts over a shared core; two were cut on play feedback, leaving draft A (drying ink). Recent commits focused on pacing (goal ladder), renderer smoothness, and word-pool readability.

### Cited Findings (all from `git log --oneline -30` and `git show --stat` run in this session)
- 13 commits total. 5ea5dc2 shared core -> 1a6eed5 three draft engines -> 696448a playable UI for all three -> 6dec761 cut draft B "the lock" ("the deadline pressure was not engaging enough to earn its complexity") -> 133d3a9 pool 785 -> 3142 words -> 672973c ring-buffer spans + typing pulse ("the typing pulse the player asked for") -> 0905113 ResizeObserver for rail -> 3220a4c goal-wpm pacing for A, read-ahead for C -> d81d058 pool rebuilt to ~960 common words ("wield, keel, phantom... That is a vocabulary test, not a typing game") -> f712a9d .gitignore -> 5ad6141 cut draft C "branches" ("too buggy, and the junction fought the rhythm the whole game is built around even after the read-ahead fix"; title screen became the game).
- Draft C ("branches") per the commit and design note: two valid lines and a chaser from behind; its spec `2026-10-02-drafts-b-and-c.md` was deleted and lives in history — [design.md:7-13](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md).
- Player-feedback-driven changes recorded: ink took too long to dry (-> goal pacer), choppiness (-> ring buffer), asked-for typing pulse, obscure words (-> pool shrink), B and C cut.

### Inferences
- Draft-C leftovers remain: `run.draft === 'c'` branch in `showResult` ([src/shell.js:226-227]), the draft-C comment in render ([src/render.js:133-134]), `createDemand/stepDemand` ([src/survival.js:13-61]), the `--caret-x` comment ([index.html:40-41]), the "esc drafts" hint ([src/shell.js:244]), the comment about keys `1, 2` ([index.html:284]), and the orphan CSS line ([index.html:123]).

### Gaps
- `docs/superpowers/plans/2026-10-01-cadence.md` (2893 lines) was not read in full. It is the implementation plan, superseded by the code.

## 8. UX friction summary (observations, each tied to code above)

### Takeaway
The highest-impact friction is in the run boundaries (death and restart), not in the core loop.

### Cited Findings
- Momentum typing after death starts a new run and skips the result screen — [src/shell.js:282-289](src/shell.js).
- Death is a hard cut with no beat, no "where you died" marker, no transition — [src/shell.js:144-156, 110-115](src/shell.js).
- Starting with a letter spends it as keystroke one against unseen text — [src/shell.js:285-287](src/shell.js).
- Tab/Esc mid-run discard banked-able progress — [src/shell.js:262-263](src/shell.js).
- No in-run combo, word, goal-reached, chapter-change or strike emphasis — [src/shell.js:169-202](src/shell.js), [src/render.js:144-161](src/render.js).
- No sound, by explicit principle — [design.md:47-48](docs/superpowers/specs/2026-10-01-cadence-typing-game-design.md), [README.md:5](README.md).
- Personal bests: only `longest` and `highest`, plus the best goal reached; no per-goal bests and no run history — [src/screens.js:51-63](src/screens.js), [src/shell.js:44-59](src/shell.js).
- Stale "esc drafts" hint — [src/shell.js:244](src/shell.js).
- Reduced-motion does not reach the JS springs or pulse — [index.html:204-206](index.html), [src/render.js:164-170](src/render.js).
- Chapter texture lags the goal by the 200-420 char buffer — [src/draft-a.js:27-28, 57-62](src/draft-a.js).
- Probable `#rail` CSS rule loss from the orphan line — [index.html:123-125](index.html).

### Inferences
- Order of likely payoff for "satisfying": (1) protect the result screen and add a short death beat, (2) celebrate the goal step-up, which is the game's one progression moment, (3) give strikes and combo visible, on-style feedback, (4) consider optional, off-by-default sound, which contradicts a stated principle and should be proposed as a toggle.

### Gaps
- No observed play session or real-player data. Friction points are derived from code paths, not usability testing.

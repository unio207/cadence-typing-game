# Typing and rhythm game precedents: what makes them feel good (flow, aesthetics, animation weighted)

Scope note: the coordinator asked midway to weight these notes toward flow, aesthetics and animation (caret and text motion, keystroke and word-complete visuals, screen-wide pulse). Monkeytype is covered from its source code (shallow clone of github.com/monkeytypegame/monkeytype, master branch, read 2026-10-12), so its numbers are exact. Rhythm game timing numbers are exact only where a primary wiki gave them. Review-sentiment summaries are kept short.

## 1. Monkeytype: how the caret, text and restart animate, and why it is popular

### Takeaway
Monkeytype's "feel" is a few short, consistent eased motions (caret glide 85 to 150 ms, line scroll 125 ms, restart fade 125 ms out plus 125 ms in), a caret that stops blinking while you type, color-only letter state changes, and optional per-key sounds including a mode that maps keys to musical notes. Its consistency stat is a squashed coefficient of variation of per-second raw WPM, not of individual keystroke intervals (a keystroke-interval version is computed separately).

### Cited Findings
**Caret motion**
- Smooth caret setting has four values: off, slow, medium, fast ([configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)).
- Caret glide durations: off = 0 ms, slow = 150 ms, medium = 100 ms, fast = 85 ms, with easing `inOut(1.25)` by default ([caret.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/elements/caret.ts)). Each new keystroke starts a new animation toward the next letter, so at 100 WPM (about 120 ms per character) the 85 to 100 ms glide is still finishing or just finished when the next key lands; the caret reads as continuous motion rather than discrete jumps (inference from the numbers, not stated in source).
- Blink: `caretFlashSmooth` is a 1 s infinite opacity cycle 0 -> 1 -> 0 when smooth caret is on; `caretFlashHard` is a step blink when smooth caret is off ([animations.scss](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/styles/animations.scss), [caret.scss](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/styles/caret.scss)).
- Blinking stops when the test enters focus mode (typing) and the caret is held at opacity 1; blinking resumes when focus is lost (mouse moved). Entering focus also hides the mouse cursor (`cursor: none`) on body, buttons and links ([focus.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/focus.ts), [caret.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/elements/caret.ts)).
- Caret shapes: off, default (bar), block, outline, underline, plus joke shapes (carrot, banana, monkey). A separate "pace caret" with its own style can run at a target speed (personal best, average, custom WPM) ([configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)).

**Text motion**
- Line jump (when the active word moves to a new line): the words block animates margin-top by one line height over 125 ms if `smoothLineScroll` is on, else instant. The caret is moved by the same offset over the same duration so they stay locked together ([test-ui.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/test-ui.ts)).
- Tape mode (off / letter / word) scrolls text horizontally instead of line-wrapping; it uses the same 125 ms, `inOut(1.25)` easing and a configurable tape margin (percent of width where the caret sits) ([test-ui.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/test-ui.ts), [configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)).
- Restart: test area fades opacity to 0 over 125 ms, then back 0 -> 1 over 125 ms; both go through a reduced-motion helper (`applyReducedMotion(125)`) ([test-ui.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/test-ui.ts)). Total restart visual cost is about 250 ms.
- Letter states are color changes via CSS variables: untyped = `--sub-color` (dim), `.correct` = correct color, `.incorrect` = error color, `.incorrect.extra` = extra-letter color, `.corrected` = correct color plus a 2px dotted underline in the main color (a letter that was wrong then fixed stays marked). Each state also has a CSS animation hook variable (`--correct-letter-animation` etc.) that themes can set; default is none ([test.scss](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/styles/test.scss)).
- "flipTestColors" option swaps typed/untyped brightness; "showAllLines", "blindMode" (hide errors), "indicateTypos" (off / below / replace / both) are separate options ([configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)).

**Error handling options**
- `stopOnError`: off / word / letter (letter = cannot advance past a wrong key; word = cannot finish a word with an error) ([configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)).
- `confidenceMode`: off / on / max (on = cannot backspace into previous words; max = no backspace at all) ([configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)).
- `minWpm` and `minAcc` options fail the test if you drop below a threshold ([configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)).

**Sound**
- `playSoundOnClick` has 26 numbered packs plus off; error sounds are a separate setting with their own sample sets ([configs.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts), [sound-controller.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/controllers/sound-controller.ts)).
- Some packs are synthesized notes, not samples: a `codeToNote` table maps physical keys to chromatic pitches like a piano (Z = C, S = Db, X = D, D = Eb, C = E ... M = B, comma = C an octave up; Q row starts at C one octave up). Notes are a Web Audio sine oscillator with gain = volume/10 and an exponential decay `setTargetAtTime(0, t, 0.3)` (time constant 300 ms), stopped after 2 s. A "scale" variant walks up and down a scale between octaves 4 and 6 regardless of which key is pressed ([sound-controller.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/controllers/sound-controller.ts)).

**Stats**
- Consistency formula: `kogasa(cov) = 100 * (1 - tanh(cov + cov^3/3 + cov^5/5))`, where cov = standard deviation / mean (population SD, divide by n) ([numbers.ts](https://github.com/monkeytypegame/monkeytype/blob/master/packages/util/src/numbers.ts)).
- The reported `consistency` is kogasa applied to `rawPerSecond` (the per-second raw WPM "burst history"). A separate `keyConsistency` is kogasa applied to keypress spacing (inter-key intervals, last interval dropped). A third, `wpmConsistency`, uses the WPM history ([test-logic.ts](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/test/test-logic.ts)). So the common claim that "Monkeytype consistency = CoV of keystroke intervals" is not what the headline number is; that is `keyConsistency`.

**Popularity (short)**
- Third-party summaries credit a minimal, distraction-free interface, no account needed to start, heavy customization (themes, fonts, smooth caret, modes) and detailed stats (wpm, raw, accuracy, consistency) ([TypeQuicker comparison, a competitor so biased](https://www.typequicker.com/compare/monkeytype); [Mintlify summary of the repo](https://mintlify.com/explore/monkeytypegame/monkeytype)).

### Inferences
- Derivation of what the kogasa number means: the polynomial c + c^3/3 + c^5/5 is the first three terms of the Taylor series of artanh(c). Since tanh(artanh(c)) = c, for small c the score is about 100(1 - c). Worked: cov 0.10 -> series 0.10034 -> tanh 0.1000 -> 90.0. cov 0.50 -> 0.54792 -> tanh 0.4990 -> 50.1. cov 1.0 -> 1.5333 -> tanh 0.911 -> 8.9. The truncation makes it fall off smoothly and never go below 0 for large cov, instead of hitting 0 at cov = 1. A cadence game can reuse this directly on inter-key intervals to get a 0 to 100 "evenness" score.
- The common thread in Monkeytype's motion is one duration family (about 85 to 150 ms) and one easing curve applied to caret, line scroll, tape scroll and restart. That uniformity is probably a big part of why it feels "smooth" rather than any single effect.
- The caret that stops blinking during typing and the hidden mouse cursor remove two sources of motion that are not caused by the player; while typing, everything that moves on screen is a response to a keystroke.
- The note-per-key sound packs turn typing into playing an instrument; for a cadence game, a pitched or rhythmic per-key sound gives audible evidence of evenness that a number cannot.

### Gaps
- Whether `keyConsistency` is shown in the UI (for example in a tooltip) was not confirmed; only that it is computed.
- No Reddit or Hacker News thread was retrieved, so player sentiment on Monkeytype comes only from third-party summaries.
- Sample-based click packs (which pack is which switch sound, any random pitch variation) were not read in detail.

## 2. Typing games: how a keystroke and a completed word are visualized

### Takeaway
The precedents share one structure: each correct keystroke gives a small, immediate, local response on the target word, and completing a word gives a larger, delayed-by-nothing payoff (explosion, world change). Few designers have published detail on the exact visuals; most available material is reviews.

### Cited Findings
- Typing of the Dead: Overkill: a completed word makes the zombie explode in front of you; reviewers single out this immediate payoff and the time pressure as the core of the fun. Steam showed 87% positive of 2,383 user reviews at the time of the search ([God is a Geek review](https://www.godisageek.com/2013/11/typing-dead-overkill-review), [Steam page](https://store.steampowered.com/app/246580/The_Typing_of_The_Dead_Overkill/), [GameWatcher review](https://www.gamewatcher.com/the-typing-of-the-dead-overkill/review)).
- ZType (Dominic Szablewski / PhobosLab, 2011, browser, JavaScript with his Impact engine): inspired by Crimsonland's Type-o-Shooter mode and Typing of the Dead. Typing a word sends a laser at the word-ship; one reviewer calls the feedback of lasers hitting the word-enemies "incredibly satisfying" (whether the shot fires per letter or per completed word is described inconsistently across these secondary sources) ([developer post](https://phoboslab.org/log/2011/01/z-type), [Wikipedia](https://en.wikipedia.org/wiki/Z-Type), [Chrome Unboxed](https://chromeunboxed.com/ztype-by-phoboslab-is-a-super-satisfying-way-to-kill-some-time-is-worth-a-try-for-the-whole-family/)).
- Epistory (Fishing Cactus, 2016, Unity): pressing space enters typing mode and shows words attached to every interactable object in view; typing a word clears trees, plants flowers, removes bugs, so a completed word changes the world rather than only destroying an enemy. Word pools are themed to the action (tree words for trees, flower names for planting, minerals for rocks, element words for spells). The world is drawn as crumpled colored paper pages with narration printed onto the landscape ([Game Developer critique](https://www.gamedeveloper.com/design/let-s-talk-about-epistory-typing-chronicles), [Wikipedia](https://en.wikipedia.org/wiki/Epistory_-_Typing_Chronicles)).
- Epistory's team wanted it to "feel like a game and not just a typing application" ([Wikipedia](https://en.wikipedia.org/wiki/Epistory_-_Typing_Chronicles)). For their later typing game Outshine, the same studio named the two main considerations as "the instant gratification of typing on the keyboard" and ergonomics ([ZSA interview](https://blog.zsa.io/2212-outshine/)).

### Inferences
- Two-tier feedback (small per-key, big per-word) is the shared pattern across ZType, Typing of the Dead and Epistory. A minimalist cadence game can keep this with no enemies: per-key = letter color/ink change plus a tiny caret or glyph response, per-word = a larger but brief event (word settling, fading, a pulse).
- Epistory's themed word pools show that the word itself can carry meaning about the action; for a cadence game the analogue is choosing words whose syllable or letter count fits the beat grid.

### Gaps
- No primary source describing ZType's exact per-letter effect (particles, letter removal, screen shake) or Typing of the Dead's letter highlight timing was found. The ZType source code was not inspected.
- Nanotale, TypeRacer, keybr, Keymash, Typing Club, Cook Serve Delicious, The Textorcist and Ord were not researched within the tool budget.
- The Epistory postmortem on gamedev.net returned HTTP 403; the Indiesider podcast with designer David Bailly was found only as a description.

## 3. Rhythm games: timing windows, latency calibration, and how visuals sync to the beat

### Takeaway
Hard numbers: osu! judgment windows are linear in Overall Difficulty (300 window from ±80 ms at OD0 to ±20 ms at OD10). DDR's top two tiers are about one and two frames (16.7 and 33 ms) per community sources. Hi-Fi Rush and Rhythm Doctor show the other side: snap the player's action and the whole scene to the beat, and be forgiving on input.

### Cited Findings
**Timing windows**
- osu!standard hit windows (ms, each side of the note): 300 = 80 − 6·OD, 100 = 140 − 8·OD, 50 = 200 − 10·OD. OD0: 80/140/200. OD5: 50/100/150. OD10: 20/60/100. Stable osu! can make these up to 0.5 ms shorter because hit error is compared against a rounded window ([osu! wiki, Overall difficulty](https://osu.ppy.sh/wiki/en/Beatmap/Overall_difficulty)).
- DDR: Marvelous about 1 frame (16.7 ms), Perfect about 2 frames (33 ms), per a community compilation that states official values are mostly unpublished ([Scrapbox timing-window compilation](https://scrapbox.io/0b5vr/Timing_Window)). A Great value of 92 ms could not be confirmed.
- Guitar Hero vs Rock Band: players report Neversoft-era Guitar Hero windows are wider than Rock Band's, and Rock Band's window is about the same as Guitar Hero 2 and stays mostly fixed across the series. No ms values found ([Rock Band subreddit mirror](https://teddit.bsalzberg.com/r/Rockband/comments/1mezzzo/help_for_solos), [Giant Bomb HO/PO wiki](https://giantbomb.com/wiki/Concepts/Hammer_On_And_Pull_Off)).
- Rift of the NecroDancer (not Crypt): a Steam user claims ±7.5 ms "super perfect" and ±37.5 ms perfect; a later reply says windows scale with BPM as fractions of a beat. Unverified ([Steam thread](https://steamcommunity.com/app/2073250/discussions/0/600770015625551529)).

**Calibration and forgiveness**
- Crypt of the NecroDancer asks players to calibrate audio and video latency at first launch and stores ms offsets (one player: 60 ms audio, 0 ms video); a review calls it "somewhat forgiving", allowing slightly early or late presses ([Steam thread](https://steamcommunity.com/app/247080/discussions/1/618453594756833156), [CGMagazine review](https://www.cgmagonline.com/reviews/crypt-of-the-necrodancer-pc-review/)).
- Hi-Fi Rush players complain it offers only one manual sync slider and no automatic calibration ([Steam discussion](https://steamcommunity.com/app/1817230/discussions/0/7128707880814326281)).

**Visual sync**
- Hi-Fi Rush: animation was authored for 120 BPM at 60 fps (so one beat = 0.5 s = 30 frames), with key poses placed on the beat, then time-scaled dynamically so "all elements were matched to the BPM and could be sped up and down in sync" (CEDEC 2023 talk by director John Johanas and lead designer Masaaki Yamada) ([GameAnim write-up](https://www.gameanim.com/?p=106877)).
- Hi-Fi Rush: attacks land on the beat regardless of exactly when the button is pressed; well-timed presses earn extra damage; enemy attacks are telegraphed on the beat; reviewers describe timing as quite forgiving ([Sophie Cress on beat syncing](https://sophiecress.com/blog/hi-fi-rush-beat-syncing), [SI preview](https://videogames.si.com/features/hi-fi-rush-preview)).
- Rhythm Doctor: core input is a single press on the 7th beat of a pattern; too early or too late cracks the heart. Swing patterns shift where beat 7 lands; 7/8 sections drop the rest so the count is 1-2-3-4-5-6-go ([Keengamer preview](https://www.keengamer.com/articles/previews/defibrillate-to-the-beat-in-rhythm-doctors-preorder-demo/), [Steam discussion](https://steamcommunity.com/app/774181/discussions/0/3053986690339660818), [Southblueprint](https://southblueprint.com/41289/entertainment/rhythm-doctor-beats-into-the-gaming-scene/)).
- Rhythm Doctor: the screen pulses or shudders on heavy beats and some levels degrade the visuals on purpose so the player must hold the beat internally; the visuals pulse like a heart monitor ([PC Gamer review](https://pcgamer.com/games/rhythm/rhythm-doctor-review), [PC Gamer on distraction mechanics](https://www.pcgamer.com/uk/rhythm-doctor-has-the-best-distraction-mechanics-ive-seen-in-any-rhythm-game), [GamesBeat](https://gamesbeat.com/?p=149325)). The level editor exposes 50+ visual effects ([Jestr listing](https://www.jestr.gg/games/rhythm-doctor)).
- Thumper (Drool, Marc Flury and Brian Gibson): one button plus one stick, described by Flury as "really stripped down and simple" while trying to be "as intense and physical as possible", the "rhythm violence" subgenre. The GDC 2017 postmortem credits strong art direction, constant experimentation and commitment to simplicity, and says the look was built without advanced shaders, particle systems or sophisticated lighting ([GDC Vault](https://gdcvault.com/play/1024291/Seven-Years-in-Alpha-Thumper), [Game Developer video post](https://gamedeveloper.com/design/video-7-years-in-alpha----a-i-thumper-i-postmortem), [Thumbsticks GDC recap](https://www.thumbsticks.com/gdc-17-how-thumper-turned-into-something-special/)).
- Tetris Effect: moving, rotating and dropping each trigger their own sound (vocal, drum, clap) layered over the backing track so the result still sounds like music; levels start sparse and the audiovisuals build as lines clear ([Fandom review](https://www.fandom.com/articles/tetris-effect-review), [Edge via PressReader](https://www.pressreader.com/australia/edge/20181206/282132112516020), [Retro Gamer via PressReader](https://www.pressreader.com/uk/retro-gamer/20181228/281749860448812)).
- General juice reference: "Juice it or Lose it" (Martin Jonasson and Petri Purho, Nordic Game Jam 2012) adds tweening/easing, screen shake and similar effects to a plain Breakout to show the difference in feel; Folmer Kelly later argued at GDC Europe that juice can cost immersion ([RPG Playground summary](https://rpgplayground.com/research-making-a-juicy-game/)).

### Inferences
- For a cadence typing game, a reasonable starting judgment scale is borrowed from osu! mid-OD: about ±50 ms "on beat", ±100 ms "close", ±150 ms "late/early". At 120 BPM a beat is 500 ms, so ±50 ms is 10% of the beat. Scaling windows as a fraction of beat length (the Rift claim) keeps difficulty steady across tempos.
- Hi-Fi Rush's trick (quantize the visible result to the beat, reward accuracy separately) suits typing well: keystrokes can register immediately for correctness while the visual "ink" or pulse is drawn on the beat grid, so the screen always looks rhythmic even when the player is slightly off.
- Rhythm Doctor and Tetris Effect both build intensity from sparse to full; a minimalist game can do the same by starting with a plain screen and letting pulse, color or sound layers appear as the player holds cadence.
- A one-time latency calibration (NecroDancer style, separate audio and visual offsets) is expected by rhythm players and its absence is a named complaint (Hi-Fi Rush). In a browser, keyboard-to-screen latency plus audio output latency both vary, so calibration matters more than in a console game.

### Gaps
- No official or wiki ms values for DDR Great/Good, Guitar Hero, Rock Band, Rhythm Heaven, Crypt of the NecroDancer or Rhythm Doctor were found.
- No primary source confirms Tetris Effect quantizes player sounds to the beat.
- Thumper's specific hit effects (screen flash, camera kick, track deformation) were not documented in the sources reached; the GDC Vault video is the place to check.

## 4. Research on typing rhythm and inter-key intervals

### Takeaway
In a 168,000-person study, fast typists averaged about 120 ms between keys versus over 480 ms for slow typists, and their main advantages were overlapping keypresses (rollover), fewer substitution errors, and faster cross-hand bigrams. Keypress duration barely changes with skill. There is no direct evidence found that typing to an imposed rhythm is faster or more accurate.

### Cited Findings
- Dhakal, Feit, Kristensson and Oulasvirta, CHI 2018 ("Observations on Typing from 136 Million Keystrokes"): about 168,000 volunteers, 136M keystrokes; 98.1% QWERTY ([project page](https://userinterfaces.aalto.fi/136Mkeystrokes/), [paper PDF](https://www.pokristensson.com/pubs/DhakalEtAlCHI2018.pdf)).
- Overall mean 51.56 WPM (SD 20.20); mean IKI 238.66 ms (SD 111.60). Fast group (top 10%, above about 78 WPM): 89.56 WPM, IKI 121.70 ms. Slow group (bottom 10%, below about 26 WPM): 20.91 WPM, IKI 481.03 ms ([paper PDF, Table 3](https://www.pokristensson.com/pubs/DhakalEtAlCHI2018.pdf)). Note: the paper's "standard deviation of only 11 ms" for fast typists is the SD of mean IKI across fast typists, not each typist's own keystroke-to-keystroke variability.
- Keypress duration averages 116.24 ms (SD 23.88), 80 to 150 ms even for slow typists; fast vs slow differ by about 20 ms. Authors: "most advances in speed are achieved elsewhere" ([paper PDF](https://www.pokristensson.com/pubs/DhakalEtAlCHI2018.pdf)).
- Rollover ratio (next key pressed before the previous is released): 25% overall, 49.9% for fast typists, 7.6% for slow typists; correlation with WPM 0.73 ([paper PDF](https://www.pokristensson.com/pubs/DhakalEtAlCHI2018.pdf)).
- Uncorrected error rate 1.17%; error corrections 6.31% of keystrokes; KSPC 1.17. Substitution errors (1.65%) dominate; fast typists 0.84% vs slow 3.72%. The authors hypothesize substitutions come from "less consistent" typing and poor finger-position representation ([paper PDF](https://www.pokristensson.com/pubs/DhakalEtAlCHI2018.pdf)).
- Bigram IKIs: hand-alternation 198 ms, right hand 204 ms, left hand 215 ms, letter repetition 176 ms. Repetition IKI correlates weakly with WPM (−0.32) versus about −0.7 for alternation and one-hand bigrams; slow typists fail to type distant letter pairs "as consistently as letter repetitions" ([paper PDF](https://www.pokristensson.com/pubs/DhakalEtAlCHI2018.pdf)).
- Earlier professional-typist studies (cited in the same paper): 60 to 75 WPM with average IKIs of 140 ms ([paper PDF](https://www.pokristensson.com/pubs/DhakalEtAlCHI2018.pdf)).
- Salthouse (1984), via a secondary summary: skilled typists are more consistent in keystroke timing; opposite-hand intervals are 30 to 60 ms shorter; frequent letter combinations are typed faster ([CogSci summary](https://www.jimdavies.org/summaries/salthouse1984.html)).
- Crump et al. (2019) report that word length does not systematically change IKIs but the first letter of a word is slower, attributed to planning and buffering, and propose that letter uncertainty predicts IKI ([Crump et al. PDF](https://www.crumplab.com/publications/Crump/files/13615/Crump%20et%20al.%20-%202019%20-%20Instance%20theory%20predicts%20information%20theory%20Episo.pdf)).

### Inferences
- Natural typing is not isochronous: bigram type alone moves IKI by about 20 to 40 ms on average, and word-initial letters are slower. A cadence game that demands a perfectly even per-letter beat fights the motor system. A beat per word (or per syllable), with letters free inside it, matches the data better. Monkeytype's headline consistency (per-second WPM) is already this kind of coarse measure.
- At 120 BPM with one beat per word, a 5-letter word plus space is 6 keystrokes in 500 ms, about 83 ms per key, which is faster than the fast-typist mean of 122 ms. One word per beat at 60 to 80 BPM (750 to 1000 ms per word) lands near 40 to 60 WPM, close to the 51.56 WPM population mean. That is a sensible default tempo range.
- Since fast typists rely on rollover, a game must accept overlapping key-down events and judge timing on keydown, not keyup.

### Gaps
- No study found that tests whether typing to an external metronome makes people faster or more accurate. The claim "rhythmic typing is better" is unsupported by the sources reached.
- Within-person IKI variability by skill level was not extracted (the paper reports between-person spread).
- Burst vs sustained speed was not studied in the sources reached, beyond Monkeytype's definitions (burst = per-second raw WPM history).

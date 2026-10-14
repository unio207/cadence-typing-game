# Game Feel, Juice, and Moment-to-Moment Input Feedback

Scope note: the coordinator asked partway through for extra weight on animation craft and minimalist-but-juicy aesthetics. Those are Q2 and Q3. Every number below comes from a source fetched or surfaced in this session. Where only a secondary summary was reachable, it is labelled as secondary.

## Q1. How do Swink, Jonasson & Purho, Nijman and the academic surveys define game feel and juice, and what techniques do they list?

### Takeaway
Game feel is "real-time control of virtual objects in a simulated space, with interactions emphasised by polish" (Swink). Juice is the amplification layer on top: more audiovisual response to each event than the mechanics strictly need. The most concrete practitioner recipe found is Nijman's breakdown of one Nuclear Throne pistol shot, which stacks about 10 small effects on a single input, each with a pixel or millisecond value.

### Cited Findings
- Swink's definition: game feel is "real-time control of virtual objects in a simulated space, with interactions emphasised by polish." — [Wikipedia: Game feel](https://en.wikipedia.org/wiki/Game_feel)
- Pichlmair & Johansen's survey of 200+ sources defines game feel as "the intentional design of the emotional impact of moment-to-moment interaction." It splits the practice into three intents, each with its own polishing practice: **Physicality (tuning)** makes object behaviour cohesive and predictable. **Amplification (juicing)** emphasises events, empowers the player, and shows how important each event is. **Support (streamlining)** acts on player intent and makes actions easier to execute. — [Pichlmair & Johansen, "Designing Game Feel. A Survey", arXiv 2011.09201 / IEEE Trans. Games, DOI 10.1109/TG.2021.3072241](https://arxiv.org/abs/2011.09201)
- Jonasson & Purho, "Juice it or lose it" (Nordic Game Jam, May 2012): a live demo adding effects to a Breakout clone. A secondary list of its takeaways: colour, tweening/easing on every movement, squash-and-stretch on events, wobble on bounce, sound, music, particles, screenshake, and objects that react to the beat of the music. (Secondary summary, order may not match the talk.) — [RPG Playground summary](https://rpgplayground.com/?p=3339); [Juicy Break](https://crcdng.itch.io/juicy-break)
- Juicing defined as "improving the feel of a game using animations, special effects, sound effects, and generally any visual or auditory improvement that supports the gameplay." — [GDQuest glossary](https://school.gdquest.com/glossary/juicing)
- Nijman (Vlambeer) on one Nuclear Throne pistol shot (30 fps, 320x240): play the shot sound. Eject a shell at 2-4 px/frame, 100-150 degrees off the aim. The bullet's first frame is a circle (a fake muzzle flash), then a bullet sprite. Bullet speed 16 px/frame with 0-4 degrees of spread. Camera kicks back 6 px from the aim. "Add 4 to the screenshake," which decays fast, where the value is the max pixel offset in any direction. Weapon kick of 2 px, then the sprite slides back. On a hit: an impact sound mixed from a material type (meat, plant, rock, metal) plus the target's own hit sound. Enemy pushed 3 px/frame along the bullet direction. Hit animation of one white frame, then 2 frames of a big-eyed "hurt" pose. **Freeze the game about 10-20 ms on every hit.** Props such as cacti exist so stray bullets hit something. — [Infovore, "Making Game Feel" (interview notes)](https://infovore.org/?p=5275)
- A later GDC talk by Folmer Kelly argued against "juice it or lose it," saying polish can reduce immersion. (Secondary mention only.) — [RPG Playground](https://rpgplayground.com/?p=3339)
- Hitstop (hit-pause, hitlag): both parties freeze for "a handful of frames," usually scaled by damage, so heavier hits freeze longer. Too long reads as a hang, too short goes unnoticed. Freeze only the attacker and target, timed on unscaled time; freezing the whole game also stops UI, audio and effects, which feels wrong. (Community and blog sources, no frame counts that hold across games.) — [critpoints.net](https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/); [Bugnet hitstop guide](https://bugnet.io/blog/how-to-fix-hitstop-or-freeze-frame-feeling-off); [Source Gaming on Sakurai's column](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/)

### Inferences
- For a typing game, the Nijman recipe translates directly: one keystroke can carry a sound, a 1-frame "flash" state on the letter, a small directional kick (a few px), a decaying shake value, and a material-dependent sound (correct vs wrong key as two "materials").
- Hitstop at 10-20 ms per event fits a typing game only for rare events (word complete, combo milestone). Typing runs at about 5-15 keystrokes per second (inferred from common WPM ranges, not sourced here), so a per-key freeze would eat a large share of each 70-200 ms inter-key interval and fight the input stream.
- Pichlmair's "support/streamlining" maps to typing affordances such as forgiving word boundaries and caret smoothing, not only to visual juice.

### Gaps
- No full transcript of "The Art of Screenshake" or the "Juice it or lose it" talk was reachable. The technique lists above come from secondary summaries and one interview write-up.
- I could not verify Swink's book text directly. See Q4 for the 100/240 ms figures often attributed to it.
- No sourced numbers for squash-and-stretch magnitudes (e.g. scale percentages) were found.

## Q2. Concrete animation craft: easing, durations, anticipation/follow-through, text and caret animation, particles, transitions

### Takeaway
UI-motion guidance converges on 100 ms for direct feedback, 200-300 ms for larger changes, ease-out for things arriving, ease-in for things leaving, and nothing near 500 ms. Monkeytype's source gives the most directly relevant numbers for a typing game: a caret that glides to the next letter in 85/100/150 ms (fast/medium/slow) with an in-out ease, and a 1 s blink cycle.

### Cited Findings
- NN/g animation durations: simple feedback (toggles, checkboxes) about **100 ms**, which "feels immediate." Substantial screen changes (e.g. a modal) **200-300 ms**. General range **100-400 ms**, with **400 ms** only for big moves on large screens. At about **500 ms** animations "feel like a drag." Entering takes slightly longer than exiting: about **300 ms in, 200-250 ms out**. — [NN/g, "Executing UX Animations: Duration and Motion Characteristics"](https://www.nngroup.com/articles/animation-duration/)
- NN/g easing: use **ease-out** (fast start, slow settle) for elements entering, which is the most common case. Use **ease-in** for elements leaving, though a slow start can feel unresponsive. Ease-in-out is fastest in the middle. Avoid linear motion, which looks unnatural. Its references include Val Head, *Designing Interface Animation* (2016), Saffer, *Microinteractions* (2014), and Pratt et al. 2010, "It's Alive! Animate motion captures visual attention" (Psychological Science). — [NN/g](https://www.nngroup.com/articles/animation-duration/)
- **Monkeytype caret (primary source code):** the setting `smoothCaret` takes off / slow / medium / fast, and **medium is the default**. Duration mapping in `animatePosition()`: **slow = 150 ms, medium = 100 ms, fast = 85 ms**, off = 0 (instant). The default easing is anime.js `"inOut(1.25)"`, a gentle power-1.25 ease-in-out, not a strong curve. A line jump is animated separately through the words container's top margin, on its own animation queue so it does not disturb the per-letter caret motion. A new position cancels the running animation, so the motion can be interrupted. The idle blink `caretFlashSmooth` runs **1 s infinite**, opacity 0 -> 1 -> 0 at 0/50/100%. The "hard" variant switches between fully on (0-50%) and fully off (51-100%) with no fade. Blinking stops (opacity 1) while the user types. — [monkeytype `frontend/src/ts/elements/caret.ts`](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/elements/caret.ts); [monkeytype `frontend/src/styles/animations.scss`](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/styles/animations.scss); [monkeytype `packages/schemas/src/configs.ts`](https://github.com/monkeytypegame/monkeytype/blob/master/packages/schemas/src/configs.ts)
- Nijman's "weapon kick" is follow-through in miniature: a 2 px displacement against the action, then a quick slide back to rest. The camera kicks 6 px, and screenshake decays quickly from an additive value (4 px per shot). — [Infovore](https://infovore.org/?p=5275)
- The 1-white-frame-then-2-frames "hit" state is a flash-and-hold pattern: at 30 fps that is about 33 ms of white followed by about 67 ms of the hurt pose. (Durations computed from the stated frame counts and frame rate.) — [Infovore](https://infovore.org/?p=5275)
- Juice It or Lose It takeaways include tweening every movement, squash-and-stretch on events, and wobble on bounce (secondary). — [RPG Playground](https://rpgplayground.com/?p=3339)

### Inferences
- Caret: 85-100 ms, close to linear or a mild in-out, is a well-tested default. It sits under the NN/g "immediate" bound, so the glide reads as smooth rather than laggy. Anything over about 150 ms will likely make fast typists see the caret trailing behind their input (inferred from Monkeytype's "slow" ceiling and the 100 ms immediacy bound).
- Make animations interruptible, as Monkeytype does by cancelling on each new target. At 10+ keys per second, a queued tween would build up lag.
- Per-letter feedback should use the "flash then settle" shape: an instant state change on the keystroke frame (0 ms delay), then an ease-out decay over roughly 100-200 ms, which keeps the cause-effect link sharp.
- Screen and menu transitions: 200-300 ms in with ease-out, 200-250 ms out with ease-in, and never 500 ms or more.
- Additive, fast-decaying shake (Nijman's model) suits combo or streak intensity: each event adds a small amount and the value decays every frame, so rapid typing builds energy and pauses calm it down.

### Gaps
- Material Design 3 duration and easing token pages could not be fetched (JS-rendered), so no M3 cubic-bezier values are included here.
- No sourced craft notes were found on ink, paint or brush visual effects, particle counts or lifetimes, or letter-by-letter text animation beyond Monkeytype's caret. The report writer should not cite numbers for these from this file.
- No sourced anticipation timings (wind-up durations) were found for UI-scale motion.

## Q3. Minimalist aesthetics that still feel juicy (Monkeytype, Mini Metro, Tetris Effect / Rez, Alto, Thumper)

### Takeaway
The best-documented minimalist examples get their juice from sound tied to player action more than from visual excess. Mini Metro triggers almost all of its audio samples from player actions, quantized to a beat and harmonized per level. Mizuguchi's synesthesia games layer action-triggered sounds over a backing track and build the audiovisual intensity up from empty as the player succeeds.

### Cited Findings
- Mini Metro (Rich Vreeland / Disasterpeace): "pretty much everything you hear in the game consists of samples that are triggered in real-time as a result of player actions." The aim was a minimalist, calming score that supports gameplay feedback and counterbalances the game's stress. — [Designing Sound interview](https://designingsound.org/2016/02/18/the-programmed-music-of-mini-metro-interview-with-rich-vreeland-disasterpeace)
- Mini Metro has no looping tracks. It uses serialism and sonification of internal game data, with the game clock (hour/day/week) feeding the system. Each level has its own harmonic base, a "core progression" that allows several rhythms. — [Disasterpeace blog / GDC 2018 transcript](https://disasterpeace.com/blog/tag.tools.procgen.p2); [Kill Screen](https://www.killscreen.com/music-urban-commute-designing-mini-metros-soundtrack/)
- Mini Metro aligns game events to beats within a measure (quantization), so notes, key and tempo shift with play. (French secondary source.) — [Siècle Digital](https://siecledigital.fr/2022/02/02/jeu-video-et-musique-procedurale-un-mariage-parfait/)
- Mini Motorways turns road noise into music (related design write-up). — [Game Developer](https://gamasutra.com/design/turning-road-noise-into-music-mini-motorways)
- Mizuguchi's synesthesia line (Rez, Lumines, Child of Eden, Tetris Effect) synchronizes on-screen actions with sound cues. — [TheGamer](https://www.thegamer.com/tetsuya-mizuguchi-synaesthesia-game-rez-infinite-area-x/)
- Tetris Effect layers sound effects over the backing track so the music "still sounds like music" during intense play (Edge review). Each level starts empty and silent and the audiovisual layer grows as the player clears lines (Retro Gamer). — [Edge via PressReader](https://www.pressreader.com/australia/edge/20181206/282132112516020); [Retro Gamer via PressReader](https://www.pressreader.com/uk/retro-gamer/20181228/281749860448812)
- Tetris Effect's Zone meter fills faster at higher difficulty and in larger steps for multi-line clears. — [Trusted Reviews](https://trustedreviews.com/reviews/tetris-effect)
- Mizuguchi sees haptics as a third layer added to visuals and sound in the synesthetic experience. — [TheGamer](https://www.thegamer.com/tetsuya-mizuguchi-synaesthesia-game-rez-infinite-area-x/)
- Monkeytype's restraint in practice: a single caret with a 1 s blink while idle that stops while typing, and a sub-100 ms glide by default (see Q2). — [monkeytype source](https://github.com/monkeytypegame/monkeytype/blob/master/frontend/src/ts/elements/caret.ts)

### Inferences
- For a minimalist typing game, the strongest juice per pixel is probably audio that follows keystrokes: each correct key triggers a note from a per-level scale, quantized or harmonized so fast typing produces music rather than noise (Mini Metro and Tetris Effect pattern).
- "Start empty, build with success" (Tetris Effect) is a low-clutter way to show a streak: add audiovisual layers as accuracy or speed holds, and strip them back on errors.
- Larger reward steps for bigger achievements (multi-line clears filling Zone faster) maps to bigger feedback for completing whole words or sentences than for single letters.

### Gaps
- No usable sourced material was gathered on Alto's Odyssey or Thumper design (timings, effects). Do not cite specifics for them from this file.
- Whether Tetris Effect quantizes input-triggered sounds to the beat could not be confirmed. Mini Metro's quantization is sourced only through a secondary French article.

## Q4. Latency and responsiveness thresholds

### Takeaway
About 100 ms is the classic bound for feeling instant. Measured perception thresholds for direct interaction are much lower: about 60 ms for mouse, about 50 ms for inking, and 2-7 ms for some direct-touch tasks. Audio-visual sync is detectable at about 45 ms of audio-early and 125 ms of audio-late (ITU, speech-based), and a tighter broadcast target is +15/-45 ms.

### Cited Findings
- Nielsen's 3 limits: **0.1 s** feels instantaneous, and users feel they directly manipulate objects. **1 s** keeps the flow of thought, with the delay noticed. **10 s** is the attention limit. These come from Miller (1968) and Card, Robertson & Mackinlay (1991). — [NN/g, Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- Figures often linked to Swink: about **240 ms** for a player to perceive the game state and react (the correction cycle), and response under **100 ms** for comfortable controls. They come from Card, Moran & Newell's 1983 Model Human Processor. A lecture slide citing Swink (pp. 34f.) gives a perception window of about 80-100 ms and comfortable lag of at most 2-3 frames at 30 fps or 5-7 frames at 60 fps. (Secondary; not verified against the book.) — [Uni Bayreuth GxD 07 Interfaces slides](https://medienwissenschaft.uni-bayreuth.de/wp-content/uploads/GxD-07-Interfaces.pdf); [Gamerboom](https://gamerboom.com/archives/72271)
- Mouse interaction: latency perception thresholds of about **60 ms** ("Are 100 ms Fast Enough?", 2017). — [Univ. Lübeck](https://imis.uni-luebeck.de/en/node/7124)
- Stylus and touch: latency perception while inking is about **50 ms**, against about **2-7 ms** for previously reported non-inking direct-touch tasks. Their prototype reached about 1 ms latency. Commercial touch devices ran up to 125 ms. Performance in dragging tasks drops as latency rises (Jota, Ng, Dietz, Wigdor 2013). — [U Alberta / Ng et al. papers](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf); [DGP Toronto](https://www.dgp.toronto.edu/?p=697)
- AV sync (ITU-R BT.1359): detectable at about **+45 ms (audio early) to -125 ms (audio late)**, acceptable at about **+90 to -185 ms**. These were derived from newsreader speech clips. ATSC IS-191 targets audio no more than 15 ms early and 45 ms late. Thresholds for music (guitar, piano) are higher than for speech. — [ITU-R BT.1359](https://itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-0-199802-S!!PDF-E.pdf); [TV Technology](https://www.tvtechnology.com/opinions/av-synchronization-how-bad-is-bad); [arXiv 2212.01686](https://arxiv.org/pdf/2212.01686)

### Inferences
- Keystroke feedback should render on the next frame (16.7 ms at 60 Hz) with no tween delay before the first visible change. Easing can then run after an instant first-frame change, which keeps the perceived latency at about one frame.
- People are less tolerant of audio arriving early than late, so keypress sounds should never play before the visual. Keep total audio latency (Web Audio output latency plus scheduling) well under about 45 ms after the visual. Pre-decode buffers and play them on keydown, not keyup.
- Because ink-drawing latency perception (~50 ms) is closer to typing-with-visual-trail than tapping is, a drying-ink trail effect probably tolerates a little more lag than the caret itself. This is an inference, not tested.

### Gaps
- No keyboard-specific latency perception study was fetched (keypress-to-glyph thresholds).
- The exact 2013 Jota et al. tapping/dragging numbers (often quoted as ~1 ms drag / ~24-33 ms tap) could not be verified in this session.

## Q5. Sound design for satisfying feedback: pitch variation, rising-pitch combos, keyboard clicks

### Takeaway
Small random pitch shifts and round-robin samples prevent the "machine-gun effect" on sounds that repeat several times per second, which is exactly a typing game's situation. Varying the transient and tail matters more than pitch alone. Hicks et al. (CHI PLAY 2024) find that pro audio designers apply juicy principles to sound on purpose, under the headings emphasis/augmentation, cohesion/coherence and synesthesia.

### Cited Findings
- Random pitch per playback reduces repetition for frequently played sounds (gunshots, footsteps, heard several times a second). The shift itself can go unnoticed but adds natural variation. — [Game Developer, "The Power of Pitch Shifting"](https://gamedeveloper.com/audio/the-power-of-pitch-shifting)
- Semitone math: 1 semitone = pitch multiplier 2^(1/12) ≈ 1.06. Web Audio `detune` is in cents, 100 cents = 1 semitone. — [O'Reilly, Web Audio API ch. 4](https://www.oreilly.com/library/view/web-audio-api/9781449332679/ch04.html)
- Godot's AudioStreamRandomizer combines a stream pool, random pitch (in semitones) and random volume offsets. No recommended range is given. — [Godot docs](https://docs.godotengine.org/pt_BR/stable/classes/class_audiostreamrandomizer.html)
- Practitioner view: against the machine-gun effect, the two most important factors are "the transient" and "identifiable sounds in the tail." Pitch alone helps less than expected, and randomising those parts slightly (even with a random pitch envelope) helps with a single sample. — [VI-Control forum](https://vi-control.net/community/threads/if-you-had-only-one-snare-sample.138821/)
- Standard practice combines several samples (round-robin) with slight pitch and volume randomization. — [Bugnet footstep variation](https://bugnet.io/blog/how-to-implement-footstep-variation-to-avoid-repetition)
- Hicks et al., "Juicy Audio" (PACM HCI, CHI PLAY 2024): interviews with 12 game audio designers. Juicy design principles carry over to audio and are used deliberately to improve feedback and player experience. Proposed foundation: emphasis/augmentation, cohesion/coherence, synesthesia. — [Staffordshire eprint 8527](https://eprints.staffs.ac.uk/8527)
- Nijman mixes the hit sound from two layers: a material sound plus the target's own sound. — [Infovore](https://infovore.org/?p=5275)

### Inferences
- Typing keys: use 3-5 click samples in round-robin, with small pitch jitter (on the order of tens of cents) and slight gain jitter. Vary the transient, not only pitch.
- A rising-pitch streak (each correct key a step up a scale, reset on error) is the typing-game version of the coin-combo ramp. Quantizing those steps to a musical scale (Mini Metro, Q3) stops the climb from sounding like a siren. This design is inferred; no source with rising-pitch combo numbers was found.
- Use two "materials" for correct vs error so the sound itself carries the information, following Nijman's material-layer approach.

### Gaps
- No sourced semitone range for pitch randomization (one search summary offered ±1-2 semitones from general knowledge; not a source, do not cite).
- No sourced data on rising-pitch combo design (step sizes, reset rules) or keyboard click / ASMR audio research. The full text of Hicks 2024 could not be extracted (PDF rendering and ACM HTML both blocked).

## Q6. When does juice become noise? Over-juicing, accessibility, reduced motion

### Takeaway
There is empirical evidence of a ceiling: extreme juice performed worse than medium or high, and in a 1,699-person study pure amplification unexpectedly lowered motivation, plausibly by blurring the action-outcome link. For motion, WCAG 2.3.3 (AAA) asks that interaction-triggered non-essential animation can be turned off, with `prefers-reduced-motion` as the standard hook.

### Cited Findings
- Kao (2020, Entertainment Computing vol. 34) built 4 versions of one action RPG (None / Medium / High / Extreme juiciness). "Both Medium Juiciness and High Juiciness outperform No Juiciness and Extreme Juiciness across all measures." The measures were player experience, intrinsic motivation, play time and in-game performance. (Secondary summaries; paper not accessed.) — [Improbable Research blog](https://www.goodreads.com/author_blog_posts/19932694-the-effects-of-juiciness-in-an-action-rpg-new-study); [UW paper citing it](https://faculty.washington.edu/zkwen/articles/lin22features.pdf)
- Kao, Ballou, Gerling, Breitsohl, Deterding (CHI '24): amplification "unexpectedly decreased" effectance, competence and curiosity, possibly by undermining agency. Success-dependent feedback raised all three. — [Imperial Spiral](https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d)
- Folmer Kelly's GDC talk argued polish can reduce immersion (secondary mention). — [RPG Playground](https://rpgplayground.com/?p=3339)
- WCAG 2.3.3 Animation from Interactions (AAA): non-essential motion triggered by interaction should be possible to disable. Sufficient techniques are C39 (CSS `prefers-reduced-motion`), SCR40 (the same in JS) and an in-app preference. Non-essential motion can trigger vestibular reactions: distraction, dizziness, headaches, nausea. Parallax and decorative motion should be switchable. — [W3C Understanding SC 2.3.3](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions)
- Deque: 2.3.3 covers animation triggered by user actions; auto-playing background motion falls under 2.2.2. Recommends an in-page toggle in addition to the media query. — [Deque](https://dequeuniversity.com/resources/wcag2.1/2.3.3-animations-from-interactions)

### Inferences
- Tie intensity to performance (success-dependence) rather than turning everything up. Feedback that scales with accuracy or streak is supported by the CHI '24 result. Constant maximal effects are not.
- Under reduced motion, keep colour, opacity and sound feedback and remove shake, kick and travel. The caret can jump instantly (Monkeytype's "off" = 0 ms is an existing pattern).
- In a reading-heavy game, effects must never move or obscure the next letters to be typed. Keep shake on the frame or decoration and leave the text alone (inferred from the readability concern, not sourced).

### Gaps
- No quantitative "too much" threshold (e.g. shake px, particle count) was found. Kao 2020 effect sizes and the exact parameters per condition were not accessed.

## Q7. Empirical studies on juice and player experience

### Takeaway
There are a small number of controlled studies. The two strongest are Kao 2020 (inverted-U on juice amount) and Kao et al. CHI '24 (n=1,699, preregistered: success-dependence and curiosity matter more than amplification). The Hicks line of work supplies the definitions and heuristic frameworks from developer surveys.

### Cited Findings
- Kao et al. CHI '24: n = 1,699, preregistered online experiment, 2x2 plus control, varying amplification, success-dependence and variability in a purpose-built action RPG. Curiosity was the strongest predictor of enjoyment and the only predictor of free-choice playtime, and competence pathways were supported. Conclusion: "uncertain success" is an underappreciated driver, and juice guidance depends on clear action-outcome links and graded success. DOI 10.1145/3613904.3642656. — [Imperial Spiral](https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d)
- Kao 2020: medium and high juice beat none and extreme on all measures (see Q6). — [Improbable Research](https://www.goodreads.com/author_blog_posts/19932694-the-effects-of-juiciness-in-an-action-rpg-new-study)
- Hicks, Dickinson, Holopainen, Gerling, "Good Game Feel: An Empirically Grounded Framework for Juicy Design" (DiGRA 2018): survey of 17 developers, an affinity-diagram framework applied to two commercial games. Defines juicy design as large amounts of audiovisual feedback contributing to positive player experience. — [DiGRA library](https://dl.digra.org/index.php/dl/article/view/936)
- Hicks, Gerling, Dickinson, "What makes a Game? Reflections on Juiciness and Player Experience": a player-and-developer survey giving an empirically grounded definition that links juiciness to autonomy and control. — [figshare](https://figshare.com/articles/Kieran_Hicks_Kathrin_Gerling_Patrick_Dickinson_-_What_makes_a_Game_Reflections_on_Juiciness_and_Player_Experience_/5147011)
- "Good Feedback for bad Players? A preliminary Study of 'juicy' Interface feedback" exists as a related study. Results not accessed. — [Elsevier Pure record](https://adk.elsevierpure.com/en/publications/good-feedback-for-bad-players-a-preliminary-study-of-juicy-interf)

### Inferences
- For design decisions, the CHI '24 result is the most reliable signal (largest n, preregistered): make feedback contingent on how well the player did (graded success) rather than uniformly loud.

### Gaps
- No study specific to typing games or text input was found.
- A 2019 IEEE CoG paper by Hicks, Gerling et al., "Understanding the Effects of Gamification and Juiciness on Players" (DOI 10.1109/CIG.2019.8848105 per a search summary), may be the main player-side study; I could not reach its landing page or results. The results of "Good Feedback for bad Players?" were not accessed either.

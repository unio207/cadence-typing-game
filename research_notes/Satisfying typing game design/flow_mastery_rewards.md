# Psychology of Satisfaction in Games: Flow, Mastery, Competence, Reward Structures (applied to a short-run browser typing game)

Scope note: per the coordinator's priority update, these notes are weighted toward game flow: pacing and intensity curves within a run, start/end/restart friction and "one more run" loops, and how flow is entered and kept. SDT theory and reward-schedule ethics are shorter. Each finding is labelled **[Empirical]** (controlled study, survey, meta-analysis, or company-reported metric) or **[Designer opinion]** (practitioner argument, talk, thesis argument, review). Company-reported metrics are marked as such because they have no published method.

## 1. Flow conditions, how designers operationalize them, and whether DDA works

### Takeaway
Challenge-skill balance is a real but moderate predictor of flow (meta-analytic), with clear goals and sense of control contributing alongside it. Automatic performance-based DDA reliably raises performance but has not been shown to raise enjoyment or flow; Chen's alternative is to let the player steer difficulty through choices built into the core action, because a hidden system cannot see flow and takes away control.

### Cited Findings
- **[Empirical]** Fong, Zaleski & Leach meta-analysis (Journal of Positive Psychology 10(5):425-446, dated 2014 online, often cited 2015): pooled 28 studies; the challenge-skill balance to flow relationship was **moderate**, and weaker for intrinsic motivation. Correlations were weaker in individualistic cultures, in work/education settings, with experience-sampling methods, and for state (vs trait) flow measures. Relative to other proposed antecedents, challenge-skill balance was a robust contributor, **alongside clear goals and sense of control**. — [Institute of Coaching summary of the meta-analysis](https://www.instituteofcoaching.org/resources/challenge%E2%80%93skill-balance-and-antecedents-flow-meta-analytic-investigation)
- **[Designer opinion / theory recap]** Chen's MFA thesis lists Csikszentmihalyi's eight flow components: a challenging activity requiring skill; merging of action and awareness; clear goals; direct feedback; concentration on the task; sense of control; loss of self-consciousness; transformation of time. "Not all of these components are needed for flow to be experienced." — [Chen, Flow in Games MFA thesis (PDF), p.7](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Designer opinion]** Chen reduces these to three conditions a game needs: (1) the game is intrinsically rewarding and the player wants to play; (2) challenge matches ability; (3) the player feels personal control over the activity. — [Chen thesis, pp.7, 18](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Designer opinion]** The flow zone is a "fuzzy safe zone" with tolerance: a player's experience curve can wobble a little above or below expectation and stay in flow, but large excursions produce anxiety (too hard) or boredom (too easy). Different players have different zones (novice vs hardcore), so one static tuning fits only the middle. — [Chen thesis, pp.5, 9-10](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Designer opinion]** Chen's critique of passive (system-driven) DDA: (a) no direct data on the player's mental state; (b) "performance does not mirror Flow" (performance is objective, flow subjective; a player may be in flow while not progressing); (c) analysis rests on assumptions that fail across a mass audience; (d) the adjustment rules are the designer's rigid preferences. He argues system DDA "ignored the other important core element, to make player feel a sense of control." — [Chen thesis, pp.12-13](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Designer opinion + informal test]** Chen's prescription: (1) widen flow coverage with a spectrum of difficulties; (2) player-oriented "active" DDA; (3) embed the difficulty choice into the core mechanic so it is made through play, not menus. — [Chen thesis, p.14](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Informal test, not controlled]** Chen's "Traffic Light" prototype asked between rounds whether to go faster/slower/same. This extended play time of a simple timing game "from 1-2 minute to about 5-12 minutes," but "the frequent DDA choices broke the player's Flow. It started offering the player a sense of control, but eventually reduces the player's control." — [Chen thesis, p.15](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Informal / popularity data]** flOw embeds difficulty in movement: eating certain food descends to harder levels, players can return to easier levels any time, death pushes you back one level ("minimal death penalty"), and swimming toward or away from creatures lets players "subconsciously" balance challenge. It had 350,000+ downloads in its first two weeks. — [Chen thesis, p.16](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Empirical]** Robb & Zhang (Acta Ludologica 5(1):4-22, 2022), n=221, three versions of a 2D game: performance-based DDA, constant difficulty, and incremental (rises regardless of performance). The DDA group **performed significantly better**, but there were **no significant differences in enjoyment or flow**. — [CEEOL abstract](https://ceeol.com/search/article-detail?id=1049985)
- **[Empirical, review-level]** A systematic review of DDA solutions selected 34 of 547 studies; approaches were mainly AI techniques (50%) and heuristic/parameter manipulation (47%). Reviews describe DDA's effect on player experience as mixed: it can enhance or hinder. — [UFG systematic review](https://repositorio.bc.ufg.br/items/36654b2c-0c40-4a08-8d21-8ff7f53765c4); [JMIR Serious Games 2021 comparative study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8204235/)

### Inferences
- For a typing game, the cleanest active-DDA lever is the one Chen describes as "embedded in gameplay": the player's own typing speed drives pace (for example, the word stream advances or ramps only as fast as the player clears it), plus a small number of up-front choices (word difficulty tier, target WPM) chosen before the run, not between rounds. Between-round prompts are exactly what broke flow in Traffic Light.
- Hidden rubber-banding based on WPM is the passive DDA Chen warns about; Robb & Zhang suggest it would make scores look better without making the run feel better. If any automatic adaptation is used, it should be small and its effect on score should be legible, so personal bests stay meaningful.
- The meta-analysis supports giving equal design weight to clear goals and sense of control, not only difficulty tuning. In a typing game, "clear goal" = the next word and the run target are always visible; "control" = no input is ever dropped or delayed and errors are attributable to the player.

### Gaps
- The Aalto thesis on hidden vs upfront DDA returned HTTP 403; I could not read its findings. No true quantitative meta-analysis (with pooled effect sizes) on DDA and enjoyment was found.
- Chen's 2007 Communications of the ACM article "Flow in Games (and Everything Else)" was not retrieved; findings above come from the MFA thesis.
- No study found measuring how long it takes to enter flow in short (under 2 minute) game runs.

## 2. Pacing and intensity curves within a run: tension and release, ramps, breathers

### Takeaway
The dominant practitioner model is a rising sawtooth: overall intensity escalates over the run, broken by short drops that let the player breathe, with peaks capped so stress does not run too long (Left 4 Dead's build-up / peak / relax). This is designer practice with little controlled evidence behind it; the empirical analogue is that the flow zone tolerates moderate deviation but not sustained overload or underload.

### Cited Findings
- **[Designer practice, secondary source]** Mike Booth created Left 4 Dead's AI Director, which "dynamically adjusted a player's experience of the game during each playthrough." — [Wikipedia: Mike Booth](https://en.wikipedia.org/wiki/Mike_Booth)
- **[Designer practice, primary interview in Japanese]** In a 2007 Game*Spark interview, Booth describes the Director reacting to pacing: if play becomes too calm, it schedules new attacks; if intense combat lasts too long, it lets things settle. — [Game*Spark interview](https://www.gamespark.jp/article/2007/04/10/11866.html)
- **[Designer practice, secondary notes]** Notes on a Booth pacing talk describe estimating each survivor's "emotional intensity," tracking the max across the four players, and lowering threats when intensity gets too high. Console-variable documentation confirms named phases: wandering enemies spawn only when all survivors are below an intensity threshold during RELAX, and a PEAK switches to RELAX based on survivor intensity plus a peak timer. Durations were not published in what I found. — [Google Groups notes](https://groups.google.com/g/brain-training/c/aEMPyrlFRJw); [L4D console command reference](https://www.gamehostbros.com/guides/games/left-4-dead/console-commands)
- **[Designer practice]** Craig Thomas (Game Developer, 2017), describing an intensity system "heavily inspired by Left 4 Dead's AI Director": "We knew we wanted the game to steadily get more and more intense over time," with a target pattern alternating "periods of rising intensity with shorter periods of falling intensity," and "relaxation periods; brief windows of time where the player would have a chance to catch their breath." The system spawned based on the gap between measured and target intensity. — [Using intensity to drive player engagement](https://www.gamedeveloper.com/design/using-intensity-to-drive-player-engagement)
- **[Designer opinion]** Edmund McMillen (Super Meat Boy): "The designer acts as the teacher, giving the player problems that escalate in difficulty," and "the levels keep coming as fast as the player can beat them" (no explicit breathers within the stream; the breather is the instant reset itself). — [Game Developer: McMillen explains 'Why So Hard?'](https://www.gamedeveloper.com/game-platforms/-i-super-meat-boy-i-s-mcmillen-explains-why-so-hard-)
- **[Designer opinion]** Tynan Sylvester's *Designing Games* is framed around engineering "emotionally charged experiences" from "elegant game mechanics, compelling fiction, and pace"; its table of contents includes "Emotional Life Support," "Difficulty Modification," "Handling Failure," and a Pacing subsection in a Fallout 3 case study. — [O'Reilly book page](https://www.oreilly.com/library/view/designing-games/9781449338015/)
- **[Empirical analogue]** Flow theory as summarized by Chen: small deviations from the challenge-skill diagonal are tolerated; large ones produce anxiety or boredom. — [Chen thesis, pp.5, 9](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)

### Inferences
- A 60-120 s typing run can use a compressed build-up / peak / relax: a gentle on-ramp (first ~10-15 s of easy, common words so the player settles into rhythm), a rising ramp in pace or word difficulty, one or two short relax dips (a few easy words or a slower stretch right after a hard cluster), and a final peak near the end so the run closes on tension rather than fade-out. Keep falling segments shorter than rising ones (Thomas).
- The cap matters as much as the ramp: Booth's design ends peaks after a timer even if the player is coping. For typing, sustained max pace causes error cascades; a scheduled release after a peak prevents one bad word from ending the run in frustration.
- In a typing game, intensity can be measured cheaply (recent error rate, keystroke interval variance, how far behind the word stream the player is). That gives an L4D-style "intensity" signal that drives release timing, which is different from Chen's criticized passive DDA because it schedules relief, not permanent difficulty.

### Gaps
- I could not access Booth's GDC 2009 "AI Systems of Left 4 Dead" slides; peak/relax durations are unverified. Claims online of a fixed "30-45 s" figure or "four stress metrics" come from fan sites without primary sourcing and are excluded.
- Sylvester's actual text on tension/release and emotion curves was not retrievable; only the table of contents was confirmed. Treat any specific Sylvester quote on tension-release curves as unverified.
- I found no controlled study comparing escalating-with-breathers vs monotonic ramps on enjoyment.

## 3. Mastery and skill expression: run start/end/restart friction, "one more run," personal bests, near-misses, fair loss

### Takeaway
The strongest design consensus is that the cost of failure should be measured in seconds, not menus: instant restart, short runs, and a visible goal keep the player in the loop and make failure feel like information rather than punishment. Near-miss evidence from games is weaker and less flattering than the gambling literature suggests.

### Cited Findings
- **[Designer opinion]** McMillen: "The time it takes for Meat Boy to die and respawn is almost instantaneous"; "the penalty for death basically turned into the amount of time you took to restart after death"; "It was very important that the levels in Super Meat Boy be bite-sized"; and "keep the levels small enough for the player to see his or her goal," lowering both the stress of the unknown and the re-traverse distance. — [Game Developer: McMillen explains 'Why So Hard?'](https://www.gamedeveloper.com/game-platforms/-i-super-meat-boy-i-s-mcmillen-explains-why-so-hard-)
- **[Designer opinion, reviews]** Reviewers tie compulsive replay to restart speed ("instant restarts mean you just go again"). Counterpoint: when later levels get longer but you still respawn at the start, "punishment and frustration increase," and with only a couple of seconds before being thrown back in, there is no time to analyze a failure. — [Pixel Poppers review](https://pixelpoppers.com/review/super-meat-boy/); [Screenwise essay](https://screenwiseapp.com/media/super-meat-boy-game)
- **[Player request]** An itch.io player asked a developer for a "Super-Meatboy-style instant restart," arguing flow depends on dying and restarting with no delay; the developer said they might shorten hold-to-restart. — [itch.io comments](https://eggnog.itch.io/stickyfoot/comments)
- **[Informal test]** flOw's "minimal death penalty" (drop back one level, not restart) was part of Chen's flow design. — [Chen thesis, p.16](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Designer opinion]** Chen's active-DDA GRE thought experiment lists features that read as a high-score design brief: no score cap so top players can always push; show score gained per item "and feel the joy of answering them correctly"; tie difficulty and reward ("More challenge equals more reward"); let players sense difficulty and skip hard items. — [Chen thesis, p.18](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Empirical, video game]** Finserås et al. (Int. J. Mental Health and Addiction, 2021), n=40, racing against avatars with near/far wins and losses. Near-miss (narrow loss) produced **more boredom and less excitement** than a large win; losses produced more frustration and regret than wins. The retrieved summaries did not report the urge-to-continue result. — [BORA (Univ. of Bergen) record](https://bora.uib.no/bora-xmlui/handle/1956/23601); [NTU repository](https://irep.ntu.ac.uk/id/eprint/36202)
- **[Empirical, gambling]** A 2015 slot-machine study found longer response latencies after near-misses than after wins in 11 of 12 participants (a pause, not acceleration). — [J. Gambling Studies, Springer](https://link.springer.com/doi/10.1007/s10899-015-9554-x)
- **[Empirical, interruptions]** Longer and more demanding interruptions produce longer resumption times (Monk, Trafton & Boehm-Davis), and resumption costs persist beyond the resumption moment itself; retrieval cues left visible in the environment speed resumption (Hodgetts & Jones). — [Monk et al., JEP: Applied](https://www.ovid.com/journals/jepap/pdf/10.1037/a0014402~the-effect-of-interruption-duration-and-demand-on-resuming); [Monk PhD](https://www.interruptions.net/literature/Monk-PhD.pdf); [Hodgetts & Jones, Cardiff](https://orca.cardiff.ac.uk/id/eprint/33005/)

### Inferences
- Restart path for a typing game: one key (e.g. Enter or Tab) restarts from the end screen and mid-run; focus stays on the text input; the first word of the new run is already on screen. Any button click, modal, or loading delay between runs is friction that works against "one more run."
- Runs should be short enough that the whole run is the "visible goal" (a progress bar or timer covering the full run), the way McMillen kept the goal on screen.
- The end screen is both a reward and an interruption. Keep it glanceable (score, delta vs personal best, one stat) and dismissible by the same restart key, so it does not become the long "interruption" that the resumption literature says is costly. Offer a deeper breakdown on demand, which also answers the "no time to analyze failure" critique.
- Fair loss in typing: the player must always be able to see why a run ended (which word, which key). Do not end runs on hidden thresholds.
- Near-misses: the video-game evidence does not support manufacturing them. Showing an honest "0.8 WPM short of your best" is likely enough; inflating closeness is a gambling pattern with weak payoff and ethical cost.

### Gaps
- No controlled study found that directly measures replay rate as a function of restart delay in games. The instant-restart case rests on designer reports and reviews.
- Optimal run length for a typing game is not established by any source found. Chen's Traffic Light data (1-2 min lifespan extended to 5-12 min) is the only session-length number, and it is informal.
- The near-miss "urge to continue" result from Finserås et al. was not retrieved. A popular article claims a 2019 review failed to replicate near-miss persistence effects; I could not verify that review.

## 4. Self-Determination Theory and PENS: what concretely produces felt competence

### Takeaway
SDT studies show felt competence and autonomy predict enjoyment and intent to keep playing; concretely, competence comes from controls that are easy to master, clear and consistent feedback, and graded challenge.

### Cited Findings
- **[Empirical]** Ryan, Rigby & Przybylski (2006), *Motivation and Emotion* 30:347-363 (DOI-based pages; another listing says 344-360), four studies: perceived in-game competence and autonomy related to enjoyment, game preference, and pre-to-post-play changes in well-being; autonomy, competence and relatedness independently predicted enjoyment and future play. — [ACU research bank](https://acuresearchbank.acu.edu.au/item/8q128/the-motivational-pull-of-video-games-a-self-determination-theory-approach); [e-teaching.org listing](https://www.e-teaching.org/materialien/literatur/ryan-rigby-przybylski-2006)
- **[Empirical, press release]** About 1,000 gamers surveyed; Ryan: "We think there's a deeper theory than the fun of playing" and the pull comes from "feelings of autonomy, competence, and relatedness." — [ScienceDaily 2006](https://www.sciencedaily.com/releases/2006/12/061226134706.htm)
- **[Empirical summary]** Features that enhanced need satisfaction: "having controls that were easily mastered," "feedback that was clear and consistent," choices about goals and strategies, and cooperative social interaction. — [SDT.org PENS page](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)
- **[Empirical framing]** Przybylski and colleagues: graded challenges and detailed, unambiguous performance feedback support competence need satisfaction. — [Przybylski, Ryan & Rigby 2009, PSPB (PDF)](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/2009_PrzbylskiRyanRigby_PSPB-1.pdf)
- **[Empirical]** Przybylski, Deci, Rigby & Ryan (2014, JPSP) on competence-impeding play (cited by SDT.org; findings not retrieved). — [PDF](https://selfdeterminationtheory.org/wp-content/uploads/2014/07/2014_PrzyDeciRigbyRyan_JPSP1.pdf)

### Inferences
- Typing is a near-ideal competence domain: controls are the keyboard the player already knows, so "easily mastered controls" means zero input lag, no dropped keys, and correct handling of backspace and IME edge cases.
- Autonomy in a single-player typing game: choice of word set, run length, and goal; Chen's "choices embedded in play" is the autonomy lever. Relatedness is the weakest fit; a ghost of one's own best run is a solo substitute (inference, not sourced).

### Gaps
- Specific effect sizes from the four 2006 studies were not retrieved (the PDF could not be text-extracted in this environment).

## 5. Koster's "A Theory of Fun," MDA aesthetics, and designer frameworks

### Takeaway
Koster: fun is the feeling of learning a pattern, and boredom arrives once the pattern is mastered, so the game must keep feeding new patterns. MDA names "Challenge" (urge to master) as the aesthetic most linked to replay.

### Cited Findings
- **[Designer opinion]** Koster: the brain is a voracious consumer of patterns, games are "exceptionally tasty patterns to eat up," and "Boredom is the opposite of learning"; once a pattern is grokked, the game must supply new challenges. Koster narrows "fun" to mastering a problem mentally, saying a wider definition "renders the word meaningless." Chris Crawford claims an earlier version: "fun is the emotional response to learning." — [Goodreads quotes](https://www.goodreads.com/work/quotes/19639); [Koster, Theory of Fun 10 Years Later (PDF)](https://www.raphkoster.com/wp-content/uploads/2026/07/Theory-of-Fun-10-Years-Later.pdf); [Drama Princess review](https://www.tale-of-tales.com/DramaPrincess/wp/?p=120)
- **[Designer framework]** MDA (Hunicke, LeBlanc, Zubek 2004) lists eight aesthetics: Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission. Challenge = "game as obstacle course," urge to master, boosts replayability. Critics call the list arbitrary and too mechanics-focused. — [MDA paper PDF](https://users.cs.northwestern.edu/%7Ehunicke/MDA.pdf); [Wikipedia: MDA framework](https://en.wikipedia.org/wiki/MDA_framework)

### Inferences
- For typing, the "pattern" being learned is motor: letter sequences, common bigrams, word shapes. A fixed word pool gets mastered and goes stale (Koster's boredom); a word pool that slowly introduces harder bigrams or less common words keeps feeding new patterns while staying fair.
- Primary aesthetics for this game: Challenge and Sensation (feel of keystrokes, audio), with Submission (relaxing rhythm) as a legitimate alternate mode, which matches the meditative player responses to flOw that Chen quotes.

### Gaps
- The exact context of Koster's "fun is just another word for learning" line was not located in the book text; quotes come from aggregators.

## 6. Feedback on performance: per-input vs end-of-run stats, goal gradient, progress visibility, juice

### Takeaway
Immediate, unambiguous per-input feedback supports competence and flow; detailed stats belong at the end. Motor-learning evidence that reduced feedback improves learning is mixed. The goal-gradient effect is solid: people speed up as a visible goal gets close, and illusory head starts increase completion.

### Cited Findings
- **[Theory]** "Direct feedback" and "clear goals" are flow components (Csikszentmihalyi via Chen); the meta-analysis also identifies clear goals as an antecedent. — [Chen thesis, p.7](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf); [Fong et al. summary](https://www.instituteofcoaching.org/resources/challenge%E2%80%93skill-balance-and-antecedents-flow-meta-analytic-investigation)
- **[Empirical, mixed]** Guidance hypothesis (Schmidt 1991): feedback after every trial may cause dependence, so reduced feedback improves retention (Winstein & Schmidt 1990). Many replications failed (Sparrow & Summers 1992; Wishart & Lee 1997; Wulf et al. 1998), and Wulf & Shea (2004) found little evidence that every-trial feedback causes dependence. Optimal frequency is unresolved. — [Frontiers in Psychology 2010](https://www.frontiersin.org/articles/10.3389/fpsyg.2010.00190/full); [Marschall, Bund & Wiemeyer 2007 (PDF)](https://orbilu.uni.lu/bitstream/10993/4589/1/Publikation_Marschall_Bund_Wiemeyer_2007_EJournal%20Bewegung%20und%20Training.PDF)
- **[Empirical]** Kivetz, Urminsky & Zheng (JMR 43:39-58, 2006): café reward members bought coffee more often the closer they were to a free coffee; music raters visited more, rated more songs per visit, and quit sessions less as they neared a reward threshold. An illusion of progress (a pre-stamped card) sped up completion. Effort depends on the proportion of distance remaining. — [Columbia Business School summary](https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal); [Full paper PDF](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf)
- **[Designer opinion]** Chen: let players "see scores gained through each question and feel the joy of answering them correctly." — [Chen thesis, p.18](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- **[Designer opinion]** "Juice it or lose it" (Jonasson & Purho, GDC Europe 2012): tweening, squash and stretch, and responsive feedback make interaction feel alive whatever the graphics. Critics (Folmer Kelly) argue that polish may cost immersion. — [roblog summary](https://roblog.co.uk/2024/03/juicy-games/); [RPG Playground](https://rpgplayground.com/research-making-a-juicy-game/)
- **[Empirical]** Kao et al. (Purdue) ran experiments on juiciness levels in an action RPG; the write-up frames the result as "too much, or too little... can be non-ideal." I did not retrieve per-condition results. Johansen & Cook (AIIDE 2021) compared simple, auto-designed, and expert-designed juice. — [Improbable Research](https://improbable.com/tag/rpg/); [AIIDE paper](https://ojs.aaai.org/index.php/AIIDE/article/download/18889/18654/22655)

### Inferences
- Per-input: each correct keystroke gets an instant, small confirmation (color, subtle sound); an error gets an unmistakable but non-punishing mark. Avoid large per-key effects, since juice that pulls the eye off the next word competes with "concentration on the task."
- In-run: one live number (WPM or progress to target) at most. A full stat dashboard during the run invites self-monitoring, the opposite of "loss of self-consciousness."
- End-of-run: delta vs personal best and vs target, plus one actionable item (slowest bigram, most-missed key). This is where the guidance-hypothesis concern can be sidestepped: summary feedback after the run, immediate cues during it.
- Goal gradient: show the run target as a progress bar that visibly fills; for cross-session goals, a pre-filled start ("2 of 10 runs toward the next tier") is supported by Kivetz et al.

### Gaps
- No study found comparing per-keystroke vs end-of-run feedback specifically in typing games.
- Kao's juiciness condition-by-condition results and Hicks et al. (2018) "Good Game Feel" findings were not retrieved.

## 7. Reward schedules, streaks/combos, loss aversion, and compulsion ethics (short)

### Takeaway
Fixed-ratio rewards create a post-reward pause where players may quit; streaks work partly through loss aversion, but Duolingo's own data show that softening streak loss (freezes) increased activity. Independent evidence on streak mechanics is thin.

### Cited Findings
- **[Designer framework, from behavior analysis]** Hopson ("Behavioral Game Design," Gamasutra 2001; GDC 2004): fixed-ratio contingencies (fixed work for a reward, e.g. XP to level) risk a **post-reward pause** in which players stop trying and may quit the game. — [GDC Vault summary on Game Developer](https://www.gamedeveloper.com/business/gdc-vault-uncovers-xna-s-debut-behavioral-game-design-lessons); [GDC 2004 report](https://gamedeveloper.com/design/postcard-from-gdc-2004-behavioral-game-design)
- **[Company-reported]** Duolingo: allowing two equipped Streak Freezes raised daily active learners by +0.38% (relative); milestone animations raised 7-day retention of new learners by +1.7%; learners who reach a 7-day streak are 3.6x more likely to finish their course (correlational); early streak days are framed as large relative gains (2 to 3 days = +50%). Loss aversion is used for long streaks, and Duolingo states a broken streak can demotivate and keep people from starting again. — [Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- **[Company statement]** A Duolingo PM says loss aversion is used on purpose, and freezes exist to reduce the demotivating effect of keeping up a streak; some users lean on freezes as a crutch. — [CMU UXA write-up](https://cmu-uxa.notion.site/Performative-Progress-Strava-Mules-Duolingo-Streaks-1c18eb2b3ca480f59cd2e4123ac0d7d2)
- **[Empirical, gambling]** Near-misses lengthen response latency rather than speeding play (11 of 12 participants). — [J. Gambling Studies 2015](https://link.springer.com/doi/10.1007/s10899-015-9554-x)

### Inferences
- In-run combos (consecutive correct words) are a within-run streak. Since breaking one is a loss, make the break visible but cheap (combo decays rather than resetting to zero, or a multiplier drops one step), the in-run version of a streak freeze.
- Cross-session daily streaks are a retention tool, not a satisfaction tool. For a hobby skill game, personal bests and skill trends give the cross-session pull without the guilt pressure. If streaks are added, include slack (freeze or grace days) per Duolingo's own data.
- Avoid variable-ratio loot or randomized reward drops in a skill game: they move credit for the outcome from skill to chance, undercutting the competence signal SDT identifies as the main driver.

### Gaps
- Hopson's original 2001 text was not retrieved; the post-reward-pause claim comes from summaries of his 2004 talk.
- No independent, peer-reviewed estimate of streak or loss-aversion effects on retention in games was found; Duolingo's numbers are company-reported with no method or confidence intervals.
- No research found on fatigue from combo/streak systems inside short runs.

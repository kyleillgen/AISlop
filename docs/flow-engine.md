# Flow engine

`games/flow-engine.js` is the reusable core of Flow // Resonance. It is for rhythm micro-games played in short bursts (30 seconds to 3 minutes, for example while code compiles). Flow's design rules hold for every game built on it:

- The beat is calibrated to the player.
- The player never fails.
- Nothing gets harder over time.
- The game flies itself when the player stops.

The evidence behind each rule is in [flow-engine-research.md](flow-engine-research.md). Where the code meets each recommendation is in [flow-engine-audit.md](flow-engine-audit.md).

To build a game on it, start with [build-on-the-engine.md](build-on-the-engine.md): it covers the three layers (engine, shell, game), the built-in rules, the five questions a game answers, and a copy-paste prompt kit. Word Rain (`games/word-rain.html`) and Drop Catch (`games/template.html`) are built on it. Flow // Resonance still runs on its own copy of the same code. Move it onto this file once the module has proved itself.

## What it does for a game

| The engine… | The game… |
|---|---|
| Reads the player's rhythm from every action and eases the music's tempo toward it in small steps. It locks once matched and re-syncs slowly if the player's pace drifts | Calls `tap()` on every rhythmic action |
| Plays Flow's generated music. Every action is a note in key, snapped to the 16th grid | Picks the note with `height` |
| Fires `beat` on every quarter note. `beatPos()` gives a smooth beat count matched to what the player hears | Spawns things on the beat and moves them by `beatPos()` |
| Paces new items with `paceBeats()`: the player's own handling speed with 15% slack, plus up to 3 beats of room when their clean rate drops below 85%. It changes in whole beats and only after 4 items | Spawns when that many beats have passed, and passes `handleSec` to `score()` |
| Keeps the streak and tiers. A miss steps the streak down by a quarter, never to zero, and raises a slow-moving assist level | Calls `score()` and `clip()`, and widens its own margins by `assist`, for things not yet on screen |
| Starts autopilot after `idleSec` with no input, or when the window loses focus. The music slows about 5%, gets quieter and settles on its home chord. The next input takes over again, and the next two misses are forgiven | Plays itself while `auto` is true and scores nothing |
| Calibrates the player's timing against the audio output delay, with a manual offset | — |
| Records measurements on the device (rhythm steadiness, timing, bursts, misses, typos) and occasionally asks two flow questions | — |

## API

```js
const eng = FlowEngine.create({
  key: "myGame",          // storage namespace (tempo, prefs, telemetry)
  perBeat: [0.5, 1, 2],   // actions per beat to try when fitting the tempo (default: Flow's taps)
  minMs: 180, maxMs: 1400,// intervals outside this range aren't rhythm
  stableTol: 1.5,         // BPM agreement needed to lock (raise for ragged input like typing)
  idleSec: 2.5,           // seconds without input before autopilot
  phaseFollow: true,      // nudge the beat toward the player after lock (off for typing)
  tierAt: [8, 20, 40],    // streak for tiers 2, 3 and 4
  autoOnBlur: true,
  flowCheck: true
});

eng.start();                         // from the first user gesture (audio needs one)
eng.tap({ height: 0.3 });            // a rhythmic action; height 0 (high note) to 1 (low)
eng.tap({ note: false });            // counts toward rhythm, plays no note (e.g. a typo)
eng.error();                         // count a typo or wrong input in telemetry
eng.update(dt);                      // every frame, in seconds
eng.on("beat", (n) => {});           // also "lock", "auto", "manual", "pause"
eng.beatPos();                       // e.g. 41.37

const tierUp = eng.score(1, "PERFECT", 1.4); // quality ("CLEAN", "GRAZE"), handling seconds for the pacer
const counted = eng.clip();          // false when forgiven or in autopilot
eng.paceBeats();                     // beats until the next item should appear
eng.chime();                         // phrase celebration shimmer

eng.setAuto(on); eng.pause(on);
eng.cycleTrack(); eng.cycleVoice(); eng.toggleMute(); eng.changeVolume(0.1);
eng.adjustOffset(10); eng.toggleHold();
eng.telemetry(); eng.history();

eng.bpm; eng.beatSec; eng.locked; eng.auto; eng.paused; eng.tier; eng.streak;
eng.assist; eng.flowIndex; eng.trackName; eng.voiceName; eng.muted; eng.volume; eng.milestones;
```

`FlowEngine.createController()` and `FlowEngine.createPacer()` are the pure state machines underneath, with no audio and no DOM. The controller enforces the autopilot rule: `score` and `clip` are ignored while autopilot is on. Its contract tests are in `tests/flow-engine.test.cjs` (run `node --test tests/flow-engine.test.cjs`). They cover tempo locking for steady tappers, half- and double-time folding, typing rhythms with pauses, slow re-syncs (no more than 1.5% per bar), autopilot (including the rule that it never scores or costs), misses, assist, and the pacer (follows capacity, adds and returns room, never faster than capacity, waits between changes).

Experiment switches work in any game: `?phase=frozen` and `?milestones=off`.

## Fitting the tempo

Each action interval is fitted to a tempo inside 96–124 BPM by trying each count in `perBeat` (actions per beat). In-band fits win, and among those, the one nearest the current tempo, so the reading doesn't jump between folds.

- **Taps** use `[0.5, 1, 2]`: half time, on the beat, or double time.
- **Word Rain** uses `[1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]`. With those counts, any typing pace from about 120 to 620 ms a key has an in-band fit. A test checks this.

## Word Rain

Words fall on the beat and reach the water after 10 beats, or up to 15 when the assist is helping. Each correct letter plays the next note up the scale, so every word is a little rising phrase.

- **Typos** cost nothing. They count toward your rhythm, and there is nothing to fix and no backspace.
- **A word that reaches the water** steps the streak down by a quarter.
- **Spacing** comes from the engine's pacer. Each word reports your typing time (first key to last, plus 0.6 s to read the next word). If words start reaching the water, the pacer adds a beat of room, then gives it back once you're clean again. Waiting time never feeds back into slower spawns.
- **Phrase celebration:** every 8 words with none lost to the water plays a shimmer.
- **Autopilot:** after 4 s without typing, the words type themselves and nothing scores.
- **Keys:** a–z type. Esc pause · Enter autopilot · Tab track · Shift+Tab voice · - / = volume · 0 mute · [ / ] audio offset · ? keys.
- **Phones:** tapping the screen brings up the keyboard, and the game stays above it.

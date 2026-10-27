# Tuning the games from data

The games get better through a loop, not one-off rewrites:

1. **Play.** Flow Pocket logs each session's numbers to `~/.flow-pocket/sessions.log` every 20 s of play and whenever autopilot takes over. It stays on your machine.
2. **Report.** Run `node pocket/report.mjs` (or `--days 7`) to get each game's numbers, with flags for anything out of range.
3. **Tune one knob.** Pick one flag, change the knob it names (table below), and note the before numbers.
4. **Play again, compare, keep or revert.** Commit with the before and after numbers in the message, so the history shows why each mechanic is the way it is.

One knob at a time, a few sessions each: the numbers are noisy, and changing two things at once hides which one helped.

## What the report measures

| Measure | What it tells us | Healthy range (first guess, revise with data) |
|---|---|---|
| Misses a minute | Is it too hard right now? | Under 4 |
| Clean rate | Share of the last 16 items handled cleanly | 0.85–0.95 (the pacer aims here) |
| Tap CV | How steady your tap or key intervals are (lower is steadier) | Under 0.35 for tap games; typing runs higher |
| Timing SD | How scattered your taps are around the groove, in ms | Falls as you settle in |
| Slowing after a miss | Next three intervals compared with the three before a miss (1.0 means unshaken) | Under 1.15 |
| Autopilot share | Time on autopilot compared with time played | Expected to be high while Claude works |
| Flow check | Fluency and absorption, 1–7, asked about one session in five | Fluency 4.5+, absorption 4+ |

## Knobs

| Game | Knob | Where | What it changes |
|---|---|---|---|
| All | `pacing` (`minBeats`, `startBeats`, `low`, `high`, `maxRoom`) | game's `engine` option → `createPacer` | How often things come, and how much room a rough patch gets |
| All | `idleSec` | game's `engine` option | How long without input before autopilot |
| All | assist effect | each game's spawn code (`api.eng.assist`) | How much help after misses (only on things not yet on screen) |
| Orbit | `PERFECT`, `FLY`, the clean window (`api.pick` in `onAction`) | `games/orbit.html` | Perfect window, flight length, how forgiving flings are |
| Orbit | lane length and spread (`addAfter`), orbit speed range (`retime`) | `games/orbit.html` | How far apart bumpers are and how fast the ball circles |
| Flipper | `PERFECT`, the clean window (`win`), flight shape (`shot`: rise time, bumper ricochets) | `games/flipper.html` | Perfect window, how forgiving flips are, how the ball fills the beats between flips |
| Word Rain | `fallBeats` (10 + 5 × assist), word list | `spawnWord` | Fall time and vocabulary |
| All | intensity scaling | each game's `api.pick({...})` calls, and `applyIntensity` in `flow-shell.js` | What chill, normal and intense change |
| All | table modes: interval (45–75 s), length (20 s), Hurry-Up and Jackpot values | `flow-shell.js` (`startMode`, `tickModes`) | How often variety arrives and how big the bonuses are |
| All | replay start (8k / 15k / 25k), +15%, in-run spacing (×1.6) | `flow-shell.js` (`REPLAY_START`, `addPoints`) | How often replays feel earned |
| All | rank thresholds and ball finishes | `flow-shell.js` (`RANKS`) | The long-term progression |
| Flow | gap height, buoyancy, pipe spacing | `flow-resonance.html` | Gemini's original physics; change carefully |

Don't change: the perfect windows' meaning (assist never widens them), the never-lose rule, or anything that makes a game harder over time on its own. Harder is only ever the player's choice of intensity. These are the engine's built-in rules (see [build-on-the-engine.md](build-on-the-engine.md)).

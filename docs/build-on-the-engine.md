# Build your own little game on the flow engine

You bring one idea: a thing that happens on the beat and one action the player repeats. The engine and shell bring everything that makes it feel good:

- The music settles into the player's own rhythm.
- Every action is a note in key.
- Nothing can be lost, and nothing gets harder over time.
- It plays itself when you stop, then winds the music down.

All of that comes with pause, settings, keyboard and touch input, and measurement on the device.

A whole game is one HTML file that loads three scripts and fills in a few functions. [`games/template.html`](../games/template.html) (Drop Catch) is the smallest complete example at about 100 lines; [`games/word-rain.html`](../games/word-rain.html) is a fuller one.

## The three layers

| Layer | File | What it owns | You touch it? |
|---|---|---|---|
| **Engine** | `games/flow-engine.js` | Rhythm and music: tempo matching, lock and re-sync, Flow's synth, notes on the grid, timing calibration, streak and tiers, assist, pacing, autopilot, wind-down, measurement | No |
| **Skin** | `games/pinball-skin.js` | The shared look: 70s pinball. Black backbox with a 7-segment score, insert-light flow meter, cream buttons with hard shadows, sunburst backglass start screen, Shrikhand and Oswald type, outlined callouts, chaser bulbs on the beat | No |
| **Shell** | `games/flow-shell.js` | Everything around a game: header, start, pause and keys screens, standard keys, phone keyboard, canvas and frame loop, callouts, particles, phrase celebrations | No |
| **Game** | `games/your-game.html` | What appears, how it moves, what the player does, what counts, how it looks | Yes, only this |

## The built-in rules (you can't break them)

These hold in every game because the engine and shell enforce them, not because each game remembers to:

1. **You can't lose.** `api.miss()` steps the streak down by a quarter. Nothing ends the game.
2. **Autopilot never scores and never costs.** `score()` and `miss()` are ignored while it's on, and the two misses after taking control back are forgiven.
3. **The tempo never jumps.** It moves no more than 3% a bar while matching and 1.5% a bar when re-matching, and it holds still once locked and during autopilot.
4. **Nothing gets harder on its own.** The pacer only follows the player: their own handling speed, plus room when their clean rate drops. Difficulty changes only when the player picks an intensity (chill, normal, intense); within a session it never ramps.
5. **Help is invisible.** `api.eng.assist` should only widen margins on things not yet on screen. The template shows how.
6. **Every action is a note** in key, snapped to the 16th grid. During calibration the snapped note is held back so it can't bias timing.
7. **Stopping is free.** Settings, tempo and best score persist, and autopilot gives a soft landing.

## The five questions a game answers

| Question | Hook | Notes |
|---|---|---|
| What appears on the beat? | `onBeat(n, api)` | Spawn when `api.eng.paceBeats()` beats have passed. It lands, arrives or matters at `n + k` beats |
| How does it move? | `update(dt, api)` | Position = a function of `api.eng.beatPos()`, so motion rides the music and lands on beats |
| What does the player do? | `onAction(api, e)` (taps) or `onLetter(ch, api)` (typing) | Call `api.eng.tap({ height })` on every action. Height 0 is a high note and 1 a low one |
| What counts? | `api.score(1, "PERFECT" \| "CLEAN", handleSec)` / `api.miss()` | `handleSec` (how long the player took) feeds the pacer |
| How does it look? | `draw(ctx, api, t)` | The shell draws particles and callouts on top. Use `api.cached()` for gradients |

Plus `autopilot(dt, api)`: what the game does by itself when the player stops. The same function runs **attract mode**: until the first input, the game plays itself under a marquee of its `title` and `hint`, like a pinball table on show. There's no start card or rules screen. The first tap or key starts the sound and is also a move. Teach the rest in context with `api.hint(id, text)`, a tip shown once ever (after attract mode), when it becomes relevant (for example, after the first miss). Use `api.ring(x, y, color, size)` for perfect moments.

The shell also runs the reward loop and the variety for every game:
- **Score:** 100 a hit, doubled for perfect, times a combo multiplier (×1 to ×5, back to ×1 on a miss), scaled by intensity. `api.bonus(points)` awards extra, for example a star.
- **Replay score:** one per game and intensity. Beating it gives "REPLAY!" and the target creeps up 15% for future runs. If it keeps going unbeaten, it eases back down. There's also a high score per intensity.
- **Lifetime rank,** shared by all games, from Rookie to Legend. Each rank gives a new ball finish via `api.ballStops()`.
- **Intensity:** `api.intensity` and `api.pick({ chill, normal, intense })` let a game scale its own density and demands. The shell scales the pacer.
- **Flow or Fidget:** the player's choice (header chip or `\`). Fidget turns a game into a toy, and the rule is that the world bends to the player's hands rather than the hands fitting the world: in `onAction`, check `api.style === "fidget"` and make the press always succeed (Orbit puts the next bumper wherever the ball is heading, Rollover jumps straight under the next light, Word Rain types the right letter whatever key you hit). Three gestures should each feel different: a slow press, mashing (`api.rev`, 0 to 1), and holding then letting go (`api.held` while down, `onRelease(api, heldSec)` after). The shell adds the sound for each (a ringing note on press, climbing staccato when mashing, a soft clack on release), turns the insert lights into a pressing-speed meter, and lets autopilot fill in only after 4 s untouched. Nothing scores or misses, and there are no table modes or tips.
- **Table modes:** a 20-second twist every 45–75 seconds of play. The built-ins are Double Score, Hurry-Up and Jackpot; list your own in `modes: [...]`, then read `api.mode` when spawning (Orbit's Star Lane, Rollover's Spinner, Word Rain's Golden Words). Optional: `setup`, `resize`, `start`, `onKey`, `onPhrase`, `tierNames`, `colors`, `engine` options.

## Prompt kit

Paste this into any AI coding assistant along with `games/template.html`, then add your idea at the bottom:

```text
Build a new game for the AISlop flow engine. Copy games/template.html and change only
the game section. Do not edit flow-engine.js or flow-shell.js.

Rules:
- One HTML file in games/, loading flow-engine.js, pinball-skin.js, then flow-shell.js,
  then calling FlowShell.mount({ ... }) like the template.
- Look: 70s pinball, not neon. Flat hot colours (api.color() gives the tier's insert
  colour), black outlines, cream (#f6e6c0) and black (#140f0c); no glows or shadowBlur.
  Think playfield parts: drop targets, bumpers, rollovers, rubber bands, silver balls.
- Spawn things in onBeat(n, api) when api.eng.paceBeats() beats have passed since the
  last spawn. Things arrive or land on a whole beat (n + k).
- Move things only as a function of api.eng.beatPos(), never with timers.
- Call api.eng.tap({ height }) on every player action, even one that does nothing.
- Report results only through api.score(1, quality, handleSec) and api.miss(). Never
  end the game, never reset the streak, never speed things up over time.
- Use api.eng.assist (0 to 1) only to widen margins on things you're about to spawn.
  Don't change anything already on screen.
- Write autopilot(dt, api) so the game plays itself calmly when the player stops.
- Draw everything in draw(ctx, api, t). Canvas 2D only, no shadowBlur, nothing built per
  frame that could be cached (use api.cached). Keep it light.
- input: "tap" (Space / ↑ / pointer) or "type" (letters). Extra keys go in onKey and
  must not use Esc, Enter, Tab, -, =, 0, [, ], ? (the shell owns those).

My idea: <one or two sentences: what appears on the beat, and what the player does>
```

## Choosing engine options

| Kind of action | `engine` options |
|---|---|
| A tap a beat (Flow, Drop Catch) | defaults |
| Typing (Word Rain) | `perBeat: [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4], minMs: 60, maxMs: 900, stableTol: 2.5, idleSec: 4, phaseFollow: false` |
| Slow, deliberate moves (one every two beats) | `perBeat: [0.25, 0.5, 1]` |
| Something that needs thinking time | raise `idleSec` so autopilot doesn't cut in while the player is thinking |

## Checking a new game

1. Run `node --test tests/flow-engine.test.cjs`. All tests should pass; the engine itself didn't change.
2. Open the game from a local server (for example `python -m http.server 4180` in the repo), then:
   - Play steadily for 20 seconds: the label should reach "In sync".
   - Stop for a few seconds: autopilot takes over and the streak doesn't move.
   - Press Esc to pause and resume.
   - Check a phone-width window: the header fits.
3. Optional: `flowTelemetry()` in the console shows the session's measurements.

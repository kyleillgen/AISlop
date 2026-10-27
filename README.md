# AISlop

Sloppy AI games, reborn.

## Flow // Resonance

Built with Gemini to draw you into a flow state. You never die; a clip just steps your streak down (or uses your Flow Shield). The engine listens to your natural tapping cadence (half- and double-time tappers included), eases the tempo toward it in steps too small to notice, and locks once it has actually reached yours. While locked it follows your timing lightly, so the beat stays with you instead of you chasing it. Pipes arrive on the beat and every tap plays in key. It never gets harder over time; it gets deeper: tiers, golden orbs, slipstreams, epochs every 500 points, and **Platinum** at 1000.

Made for quick sessions, like a minute while something compiles. It remembers your tempo and your epoch progress, so stopping mid-run costs nothing. Stop tapping for a few beats (or press **A**, or look away) and **autopilot** takes over: the craft follows the guide line, nothing scores and nothing is lost, and the music slows and softens, resolves to its home chord, then drifts into a longer, gentler version of the song: chords change every four bars and wander instead of looping, and a generated melody comes and goes. It crossfades in over about six seconds and back out over about three, so there's a natural place to stop and nothing grates while you work. Tap to take back control, with the next two pillars forgiven. A tool can post `{type: "flow:build-done"}` to the page when a build finishes. A quiet assist widens off-screen gaps when you're struggling and backs off while you're cruising; it never makes "perfect" easier.

Four tracks (**MIDNIGHT**, **GOLDEN HOUR**, **DEEP SEA**, **RAIN ON GLASS**) in three groove voices. Keys: Space / ↑ fly · A autopilot · P pause · T track · V voice · - / = volume · M mute · L hold tempo · [ / ] audio offset · ? all keys. On phones, pause opens track and voice settings.

Design follows a sourced research brief ([docs/flow-engine-research.md](docs/flow-engine-research.md)), and [docs/flow-engine-audit.md](docs/flow-engine-audit.md) maps each recommendation to the code. Session measurements stay on your device (`flowTelemetry()` in the console). Experiment switches: `?phase=frozen`, `?milestones=off`.

Play at https://kyleillgen.github.io/AISlop/ or open `games/flow-resonance.html`.

## The flow engine, and building on it

Flow's engine is its own module, and any small rhythm game can sit on top of it. A game is three layers:

- **Engine** ([`games/flow-engine.js`](games/flow-engine.js)): tempo matching, Flow's music, pacing, autopilot, stopping cues and on-device measurement, plus built-in rules no game can break (you can't lose, autopilot never scores, the tempo never jumps, nothing gets harder with time).
- **Shell** ([`games/flow-shell.js`](games/flow-shell.js)): the header, start, pause and keys screens, input, the frame loop and effects.
- **Game**: one HTML file answering five questions (what appears on the beat, how it moves, what the player does, what counts, how it looks).

Start here: [docs/build-on-the-engine.md](docs/build-on-the-engine.md), which includes a copy-paste prompt kit. API: [docs/flow-engine.md](docs/flow-engine.md). Tests: `node --test tests/flow-engine.test.cjs`.

- **Word Rain** (`games/word-rain.html`): words drift down on the beat, and you type them before they reach the river. The music settles into your typing rhythm, every letter is a note, and typos cost nothing.
- **Drop Catch** (`games/template.html`): the starter template. Drops land on a pad on the beat; tap as they land.

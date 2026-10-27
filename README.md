# AISlop

Sloppy AI games, reborn.

## Flow // Resonance

Built with Gemini to draw you into a flow state. You never die; a clip just steps your streak down (or uses your Flow Shield). The engine listens to your natural tapping cadence (half- and double-time tappers included), eases the tempo toward it in steps too small to notice, and locks once it has actually reached yours. While locked it follows your timing lightly, so the beat stays with you instead of you chasing it. Pipes arrive on the beat and every tap plays in key. It never gets harder over time; it gets deeper: tiers, golden orbs, slipstreams, epochs every 500 points, and **Platinum** at 1000.

Made for quick sessions, like a minute while something compiles. It remembers your tempo and your epoch progress, so stopping mid-run costs nothing. Look away (or press **A**) and it switches to **auto glide**: the craft rides the guide ribbon, nothing scores and nothing is lost, and the music slows, softens and settles on its home chord so there's a natural place to stop. Tap to take back control, with the next two pillars forgiven. A tool can post `{type: "flow:build-done"}` to the page when a build finishes. A quiet assist widens off-screen gaps when you're struggling and backs off while you're cruising; it never makes "perfect" easier.

Four tracks (**MIDNIGHT**, **GOLDEN HOUR**, **DEEP SEA**, **RAIN ON GLASS**) in three groove voices. Keys: Space / ↑ fly · A auto · T track · V voice · M mute · L hold tempo · [ / ] audio offset.

Design follows a sourced research brief ([docs/flow-engine-research.md](docs/flow-engine-research.md)), and [docs/flow-engine-audit.md](docs/flow-engine-audit.md) maps each recommendation to the code. Session measurements stay on your device (`flowTelemetry()` in the console). Experiment switches: `?phase=frozen`, `?milestones=off`.

Play at https://kyleillgen.github.io/AISlop/ or open `games/flow-resonance.html`.

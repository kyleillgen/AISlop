# Flow science check: the October 2026 changes

This checks everything added since the engine audit ([flow-engine-audit.md](flow-engine-audit.md)) against the research brief ([flow-engine-research.md](flow-engine-research.md)) and the design rules (never die, never harder over time, the beat calibrated to the player). The changes covered are Fidget and Flow, hold shots, table modes and scoring, intensity, the new games (Orbit, Flipper, Ricochet) and the cleaner art.

**Verdict:** the core science is intact. The engine still finds the player's tempo, follows it lightly, keeps a fixed perfect window, and nothing ramps on its own. Five things had drifted, and all five are fixed (table below).

## Fixed

| # | What had drifted | Why it mattered | Fix |
|---|---|---|---|
| 1 | Fidget presses were fed to the tempo detector, the timing calibration and the telemetry | Mashing at 8 presses a second could drag the player's calibrated beat and timing zero away from their natural rhythm, the thing the whole engine is built on | `eng.holdTempo`: in Fidget a press is heard but never measured. Fidget sessions also stay out of the tuning log. Checked: tempo held at 109.3 BPM through a Fidget mash |
| 2 | A miss reset the multiplier to ×1 and lost a running Jackpot ("Jackpot lost") | The brief warns that milestones must not create "protect the streak" pressure, which carries attention residue back into work; a wipe also contradicted the engine's own rule (a miss steps the streak down a quarter, never to zero) | A miss steps the multiplier down one level; a Jackpot is never taken away |
| 3 | Orbit's "fling on the first loop" could put two flings one beat apart | The brief's minimum spacing is two beats per required action (about 1 s) | The next crossing is never sooner than two beats after the last fling |
| 4 | After a missed crossing, Orbit re-timed the orbit mid-loop, changing the ball's speed | "Never adapt motion mid-arc": a speed change under the player's eye breaks motor prediction and exposes the help | A missed crossing keeps the ball's speed; the arrow comes round again a lap later |
| 5 | A red flash on every miss | The brief says to mute per-action judgments; the original game uses a gentle cushion chord, not an alarm | A faint warm wash instead of a red flash |

## Checked and fine

| Change | Against the research | Status |
|---|---|---|
| **Fidget style** | A different state from flow on purpose: low demand, no judgment. The incubation evidence favours low-demand fillers for "letting you think" (Sio & Ormerod 2009; Baird et al. 2012). Kriescher et al. (2023) found fidgets can add load, so it's opt-in and asks nothing of you | Fine |
| **Fidget keeps progressing; handover back to Flow** | Depth through tiers and music, not difficulty. The handover forgives three misses, the documented "first shots miss" pattern | Fine |
| **Hold shots** | Optional, never score or cost. Every hold shot ends on a beat, so the rhythm resumes where it was | Fine |
| **Intensity (chill, normal, intense)** | The player's choice, never automatic. Perfect stays ±0.08 beat (about ±45 ms) at every intensity; only the clean window changes | Fine |
| **Table modes** | Variety without difficulty. Hurry-Up's falling bonus is mild time pressure, but nothing is lost if you ignore it | Watch |
| **Flipper's free flights** | The ball goes somewhere different every time, but the landing beat never moves and the ring telegraphs where and when; only the end is steered, and never later than the ball could naturally fall from where it is (the brief: correct the outcome near the end, never as a force through the arc). The last beat (0.8 beat on a two-beat pace) is a steady roll down a lit inlane onto the flipper, so the flip is read from a predictable cue instead of a fast drop; the landing beat and spacing are unchanged. Timing aims the shot, which is immediate, clear feedback | Fine |
| **Orbit, Flipper, Ricochet timing** | All land on whole beats, at least two beats apart, perfect ±0.08 beat, clean window 0.17–0.30 beat by intensity plus the assist (which never touches perfect) | Fine |
| **Cleaner art** | Calmer visuals lower arousal, which sits on the right side of the inverted-U between stress and flow (Peifer et al. 2014) | Fine |
| **Rocket boost (Flow // Resonance)** | Optional and unscored; boosted passes don't count, so the rhythm stays the game | Fine |

## Still open

- **Deep flow is not the goal.** A 30 s to 3 min burst can give a flow-like state and a mood lift, not deep flow (Khoshnoud et al. 2020). The Flow Check prompt (one session in five) is how to see whether the changes help.
- **Fidget's tempo hold** means a long Fidget session never re-calibrates. That's intended: switching back to Flow lands on your last real rhythm.

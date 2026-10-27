# Flow // Resonance: audit against the research brief

This document checks the final copy of Flow // Resonance against every recommendation in [flow-engine-research.md](flow-engine-research.md). Each row names the recommendation, what the game does, where the code is, and whether it fully meets the brief.

- **Code:** `index.html` on `main` (the same file as `games/flow-resonance.html` on `arcade-trial`). Line numbers refer to that file as of this commit.
- **Status key:** **Met** = matches the brief. **Partial** = the intent is met but the method differs, with the reason given. **Not built** = deliberately left out, with the reason given.

## Timing and tempo

| # | Brief recommendation | What the game does | Code | Status |
|---|---|---|---|---|
| T1 | Cadence band 96–124 BPM | The player's inter-tap tempo is clamped to 96–124 | `recordTapAndEntrainCadence`, ~L962 | Met |
| T2 | Fold half- and double-time tappers into the band (do not force them) | Below 96, the tempo doubles if the result fits; above 124, it halves. Simulated 56 BPM tapping locks at 111; 220 BPM tapping locks at 110 | L962 | Met |
| T3 | Detect cadence over 6–8 taps; lock when steady and within 2.5% | Eight-tap window. The game locks when the smoothed and latest cadences agree within 1.5 BPM, the game tempo is within 2 BPM (about 1.8%), and scroll speed has caught up. After 24 steady taps it also locks if within 3 BPM, so an unusual tapper cannot stall | L1225–1235 | Partial: steadiness comes from Gemini's rhythm-consistency score, not a strict CV ≤ 5% test |
| T4 | Tempo steps ≤ 1–2% per bar; re-sync never jumps | At most 3% per bar during first calibration and 1.5% per bar during re-sync | L1266–1272 | Met for re-sync. First calibration allows up to 3% per bar so a new player reaches their tempo in a few bars; every step is still smooth |
| T5 | Re-sync trigger: tempo drifts more than 4% for 2 or more bars, or a pause over 1.8 s | Re-sync starts when cadence sits more than 6 BPM (about 5.5%) from the locked tempo for 4 s (about 2 bars). The re-sync announcement was removed so the change stays unnoticed | L1238–1249 | Partial: a pause does not trigger re-sync. A pause usually means the player stepped away, which auto glide already handles |
| T6 | After lock, follow phase lightly (α 0.1–0.3), not a frozen grid | Each locked tap moves the beat grid 20% of the way toward the tap's error, measured from the player's own calibrated zero. Each move is capped at 20 ms | `nudgePhase` L365; L1562–1566; `PHASE_ALPHA` L747 | Met (α = 0.2) |
| T7 | Calibrate the mean tap–beat asynchrony during the cadence phase | While calibrating, the game averages each tap's offset from the nearest eighth note. That average becomes the player's zero | `getBeatOffset` L357; `measureTapAsync` L1483; L1556–1561 | Met |
| T8 | Keep tap sounds off during calibration | While calibrating, the in-key lead note snapped to the grid is not played, so it cannot bias timing. The immediate soft tap sound stays, so each tap is still heard | `queueQuantizedTap(..., leadNote)`; L1573 | Met: the snapped note is muted; the unsnapped tap sound stays |
| T9 | Judge timing against `currentTime − outputLatency − userOffset`, re-read on device change, with a manual offset | Offsets use `outputLatency` (or `baseLatency`), re-read on every tap, minus a manual offset. **[ / ]** keys change the offset by 10 ms; it is saved | L1483–1500 | Met |
| T10 | Required actions no faster than eighth notes; snap to 16ths at most | Pipes come every 2 beats. Taps snap to a 16th grid only for the music; no action requires 16ths | `getQuantizedPipeSpacing` L1293 | Met |
| T11 | Drive motion from the audio clock | Motion runs on frame time (capped at 50 ms per frame). The music runs on the audio clock with look-ahead scheduling | — | Partial: motion and audio stay locked because pipe spacing comes from tempo, but motion is not timed from `AudioContext.currentTime` |

## Assistance and difficulty

| # | Brief recommendation | What the game does | Code | Status |
|---|---|---|---|---|
| A1 | Never harder over time; deepen through music and visuals instead | No speed or gap tightening over time. Tiers, epochs and Platinum change visuals and music only | Gemini design, unchanged | Met |
| A2 | Perfect window fixed; assist never widens it | "Perfect" is judged against the baseline 175 px gap, so a gap the assist has widened does not widen the perfect band | `evaluatePipePass` L1393 | Met. Note: the window is spatial (distance from gap centre), not a ±35–45 ms timing window |
| A3 | Assist widens only survival margins | Assist widens gaps from 175 px to at most 201 px and strengthens the pull toward the guide line | L1279–1285 | Met |
| A4 | Change only gaps not yet on screen | Gap height is read only when a pipe spawns off-screen | `spawnNextHarmonicPipe` L1298 | Met |
| A5 | Rise within 1–2 clips; decay over 8–16 clean bars; never below baseline | Each clip adds 0.35. Assist decays 0.03/s (full help fades in about 15 bars at 108 BPM), faster with perfect passes. Applied level moves at most 0.08/s; floor 0 = Gemini's baseline | L1192, L1282–1284 | Met |
| A6 | Assist target: 85–95% clean passes | Assist responds to clips, grazes and perfect passes rather than to a measured pass rate | — | Partial: event-driven; no rolling pass-rate target |
| A7 | Guide pull only near a gap, never against a tap | The pull acts only when a pipe is within about 140 px ahead. It is skipped for 220 ms after a flap if it would oppose the flap | L1838–1849 | Met |
| A8 | Post-clip grace and collision tolerance | Clips never kill: a 1.15 s ghost window after each clip, a shield that absorbs a clip, and two forgiven pillars after leaving auto glide | L1197; L1518; Gemini shield | Met |
| A9 | Never adapt gravity, flap impulse, mid-arc speed, A/V offset or visible obstacles | None adapt. Scroll speed changes only while calibrating, toward the player's own tempo | — | Met |

## Feedback, milestones and stopping

| # | Brief recommendation | What the game does | Code | Status |
|---|---|---|---|---|
| F1 | No per-tap judgment text | Removed: "HARMONIC LOCK +2", "VELVET GRAZE +2", "SLIPSTREAM +1", "GOLDEN RESONANCE +3", "SOFT CUSHION", "SHIELD GLIDE", "FLOW SHIELD CHARGED", "RE-SYNCING". Sound, light and rings carry the feedback | patch | Met |
| F2 | Celebrate at phrase boundaries | Every 8 pillars, a clean phrase (no clips) earns a shimmer and a wide ring | L2020–2028 | Met |
| F3 | Each tap its own sound | Every tap has an immediate soft sound plus (after lock) an in-key note on the grid | `queueQuantizedTap` | Met |
| F4 | Milestones must not create streak pressure; persist progress across bursts | Epoch and Platinum progress is saved, so quitting mid-epoch loses nothing. A clip reduces the streak but never the saved progress | `PROGRESS_KEY` L751 | Met |
| F5 | Stopping cues: resolve the music, wind tempo down, end on a build-done event | In auto glide the music slows about 5% (at most about 1.3% per bar), gets quieter, and moves to the home chord and stays there. A page or extension can post `{type: "flow:build-done"}`; the game shows "BUILD DONE" and winds down. Tapping restores everything at the same rate | `holdTonic` L555; L1503; L1785; L1538 | Met |
| F6 | Clean, low-demand HUD | The chord, tempo and tier pills are gone, and so are the lock button and blur. What remains: streak, state, flow bar, and track, voice and mute buttons | header markup | Met |

## Rendering and power

| # | Brief recommendation | What the game does | Code | Status |
|---|---|---|---|---|
| R1 | `alpha: false` canvas | Done | L700 | Met |
| R2 | DPR capped at 2 | Done | L721, L888 | Met |
| R3 | Fixed particle budget | No more than 160 particles at once | L1440 | Met |
| R4 | No `shadowBlur`; no per-frame text | Callout text no longer uses `shadowBlur`. Text draws only while a callout is alive | callout draw | Met |
| R5 | Bake gradients | The background gradient is cached until its colours change. Pipe, ribbon and aurora gradients are still built each frame | L2103–2113 | Partial: the largest gradient is cached; the small ones are not |
| R6 | Suspend the AudioContext when hidden | Audio suspends when the tab is hidden (frames stop then anyway) and resumes when it is shown | L1526–1532 | Met |

Measured in headless Edge at 1100×720: about 126–130 fps uncapped, no script errors.

## Music sources

| # | Brief recommendation | What the game does | Status |
|---|---|---|---|
| M1 | Default to generated, in-key music | Gemini's synth plays four tracks and three voices, scheduled on the audio clock | Met |
| M2 | Optional "use my file" | — | Not built: out of scope for this pass |
| M3 | "Tap along to anything" | Works with no extra code: mute the game, play music elsewhere, and the cadence detector locks to your taps | Met by design |
| M4 | No Spotify | No external streaming service is used | Met |

## Measurement and experiments

| # | Brief recommendation | What the game does | Code | Status |
|---|---|---|---|---|
| E1 | Behavioural proxies: interval CV, asynchrony mean and SD, burst length, slowing after a clip | Recorded per session: interval CV, asynchrony mean and SD in ms, bursts (split at pauses over 1.8 s), clip count, and the ratio of tap pace after a clip to before it. Also: active seconds, locked BPM and peak | `TELEMETRY_KEY` L979 onward | Met |
| E2 | Occasional 2-item flow check plus a duration estimate | In about one session in five, after at least 45 s of play, a small card appears on entering auto glide. It asks two 1–7 items (fluency, absorption) and a time estimate, and stores the actual time alongside | `maybeAskFlowCheck` L1067 | Met (items paraphrase the Flow Short Scale; not the validated wording) |
| E3 | A/B: frozen grid vs α ≈ 0.2 phase following | `?phase=frozen` turns off phase following. Each session records its arm | L745 | Met |
| E4 | A/B: milestones on vs off | `?milestones=off` hides epoch, Platinum and tier announcements; visuals still change | L746, L1134, L1149 | Met |
| E5 | Privacy | All data stays in `localStorage` on the device. Nothing is sent anywhere. `window.flowTelemetry()` in the console shows the stored sessions | — | Met |

## Verification

- **Cadence simulation.** The game's own controller code was extracted and run at 60 fps. Each case below shows the player's tapping tempo and the tempo the game locked at:

  | Player | Game locked at |
  |---|---|
  | 108 | 108.2 |
  | 116 (new player) | 114.1 |
  | 116 (returning player, saved tempo) | 116.0, after 2.8 s |
  | 56 (half time) | 111.0 |
  | 220 (double time) | 109.7 |
  | 120, then 100 | Locked at 118.0. After the switch it re-synced over about 20 s of small steps and locked again at 103.0, with no lock and unlock wobble |

- **Headless play test** (50 s at about 112 BPM with ±15 ms jitter): locked at 111.9. All telemetry fields were filled, the flow-check card appeared and recorded answers, the build-done message entered auto glide, and there were no script errors. The `?phase=frozen&milestones=off` arm ran cleanly.
- **Not verified by a human ear:** whether the wind-down and tonic resolve sound natural, and how phase following feels to a real player. Those are what the two A/B switches are for.

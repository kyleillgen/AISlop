// Flow engine: the reusable core of Flow // Resonance, for rhythm micro-games played in
// short bursts (30 s to 3 min, e.g. while code compiles). It calibrates the beat to the
// player, never punishes, flies itself when the player stops, and winds the music down so
// there's a natural place to stop. Design and evidence: docs/flow-engine-research.md;
// audit: docs/flow-engine-audit.md; API: docs/flow-engine.md.
//
// The synth below (tracks, CHORD_PROGRESSION, GROOVE_VOICES, CoCreationResonanceSynth) is
// copied unchanged from games/flow-resonance.html, including its beat bookkeeping
// (getBeatOffset, nudgePhase, setAutopilot and the drift arrangement). Keep the two in step until Flow runs on this file.
//
//   const eng = FlowEngine.create({ key: "myGame" });
//   eng.start();                 // first user gesture
//   eng.tap({ height: 0.3 });    // every rhythmic action
//   eng.update(dt);              // every frame
//   eng.on("beat", n => ...);    // spawn on the beat; eng.beatPos() for smooth motion
(() => {
  "use strict";
  if (window.FlowEngine) return;

  // ==========================================================================
  // Flow // Resonance synth, unchanged
  // ==========================================================================
  const CHORD_PROGRESSION = [
      {
          name: "Dmin9",
          bass: [73.42, 0, 73.42, 110.00, 146.83, 0, 110.00, 130.81],
          pad: [146.83, 174.61, 220.00, 261.63, 329.63],
          scale: [293.66, 329.63, 349.23, 392.00, 440.00, 523.25, 587.33, 659.25, 698.46, 880.00]
      },
      {
          name: "BbMaj9",
          bass: [58.27, 0, 58.27, 87.31, 116.54, 0, 87.31, 110.00],
          pad: [116.54, 146.83, 174.61, 220.00, 261.63],
          scale: [233.08, 261.63, 293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 783.99]
      },
      {
          name: "Gmin9",
          bass: [98.00, 0, 98.00, 146.83, 196.00, 0, 146.83, 174.61],
          pad: [196.00, 233.08, 293.66, 349.23, 440.00],
          scale: [293.66, 349.23, 392.00, 440.00, 466.16, 587.33, 698.46, 783.99, 880.00, 1046.50]
      },
      {
          name: "A7sus4",
          bass: [110.00, 0, 110.00, 146.83, 164.81, 0, 146.83, 196.00],
          pad: [110.00, 146.83, 164.81, 196.00, 246.94],
          scale: [293.66, 329.63, 392.00, 440.00, 493.88, 587.33, 659.25, 783.99, 880.00, 987.77]
      }
  ];

  const GROOVE_VOICES = ["LO-FI RHODES", "SYNTHWAVE PULSE", "AMBIENT DRIFT"];

  // Music selections: four tracks (chord progressions with matching basslines and
  // melody scales), each playable in any of the three groove voices. Track 0 is the
  // original Dm9 → BbMaj9 → Gm9 → A7sus4; the others are built the same way.
  const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function makeChord(name, root, pad, scaleRoot, scaleSteps) {
      const bassSteps = [0, null, 0, 7, 12, null, 7, pad[3]];
      return {
          name,
          bass: bassSteps.map((s) => (s === null ? 0 : m2f(root + s))),
          pad: pad.map((s) => m2f(root + 12 + s)),
          scale: scaleSteps.map((s) => m2f(scaleRoot + s))
      };
  }
  const MAJ9 = [0, 4, 7, 11, 14];
  const MIN9 = [0, 3, 7, 10, 14];
  const SIX9 = [0, 4, 7, 9, 14];
  const SUS4 = [0, 5, 7, 10, 14];
  const MAJ_PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  const MIN_PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
  const IONIAN = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
  const TRACKS = [
      { name: "MIDNIGHT", chords: CHORD_PROGRESSION.slice() },
      {
          name: "GOLDEN HOUR",
          chords: [
              makeChord("Cmaj9", 36, MAJ9, 60, MAJ_PENTA),
              makeChord("Am9", 45, MIN9, 60, MAJ_PENTA),
              makeChord("Fmaj9", 41, MAJ9, 60, MAJ_PENTA),
              makeChord("G6/9", 43, SIX9, 60, MAJ_PENTA)
          ]
      },
      {
          name: "DEEP SEA",
          chords: [
              makeChord("Ebm9", 39, MIN9, 63, MIN_PENTA),
              makeChord("Bmaj9", 35, MAJ9, 63, MIN_PENTA),
              makeChord("Abm9", 44, MIN9, 63, MIN_PENTA),
              makeChord("Bb7sus4", 46, SUS4, 63, MIN_PENTA)
          ]
      },
      {
          name: "RAIN ON GLASS",
          chords: [
              makeChord("Fmaj9", 41, MAJ9, 60, IONIAN),
              makeChord("Em9", 40, MIN9, 60, IONIAN),
              makeChord("Dm9", 38, MIN9, 60, IONIAN),
              makeChord("Cmaj9", 36, MAJ9, 60, IONIAN)
          ]
      }
  ];
  let trackIndex = 0;
  // The synth reads CHORD_PROGRESSION live, so swapping its contents changes the music
  // from the next note on
  function setTrack(i) {
      trackIndex = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
      CHORD_PROGRESSION.splice(0, CHORD_PROGRESSION.length, ...TRACKS[trackIndex].chords);
  }

  class CoCreationResonanceSynth {
      constructor() {
          this.ctx = null;
          this.masterGain = null;
          this.bassFilter = null;
          this.padFilter = null;
          this.delayNode = null;
          this.delayFeedback = null;

          this.isMuted = false;
          this.isInitialized = false;
          this.voiceIndex = 0; // 0: LO-FI RHODES, 1: SYNTHWAVE PULSE, 2: AMBIENT DRIFT

          this.stepIndex = 0;
          this.barCount = 0;
          this.chordIndex = 0;
          this.nextStepTime = 0;

          this.currentCutoff = 900;
          this.cushionedFilterTimer = 0; // Smooth 2-second filter crossfade on gentle pipe clip
          this.queuedTapNotes = [];      // Quantized notes triggered by player taps

          // Drift: the autopilot arrangement. autoMix crossfades 0 (game) to 1 (drift) over
          // about 6 s going in and 3 s coming back, so nothing ever switches abruptly.
          this.autoTarget = 0;
          this.autoMix = 0;
          this.lastMixTime = 0;
          this.resolvePending = false;
          this.driftDegree = 4;     // the drift melody's position in the scale (random walk)
          this.driftPhraseOn = true;
      }

      // Autopilot on: resolve home at the next bar, then drift into the long-form arrangement
      setAutopilot(on) {
          this.autoTarget = on ? 1 : 0;
          if (on) this.resolvePending = true;
      }

      init() {
          if (this.isInitialized) {
              if (this.ctx && this.ctx.state === "suspended") {
                  this.ctx.resume();
              }
              return;
          }
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;

          this.ctx = new AudioCtx();

          const compressor = this.ctx.createDynamicsCompressor();
          compressor.threshold.value = -15;
          compressor.knee.value = 20;
          compressor.ratio.value = 3.2;
          compressor.attack.value = 0.01;
          compressor.release.value = 0.22;

          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.80;

          this.bassFilter = this.ctx.createBiquadFilter();
          this.bassFilter.type = "lowpass";
          this.bassFilter.frequency.value = 720;
          this.bassFilter.Q.value = 2.0;

          this.padFilter = this.ctx.createBiquadFilter();
          this.padFilter.type = "lowpass";
          this.padFilter.frequency.value = 1800;
          this.padFilter.Q.value = 1.0;

          this.delayNode = this.ctx.createDelay(1.2);
          this.delayNode.delayTime.value = 0.28;
          this.delayFeedback = this.ctx.createGain();
          this.delayFeedback.gain.value = 0.36;

          const delayFilter = this.ctx.createBiquadFilter();
          delayFilter.type = "lowpass";
          delayFilter.frequency.value = 1900;

          this.delayNode.connect(delayFilter);
          delayFilter.connect(this.delayFeedback);
          this.delayFeedback.connect(this.delayNode);
          this.delayNode.connect(this.padFilter);

          this.bassFilter.connect(compressor);
          this.padFilter.connect(compressor);
          compressor.connect(this.masterGain);
          this.masterGain.connect(this.ctx.destination);

          this.nextStepTime = this.ctx.currentTime + 0.04;
          this.isInitialized = true;
      }

      cycleVoice() {
          this.voiceIndex = (this.voiceIndex + 1) % GROOVE_VOICES.length;
          return GROOVE_VOICES[this.voiceIndex];
      }

      getCurrentVoiceName() {
          return GROOVE_VOICES[this.voiceIndex];
      }

      getCurrentChordName() {
          return CHORD_PROGRESSION[this.chordIndex].name;
      }

      toggleMute() {
          this.isMuted = !this.isMuted;
          if (this.masterGain && this.ctx) {
              this.masterGain.gain.setTargetAtTime(
                  this.isMuted ? 0.0001 : 0.80,
                  this.ctx.currentTime,
                  0.04
              );
          }
          return this.isMuted;
      }

      triggerCushionCrossfade() {
          this.cushionedFilterTimer = 2.0;
      }

      // Signed seconds from the nearest eighth-note (+ = late). Used for calibration
      // and phase following; eighths because required actions are never finer.
      getBeatOffset(atTime) {
          if (!this.lastBeatTime || !this.beatSec) return null;
          const half = this.beatSec / 2;
          const rel = (atTime - this.lastBeatTime) / half;
          return (rel - Math.round(rel)) * half;
      }

      // Light phase following: slide the grid a little toward the player's taps
      nudgePhase(sec) {
          this.nextStepTime += sec;
          this.lastBeatTime += sec;
      }

      updateSynesthesia(flowIndex, tier, bpm, dt) {
          if (!this.isInitialized || !this.ctx) return;
          const now = this.ctx.currentTime;

          if (this.cushionedFilterTimer > 0) {
              this.cushionedFilterTimer = Math.max(0, this.cushionedFilterTimer - dt);
          }

          // Cross-fade filter gently during 2-second cushion window so flow never shatters
          const cushionDip = this.cushionedFilterTimer > 0 ? 0.48 : 1.0;
          const tierBoost = (tier - 1) * 320;
          const targetCutoff = (420 + flowIndex * 1150 + tierBoost) * cushionDip;

          this.currentCutoff += (targetCutoff - this.currentCutoff) * 0.12;
          this.bassFilter.frequency.setTargetAtTime(this.currentCutoff, now, 0.12);

          const padCutoff = (1100 + flowIndex * 2200 + tierBoost) * cushionDip;
          this.padFilter.frequency.setTargetAtTime(padCutoff, now, 0.14);

          // Ping-pong/dub delay feedback scales up in Tier 3 & Tier 4
          const targetFeedback = tier >= 3 ? 0.44 : 0.28;
          this.delayFeedback.gain.setTargetAtTime(targetFeedback, now, 0.15);

          const beatSec = 60 / Math.max(88, Math.min(136, bpm));
          this.delayNode.delayTime.setTargetAtTime(beatSec * 0.75, now, 0.1);
      }

      // Immediate warm tactile transient + queues a quantized lead note on the next 16th subdivision
      queueQuantizedTap(heightNorm, tier, leadNote = true) {
          if (!this.isInitialized || this.isMuted) return;
          const now = this.ctx.currentTime;
          const chord = CHORD_PROGRESSION[this.chordIndex];
          const clampedH = Math.max(0, Math.min(1, 1 - heightNorm));

          // Queue for the 16th-note grid scheduler so it lands 100% in time and in key.
          // Skipped while calibrating: a grid-snapped echo would bias the player's timing
          if (leadNote) {
              this.queuedTapNotes.push({
                  heightNorm: clampedH,
                  tier
              });
              if (this.queuedTapNotes.length > 2) {
                  this.queuedTapNotes.shift();
              }
          }

          // Immediate soft tactile body resonance (sub-octave warm air impulse)
          const idx = Math.min(chord.scale.length - 1, Math.floor(clampedH * chord.scale.length));
          const tactileFreq = chord.scale[idx] * 0.5;

          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(tactileFreq, now);
          osc.frequency.exponentialRampToValueAtTime(tactileFreq * 1.12, now + 0.065);

          gain.gain.setValueAtTime(0.065, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);

          osc.connect(gain);
          gain.connect(this.padFilter);
          osc.start(now);
          osc.stop(now + 0.08);
      }

      playPipeHarmony(streak, quality) {
          if (!this.isInitialized || this.isMuted) return;
          const now = this.ctx.currentTime;
          const chord = CHORD_PROGRESSION[this.chordIndex];

          const indices =
              quality === "PERFECT"
                  ? [0, 2, 4, 6, 8]
                  : quality === "GRAZE"
                  ? [1, 3, 5]
                  : [0, 2, 4];

          indices.forEach((scalePos, i) => {
              const freq = chord.scale[(scalePos + (streak % 3)) % chord.scale.length];
              const start = now + i * 0.03;

              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = this.voiceIndex === 1 ? "sawtooth" : "triangle";
              osc.frequency.setValueAtTime(freq, start);

              const amp = quality === "PERFECT" ? 0.11 : 0.08;
              gain.gain.setValueAtTime(0.001, start);
              gain.gain.linearRampToValueAtTime(amp, start + 0.015);
              gain.gain.exponentialRampToValueAtTime(0.0006, start + 0.45);

              osc.connect(gain);
              gain.connect(this.padFilter);
              gain.connect(this.delayNode);
              osc.start(start);
              osc.stop(start + 0.48);
          });
      }

      playGoldenOrbShimmer() {
          if (!this.isInitialized || this.isMuted) return;
          const now = this.ctx.currentTime;
          const chord = CHORD_PROGRESSION[this.chordIndex];

          chord.scale.slice(3, 9).forEach((freq, idx) => {
              const start = now + idx * 0.036;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();

              osc.type = "triangle";
              osc.frequency.setValueAtTime(freq * 1.5, start);

              gain.gain.setValueAtTime(0.001, start);
              gain.gain.linearRampToValueAtTime(0.11, start + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.65);

              osc.connect(gain);
              gain.connect(this.padFilter);
              gain.connect(this.delayNode);
              osc.start(start);
              osc.stop(start + 0.68);
          });
      }

      playSlipstreamTick(stepCounter) {
          if (!this.isInitialized || this.isMuted) return;
          const now = this.ctx.currentTime;
          const chord = CHORD_PROGRESSION[this.chordIndex];
          const freq = chord.scale[(stepCounter + 4) % chord.scale.length];

          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.075, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.22);

          osc.connect(gain);
          gain.connect(this.delayNode);
          osc.start(now);
          osc.stop(now + 0.24);
      }

      playGentleCushionChord() {
          if (!this.isInitialized || this.isMuted) return;
          const now = this.ctx.currentTime;
          const chord = CHORD_PROGRESSION[this.chordIndex];

          chord.pad.forEach((freq) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, now);
              osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.55);

              gain.gain.setValueAtTime(0.09, now);
              gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);

              osc.connect(gain);
              gain.connect(this.bassFilter);
              osc.start(now);
              osc.stop(now + 0.6);
          });
      }

      updateScheduler(bpm, flowIndex, tier, callbacks) {
          if (!this.isInitialized || !this.ctx) return;
          const now = this.ctx.currentTime;
          const secondsPerBeat = 60.0 / Math.max(88, Math.min(136, bpm));
          this.beatSec = secondsPerBeat;
          const sixteenthDuration = secondsPerBeat / 4.0;

          if (this.nextStepTime < now - 0.2) {
              this.nextStepTime = now;
          }

          const mixDt = Math.max(0, Math.min(0.1, now - (this.lastMixTime || now)));
          this.lastMixTime = now;
          const fadeSec = this.autoTarget > this.autoMix ? 6 : 3;
          this.autoMix += Math.max(-mixDt / fadeSec, Math.min(mixDt / fadeSec, this.autoTarget - this.autoMix));

          while (this.nextStepTime < now + 0.09) {
              this.scheduleStep(this.stepIndex, this.nextStepTime, flowIndex, tier, callbacks);
              this.stepIndex = (this.stepIndex + 1) % 16;
              if (this.stepIndex === 0) {
                  this.barCount++;
                  // Cycle through the 4-chord progression (faster cycling in Tier 4 for lush movement)
                  const barsPerChord = tier >= 4 ? 1 : 2;
                  if (this.resolvePending) {
                      this.chordIndex = 0; // stopping cue: resolve home first
                      this.resolvePending = false;
                      this.driftBar = 0;
                  } else if (this.autoMix > 0.5) {
                      // Drift: four bars a chord, wandering rather than looping. The next chord
                      // is any other one, leaning toward a step forward, so no two passes match.
                      this.driftBar = (this.driftBar || 0) + 1;
                      if (this.driftBar % 4 === 0) {
                          const n = CHORD_PROGRESSION.length;
                          const step = Math.random() < 0.6 ? 1 : 1 + Math.floor(Math.random() * (n - 1));
                          this.chordIndex = (this.chordIndex + step) % n;
                      }
                      // Melody phrases come and go: roughly two bars on, one or two off
                      this.driftPhraseOn = this.driftPhraseOn ? Math.random() < 0.55 : Math.random() < 0.6;
                  } else if (this.barCount % barsPerChord === 0) {
                      this.chordIndex = (this.chordIndex + 1) % CHORD_PROGRESSION.length;
                  }
              }
              this.nextStepTime += sixteenthDuration;
          }
      }

      scheduleStep(step, time, flowIndex, tier, callbacks) {
          if (step % 4 === 0) {
              this.lastBeatTime = time;
              if (callbacks && callbacks.onQuarterBeat) callbacks.onQuarterBeat(step / 4);
          }
          if (callbacks && callbacks.onSixteenth) {
              callbacks.onSixteenth(step);
          }

          if (this.isMuted) return;

          const chord = CHORD_PROGRESSION[this.chordIndex];
          const voice = this.voiceIndex; // 0: LO-FI RHODES, 1: SYNTHWAVE PULSE, 2: AMBIENT DRIFT

          // 1. Warm Pad Swell on Step 0 of each bar
          if (step === 0) {
              chord.pad.forEach((freq, idx) => {
                  if (tier === 1 && idx > 2) return; // Richer 9th extensions unlock in higher tiers
                  const padOsc = this.ctx.createOscillator();
                  const padGain = this.ctx.createGain();
                  padOsc.type = voice === 0 ? "sine" : voice === 1 ? "sawtooth" : "triangle";
                  padOsc.frequency.setValueAtTime(freq, time);

                  const padAmp = (voice === 2 ? 0.055 : 0.038) * (1 + 0.45 * this.autoMix);
                  const padRelease = 1.9 + 2.4 * this.autoMix; // drift pads overlap into a wash
                  padGain.gain.setValueAtTime(0.001, time);
                  padGain.gain.linearRampToValueAtTime(padAmp, time + 0.35 + 0.5 * this.autoMix);
                  padGain.gain.exponentialRampToValueAtTime(0.0008, time + padRelease);

                  padOsc.connect(padGain);
                  padGain.connect(this.padFilter);
                  padOsc.start(time);
                  padOsc.stop(time + padRelease + 0.05);
              });
          }

          // 2. Sub-Kick & Percussion Pocket (Adapted per Groove Voice); in drift, a soft
          //    half-time pulse that fades almost away
          const drumMix = 1 - 0.8 * this.autoMix;
          if (step % 4 === 0 && (this.autoMix < 0.5 || step % 8 === 0)) {
              const kickOsc = this.ctx.createOscillator();
              const kickGain = this.ctx.createGain();
              kickOsc.type = "sine";
              const startPitch = voice === 1 ? 135 : 112;
              kickOsc.frequency.setValueAtTime(startPitch, time);
              kickOsc.frequency.exponentialRampToValueAtTime(42, time + 0.13);

              const kickAmp = (voice === 2 ? 0.22 : 0.30) * drumMix;
              kickGain.gain.setValueAtTime(kickAmp, time);
              kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

              kickOsc.connect(kickGain);
              kickGain.connect(this.masterGain);
              kickOsc.start(time);
              kickOsc.stop(time + 0.17);
          }

          // Off-beat dusty shaker / hat
          if (voice !== 2 && this.autoMix < 0.9 && (step % 4 === 2 || (tier >= 2 && (step === 7 || step === 15)))) {
              const hatOsc = this.ctx.createOscillator();
              const hatGain = this.ctx.createGain();
              hatOsc.type = "square";
              hatOsc.frequency.setValueAtTime(voice === 0 ? 4200 : 5600, time);

              const hatFilter = this.ctx.createBiquadFilter();
              hatFilter.type = "highpass";
              hatFilter.frequency.value = 3000;

              const amp = (step % 4 === 2 ? 0.026 : 0.012) * (1 - this.autoMix);
              hatGain.gain.setValueAtTime(Math.max(0.0006, amp), time);
              hatGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.04);

              hatOsc.connect(hatFilter);
              hatFilter.connect(hatGain);
              hatGain.connect(this.masterGain);
              hatOsc.start(time);
              hatOsc.stop(time + 0.045);
          }

          // 3. Tier 2+ Rolling Dorian/Chord Bassline
          const bassStep = this.autoMix > 0.5 ? step % 8 === 0 : tier >= 2 || step % 4 === 0;
          if (bassStep) {
              const bassFreq = chord.bass[step % 8];
              if (bassFreq > 0) {
                  const bassOsc = this.ctx.createOscillator();
                  const bassGain = this.ctx.createGain();
                  bassOsc.type = voice === 1 ? "sawtooth" : "triangle";
                  bassOsc.frequency.setValueAtTime(bassFreq, time);

                  const amp = (0.12 + Math.min(0.06, tier * 0.015)) * (1 - 0.45 * this.autoMix);
                  const bassDecay = 0.15 + 0.7 * this.autoMix; // long, round notes in drift
                  bassGain.gain.setValueAtTime(0.001, time);
                  bassGain.gain.linearRampToValueAtTime(amp, time + 0.012);
                  bassGain.gain.exponentialRampToValueAtTime(0.001, time + bassDecay);

                  bassOsc.connect(bassGain);
                  bassGain.connect(this.bassFilter);
                  bassOsc.start(time);
                  bassOsc.stop(time + bassDecay + 0.01);
              }
          }

          // 4. Quantized Player Co-Creation Lead OR Tier 3+ Lush Auto-Arpeggiator
          const queuedTap = this.queuedTapNotes.shift();
          const shouldAutoArp = tier >= 3 && (step % 2 === 1) && Math.random() > this.autoMix;

          // Drift melody: on eighth notes, a slow random walk through the scale, phrased with
          // rests, ringing out through the delay. Generated, so it never repeats exactly.
          if (this.autoMix > 0.05 && step % 2 === 0 && this.driftPhraseOn && !queuedTap) {
              const chance = (step % 8 === 0 ? 0.55 : 0.22) * this.autoMix;
              if (Math.random() < chance) {
                  const moves = [-2, -1, -1, 1, 1, 2, 0];
                  this.driftDegree = Math.max(2, Math.min(chord.scale.length - 2, this.driftDegree + moves[Math.floor(Math.random() * moves.length)]));
                  const dOsc = this.ctx.createOscillator();
                  const dGain = this.ctx.createGain();
                  dOsc.type = voice === 1 ? "triangle" : "sine";
                  dOsc.frequency.setValueAtTime(chord.scale[this.driftDegree], time);
                  const dPeak = 0.07 * this.autoMix;
                  dGain.gain.setValueAtTime(0.001, time);
                  dGain.gain.linearRampToValueAtTime(dPeak, time + 0.03);
                  dGain.gain.exponentialRampToValueAtTime(0.0006, time + 1.1);
                  dOsc.connect(dGain);
                  dGain.connect(this.padFilter);
                  dGain.connect(this.delayNode);
                  dOsc.start(time);
                  dOsc.stop(time + 1.15);
              }
          }

          if (queuedTap || shouldAutoArp) {
              const normH = queuedTap ? queuedTap.heightNorm : ((step * 3) % 10) / 10;
              const scaleIdx = Math.min(
                  chord.scale.length - 1,
                  Math.floor(normH * chord.scale.length)
              );
              const noteFreq = chord.scale[scaleIdx];

              const leadOsc = this.ctx.createOscillator();
              const leadGain = this.ctx.createGain();

              // LO-FI RHODES uses warm bell-like sine+triangle FM feel; SYNTHWAVE uses rich saw/triangle
              leadOsc.type = voice === 0 ? "sine" : voice === 1 ? "sawtooth" : "triangle";
              leadOsc.frequency.setValueAtTime(noteFreq, time);

              const peak = queuedTap ? 0.135 : 0.065;
              const decay = voice === 2 ? 0.38 : 0.25;
              leadGain.gain.setValueAtTime(0.001, time);
              leadGain.gain.linearRampToValueAtTime(peak, time + 0.01);
              leadGain.gain.exponentialRampToValueAtTime(0.0007, time + decay);

              leadOsc.connect(leadGain);
              leadGain.connect(this.padFilter);
              leadGain.connect(this.delayNode);
              leadOsc.start(time);
              leadOsc.stop(time + decay + 0.02);
          }
      }
  }

  // ==========================================================================
  // Cadence controller: pure state, no audio and no DOM, so it runs in Node tests.
  // Mirrors Flow // Resonance's recordTapAndEntrainCadence / updateCadenceSynchronizer
  // and the research-brief changes (docs/flow-engine-research.md).
  // ==========================================================================
  const BAND_MIN = 96;
  // Raised from the brief's 124 so fast tappers and typists aren't capped (2026-10-27);
  // 136 is the synth's own ceiling
  const BAND_MAX = 136;

  function median(a) {
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Fit an inter-action interval to a beat tempo inside the band. `perBeat` lists how many
  // actions may make up one beat: Flow's taps use [0.5, 1, 2] (half time, on the beat,
  // double time); typing uses [2, 3, 4] keystrokes per beat. In-band fits win, then the
  // one nearest the current tempo, so the reading doesn't flip between folds.
  function fitTempoFold(intervalMs, perBeat, currentBpm) {
    let best = null;
    for (const k of perBeat) {
      const bpm = 60000 / (intervalMs * k);
      const clamped = Math.max(BAND_MIN, Math.min(BAND_MAX, bpm));
      const cost = Math.abs(bpm - clamped) * 4 + Math.abs(clamped - currentBpm);
      if (!best || cost < best.cost) best = { bpm: clamped, k, cost };
    }
    return best;
  }
  const fitTempo = (intervalMs, perBeat, currentBpm) => fitTempoFold(intervalMs, perBeat, currentBpm).bpm;

  function createController(options) {
    const o = Object.assign(
      {
        startBpm: 108,
        perBeat: [0.5, 1, 2],
        minMs: 180, // intervals outside this range aren't rhythm (double hits, pauses)
        maxMs: 1400,
        window: 8, // taps considered per reading
        minTaps: 8, // readings before a lock (fewer when a saved tempo matched)
        savedMinTaps: 4,
        stableTol: 1.5, // smoothed vs latest reading must agree within this many BPM
        idleSec: 2.5, // no action for this long (game time) starts autopilot
        tierAt: [8, 20, 40]
      },
      options || {}
    );
    const c = {
      o,
      bpm: o.startBpm,
      detected: o.startBpm,
      recent: o.startBpm,
      saved: false,
      tapTimes: [],
      tapCount: 0,
      fold: 0, // actions per beat currently assumed (from perBeat)
      rhythmScore: 0.85,
      flowIndex: 0.45,
      locked: false,
      manualLock: false,
      resyncing: false,
      driftTimer: 0,
      assist: 0,
      assistApplied: 0,
      streak: 0,
      best: 0,
      tier: 1,
      idle: 0,
      auto: false,
      forgive: 0,
      windDown: 0,
      events: [] // drained by the engine: "lock", "auto", "manual"
    };

    c.useSavedTempo = (bpm) => {
      if (!(bpm >= BAND_MIN && bpm <= BAND_MAX)) return false;
      c.bpm = c.detected = c.recent = bpm;
      c.saved = true;
      return true;
    };

    c.recordTap = (nowMs) => {
      c.idle = 0;
      if (c.auto) {
        c.auto = false;
        c.forgive = 2; // taking control back forgives the next two obstacles
        c.events.push("manual");
      }
      c.tapTimes.push(nowMs);
      if (c.tapTimes.length > o.window) c.tapTimes.shift();
      const intervals = [];
      for (let i = 1; i < c.tapTimes.length; i++) {
        const d = c.tapTimes[i] - c.tapTimes[i - 1];
        if (d > o.minMs && d < o.maxMs) intervals.push(d);
      }
      if (intervals.length < 2) return;
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const sd = Math.sqrt(intervals.reduce((a, v) => a + (v - mean) ** 2, 0) / intervals.length);
      const cv = sd / Math.max(mean, 60);
      const consistency = Math.max(0.35, Math.min(1, 1 - (cv - 0.16) * 0.95));
      c.rhythmScore = c.rhythmScore * 0.75 + consistency * 0.25;
      // Median, not mean: one long pause or double hit doesn't drag the reading (brief).
      // Keep the current fold (actions per beat) while the pace stays within 15% of the band,
      // so a ragged player whose pace sits between two folds doesn't flip between them. The
      // fold is only committed once there are 4 intervals to judge from.
      const med = median(intervals);
      let fit = null;
      if (c.fold) {
        const b = 60000 / (med * c.fold);
        if (b >= BAND_MIN * 0.85 && b <= BAND_MAX * 1.15) fit = Math.max(BAND_MIN, Math.min(BAND_MAX, b));
      }
      if (fit === null) {
        const r = fitTempoFold(med, o.perBeat, c.bpm);
        fit = r.bpm;
        if (intervals.length >= 4) c.fold = r.k;
      }
      c.detected = c.detected * 0.82 + fit * 0.18;
      c.recent = fit;
      c.tapCount++;
    };

    c.computeTier = (s) => (s >= o.tierAt[2] ? 4 : s >= o.tierAt[1] ? 3 : s >= o.tierAt[0] ? 2 : 1);

    // Built-in rule: autopilot never scores and never costs. Enforced here so no game can
    // break it. Both return false when ignored.
    c.score = (n) => {
      if (c.auto) return false;
      c.idle = 0; // a hit is playing, even without input (waiting in the right lane counts)
      c.streak += n;
      c.best = Math.max(c.best, c.streak);
      c.tier = c.computeTier(c.streak);
      return true;
    };
    // A miss steps the streak down by a quarter (never a reset) and raises the assist
    c.clip = () => {
      if (c.auto) return false;
      c.streak = Math.floor(c.streak * 0.75);
      c.tier = c.computeTier(c.streak);
      c.assist = Math.min(1, c.assist + 0.35);
      c.flowIndex = Math.max(0.45, c.flowIndex - 0.12);
      return true;
    };
    c.perfect = () => (c.assist = Math.max(0, c.assist - 0.04));
    c.clean = () => (c.assist = Math.max(0, c.assist - 0.01));

    c.setAuto = (on) => {
      if (on === c.auto) return;
      c.auto = on;
      c.idle = 0;
      if (!on) c.forgive = 2;
      c.events.push(on ? "auto" : "manual");
    };

    // dt in seconds of game time (the engine stops calling this while paused)
    c.update = (dt) => {
      const target = Math.min(1, 0.38 + c.rhythmScore * 0.48 + Math.min(0.22, c.streak * 0.01));
      c.flowIndex += (target - c.flowIndex) * Math.min(1, dt * 0.65);

      const wasLocked = c.locked;
      const calibrated =
        (c.tapCount >= o.minTaps * 3 && Math.abs(c.bpm - c.detected) < 1.5) ||
        (c.tapCount >= (c.saved ? o.savedMinTaps : o.minTaps) &&
          Math.abs(c.detected - c.recent) < o.stableTol &&
          Math.abs(c.bpm - c.recent) < 2);

      // Once locked, follow the player if their cadence settles >6 BPM away for 4 s of play
      // (never during autopilot, when there's no fresh input to follow)
      if (wasLocked && !c.manualLock && !c.auto && Math.abs(c.detected - c.bpm) > 6) c.driftTimer += dt;
      else c.driftTimer = 0;
      const drifted = c.driftTimer > 4;
      if (drifted) {
        c.tapCount = Math.min(c.tapCount, Math.max(0, o.minTaps - 2));
        c.resyncing = true;
      }
      c.locked = c.manualLock || (wasLocked ? !drifted : calibrated);
      if (c.locked && !wasLocked && !c.manualLock) c.events.push("lock");
      if (c.locked) c.resyncing = false;

      // Tempo moves at most 3%/bar while calibrating and 1.5%/bar while re-syncing (brief)
      if (!c.locked) {
        const barSec = (4 * 60) / Math.max(88, c.bpm);
        const maxStep = ((c.resyncing ? 0.015 : 0.03) * c.bpm * dt) / barSec;
        const wanted = (c.detected - c.bpm) * Math.min(1, dt * 1.4);
        c.bpm += Math.max(-maxStep, Math.min(maxStep, wanted));
      }

      // Assist sinks back over ~15 clean bars; the applied level moves at most 8%/s
      c.assist = Math.max(0, c.assist - dt * 0.03);
      const step = 0.08 * dt;
      c.assistApplied += Math.max(-step, Math.min(step, c.assist - c.assistApplied));

      // Idle autopilot, and the stopping cue's wind-down (about 4 bars either way)
      if (!c.auto) {
        c.idle += dt;
        if (c.idle > o.idleSec) c.setAuto(true);
      }
      c.windDown = Math.max(0, Math.min(1, c.windDown + (c.auto ? 1 : -1) * 0.12 * dt));
    };

    return c;
  }

  // ==========================================================================
  // Pacer: how many beats between new things (words, obstacles, targets). Pure, like the
  // controller. Two signals, kept separate:
  //   capacity: how long the player takes to handle one item (first action to done),
  //             times 15% slack, so items come at the player's own pace;
  //   success:  the clean rate over the last 16 items. Below 85% adds a beat of room (up to
  //             3); above 95% gives one back, but never below the capacity pace.
  // Changes wait 4 items between steps (hysteresis), are whole beats, and apply only to the
  // next item spawned. Nothing here ramps with time: it can only follow the player.
  // ==========================================================================
  function createPacer(options) {
    const o = Object.assign(
      { startBeats: 4, minBeats: 2, maxBeats: 8, slack: 1.15, window: 16, low: 0.85, high: 0.95, settle: 4, maxRoom: 3 },
      options || {}
    );
    const p = { o, handleSec: null, outcomes: [], room: 0, sinceChange: 0 };
    p.rate = () => (p.outcomes.length ? p.outcomes.reduce((a, b) => a + b, 0) / p.outcomes.length : 1);
    // handleSec: seconds the player needed for this item (null for a miss)
    p.record = (handleSec, ok) => {
      if (ok && handleSec > 0 && isFinite(handleSec)) {
        const sec = Math.min(8, handleSec);
        p.handleSec = p.handleSec === null ? sec : p.handleSec * 0.75 + sec * 0.25;
      }
      p.outcomes.push(ok ? 1 : 0);
      if (p.outcomes.length > o.window) p.outcomes.shift();
      if (++p.sinceChange < o.settle) return;
      const rate = p.rate();
      if (rate < o.low && p.room < o.maxRoom) {
        p.room++;
        p.sinceChange = 0;
      } else if (rate > o.high && p.room > 0 && p.outcomes.length >= o.window / 2) {
        p.room--;
        p.sinceChange = 0;
      }
    };
    p.beats = (beatSec) => {
      const base = p.handleSec === null ? o.startBeats : Math.round((p.handleSec * o.slack) / beatSec);
      return Math.max(o.minBeats, Math.min(o.maxBeats, base + p.room));
    };
    return p;
  }

  // ==========================================================================
  // The engine: controller + synth + timing calibration + stopping cues + measurement
  // ==========================================================================
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      return null; // sandboxed iframes have no storage; everything still works
    }
  }

  function create(options) {
    const o = Object.assign(
      {
        key: "flowEngine", // storage namespace for this game
        phaseFollow: true, // light phase following after lock (alpha 0.2); off suits typing
        autoOnBlur: true, // looking away starts autopilot
        flowCheck: true // occasional two-question check on entering autopilot
      },
      options || {}
    );
    const params = new URLSearchParams(window.location.search);
    if (params.get("phase") === "frozen") o.phaseFollow = false;
    const milestones = params.get("milestones") !== "off";

    const ctrl = createController(o);
    const pacer = createPacer(o.pacing);
    const synth = new CoCreationResonanceSynth();
    const TEMPO_KEY = o.key + ".tempo";
    const PREFS_KEY = o.key + ".prefs";
    const OFFSET_KEY = "flowEngine.offsetMs"; // a property of the device, shared by all games
    ctrl.useSavedTempo(parseFloat(store(TEMPO_KEY)));

    let level = 0.8;
    let offsetMs = Math.max(-150, Math.min(150, parseInt(store(OFFSET_KEY) || "0", 10) || 0));
    let started = false;
    let paused = false;
    let beatCount = 0;
    let silentBeat = 0;
    const audioLive = () => started && synth.ctx && synth.ctx.state === "running";
    const timingLive = () => audioLive() && !!synth.lastBeatTime && !!synth.beatSec;
    let handoverAt = null;
    let handoverGap = 0;
    const timing = { meanAsync: 0, samples: 0 };
    const listeners = { beat: [], lock: [], auto: [], manual: [], pause: [], signal: [] };
    const emit = (evt, arg) => listeners[evt].forEach((fn) => fn(arg));

    try {
      const prefs = JSON.parse(store(PREFS_KEY) || "{}");
      if (Number.isInteger(prefs.voice)) synth.voiceIndex = ((prefs.voice % GROOVE_VOICES.length) + GROOVE_VOICES.length) % GROOVE_VOICES.length;
      if (Number.isInteger(prefs.track)) setTrack(prefs.track);
      if (prefs.muted) synth.isMuted = true;
      if (prefs.volume >= 0.1 && prefs.volume <= 1) level = prefs.volume;
    } catch (e) {}
    const savePrefs = () =>
      store(PREFS_KEY, JSON.stringify({ voice: synth.voiceIndex, track: trackIndex, muted: synth.isMuted, volume: level }));

    // ---- Measurement (local only; see Flow's notes) --------------------------------------
    const TELEMETRY_KEY = o.key + ".telemetry";
    const tel = {
      startedAt: Date.now(),
      variant: { phase: o.phaseFollow ? "follow" : "frozen", milestones: milestones ? "on" : "off" },
      activeSec: 0,
      autoSec: 0,
      intervals: [],
      asyncs: [],
      bursts: [],
      burstTaps: 0,
      lastTapMs: 0,
      clips: [],
      errors: 0,
      check: null
    };
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const sd = (a) => {
      const m = avg(a);
      return a.length > 1 ? Math.sqrt(a.reduce((acc, v) => acc + (v - m) ** 2, 0) / a.length) : null;
    };
    function telemetryTap(nowMs) {
      const gap = tel.lastTapMs ? nowMs - tel.lastTapMs : Infinity;
      tel.lastTapMs = nowMs;
      if (gap > 1800) {
        if (tel.burstTaps > 1) tel.bursts.push(tel.burstTaps);
        tel.burstTaps = 1;
        return;
      }
      tel.burstTaps++;
      tel.intervals.push(gap);
      if (tel.intervals.length > 4000) tel.intervals.shift();
      tel.clips.forEach((c) => {
        if (c.after === null && tel.intervals.length - c.index >= 3) c.after = avg(tel.intervals.slice(-3));
      });
    }
    function summary() {
      const iv = tel.intervals;
      const slowing = tel.clips.filter((c) => c.before && c.after).map((c) => c.after / c.before);
      return {
        game: o.key,
        startedAt: new Date(tel.startedAt).toISOString(),
        variant: tel.variant,
        activeSec: Math.round(tel.activeSec),
        autoSec: Math.round(tel.autoSec),
        cleanRate: +pacer.rate().toFixed(2),
        paceBeats: pacer.beats(eng.beatSec),
        actions: iv.length,
        intervalCv: iv.length > 1 ? +(sd(iv) / avg(iv)).toFixed(3) : null,
        asyncMeanMs: tel.asyncs.length ? Math.round(avg(tel.asyncs) * 1000) : null,
        asyncSdMs: tel.asyncs.length > 1 ? Math.round(sd(tel.asyncs) * 1000) : null,
        bursts: tel.bursts.concat(tel.burstTaps > 1 ? [tel.burstTaps] : []),
        clips: tel.clips.length,
        errors: tel.errors,
        postClipSlowing: slowing.length ? +avg(slowing).toFixed(3) : null,
        lockedBpm: +ctrl.bpm.toFixed(1),
        best: ctrl.best,
        check: tel.check
      };
    }
    function saveTelemetry() {
      if (tel.activeSec < 5) return;
      try {
        const all = JSON.parse(store(TELEMETRY_KEY) || "[]");
        const s = summary();
        const i = all.findIndex((x) => x.startedAt === s.startedAt);
        if (i >= 0) all[i] = s;
        else all.push(s);
        store(TELEMETRY_KEY, JSON.stringify(all.slice(-50)));
      } catch (e) {}
    }

    // About one session in five, after 45 s of play, on entering autopilot: two flow items
    // (fluency, absorption; 1-7) and a time estimate, stored with the session's numbers
    let checkEl = null;
    function maybeAskFlowCheck() {
      if (!o.flowCheck || tel.check || checkEl || tel.activeSec < 45) return;
      const count = (parseInt(store("flowEngine.sessions") || "0", 10) || 0) + 1;
      store("flowEngine.sessions", String(count));
      tel.check = "skipped";
      if (count % 5 !== 0) return;
      const scale = (name) =>
        `<div style="display:flex;gap:4px;margin:6px 0 10px">${[1, 2, 3, 4, 5, 6, 7]
          .map((n) => `<button data-q="${name}" data-v="${n}" style="flex:1;padding:6px 0;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#cbd5e1;font:600 12px monospace">${n}</button>`)
          .join("")}</div>`;
      checkEl = document.createElement("div");
      checkEl.style.cssText =
        "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(340px,calc(100vw - 32px));z-index:50;background:#020617;border:1px solid #1e293b;border-radius:12px;padding:12px 14px;color:#cbd5e1;font:12px system-ui,sans-serif";
      checkEl.innerHTML =
        `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><b style="color:#e2e8f0">Quick check (optional)</b><button data-close style="background:none;border:0;color:#64748b;font-size:14px">✕</button></div>` +
        `<div>That ran fluidly and smoothly <span style="color:#64748b">(1 no – 7 yes)</span></div>${scale("fluency")}` +
        `<div>I was absorbed and lost track of time <span style="color:#64748b">(1–7)</span></div>${scale("absorption")}` +
        `<label>About how many minutes did that feel like? <input data-est type="number" min="0" step="0.5" style="width:60px;margin-left:4px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:2px 4px"></label>`;
      tel.check = { fluency: null, absorption: null, estimatedMin: null, actualMin: +(tel.activeSec / 60).toFixed(2) };
      checkEl.addEventListener("pointerdown", (e) => e.stopPropagation());
      checkEl.addEventListener("keydown", (e) => e.stopPropagation());
      checkEl.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-close")) return closeFlowCheck();
        tel.check[b.dataset.q] = +b.dataset.v;
        checkEl.querySelectorAll(`[data-q="${b.dataset.q}"]`).forEach((x) => (x.style.background = x === b ? "#155e75" : "#0f172a"));
        saveTelemetry();
      });
      checkEl.querySelector("[data-est]").addEventListener("input", (e) => {
        tel.check.estimatedMin = parseFloat(e.target.value) || null;
        saveTelemetry();
      });
      document.body.appendChild(checkEl);
    }
    function closeFlowCheck() {
      if (!checkEl) return;
      saveTelemetry();
      checkEl.remove();
      checkEl = null;
    }

    // ---- Events from the controller -------------------------------------------------------
    function drainEvents() {
      while (ctrl.events.length) {
        const evt = ctrl.events.shift();
        if (evt === "lock") store(TEMPO_KEY, ctrl.bpm.toFixed(1));
        if (evt === "auto") {
          synth.setAutopilot(true); // stopping cue: resolve home, then drift
          saveTelemetry();
          maybeAskFlowCheck();
        }
        if (evt === "manual") {
          synth.setAutopilot(false); // crossfade back to the game arrangement
          closeFlowCheck();
        }
        emit(evt);
      }
    }

    // Judge taps against the beat as heard: scheduled time + output latency + manual offset
    function measureAsync() {
      if (!synth.ctx) return null;
      const latency = synth.ctx.outputLatency || synth.ctx.baseLatency || 0;
      const off = synth.getBeatOffset(synth.ctx.currentTime - latency - offsetMs / 1000);
      return off !== null && Math.abs(off) < 0.12 ? off : null;
    }

    if (o.autoOnBlur) window.addEventListener("blur", () => started && !paused && ctrl.setAuto(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        if (started) ctrl.setAuto(true);
        drainEvents();
        if (synth.ctx) synth.ctx.suspend().catch(() => {});
      } else if (synth.ctx && !paused) {
        synth.ctx.resume().catch(() => {});
      }
    });
    // Build-done hook: a wrapper (the pocket app, an extension) posts
    // {type: "flow:build-done", label?}. Autopilot takes over and winds down, and a chime plays
    // even if autopilot was already on, since that's the cue to switch back to your work.
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "flow:build-done" && started) {
        ctrl.setAuto(true);
        drainEvents();
        synth.playGoldenOrbShimmer();
        emit("signal", typeof e.data.label === "string" ? e.data.label.slice(0, 40) : "Build done");
      }
    });
    window.addEventListener("pagehide", () => saveTelemetry());

    const eng = {
      ctrl,
      synth,
      pacer,
      quietLead: false, // true: actions don't queue the grid-snapped lead note (Fidget plays its own)
      // An immediate note for Fidget: no waiting for the grid, in key with the current chord.
      // height 0 (high) to 1 (low); sustain in seconds (long rings for slow presses, short
      // staccato for fast ones); a soft click on top so every press has a tactile edge.
      pluck(height = 0.5, sustain = 0.6, vel = 0.12) {
        if (!synth.ctx || synth.isMuted || !synth.padFilter) return;
        const t = synth.ctx.currentTime;
        const scale = CHORD_PROGRESSION[synth.chordIndex].scale;
        const idx = Math.max(0, Math.min(scale.length - 1, Math.floor((1 - height) * scale.length)));
        const osc = synth.ctx.createOscillator();
        const gain = synth.ctx.createGain();
        osc.type = synth.voiceIndex === 1 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(scale[idx], t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vel, t + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + sustain);
        osc.connect(gain);
        gain.connect(synth.padFilter);
        if (sustain > 0.4) gain.connect(synth.delayNode); // slow presses ring out through the delay
        osc.start(t);
        osc.stop(t + sustain + 0.02);
        const click = synth.ctx.createOscillator();
        const cg = synth.ctx.createGain();
        click.type = "square";
        click.frequency.setValueAtTime(1800, t);
        cg.gain.setValueAtTime(0.018, t);
        cg.gain.exponentialRampToValueAtTime(0.0004, t + 0.012);
        click.connect(cg);
        cg.connect(synth.masterGain);
        click.start(t);
        click.stop(t + 0.015);
      },
      milestones,
      // Call from the first user gesture (audio needs one)
      start() {
        synth.init();
        if (synth.isMuted && synth.masterGain) synth.masterGain.gain.value = 0.0001;
        started = true;
        ctrl.idle = 0;
      },
      // A rhythmic action: a tap, a keystroke. height 0 (top) .. 1 (bottom) picks the note;
      // note:false counts toward cadence without a lead note (e.g. a wrong key)
      tap({ height = 0.5, note = true } = {}) {
        const nowMs = performance.now();
        ctrl.recordTap(nowMs);
        telemetryTap(nowMs);
        const a = measureAsync();
        if (a !== null) {
          tel.asyncs.push(a);
          if (!ctrl.locked) {
            timing.samples++;
            timing.meanAsync += (a - timing.meanAsync) * (timing.samples < 6 ? 1 / timing.samples : 0.15);
          } else if (o.phaseFollow && timing.samples >= 4) {
            synth.nudgePhase(Math.max(-0.02, Math.min(0.02, (a - timing.meanAsync) * 0.2)));
          }
        }
        // The grid-snapped lead note stays silent while calibrating so it can't bias timing
        synth.queueQuantizedTap(height, ctrl.tier, note && ctrl.locked && !eng.quietLead);
        drainEvents();
        return a;
      },
      error() {
        tel.errors++;
      },
      // Call every frame with real seconds; does nothing while paused
      update(dt) {
        if (paused) return;
        if (started) {
          ctrl.update(dt);
          if (!ctrl.auto) tel.activeSec += dt;
          else tel.autoSec += dt;
          drainEvents();
        }
        // Until audio is running (browsers need a gesture first), a silent clock keeps the
        // same tempo, so games can play themselves in attract mode before anyone taps. It keeps
        // running until the audio clock has scheduled its first beat, so motion never freezes
        // at the moment you take over.
        if (!timingLive()) silentBeat += dt / eng.beatSec;
        if (!audioLive()) {
          while (silentBeat >= beatCount + 1) {
            beatCount++;
            emit("beat", beatCount);
          }
          return;
        }
        if (synth.masterGain && !synth.isMuted) synth.masterGain.gain.value = level * (1 - 0.35 * ctrl.windDown);
        synth.updateScheduler(ctrl.bpm * (1 - 0.05 * ctrl.windDown), ctrl.flowIndex, ctrl.tier, {
          onQuarterBeat: () => {
            beatCount++;
            emit("beat", beatCount);
          }
        });
        synth.updateSynesthesia(ctrl.flowIndex, ctrl.tier, ctrl.bpm, dt);
      },
      // Continuous beat count locked to what the player hears (e.g. 41.37)
      beatPos() {
        if (!timingLive()) return silentBeat;
        const latency = synth.ctx.outputLatency || synth.ctx.baseLatency || 0;
        const raw = beatCount + (synth.ctx.currentTime - latency - synth.lastBeatTime) / synth.beatSec;
        // Hand over from the silent clock without a jump: the difference fades out in ~250 ms
        if (handoverAt === null) {
          handoverAt = performance.now();
          handoverGap = silentBeat - raw;
        }
        return raw + handoverGap * Math.exp(-(performance.now() - handoverAt) / 250);
      },
      on(evt, fn) {
        listeners[evt].push(fn);
        return eng;
      },
      // handleSec (optional): how long the player took on this item, for the pacer
      score(n = 1, quality, handleSec) {
        const prevTier = ctrl.tier;
        if (!ctrl.score(n)) return false;
        pacer.record(handleSec, true);
        if (quality === "PERFECT") ctrl.perfect();
        else ctrl.clean();
        if (quality) synth.playPipeHarmony(ctrl.streak, quality);
        return ctrl.tier > prevTier;
      },
      clip() {
        if (ctrl.forgive > 0) {
          ctrl.forgive--;
          return false;
        }
        if (ctrl.auto) return false;
        tel.clips.push({ index: tel.intervals.length, before: avg(tel.intervals.slice(-3)), after: null });
        ctrl.clip();
        pacer.record(null, false);
        synth.triggerCushionCrossfade();
        synth.playGentleCushionChord();
        return true;
      },
      // Beats until the next item should appear (see createPacer)
      paceBeats() {
        return pacer.beats(eng.beatSec);
      },
      chime() {
        synth.playGoldenOrbShimmer();
      },
      setAuto(on) {
        ctrl.setAuto(on);
        drainEvents();
      },
      pause(on) {
        if (!started || paused === on) return;
        paused = on;
        if (synth.ctx) (on ? synth.ctx.suspend() : synth.ctx.resume()).catch(() => {});
        if (on) saveTelemetry();
        emit("pause", on);
      },
      cycleTrack() {
        setTrack(trackIndex + 1);
        savePrefs();
        return TRACKS[trackIndex].name;
      },
      cycleVoice() {
        synth.init();
        const name = synth.cycleVoice();
        savePrefs();
        return name;
      },
      toggleMute() {
        synth.init();
        const muted = synth.toggleMute();
        savePrefs();
        return muted;
      },
      changeVolume(delta) {
        level = Math.round(Math.max(0.1, Math.min(1, level + delta)) * 10) / 10;
        savePrefs();
        return level;
      },
      adjustOffset(deltaMs) {
        offsetMs = Math.max(-150, Math.min(150, offsetMs + deltaMs));
        store(OFFSET_KEY, String(offsetMs));
        return offsetMs;
      },
      toggleHold() {
        ctrl.manualLock = !ctrl.manualLock;
        return ctrl.manualLock;
      },
      telemetry: summary,
      history: () => {
        try {
          return JSON.parse(store(TELEMETRY_KEY) || "[]");
        } catch (e) {
          return [];
        }
      },
      get started() { return started; },
      get paused() { return paused; },
      get bpm() { return ctrl.bpm; },
      get beatSec() { return 60 / Math.max(88, Math.min(136, ctrl.bpm * (1 - 0.05 * ctrl.windDown))); },
      get locked() { return ctrl.locked; },
      get auto() { return ctrl.auto; },
      get tier() { return ctrl.tier; },
      get streak() { return ctrl.streak; },
      get assist() { return ctrl.assistApplied; },
      get flowIndex() { return ctrl.flowIndex; },
      get trackName() { return TRACKS[trackIndex].name; },
      get voiceName() { return synth.getCurrentVoiceName(); },
      get muted() { return synth.isMuted; },
      get volume() { return level; }
    };
    return eng;
  }

  window.FlowEngine = { create, createController, createPacer, fitTempo, BAND_MIN, BAND_MAX, TRACKS, version: 1 };
})();

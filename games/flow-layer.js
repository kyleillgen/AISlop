// Flow layer: Flow // Resonance's own engine, shared by every AISlop game and toy.
//
// The point of Flow is to draw you into a flow state by calibrating the beat to you: it
// measures your natural tapping cadence, eases the tempo toward it, and once you're steady
// it locks there ("sweet spot frozen"). The world is built on that beat (Flow sends a pipe
// every two beats), and every input is quantized onto the 16th-note grid, in key.
//
// The synth (CHORD_PROGRESSION, GROOVE_VOICES, CoCreationResonanceSynth) is copied unchanged
// from the original Flow // Resonance file; the cadence logic below mirrors its
// recordTapAndEntrainCadence and updateCadenceSynchronizer.
//
// Games build on the calibrated beat:
//   Flow.bpm, Flow.beat (seconds per beat), Flow.locked     read every frame for speed/spacing
//   Flow.onBeat(fn)       fn(beatIndex) on each quarter beat; spawn things on the beat
// and report what happens (always guarded: window.Flow && ...):
//   Flow.score(n), Flow.hit(x, y, quiet), Flow.miss(), Flow.reset(), Flow.note(degree), Flow.tap(y)
// Attributes: data-mode="toy", data-music="off" (visuals only), data-bpm (starting tempo,
// default 108), data-step (points per tier, default 10 = Flow's 8/20/40), data-taps="off".
(() => {
  "use strict";
  if (window.Flow) return;

  // ==========================================================================
  // Original Flow // Resonance synth, unchanged
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
      queueQuantizedTap(heightNorm, tier) {
          if (!this.isInitialized || this.isMuted) return;
          const now = this.ctx.currentTime;
          const chord = CHORD_PROGRESSION[this.chordIndex];
          const clampedH = Math.max(0, Math.min(1, 1 - heightNorm));

          // Queue for the 16th-note grid scheduler so it lands 100% in time and in key
          this.queuedTapNotes.push({
              heightNorm: clampedH,
              tier
          });
          if (this.queuedTapNotes.length > 2) {
              this.queuedTapNotes.shift();
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
          const sixteenthDuration = secondsPerBeat / 4.0;

          if (this.nextStepTime < now - 0.2) {
              this.nextStepTime = now;
          }

          while (this.nextStepTime < now + 0.09) {
              this.scheduleStep(this.stepIndex, this.nextStepTime, flowIndex, tier, callbacks);
              this.stepIndex = (this.stepIndex + 1) % 16;
              if (this.stepIndex === 0) {
                  this.barCount++;
                  // Cycle through the 4-chord progression (faster cycling in Tier 4 for lush movement)
                  const barsPerChord = tier >= 4 ? 1 : 2;
                  if (this.barCount % barsPerChord === 0) {
                      this.chordIndex = (this.chordIndex + 1) % CHORD_PROGRESSION.length;
                  }
              }
              this.nextStepTime += sixteenthDuration;
          }
      }

      scheduleStep(step, time, flowIndex, tier, callbacks) {
          if (step % 4 === 0 && callbacks && callbacks.onQuarterBeat) {
              callbacks.onQuarterBeat(step / 4);
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

                  const padAmp = voice === 2 ? 0.055 : 0.038;
                  padGain.gain.setValueAtTime(0.001, time);
                  padGain.gain.linearRampToValueAtTime(padAmp, time + 0.35);
                  padGain.gain.exponentialRampToValueAtTime(0.0008, time + 1.9);

                  padOsc.connect(padGain);
                  padGain.connect(this.padFilter);
                  padOsc.start(time);
                  padOsc.stop(time + 1.95);
              });
          }

          // 2. Sub-Kick & Percussion Pocket (Adapted per Groove Voice)
          if (step % 4 === 0) {
              const kickOsc = this.ctx.createOscillator();
              const kickGain = this.ctx.createGain();
              kickOsc.type = "sine";
              const startPitch = voice === 1 ? 135 : 112;
              kickOsc.frequency.setValueAtTime(startPitch, time);
              kickOsc.frequency.exponentialRampToValueAtTime(42, time + 0.13);

              const kickAmp = voice === 2 ? 0.22 : 0.30;
              kickGain.gain.setValueAtTime(kickAmp, time);
              kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

              kickOsc.connect(kickGain);
              kickGain.connect(this.masterGain);
              kickOsc.start(time);
              kickOsc.stop(time + 0.17);
          }

          // Off-beat dusty shaker / hat
          if (voice !== 2 && (step % 4 === 2 || (tier >= 2 && (step === 7 || step === 15)))) {
              const hatOsc = this.ctx.createOscillator();
              const hatGain = this.ctx.createGain();
              hatOsc.type = "square";
              hatOsc.frequency.setValueAtTime(voice === 0 ? 4200 : 5600, time);

              const hatFilter = this.ctx.createBiquadFilter();
              hatFilter.type = "highpass";
              hatFilter.frequency.value = 3000;

              const amp = step % 4 === 2 ? 0.026 : 0.012;
              hatGain.gain.setValueAtTime(amp, time);
              hatGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.04);

              hatOsc.connect(hatFilter);
              hatFilter.connect(hatGain);
              hatGain.connect(this.masterGain);
              hatOsc.start(time);
              hatOsc.stop(time + 0.045);
          }

          // 3. Tier 2+ Rolling Dorian/Chord Bassline
          if (tier >= 2 || step % 4 === 0) {
              const bassFreq = chord.bass[step % 8];
              if (bassFreq > 0) {
                  const bassOsc = this.ctx.createOscillator();
                  const bassGain = this.ctx.createGain();
                  bassOsc.type = voice === 1 ? "sawtooth" : "triangle";
                  bassOsc.frequency.setValueAtTime(bassFreq, time);

                  const amp = 0.12 + Math.min(0.06, tier * 0.015);
                  bassGain.gain.setValueAtTime(0.001, time);
                  bassGain.gain.linearRampToValueAtTime(amp, time + 0.012);
                  bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

                  bassOsc.connect(bassGain);
                  bassGain.connect(this.bassFilter);
                  bassOsc.start(time);
                  bassOsc.stop(time + 0.16);
              }
          }

          // 4. Quantized Player Co-Creation Lead OR Tier 3+ Lush Auto-Arpeggiator
          const queuedTap = this.queuedTapNotes.shift();
          const shouldAutoArp = tier >= 3 && (step % 2 === 1);

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
  // Everything below adapts the original engine for other games and toys.
  // ==========================================================================
  const cfg = (document.currentScript && document.currentScript.dataset) || {};
  const TOY = cfg.mode === "toy";
  const MUSIC = cfg.music !== "off";
  const STEP = Number(cfg.step) || 10;
  const START_BPM = Number(cfg.bpm) || 108;
  // Games play a quantized note on every tap, like Flow's flaps; toys call Flow.note themselves
  const AUTO_TAPS = cfg.taps ? cfg.taps !== "off" : !TOY;
  const MUTE_KEY = "aislop.flow.muted";
  const VOICE_KEY = "aislop.flow.voice";

  const synth = new CoCreationResonanceSynth();
  try { synth.voiceIndex = (parseInt(localStorage.getItem(VOICE_KEY) || "0", 10) || 0) % GROOVE_VOICES.length; } catch (e) {}
  let wantMuted = false;
  try { wantMuted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) {}

  // Cadence state, as in Flow // Resonance's flowCtrl
  const ctrl = {
    flowIndex: 0.45, tier: 1, manualLock: false, resonanceLocked: false,
    bpm: START_BPM, detectedCadenceBpm: START_BPM, tapTimes: [], tapRhythmScore: 0.85
  };
  let streak = 0;

  // Same as the original recordTapAndEntrainCadence
  function recordTap(nowMs) {
    ctrl.tapTimes.push(nowMs);
    if (ctrl.tapTimes.length > 8) ctrl.tapTimes.shift();
    if (ctrl.tapTimes.length >= 3) {
      const intervals = [];
      for (let i = 1; i < ctrl.tapTimes.length; i++) {
        const dtMs = ctrl.tapTimes[i] - ctrl.tapTimes[i - 1];
        if (dtMs > 180 && dtMs < 1400) intervals.push(dtMs);
      }
      if (intervals.length >= 2) {
        const meanMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((acc, val) => acc + Math.pow(val - meanMs, 2), 0) / intervals.length;
        const cv = Math.sqrt(variance) / Math.max(meanMs, 200);
        const consistency = Math.max(0.35, Math.min(1.0, 1.0 - (cv - 0.16) * 0.95));
        ctrl.tapRhythmScore = ctrl.tapRhythmScore * 0.75 + consistency * 0.25;
        const rawBpm = 60000 / meanMs;
        const normalizedBpm = rawBpm < 88 ? rawBpm * 1.5 : rawBpm > 140 ? rawBpm * 0.75 : rawBpm;
        const clampedBpm = Math.max(96, Math.min(124, normalizedBpm));
        ctrl.detectedCadenceBpm = ctrl.detectedCadenceBpm * 0.82 + clampedBpm * 0.18;
      }
    }
  }

  // The lead voice from the original scheduleStep, played now instead of on the next 16th
  function playLead(heightNorm) {
    if (synth.isMuted || !synth.ctx) return;
    const chord = CHORD_PROGRESSION[synth.chordIndex];
    const idx = Math.min(chord.scale.length - 1, Math.floor(Math.max(0, Math.min(1, 1 - heightNorm)) * chord.scale.length));
    const voice = synth.voiceIndex;
    const time = synth.ctx.currentTime + 0.005;
    const osc = synth.ctx.createOscillator(), gain = synth.ctx.createGain();
    osc.type = voice === 0 ? "sine" : voice === 1 ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(chord.scale[idx], time);
    const decay = voice === 2 ? 0.38 : 0.25;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0007, time + decay);
    osc.connect(gain); gain.connect(synth.padFilter); gain.connect(synth.delayNode);
    osc.start(time); osc.stop(time + decay + 0.02);
  }

  // Flow's tiers are 8 / 20 / 40 points; other games scale that by data-step (10 = Flow)
  function computeTier(s) {
    if (s >= STEP * 4) return 4;
    if (s >= STEP * 2) return 3;
    if (s >= STEP * 0.8) return 2;
    return 1;
  }

  // Same as the original updateCadenceSynchronizer, minus Flow's own physics
  function updateCadence(dt) {
    const targetFlow = Math.min(1.0, 0.38 + ctrl.tapRhythmScore * 0.48 + Math.min(0.22, streak * (0.1 / STEP)));
    ctrl.flowIndex += (targetFlow - ctrl.flowIndex) * Math.min(1.0, dt * 0.65);
    ctrl.resonanceLocked = ctrl.manualLock || ctrl.flowIndex >= 0.75;
    if (!ctrl.resonanceLocked) {
      ctrl.bpm += (ctrl.detectedCadenceBpm - ctrl.bpm) * Math.min(1.0, dt * 1.4);
    }
    synth.updateSynesthesia(ctrl.flowIndex, ctrl.tier, ctrl.bpm, dt);
  }

  // ---- Audio start-up (needs a user gesture) and the scheduler clock ------------------
  function startAudio() {
    if (!MUSIC) return;
    const first = !synth.isInitialized;
    synth.init();
    if (first && wantMuted && !synth.isMuted) synth.toggleMute();
    syncPill();
  }

  // The scheduler runs on its own timer so the groove never stutters when a toy slows
  // its drawing down in a background window
  // Games subscribe to the calibrated quarter beat to spawn things on it, the way Flow
  // spaces its pipes two beats apart. With sound off (or before the first gesture) a silent
  // clock keeps the same beat, so gameplay stays calibrated either way.
  let kickAt = 0, lastTick = performance.now(), beatIndex = 0, silentPhase = 0;
  const beatListeners = [];
  // Beats are scheduled slightly ahead of when they sound; remember each one's audio time
  // so games can read a smooth beat position that matches what the player hears
  const scheduled = [];
  let heard = null;
  function beat() {
    kickAt = performance.now();
    beatIndex++;
    // Inside the scheduler's callback, nextStepTime is the time this beat will sound
    if (synth.isInitialized) {
      scheduled.push({ i: beatIndex, at: synth.nextStepTime });
      if (scheduled.length > 8) scheduled.shift();
    }
    for (const fn of beatListeners) { try { fn(beatIndex); } catch (e) { console.error(e); } }
  }
  function beatSec() { return 60 / Math.max(88, Math.min(136, ctrl.bpm)); }
  // Continuous beat count (e.g. 41.37), locked to the audible groove
  function beatPos() {
    if (synth.isInitialized && synth.ctx) {
      const now = synth.ctx.currentTime;
      while (scheduled.length && scheduled[0].at <= now) heard = scheduled.shift();
      if (heard) return heard.i + Math.min(1.5, (now - heard.at) / beatSec());
    }
    return beatIndex + silentPhase;
  }
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    // As in Flow, calibration only runs once play has begun (the first tap), so the
    // short window where the tempo follows you isn't spent before you've touched anything
    if (calibrating) updateCadence(dt);
    if (synth.isInitialized) {
      synth.updateScheduler(ctrl.bpm, ctrl.flowIndex, ctrl.tier, { onQuarterBeat: beat });
    } else {
      silentPhase += dt / (60 / Math.max(88, Math.min(136, ctrl.bpm)));
      while (silentPhase >= 1) { silentPhase -= 1; beat(); }
    }
  }, 25);

  // Every tap and action key counts toward your cadence; in games it also plays in key
  const ACTION_KEYS = new Set(["Space", "ArrowUp", "KeyW", "Enter"]);
  function isUi(e) { return e.target && e.target.closest && e.target.closest("[data-flow-ui]"); }
  let calibrating = false;
  function onTap(y) {
    calibrating = true;
    recordTap(performance.now());
    if (AUTO_TAPS && synth.isInitialized) {
      synth.queueQuantizedTap(Math.max(0, Math.min(1, y / Math.max(1, H))), ctrl.tier);
    }
  }
  window.addEventListener("pointerdown", (e) => {
    if (isUi(e)) return;
    startAudio();
    onTap(e.clientY);
  }, true);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (MUSIC && e.code === "KeyM") { startAudio(); toggleMute(); return; }
    if (MUSIC && e.code === "KeyV") { startAudio(); cycleVoice(); return; }
    if (MUSIC && e.code === "KeyL") { startAudio(); toggleLock(); return; }
    startAudio();
    if (ACTION_KEYS.has(e.code)) onTap(H * 0.5);
  }, true);

  // ---- The groove pill: voice, cadence lock, mute (Flow's own controls) ------------------
  const pill = document.createElement("div");
  pill.setAttribute("data-flow-ui", "");
  pill.style.cssText =
    "position:fixed;right:8px;bottom:8px;z-index:2147483001;display:flex;gap:4px;font:700 10px ui-monospace,Menlo,Consolas,monospace;" +
    "letter-spacing:.06em;text-transform:uppercase;opacity:.8";
  const btnCss =
    "border:1px solid rgba(255,255,255,0.22);background:rgba(8,10,24,0.72);color:#e6e9f5;border-radius:10px;padding:6px 8px;cursor:pointer;font:inherit";
  function mkBtn(title, onPress) {
    const b = document.createElement("button");
    b.type = "button"; b.title = title; b.style.cssText = btnCss;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); startAudio(); onPress(); });
    pill.appendChild(b);
    return b;
  }
  const voiceBtn = mkBtn("Groove voice (V)", () => cycleVoice());
  const lockBtn = mkBtn("Cadence: auto sync / lock (L)", () => toggleLock());
  const muteBtn = mkBtn("Sound (M)", () => toggleMute());

  function cycleVoice() {
    synth.cycleVoice();
    try { localStorage.setItem(VOICE_KEY, String(synth.voiceIndex)); } catch (e) {}
    syncPill();
  }
  function toggleLock() {
    ctrl.manualLock = !ctrl.manualLock;
    syncPill();
  }
  function toggleMute() {
    if (!synth.isInitialized) { wantMuted = !wantMuted; }
    else { wantMuted = synth.toggleMute(); }
    try { localStorage.setItem(MUTE_KEY, wantMuted ? "1" : "0"); } catch (e) {}
    syncPill();
  }
  function syncPill() {
    voiceBtn.textContent = synth.getCurrentVoiceName();
    const state = ctrl.manualLock ? "LOCKED" : ctrl.resonanceLocked ? "SYNCED" : "AUTO SYNC";
    lockBtn.textContent = Math.round(ctrl.bpm) + " BPM · " + state;
    lockBtn.style.borderColor = ctrl.manualLock ? "rgba(52,211,153,0.7)" : ctrl.resonanceLocked ? "rgba(34,211,238,0.6)" : "rgba(255,255,255,0.22)";
    muteBtn.textContent = wantMuted ? "\u{1F507}" : "♪";
  }
  setInterval(syncPill, 400);

  // ---- Visual wash: soft glow that pulses on the groove's kick ----------------------------
  const PALETTES = [[195, 265], [165, 215], [285, 330], [22, 48], [125, 175], [230, 300], [330, 20]];
  const cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;mix-blend-mode:screen";
  const g = cv.getContext("2d");
  let W = window.innerWidth, H = window.innerHeight;
  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * d; cv.height = H * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  }
  window.addEventListener("resize", resize);
  function mount() {
    document.body.appendChild(cv);
    if (MUSIC) { syncPill(); document.body.appendChild(pill); }
    resize();
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  let eraPos = 0, dip = 0, rings = [];

  window.Flow = {
    score(n) {
      const prevTier = ctrl.tier;
      streak = Math.max(0, Number(n) || 0);
      ctrl.tier = computeTier(streak);
      if (ctrl.tier > prevTier) rings.push({ x: W / 2, y: H / 2, r: 20, max: Math.max(W, H) * 0.7, a: 0.5, big: true });
    },
    hit(x, y, quiet) {
      ctrl.flowIndex = Math.min(1.0, ctrl.flowIndex + 0.035);
      rings.push({ x: typeof x === "number" ? x : W / 2, y: typeof y === "number" ? y : H / 2, r: 8, max: 80 + ctrl.flowIndex * 40, a: 0.8 });
      if (!quiet && synth.isInitialized) synth.playPipeHarmony(streak, "CLEAN");
    },
    miss() {
      ctrl.flowIndex = Math.max(0.45, ctrl.flowIndex - 0.12);
      dip = 1;
      if (synth.isInitialized) { synth.triggerCushionCrossfade(); synth.playGentleCushionChord(); }
    },
    // A new run recalibrates from your next taps, keeping the tempo you'd settled into
    reset() {
      streak = 0; ctrl.tier = 1; dip = 0; rings = [];
      ctrl.flowIndex = 0.45; ctrl.tapTimes = []; ctrl.tapRhythmScore = 0.85;
      ctrl.resonanceLocked = ctrl.manualLock;
      calibrating = false;
    },
    // Scale degree 0 (low) to 13 (high) of the current chord. By default it's queued onto
    // the 16th grid like a Flow tap; { now: true } plays the same lead voice immediately,
    // for callers that are already on the grid (and need chords, which the queue can't hold).
    note(degree, opts) {
      if (!synth.isInitialized) return;
      const d = Math.max(0, Math.min(13, Number(degree) || 0));
      if (opts && opts.now) playLead(1 - d / 13);
      else synth.queueQuantizedTap(1 - d / 13, ctrl.tier);
    },
    // Switch Flow's groove voice (LO-FI RHODES / SYNTHWAVE PULSE / AMBIENT DRIFT); returns its name
    nextVoice() { cycleVoice(); return synth.getCurrentVoiceName(); },
    // Count an input toward cadence (raw taps and action keys are counted automatically)
    tap(y) { onTap(typeof y === "number" ? y : H * 0.5); },
    // The calibrated beat: build speed and spacing on these, as Flow does
    onBeat(fn) { if (typeof fn === "function") beatListeners.push(fn); },
    get bpm() { return Math.max(88, Math.min(136, ctrl.bpm)); },
    get beat() { return beatSec(); },
    // Smooth position in beats, matched to what the player hears: drive beat-locked
    // motion and on-beat judging from this rather than from a clock of your own
    get beatPos() { return beatPos(); },
    get locked() { return ctrl.resonanceLocked; },
    get level() { return ctrl.flowIndex; },
    get away() { return !document.hasFocus(); }
  };

  let last = performance.now();
  function frame(now) {
    if (!document.hasFocus() && now - last < 100) { requestAnimationFrame(frame); return; }
    const dt = Math.min(0.12, (now - last) / 1000);
    last = now;
    dip = Math.max(0, dip - dt * 0.8);
    eraPos += (streak / STEP - eraPos) * Math.min(1, dt * 0.5);

    const pulse = Math.pow(Math.max(0, 1 - (now - kickAt) / (60000 / ctrl.bpm)), 3);
    const e0 = Math.floor(eraPos), f = eraPos - e0;
    const pa = PALETTES[e0 % PALETTES.length], pb = PALETTES[(e0 + 1) % PALETTES.length];
    const mixHue = (a, b) => a + ((((b - a) % 360) + 540) % 360 - 180) * f;
    const h1 = mixHue(pa[0], pb[0]), h2 = mixHue(pa[1], pb[1]);

    g.clearRect(0, 0, W, H);
    const strength = (0.06 + (ctrl.flowIndex - 0.4) * 0.16 + pulse * 0.04) * (1 - dip * 0.5) * (TOY ? 0.75 : 1);
    const t = now / 1000;
    const blobs = [
      [W * (0.25 + 0.1 * Math.sin(t * 0.07)), H * (0.3 + 0.08 * Math.cos(t * 0.05)), h1],
      [W * (0.75 + 0.1 * Math.cos(t * 0.06)), H * (0.72 + 0.08 * Math.sin(t * 0.04)), h2]
    ];
    for (const [bx, by, h] of blobs) {
      const rad = Math.max(W, H) * 0.65;
      const grad = g.createRadialGradient(bx, by, 0, bx, by, rad);
      grad.addColorStop(0, `hsla(${h}, 85%, 60%, ${Math.max(0, strength)})`);
      grad.addColorStop(1, `hsla(${h}, 85%, 60%, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }
    const hz = g.createLinearGradient(0, H - 3, 0, H);
    hz.addColorStop(0, `hsla(${h1}, 90%, 70%, 0)`);
    hz.addColorStop(1, `hsla(${h1}, 90%, 70%, ${0.12 + pulse * 0.22})`);
    g.fillStyle = hz; g.fillRect(0, H - 3, W, 3);
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += (r.max - r.r) * dt * (r.big ? 2.2 : 5);
      r.a -= dt * (r.big ? 0.45 : 1.6);
      if (r.a <= 0) { rings.splice(i, 1); continue; }
      g.strokeStyle = `hsla(${r.big ? h2 : h1}, 90%, 72%, ${r.a})`;
      g.lineWidth = r.big ? 3 : 2;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

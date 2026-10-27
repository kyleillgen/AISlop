// Flow layer: the shared ambient theme for AISlop games, borrowed from Flow // Resonance.
// It lays a slow-shifting glow wash over the game, pulses it on a soft beat, plays a
// chill groove on the same Dm9 → Bbmaj9 → Gm9 → A7sus4 progression, and answers the
// game's moments with poppy rings and in-key chimes. Mistakes get a soft dip, never a jolt.
//
// Games opt in with three calls (always guarded, so a game runs without the layer):
//   window.Flow && Flow.score(n)        whenever the score changes
//   window.Flow && Flow.hit(x, y, quiet) on a success, at its screen position (quiet: no chime)
//   window.Flow && Flow.miss()          on a mistake or game over
//   window.Flow && Flow.reset()         on restart
//
// Script attributes: data-bpm (default 96), data-music ("on" | "pad" | "off"),
// data-step (points per palette shift, default 10).
(() => {
  "use strict";
  if (window.Flow) return;

  const cfg = (document.currentScript && document.currentScript.dataset) || {};
  const BPM = Number(cfg.bpm) || 96;
  const BEAT = 60 / BPM;
  const MUSIC = cfg.music || "on";
  const STEP = Number(cfg.step) || 10;

  const CHORDS = [
    { pad: [146.83, 174.61, 220.0, 261.63, 329.63], bass: 73.42, bell: [293.66, 349.23, 440.0, 523.25, 587.33, 698.46, 880.0] },
    { pad: [116.54, 146.83, 174.61, 220.0, 261.63], bass: 58.27, bell: [293.66, 349.23, 392.0, 466.16, 587.33, 698.46, 783.99] },
    { pad: [196.0, 233.08, 293.66, 349.23, 440.0], bass: 98.0, bell: [293.66, 349.23, 392.0, 466.16, 587.33, 698.46, 880.0] },
    { pad: [110.0, 146.83, 164.81, 196.0, 246.94], bass: 110.0, bell: [293.66, 329.63, 392.0, 440.0, 587.33, 659.25, 880.0] }
  ];
  // Glow hue pairs, one per palette era; the wash eases from one to the next
  const PALETTES = [[195, 265], [165, 215], [285, 330], [22, 48], [125, 175], [230, 300], [330, 20]];

  let score = 0;
  let eraPos = 0;
  let flow = 0.3;
  let dip = 0;
  let rings = [];
  let muted = false;
  try { muted = localStorage.getItem("aislop.flow.muted") === "1"; } catch (e) {}

  // ---- Visual wash (screen-blended overlay, never intercepts input) -------------------
  const cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText =
    "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;mix-blend-mode:screen";
  const g = cv.getContext("2d");
  let W = 0, H = 0;
  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * d; cv.height = H * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", "Toggle flow music");
  btn.style.cssText =
    "position:fixed;right:10px;bottom:10px;z-index:2147483001;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.25);" +
    "background:rgba(10,12,24,0.45);color:#fff;font:14px system-ui;opacity:0.55;cursor:pointer;padding:0;line-height:28px";
  function syncBtn() { btn.textContent = muted ? "\u{1F507}" : "♪"; }
  btn.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); toggleMute(); });

  function mount() {
    document.body.appendChild(cv);
    if (MUSIC !== "off") { syncBtn(); document.body.appendChild(btn); }
    resize();
  }
  window.addEventListener("resize", resize);
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  // ---- Audio ---------------------------------------------------------------------------
  let ac = null, master = null, lp = null, t0 = 0, nextT = 0, stepN = 0;
  function startAudio() {
    if (ac || MUSIC === "off") return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    lp = ac.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.7;
    lp.connect(master); master.connect(ac.destination);
    t0 = nextT = ac.currentTime + 0.06;
  }
  // Capture phase: start sound on the very first input without touching the game's handlers
  window.addEventListener("pointerdown", startAudio, true);
  window.addEventListener("keydown", (e) => {
    startAudio();
    if (e.code === "KeyM" && !e.repeat && MUSIC !== "off") toggleMute();
  }, true);

  function toggleMute() {
    startAudio();
    muted = !muted;
    try { localStorage.setItem("aislop.flow.muted", muted ? "1" : "0"); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ac.currentTime, 0.05);
    syncBtn();
  }

  function voice(freq, at, dur, vol, type, dest) {
    const o = ac.createOscillator(), v = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, at);
    v.gain.setValueAtTime(0.0001, at);
    v.gain.linearRampToValueAtTime(vol, at + Math.min(0.4, dur * 0.25));
    v.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(v); v.connect(dest || lp);
    o.start(at); o.stop(at + dur + 0.05);
  }

  function chord() { return CHORDS[Math.floor(stepN / 16) % CHORDS.length]; }

  // Eighth-note scheduler: pad swell each bar, soft kick on quarters, airy tick when flowing
  function schedule() {
    if (!ac || MUSIC === "off") return;
    const eighth = BEAT / 2;
    while (nextT < ac.currentTime + 0.12) {
      const s = stepN % 8;
      const c = chord();
      if (s === 0) c.pad.forEach((f, i) => { if (i < 3 + Math.round(flow * 2)) voice(f, nextT, BEAT * 4.2, 0.032, "sine"); });
      if (s === 0 || s === 4) voice(c.bass, nextT, BEAT * 0.9, 0.07, "triangle");
      if (MUSIC === "on" && s % 2 === 0) {
        const k = ac.createOscillator(), kv = ac.createGain();
        k.frequency.setValueAtTime(105, nextT);
        k.frequency.exponentialRampToValueAtTime(42, nextT + 0.12);
        kv.gain.setValueAtTime(0.16, nextT);
        kv.gain.exponentialRampToValueAtTime(0.001, nextT + 0.15);
        k.connect(kv); kv.connect(master);
        k.start(nextT); k.stop(nextT + 0.16);
      }
      if (MUSIC === "on" && s % 2 === 1 && flow > 0.55) voice(5200, nextT, 0.03, 0.006, "square", master);
      stepN++;
      nextT += eighth;
    }
    lp.frequency.setTargetAtTime((500 + flow * 2300) * (1 - dip * 0.6), ac.currentTime, 0.15);
  }

  function chime(y) {
    if (!ac || muted || MUSIC === "off") return;
    const eighth = BEAT / 2;
    const at = t0 + Math.ceil((ac.currentTime - t0) / eighth) * eighth; // land on the grid, in key
    const bell = chord().bell;
    const idx = Math.max(0, Math.min(bell.length - 1, Math.floor((1 - y / Math.max(1, H)) * bell.length)));
    voice(bell[idx], at, 0.7, 0.07, "sine", master);
    voice(bell[idx] * 2, at, 0.35, 0.02, "triangle", master);
  }

  // ---- Public API ----------------------------------------------------------------------
  window.Flow = {
    score(n) {
      const prevEra = Math.floor(score / STEP);
      score = Math.max(0, Number(n) || 0);
      if (Math.floor(score / STEP) > prevEra) {
        rings.push({ x: W / 2, y: H / 2, r: 20, max: Math.max(W, H) * 0.7, a: 0.5, big: true });
        flow = Math.min(1, flow + 0.1);
      }
    },
    hit(x, y, quiet) {
      const px = typeof x === "number" ? x : W / 2;
      const py = typeof y === "number" ? y : H / 2;
      flow = Math.min(1, flow + 0.07);
      rings.push({ x: px, y: py, r: 8, max: 70 + flow * 40, a: 0.8 });
      if (!quiet) chime(py);
    },
    miss() {
      flow = Math.max(0.15, flow - 0.18);
      dip = 1;
    },
    reset() {
      score = 0; flow = 0.3; dip = 0; rings = [];
    },
    get level() { return flow; }
  };

  // ---- Frame loop ------------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    schedule();

    flow += (0.3 - flow) * dt * 0.025;
    dip = Math.max(0, dip - dt * 0.8);
    eraPos += (score / STEP - eraPos) * Math.min(1, dt * 0.5);

    const clock = ac ? ac.currentTime - t0 : now / 1000;
    const phase = ((clock / BEAT) % 1 + 1) % 1;
    const pulse = Math.pow(1 - phase, 3);

    const e0 = Math.floor(eraPos), f = eraPos - e0;
    const pa = PALETTES[e0 % PALETTES.length], pb = PALETTES[(e0 + 1) % PALETTES.length];
    const mixHue = (a, b) => a + ((((b - a) % 360) + 540) % 360 - 180) * f;
    const h1 = mixHue(pa[0], pb[0]), h2 = mixHue(pa[1], pb[1]);

    g.clearRect(0, 0, W, H);
    const strength = (0.07 + flow * 0.1 + pulse * 0.035) * (1 - dip * 0.5);
    const t = now / 1000;
    const blobs = [
      [W * (0.25 + 0.1 * Math.sin(t * 0.07)), H * (0.3 + 0.08 * Math.cos(t * 0.05)), h1],
      [W * (0.75 + 0.1 * Math.cos(t * 0.06)), H * (0.72 + 0.08 * Math.sin(t * 0.04)), h2]
    ];
    for (const [bx, by, h] of blobs) {
      const rad = Math.max(W, H) * 0.65;
      const grad = g.createRadialGradient(bx, by, 0, bx, by, rad);
      grad.addColorStop(0, `hsla(${h}, 85%, 60%, ${strength})`);
      grad.addColorStop(1, `hsla(${h}, 85%, 60%, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }
    // Horizon line that breathes with the beat
    const hz = g.createLinearGradient(0, H - 3, 0, H);
    hz.addColorStop(0, `hsla(${h1}, 90%, 70%, 0)`);
    hz.addColorStop(1, `hsla(${h1}, 90%, 70%, ${0.12 + pulse * 0.2})`);
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

// Flow shell: everything a flow-engine game needs that isn't the game itself.
//
// It provides the header (streak, best, state, flow meter, track, voice, pause, mute), the
// start card, the pause card (which doubles as settings on phones), the keys card, the
// standard keys, a phone keyboard for typing games, the canvas with DPR and resizing, the
// frame loop, pause, autopilot labels, tier and lock callouts, phrase celebrations,
// particles and the miss flash. A game supplies its rules and its look:
//
//   FlowShell.mount({
//     key: "myGame", title: "My Game", tagline: "One line.", about: "Two sentences.",
//     input: "tap" | "type",                 // tap: Space/↑/pointer; type: letters
//     engine: { ... },                       // FlowEngine.create options
//     tierNames: [...4], colors: [...4],     // optional
//     onBeat(n, api)    spawn on the beat (api.eng.paceBeats() says how often)
//     onAction(api, e)  a tap (input "tap"): e = { x, y } or {} from a key
//     onLetter(ch, api) a letter (input "type")
//     onKey(key, api)   any other key; return true if used
//     update(dt, api)   move things (api.eng.beatPos() for beat-locked motion)
//     autopilot(dt, api) play yourself while api.eng.auto (nothing scores)
//     draw(ctx, api, t) draw everything except particles and callouts
//   });
//
// api: eng, ctx, W, H, color(), tier, reduced, started, score(n, quality, handleSec),
//      miss(), callout(text, x, y, color, scale), burst(x, y, color, n, dir), cached(key, make)
// Load after flow-engine.js. Design and rules: docs/build-on-the-engine.md.
(() => {
  "use strict";
  if (window.FlowShell) return;

  // Layout only; the look comes from pinball-skin.js (load it before this file)
  const CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: #140f0c; color: #f6e6c0; font-family: Inter, system-ui, sans-serif; }
  #fs-canvas { position: fixed; inset: 0; display: block; width: 100%; height: 100%; touch-action: none; }
  .fs button { font: inherit; }
  .fs-head { position: fixed; top: 0; left: 0; right: 0; z-index: 20; padding: 8px 10px; max-width: 42rem; margin: 0 auto; pointer-events: none; }
  .fs-state { flex: 1; min-width: 0; max-width: 220px; }
  .fs-controls { display: flex; gap: 7px; pointer-events: auto; }
  @media (max-width: 520px) { .fs-voice, .pb-best { display: none; } }
  .fs-over { position: fixed; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; padding: 16px; background: rgba(20,15,12,.72); }
  .fs-over.show { display: flex; }
  .fs-hint { position: fixed; bottom: 26px; left: 0; right: 0; z-index: 10; text-align: center; pointer-events: none; transition: opacity .7s; }
  /* Attract mode: the game plays itself under a marquee until the first input */
  .fs-marquee { position: fixed; left: 0; right: 0; top: 34%; z-index: 15; text-align: center; pointer-events: none; transition: opacity .6s, transform .6s cubic-bezier(.34,1.56,.64,1); }
  .fs-marquee.gone { opacity: 0; transform: translateY(-12px) scale(.96); }
  .fs-marquee-title { font-size: 46px !important; margin: 0 0 12px !important; animation: fs-breathe 2.4s ease-in-out infinite; }
  @keyframes fs-breathe { 50% { transform: scale(1.04); } }
  @media (prefers-reduced-motion: reduce) { .fs-marquee-title { animation: none; } }
  #fs-typer { position: fixed; left: 0; bottom: 0; width: 1px; height: 1px; opacity: 0; border: 0; padding: 0; font-size: 16px; }`;

  const Skin = window.PinballSkin;
  if (!Skin) throw new Error("flow-shell.js needs pinball-skin.js loaded first");
  const DEFAULT_COLORS = Skin.tiers;
  const kbd = (k) => `<span class="pb-kbd">${k}</span>`;

  function mount(g) {
    const typing = g.input === "type";
    const colors = g.colors || DEFAULT_COLORS;
    const tierNames = g.tierNames || ["Finding your rhythm", "Groove", "Deep", "Transcendent"];
    const actionKeys = typing ? [["a–z", "type"]] : [["Space", "play"]];
    const extraKeys = g.keys || [];

    Skin.install();
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    const root = document.createElement("div");
    root.className = "fs";
    root.innerHTML = `
      <canvas id="fs-canvas"></canvas>
      <header class="fs-head"><div class="pb-bar">
        <div><span class="pb-cap">Streak</span><span class="pb-window" data-streak></span><span class="pb-best">best <b data-best>0</b></span></div>
        <div class="fs-state"><span class="pb-label" data-label></span><div class="pb-lights" data-lights></div></div>
        <div class="fs-controls">
          <button class="pb-btn" data-track title="Switch track (Tab)"></button>
          <button class="pb-btn fs-voice" data-voice title="Switch voice (Shift+Tab)"></button>
          <button class="pb-btn pb-icon" data-pause title="Pause (Esc)" aria-label="Pause"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>
          <button class="pb-btn pb-icon" data-mute title="Mute (0)" aria-label="Mute"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.6 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.6l4.7-4.7c.6-.6 1.7-.2 1.7.7v14c0 .9-1.1 1.3-1.7.7z"/><path data-waves d="M15.5 8.5a5 5 0 010 7M18.4 5.6a9 9 0 010 12.8"/><path data-cross d="M17 10l4 4m0-4l-4 4" style="display:none"/></svg></button>
        </div></div></header>
      <div class="fs-hint" data-hint style="opacity:0"><span class="pb-hint" data-hinttext></span></div>
      ${typing ? '<input id="fs-typer" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Type here">' : ""}
      <div class="fs-marquee" data-marquee>
        <div class="pb-title fs-marquee-title">${g.title}</div>
        <span class="pb-hint">${g.hint || (typing ? "Start typing" : "Tap or Space in a steady rhythm")}</span>
      </div>
      <div class="fs-over" data-pausecard><div style="text-align:center">
        <div class="pb-paused">Paused</div>
        <div class="pb-sub">Tap or ${kbd("Esc")} to resume</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="pb-btn" data-ptrack></button><button class="pb-btn" data-pvoice></button>
        </div></div></div>
      <div class="fs-over" data-keyscard><div class="pb-card" style="max-width:20rem;transform:none">
        <div class="pb-kicker">Keys</div>
        <div class="pb-rows">
          ${actionKeys.concat(extraKeys).map(([k, d]) => `<div><span>${d}</span>${kbd(k)}</div>`).join("")}
          <div><span>Pause</span>${kbd("Esc")}</div>
          <div><span>Autopilot</span>${kbd("Enter")}</div>
          <div><span>Track / voice</span><span>${kbd("Tab")} ${kbd("Shift+Tab")}</span></div>
          <div><span>Volume / mute</span><span>${kbd("-")} ${kbd("=")} ${kbd("0")}</span></div>
          <div><span>Audio offset</span><span>${kbd("[")} ${kbd("]")}</span></div>
        </div>
        <div class="pb-note">Stop for a few seconds and it plays itself, without scoring. Any input takes over again, and the next two misses are forgiven.</div>
      </div></div>`;
    document.body.appendChild(root);
    const q = (sel) => root.querySelector(sel);

    const eng = FlowEngine.create(Object.assign({ key: g.key }, g.engine || {}));
    window.flowTelemetry = () => eng.history();
    const canvas = q("#fs-canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const typer = q("#fs-typer");
    const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

    let W = 0, H = 0, started = false, flash = 0, bulbFlash = 0;
    // Frame pacing: a steady 60 fps on average, scheduled by time rather than by counting
    // display ticks. Measured in the pocket app, the browser's ticks weren't tied to any screen
    // (about 180 a second), and a tick-counting cap drew an uneven 48 on a 144 Hz screen; a
    // deadline that advances by exactly 1/60 s keeps the average at 60 whatever the tick rate.
    // Pocket mode (the pocket app, or ?pocket=1) draws at 0.75x resolution, because the
    // browser's raster and compositing, not the game's code (~0.15 ms a frame), costs the most.
    const pocket = /[?&]pocket=1/.test(location.search) || !!window.NL_OS;
    const FRAME_MS = 1000 / 60;
    let due = 0;
    let fpsFrames = 0;
    let fpsWork = 0; // ms spent drawing, to tell slow JS apart from a slow compositor
    let fpsSince = performance.now();
    const particles = [];
    const callouts = [];
    const rings = [];
    const cache = new Map();
    let phrase = 0, phraseClean = true;
    let hintTimer = 0;
    const BEST_KEY = g.key + ".best";
    let best = 0;
    try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) {}

    const api = {
      eng,
      ctx,
      reduced,
      get W() { return W; },
      get H() { return H; },
      get started() { return started; },
      get tier() { return eng.tier; },
      color: () => colors[eng.tier - 1],
      // Things the player did well. quality "PERFECT" | "CLEAN" | "GRAZE" plays a harmony;
      // handleSec feeds the pacer. Ignored during autopilot (the engine enforces it).
      score(n = 1, quality = "CLEAN", handleSec) {
        const prev = eng.tier;
        if (eng.auto || !started) return false;
        eng.score(n, quality, handleSec);
        if (eng.tier > prev && eng.milestones) {
          api.callout(tierNames[eng.tier - 1], W / 2, H * 0.3, api.color(), 1.2);
          bulbFlash = 1.2;
        }
        // Celebrate at phrase boundaries, not every action (research brief)
        if (++phrase >= (g.phrase || 8)) {
          if (phraseClean) {
            eng.chime();
            bulbFlash = 0.8; // the whole bulb row blinks, like a pinball bonus
            api.ring(W / 2, H * 0.45, api.color(), Math.min(W, H) * 0.35);
            if (g.onPhrase) g.onPhrase(api);
          }
          phrase = 0;
          phraseClean = true;
        }
        hud();
        return true;
      },
      // Something got past the player. Steps the streak down by a quarter; never during
      // autopilot, and the two after taking control back are forgiven.
      miss() {
        if (!started) return false;
        const counted = eng.clip();
        if (counted) {
          phraseClean = false;
          if (!reduced) flash = 0.25;
        }
        hud();
        return counted;
      },
      // A tip shown once ever (per id), in context, then never again: discovery over manuals
      hint(id, text) {
        if (!started) return; // never spend a tip on the attract-mode demo
        const key = g.key + ".hint." + id;
        try {
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, "1");
        } catch (e) {}
        q("[data-hinttext]").innerHTML = text;
        q("[data-hint]").style.opacity = "1";
        clearTimeout(hintTimer);
        hintTimer = setTimeout(hideHint, 4500);
      },
      callout(text, x, y, color = "#e2e8f0", scale = 1) {
        callouts.push({ text, x, y, vy: -0.55, a: 1, color, scale });
      },
      // dir -1 floats up, 1 falls with gravity. Sizes vary and fade on a curve, not a line.
      burst(x, y, color, n = 6, dir = -1) {
        if (reduced) n = Math.ceil(n / 2);
        for (let i = 0; i < n && particles.length < 160; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 40 + Math.random() * 90;
          particles.push({ x, y, vx: Math.cos(a) * v, vy: dir > 0 ? 60 + Math.random() * 120 : Math.sin(a) * v - 50, g: dir > 0 ? 260 : 90, a: 1, s: 2 + Math.random() * 2.5, color });
        }
      },
      // An expanding ring of light that eases out: the "perfect" moment, or a phrase bonus
      ring(x, y, color, size = 44) {
        if (rings.length < 12) rings.push({ x, y, color, size, t: 0 });
      },
      // Build a gradient (or anything costly) once per key instead of every frame
      cached(key, make) {
        if (!cache.has(key)) cache.set(key, make());
        return cache.get(key);
      }
    };

    function resize() {
      const vv = window.visualViewport;
      W = window.innerWidth;
      H = vv ? Math.round(vv.height) : window.innerHeight; // stays above a phone keyboard
      const dpr = pocket ? 0.75 : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cache.clear();
      if (g.resize) g.resize(api);
    }

    function start() {
      if (started) return;
      started = true;
      eng.start();
      q("[data-marquee]").classList.add("gone");
      if (g.start) g.start(api);
      hud();
    }
    function hideHint() {
      q("[data-hint]").style.opacity = "0";
    }

    eng.on("beat", (n) => {
      if (!eng.paused && g.onBeat) g.onBeat(n, api); // attract mode spawns too
    });
    eng.on("lock", () => api.callout("In sync", W / 2, H * 0.3, "#ffc400", 1.05));
    eng.on("auto", hud);
    eng.on("manual", hud);
    eng.on("pause", hud);
    // "Claude is done", "Build done": the cue to switch back; the bulbs blink with it
    eng.on("signal", (label) => {
      api.callout(label, W / 2, H * 0.3, "#ffc400", 1.1);
      bulbFlash = 1.6;
      hud();
    });

    function hud() {
      Skin.score(q("[data-streak]"), eng.streak);
      if (eng.ctrl.best > best) {
        best = eng.ctrl.best;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      }
      q("[data-best]").textContent = best;
      Skin.lights(q("[data-lights]"), eng.flowIndex * 100, api.color());
      let label = eng.tier === 1 ? (eng.locked ? "In sync" : tierNames[0]) : tierNames[eng.tier - 1];
      let c = api.color();
      if (eng.paused) [label, c] = ["Paused", "#f6e6c0"];
      else if (eng.auto && started) [label, c] = [g.autoLabel || "Autopilot · " + (typing ? "type" : "tap") + " to take over", "#ffc400"];
      q("[data-label]").textContent = label;
      q("[data-label]").style.color = c;
      q("[data-track]").textContent = q("[data-ptrack]").textContent = eng.trackName;
      q("[data-voice]").textContent = q("[data-pvoice]").textContent = eng.voiceName;
      q("[data-waves]").style.display = eng.muted ? "none" : "";
      q("[data-cross]").style.display = eng.muted ? "" : "none";
    }
    setInterval(() => !eng.paused && hud(), 250);

    function setPaused(on) {
      if (!started) return;
      eng.pause(on);
      q("[data-pausecard]").classList.toggle("show", on);
      hud();
    }
    const keysShown = () => q("[data-keyscard]").classList.contains("show");
    const press = (sel, fn) =>
      q(sel).addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        fn();
        hud();
      });
    const note = (text, color) => api.callout(text, W / 2, 130, color || "#94a3b8", 0.95);
    press("[data-track]", () => note(eng.cycleTrack().toLowerCase(), "#ffc400"));
    press("[data-voice]", () => note(eng.cycleVoice().toLowerCase(), "#ff1f8a"));
    press("[data-ptrack]", () => eng.cycleTrack());
    press("[data-pvoice]", () => eng.cycleVoice());
    press("[data-pause]", () => setPaused(!eng.paused));
    press("[data-mute]", () => eng.toggleMute());
    q("[data-pausecard]").addEventListener("pointerdown", () => setPaused(false));
    q("[data-keyscard]").addEventListener("pointerdown", () => q("[data-keyscard]").classList.remove("show"));

    function action(e) {
      if (!started) start();
      if (eng.paused) return setPaused(false);
      if (g.onAction) g.onAction(api, e || {});
    }
    function letter(ch) {
      if (!started) start();
      if (eng.paused) return;
      if (g.onLetter) g.onLetter(ch, api);
    }

    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (typing) {
        typer.focus();
        if (!started) start();
      } else action({ x: e.clientX, y: e.clientY });
    });

    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (keysShown() && e.key !== "?") {
        q("[data-keyscard]").classList.remove("show");
        if (e.key === "Escape") return;
      }
      if (typing && e.key.length === 1 && /[a-z]/i.test(e.key)) {
        e.preventDefault();
        if (!e.repeat) letter(e.key.toLowerCase());
        return;
      }
      if (!typing && (e.code === "Space" || e.code === "ArrowUp")) {
        e.preventDefault();
        if (!e.repeat) action({});
        return;
      }
      if (e.repeat) return;
      if (e.key === "Escape") setPaused(!eng.paused);
      else if (e.key === "Enter" && started) eng.setAuto(!eng.auto);
      else if (e.key === "Tab") {
        e.preventDefault();
        note((e.shiftKey ? eng.cycleVoice() : eng.cycleTrack()).toLowerCase(), e.shiftKey ? "#ff1f8a" : "#ffc400");
      } else if (e.key === "-") note(`Volume ${Math.round(eng.changeVolume(-0.1) * 100)}%`);
      else if (e.key === "=" || e.key === "+") note(`Volume ${Math.round(eng.changeVolume(0.1) * 100)}%`);
      else if (e.key === "0") eng.toggleMute();
      else if (e.key === "[" || e.key === "]") {
        const ms = eng.adjustOffset(e.key === "[" ? -10 : 10);
        note(`Audio offset ${ms > 0 ? "+" : ""}${ms} ms`);
      } else if (e.key === "?") q("[data-keyscard]").classList.toggle("show");
      else if (g.onKey && !eng.paused && g.onKey(e.key, api)) {
        // A game's own keys (arrows in Rollover) start the game too, like Space or a tap
        e.preventDefault();
        if (!started) start();
      }
      else return;
      hud();
    });
    if (typer) {
      // Phone keyboards deliver text through the input, not reliable keydowns
      typer.addEventListener("input", () => {
        const v = typer.value;
        typer.value = "";
        for (const ch of v.toLowerCase()) if (ch >= "a" && ch <= "z") letter(ch);
      });
      typer.addEventListener("keydown", (e) => {
        if (e.key.length === 1) e.preventDefault(); // the window handler already took it
      });
    }

    let last = performance.now();
    function frame(now) {
      if (now < due - 1) return requestAnimationFrame(frame);
      due = Math.max(due + FRAME_MS, now); // never bank more than one late frame
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      eng.update(dt);
      if (!eng.paused) {
        if ((!started || eng.auto) && g.autopilot) g.autopilot(dt, api); // attract mode or autopilot
        if (g.update) g.update(dt, api);
        flash = Math.max(0, flash - dt * 1.4);
        bulbFlash = Math.max(0, bulbFlash - dt);
        const drag = Math.pow(0.12, dt); // particles slow as they spread, then hang and fade
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.vx *= drag;
          p.vy = p.vy * drag + p.g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.a -= dt * 1.4;
          if (p.a <= 0) particles.splice(i, 1);
        }
        for (let i = rings.length - 1; i >= 0; i--) {
          rings[i].t += dt / 0.45;
          if (rings[i].t >= 1) rings.splice(i, 1);
        }
        for (let i = callouts.length - 1; i >= 0; i--) {
          const c = callouts[i];
          c.y += c.vy * dt * 60;
          c.vy *= Math.pow(0.97, dt * 60);
          c.a -= dt * 0.7;
          if (c.a <= 0) callouts.splice(i, 1);
        }
        const t = now / 1000;
        // Every frame starts fully opaque: a leftover alpha here would paint the background
        // translucently and leave smeared ghosts of earlier frames
        ctx.globalAlpha = 1;
        const workStart = performance.now();
        if (g.draw) g.draw(ctx, api, t);
        // Report the real frame rate to a host page (the pocket app shows it in its strip)
        fpsFrames++;
        fpsWork += performance.now() - workStart;
        if (now - fpsSince > 2000) {
          if (window.parent !== window) {
            window.parent.postMessage({ type: "flow:fps", fps: Math.round((fpsFrames * 1000) / (now - fpsSince)), workMs: +(fpsWork / fpsFrames).toFixed(2), canvas: canvas.width + "x" + canvas.height }, "*");
          }
          fpsFrames = 0;
          fpsWork = 0;
          fpsSince = now;
        }
        for (const p of particles) {
          ctx.globalAlpha = Math.max(0, p.a * p.a);
          ctx.fillStyle = p.color;
          const sz = p.s * (0.5 + 0.5 * p.a);
          ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        }
        for (const r of rings) {
          const e = 1 - Math.pow(1 - r.t, 3); // ease-out cubic
          ctx.globalAlpha = 1 - r.t;
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 4 * (1 - r.t) + 1;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 8 + r.size * e, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const c of callouts) Skin.callout(ctx, c.text, c.x, c.y, c.color, 20 * c.scale, Math.max(0, Math.min(1, (1 - c.a) * 8, c.a)), 1 - c.a);
        // Chaser bulbs along the bottom edge run on the eighth notes and blink on big moments
        if (g.bulbs !== false) Skin.bulbs(ctx, W, H - 9, eng.beatPos(), bulbFlash > 0 && Math.floor(bulbFlash * 10) % 2 === 0 ? 1 : 0);
        if (flash > 0) {
          ctx.fillStyle = `rgba(232, 35, 31, ${flash * 0.16})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    if (window.visualViewport) visualViewport.addEventListener("resize", resize);
    resize();
    if (g.setup) g.setup(api);
    hud();
    requestAnimationFrame(frame);
    return api;
  }

  window.FlowShell = { mount };
})();

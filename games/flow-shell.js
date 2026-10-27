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

  const CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: #050a14; color: #e2e8f0; font-family: Inter, system-ui, sans-serif; }
  #fs-canvas { position: fixed; inset: 0; display: block; width: 100%; height: 100%; touch-action: none; }
  .fs button { font: inherit; color: inherit; cursor: pointer; }
  .fs .kbd { display: inline-block; min-width: 1.6em; padding: 0 .4em; border: 1px solid #334155; border-bottom-width: 2px; border-radius: 5px; color: #e2e8f0; font: 500 10px/1.6 'JetBrains Mono', monospace; text-align: center; }
  .fs-head { position: fixed; top: 0; left: 0; right: 0; z-index: 20; padding: 8px; max-width: 42rem; margin: 0 auto; pointer-events: none; }
  .fs-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: rgba(2,6,23,.9); border: 1px solid rgba(30,41,59,.9); border-radius: 16px; padding: 8px 12px; }
  .fs-streak small { display: block; font-size: 10px; color: #94a3b8; }
  .fs-streak b { font: 700 26px/1 'JetBrains Mono', monospace; color: #34d399; }
  .fs-streak span { font-size: 10px; color: #64748b; margin-left: 6px; }
  .fs-state { flex: 1; min-width: 0; max-width: 220px; }
  .fs-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
  .fs-label { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fs-pct { font: 600 10px 'JetBrains Mono', monospace; color: #6ee7b7; margin-left: 6px; }
  .fs-meter { height: 4px; background: rgba(30,41,59,.8); border-radius: 99px; overflow: hidden; }
  .fs-fill { height: 100%; width: 45%; border-radius: 99px; background: linear-gradient(90deg,#06b6d4,#34d399,#e879f9); transition: width .5s ease-out; }
  .fs-controls { display: flex; gap: 6px; pointer-events: auto; }
  .fs .fs-chip { white-space: nowrap; padding: 6px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: rgba(15,23,42,.9); border: 1px solid rgba(51,65,85,.7); }
  .fs-chip:active { transform: scale(.95); }
  .fs .fs-icon { padding: 6px 8px; display: flex; align-items: center; }
  .fs-icon svg { width: 16px; height: 16px; }
  @media (max-width: 520px) { .fs-voice, .fs-streak span { display: none; } }
  .fs-over { position: fixed; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; padding: 16px; background: rgba(2,6,23,.7); }
  .fs-over.show { display: flex; }
  .fs-card { max-width: 24rem; width: 100%; background: rgba(15,23,42,.96); border: 1px solid #1e293b; border-radius: 24px; padding: 24px; }
  .fs-kicker { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .3em; text-transform: uppercase; color: rgba(103,232,249,.8); }
  .fs-card h1 { margin: 8px 0; font-size: 27px; font-weight: 600; letter-spacing: -.01em; line-height: 1.15; color: #fff; }
  .fs-card p { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: #94a3b8; }
  .fs-keys { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; font-size: 12px; color: #94a3b8; margin-bottom: 18px; }
  .fs .fs-start { width: 100%; padding: 13px; border: 0; border-radius: 16px; font-size: 16px; font-weight: 600; color: #020617; background: linear-gradient(90deg,#34d399,#5eead4,#22d3ee); }
  .fs-or { margin-top: 10px; text-align: center; font-size: 12px; color: #64748b; }
  .fs-rows div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #cbd5e1; margin: 6px 0; }
  .fs-note { margin-top: 10px; font-size: 12px; color: #64748b; }
  .fs-hint { position: fixed; bottom: 14px; left: 0; right: 0; z-index: 10; text-align: center; pointer-events: none; transition: opacity .7s; }
  .fs-hint div { display: inline-block; padding: 6px 14px; border-radius: 99px; font-size: 11px; color: #cbd5e1; background: rgba(2,6,23,.8); border: 1px solid rgba(30,41,59,.9); }
  #fs-typer { position: fixed; left: 0; bottom: 0; width: 1px; height: 1px; opacity: 0; border: 0; padding: 0; font-size: 16px; }`;

  const DEFAULT_COLORS = ["#38bdf8", "#34d399", "#c084fc", "#f472b6"];
  const kbd = (k) => `<span class="kbd">${k}</span>`;

  function mount(g) {
    const typing = g.input === "type";
    const colors = g.colors || DEFAULT_COLORS;
    const tierNames = g.tierNames || ["Finding your rhythm", "Groove", "Deep", "Transcendent"];
    const actionKeys = typing ? [["a–z", "type"]] : [["Space", "play"]];
    const extraKeys = g.keys || [];

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    const root = document.createElement("div");
    root.className = "fs";
    root.innerHTML = `
      <canvas id="fs-canvas"></canvas>
      <header class="fs-head"><div class="fs-bar">
        <div class="fs-streak"><small>Streak</small><b data-streak>0</b><span>best <strong data-best>0</strong></span></div>
        <div class="fs-state"><div class="fs-row"><span class="fs-label" data-label></span><span class="fs-pct" data-pct>45%</span></div><div class="fs-meter"><div class="fs-fill" data-fill></div></div></div>
        <div class="fs-controls">
          <button class="fs-chip" data-track style="color:#67e8f9" title="Switch track (Tab)"></button>
          <button class="fs-chip fs-voice" data-voice style="color:#a5b4fc" title="Switch voice (Shift+Tab)"></button>
          <button class="fs-chip fs-icon" data-pause title="Pause (Esc)" aria-label="Pause"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg></button>
          <button class="fs-chip fs-icon" data-mute title="Mute (0)" aria-label="Mute"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.6 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.6l4.7-4.7c.6-.6 1.7-.2 1.7.7v14c0 .9-1.1 1.3-1.7.7z"/><path data-waves d="M15.5 8.5a5 5 0 010 7M18.4 5.6a9 9 0 010 12.8"/><path data-cross d="M17 10l4 4m0-4l-4 4" style="display:none"/></svg></button>
        </div></div></header>
      <div class="fs-hint" data-hint><div>${g.hint || (typing ? "Start typing" : "Tap or Space in a steady rhythm")} &middot; ${kbd("?")} keys</div></div>
      ${typing ? '<input id="fs-typer" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Type here">' : ""}
      <div class="fs-over show" data-startcard><div class="fs-card">
        <div class="fs-kicker">${g.title}</div>
        <h1>${g.tagline || g.title}</h1>
        <p>${g.about || ""}</p>
        <div class="fs-keys">${actionKeys.concat(extraKeys.slice(0, 1), [["Esc", "pause"], ["Enter", "autopilot"]]).slice(0, 4).map(([k, d]) => `<span>${kbd(k)} ${d}</span>`).join("")}</div>
        <button class="fs-start" data-start>Start</button>
        <div class="fs-or">${typing ? "or just start typing" : "or just tap"}</div>
      </div></div>
      <div class="fs-over" data-pausecard><div style="text-align:center">
        <div style="font-size:24px;font-weight:600;color:#fff">Paused</div>
        <div style="font-size:14px;color:#94a3b8;margin-top:6px">Tap or ${kbd("Esc")} to resume</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
          <button class="fs-chip" data-ptrack style="color:#67e8f9"></button><button class="fs-chip" data-pvoice style="color:#a5b4fc"></button>
        </div></div></div>
      <div class="fs-over" data-keyscard><div class="fs-card" style="max-width:20rem;padding:20px">
        <div style="font-weight:600;color:#fff;margin-bottom:6px">Keys</div>
        <div class="fs-rows">
          ${actionKeys.concat(extraKeys).map(([k, d]) => `<div><span>${d}</span>${kbd(k)}</div>`).join("")}
          <div><span>Pause</span>${kbd("Esc")}</div>
          <div><span>Autopilot</span>${kbd("Enter")}</div>
          <div><span>Track / voice</span><span>${kbd("Tab")} ${kbd("Shift+Tab")}</span></div>
          <div><span>Volume / mute</span><span>${kbd("-")} ${kbd("=")} ${kbd("0")}</span></div>
          <div><span>Audio offset</span><span>${kbd("[")} ${kbd("]")}</span></div>
        </div>
        <div class="fs-note">Stop for a few seconds and it plays itself, without scoring. Any input takes over again, and the next two misses are forgiven.</div>
      </div></div>`;
    document.body.appendChild(root);
    const q = (sel) => root.querySelector(sel);

    const eng = FlowEngine.create(Object.assign({ key: g.key }, g.engine || {}));
    window.flowTelemetry = () => eng.history();
    const canvas = q("#fs-canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const typer = q("#fs-typer");
    const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

    let W = 0, H = 0, started = false, flash = 0;
    const particles = [];
    const callouts = [];
    const cache = new Map();
    let phrase = 0, phraseClean = true;
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
        if (eng.auto) return false;
        eng.score(n, quality, handleSec);
        if (eng.tier > prev && eng.milestones) api.callout(tierNames[eng.tier - 1], W / 2, H * 0.3, api.color(), 1.2);
        // Celebrate at phrase boundaries, not every action (research brief)
        if (++phrase >= (g.phrase || 8)) {
          if (phraseClean) {
            eng.chime();
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
        const counted = eng.clip();
        if (counted) {
          phraseClean = false;
          if (!reduced) flash = 0.25;
        }
        hud();
        return counted;
      },
      callout(text, x, y, color = "#e2e8f0", scale = 1) {
        callouts.push({ text, x, y, vy: -0.55, a: 1, color, scale });
      },
      // dir -1 floats up, 1 falls with gravity
      burst(x, y, color, n = 6, dir = -1) {
        if (reduced) n = Math.ceil(n / 2);
        for (let i = 0; i < n && particles.length < 160; i++) {
          particles.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: dir > 0 ? 60 + Math.random() * 120 : -40 - Math.random() * 70, g: dir > 0 ? 260 : 60, a: 1, color });
        }
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      q("[data-startcard]").classList.remove("show");
      if (g.start) g.start(api);
      hud();
    }
    function hideHint() {
      q("[data-hint]").style.opacity = "0";
    }

    eng.on("beat", (n) => {
      if (started && !eng.paused && g.onBeat) g.onBeat(n, api);
    });
    eng.on("lock", () => api.callout("In sync", W / 2, H * 0.3, "#5eead4", 1.05));
    eng.on("auto", hud);
    eng.on("manual", hud);
    eng.on("pause", (why) => {
      if (why === "build-done") api.callout("Build done", W / 2, H * 0.3, "#e2e8f0", 1.1);
      hud();
    });

    function hud() {
      q("[data-streak]").textContent = eng.streak;
      if (eng.ctrl.best > best) {
        best = eng.ctrl.best;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      }
      q("[data-best]").textContent = best;
      const pct = Math.round(eng.flowIndex * 100);
      q("[data-pct]").textContent = pct + "%";
      q("[data-fill]").style.width = pct + "%";
      let label = eng.tier === 1 ? (eng.locked ? "In sync" : tierNames[0]) : tierNames[eng.tier - 1];
      let c = api.color();
      if (eng.paused) [label, c] = ["Paused", "#94a3b8"];
      else if (eng.auto && started) [label, c] = [g.autoLabel || "Autopilot · " + (typing ? "type" : "tap") + " to take over", "#fcd34d"];
      q("[data-label]").textContent = label;
      q("[data-label]").style.color = c;
      q("[data-track]").textContent = q("[data-ptrack]").textContent = eng.trackName.toLowerCase();
      q("[data-voice]").textContent = q("[data-pvoice]").textContent = eng.voiceName.toLowerCase();
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
    press("[data-track]", () => note(eng.cycleTrack().toLowerCase(), "#67e8f9"));
    press("[data-voice]", () => note(eng.cycleVoice().toLowerCase(), "#a5b4fc"));
    press("[data-ptrack]", () => eng.cycleTrack());
    press("[data-pvoice]", () => eng.cycleVoice());
    press("[data-pause]", () => setPaused(!eng.paused));
    press("[data-mute]", () => eng.toggleMute());
    press("[data-start]", () => {
      start();
      if (typer) typer.focus();
    });
    q("[data-pausecard]").addEventListener("pointerdown", () => setPaused(false));
    q("[data-keyscard]").addEventListener("pointerdown", () => q("[data-keyscard]").classList.remove("show"));
    q("[data-startcard]").addEventListener("pointerdown", (e) => {
      if (e.target !== q("[data-startcard]")) return;
      start();
      if (typer) typer.focus();
    });

    function action(e) {
      if (!started) start();
      if (eng.paused) return setPaused(false);
      hideHint();
      if (g.onAction) g.onAction(api, e || {});
    }
    function letter(ch) {
      if (!started) start();
      if (eng.paused) return;
      hideHint();
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
        note((e.shiftKey ? eng.cycleVoice() : eng.cycleTrack()).toLowerCase(), e.shiftKey ? "#a5b4fc" : "#67e8f9");
      } else if (e.key === "-") note(`Volume ${Math.round(eng.changeVolume(-0.1) * 100)}%`);
      else if (e.key === "=" || e.key === "+") note(`Volume ${Math.round(eng.changeVolume(0.1) * 100)}%`);
      else if (e.key === "0") eng.toggleMute();
      else if (e.key === "[" || e.key === "]") {
        const ms = eng.adjustOffset(e.key === "[" ? -10 : 10);
        note(`Audio offset ${ms > 0 ? "+" : ""}${ms} ms`);
      } else if (e.key === "?") q("[data-keyscard]").classList.toggle("show");
      else if (g.onKey && started && !eng.paused && g.onKey(e.key, api)) e.preventDefault();
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
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      eng.update(dt);
      if (!eng.paused) {
        if (started && eng.auto && g.autopilot) g.autopilot(dt, api);
        if (g.update) g.update(dt, api);
        flash = Math.max(0, flash - dt * 1.4);
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += p.g * dt;
          p.a -= dt * 1.6;
          if (p.a <= 0) particles.splice(i, 1);
        }
        for (let i = callouts.length - 1; i >= 0; i--) {
          const c = callouts[i];
          c.y += c.vy * dt * 60;
          c.vy *= Math.pow(0.97, dt * 60);
          c.a -= dt * 0.7;
          if (c.a <= 0) callouts.splice(i, 1);
        }
        const t = now / 1000;
        if (g.draw) g.draw(ctx, api, t);
        for (const p of particles) {
          ctx.globalAlpha = Math.max(0, p.a);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        }
        ctx.textAlign = "center";
        for (const c of callouts) {
          ctx.font = `600 ${Math.round(15 * c.scale)}px Inter, sans-serif`;
          ctx.globalAlpha = Math.max(0, Math.min(1, (1 - c.a) * 8, c.a));
          ctx.fillStyle = c.color;
          ctx.fillText(c.text, c.x, c.y);
        }
        ctx.globalAlpha = 1;
        if (flash > 0) {
          ctx.fillStyle = `rgba(56, 189, 248, ${flash * 0.18})`;
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

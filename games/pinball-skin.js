// Pinball skin: the shared look for Flow // Resonance and every game on the flow shell.
// A real machine's parts, drawn clean: a black backbox with an orange 7-segment score,
// insert lights for the flow meter, quiet glass buttons, a sunburst backglass for the start
// screen, condensed Oswald type, and a row of chaser bulbs that runs on the beat.
// No thick black outlines, hard offset shadows or script lettering: those read as clip art.
// Depth comes from soft shadows, subtle gradients and specular highlights, all baked once into
// small offscreen sprites, so a frame only stamps images (no per-frame gradients or blur).
//
// PinballSkin.install(options)             fonts + CSS (once); { vignette: false } skips the DOM vignette
// PinballSkin.score(el, n, digits)         7-segment number into el
// PinballSkin.lights(el, pct, color)       10 insert lights into el
// PinballSkin.bulbs(ctx, W, y, beatPos, flash)   chaser bulbs along y
// PinballSkin.callout(ctx, text, x, y, color, size, alpha, age)
// PinballSkin.layer(ctx, key, W, H, paint)  a full-size static layer, painted once per key and size
// PinballSkin.sprite(ctx, key, w, h, ox, oy, paint) + draw(ctx, s, x, y, k)  a cached sprite
// PinballSkin.playfield(g, W, H, tier)      paint the playfield into g (inside a layer's paint)
// PinballSkin.bumper(ctx, x, y, r, cap, pop)   a pop bumper (cap: the centre light's colour)
// PinballSkin.ball(ctx, x, y, r, stops, sx, sy) the ball with its contact shadow
// PinballSkin.streak(ctx, trail, r)        a ball's motion streak along [[x, y], ...]
// PinballSkin.insert(ctx, x, y, size, color, lit, angle)  an arrow insert, lit 0..1
// PinballSkin.column(ctx, key, x, period, scroll, H, w, paint)  scrolling parts as one baked tile
// PinballSkin.post(ctx, x, y, r)            a rubber post
// PinballSkin.glow(ctx, x, y, r, color, a)  a soft halo of light
// PinballSkin.star(ctx, x, y, r)            a gold star insert
(() => {
  "use strict";
  if (window.PinballSkin) return;

  const C = {
    black: "#140f0c",
    cream: "#f6e6c0",
    red: "#e8231f",
    orange: "#ff7a00",
    yellow: "#ffc400",
    segOn: "#ff6a00",
    segOff: "#2a1208"
  };
  // Playfield insert colours by tier
  const TIERS = ["#2f6bff", "#1fbf55", "#ff1f8a", "#ff7a00"];

  const CSS = `
  .pb-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: linear-gradient(#221a15, #120d0a); border: 0; box-shadow: 0 0 0 1px rgba(246,230,192,.07), 0 1px 0 rgba(255,255,255,.05) inset, 0 10px 28px rgba(0,0,0,.45); border-radius: 14px; padding: 6px 7px 6px 8px; }
  .pb-cap { display: block; font: 500 9px/1 Oswald, Impact, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: ${C.cream}; opacity: .5; margin-bottom: 3px; }
  .pb-window { display: inline-flex; align-items: center; background: #050302; border-radius: 7px; padding: 4px 6px; line-height: 0; box-shadow: 0 1px 2px rgba(0,0,0,.6) inset, 0 0 0 1px rgba(255,255,255,.04); }
  .pb-best { font: 500 10px Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: ${C.cream}; opacity: .45; margin-left: 8px; }
  .pb-label { display: block; font: 500 11px/1.15 Oswald, Impact, sans-serif !important; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pb-lights { display: flex; gap: 3px; margin-top: 5px; }
  .pb-lights i { position: relative; flex: 1; max-width: 11px; aspect-ratio: 1; border-radius: 50%; background: #241812; box-shadow: 0 1px 1px rgba(0,0,0,.5) inset; }
  /* Incandescent: the lit layer snaps on fast and fades off slowly, like a real bulb's filament */
  .pb-lights i::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, transparent 50%, rgba(0,0,0,.28) 100%), radial-gradient(circle at 38% 32%, #fff 0 12%, var(--c, #ffc400) 45%); opacity: 0; transition: opacity .45s cubic-bezier(.2,.7,.3,1); }
  .pb-lights i.on::after { opacity: 1; transition: opacity .06s linear; }
  .pb-btn { white-space: nowrap; font: 600 11px/1 Oswald, Impact, sans-serif !important; letter-spacing: .1em; text-transform: uppercase; color: ${C.black} !important; background: ${C.cream} !important; border: 0 !important; border-radius: 8px !important; box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 2px 6px rgba(0,0,0,.3); padding: 6px 9px !important; cursor: pointer; }
  .pb-btn { transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease, background-color .2s, color .2s; }
  .pb-btn:hover { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 10px rgba(0,0,0,.35); }
  .pb-btn:active { transform: translateY(1px) scale(.98); box-shadow: 0 1px 2px rgba(0,0,0,.4); transition-duration: .05s; }
  .pb-btn svg { width: 15px; height: 15px; color: currentColor; }
  .pb-icon { display: flex; align-items: center; padding: 5px 7px !important; }
  /* In the header the buttons are quiet glass: cream type on a faint fill, so the playfield stays the star */
  .pb-bar .pb-btn { color: ${C.cream} !important; background: rgba(246,230,192,.08) !important; box-shadow: 0 0 0 1px rgba(246,230,192,.08) inset; font-weight: 500 !important; padding: 6px 8px !important; }
  .pb-bar .pb-btn:hover { background: rgba(246,230,192,.15) !important; box-shadow: 0 0 0 1px rgba(246,230,192,.12) inset; }
  .pb-bar .pb-btn.on { color: ${C.black} !important; background: ${C.yellow} !important; box-shadow: 0 2px 8px rgba(255,196,0,.25); font-weight: 600 !important; }
  .pb-bar .pb-icon { padding: 5px 6px !important; }
  .pb-badge { display: inline-block; font: 600 9px/1 Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: 2px 4px; border-radius: 4px; background: rgba(246,230,192,.1); color: ${C.cream}; opacity: .75; vertical-align: 1px; }
  .pb-badge.ready { background: ${C.yellow}; color: ${C.black}; opacity: 1; }
  .pb-backglass { overflow: hidden; background: ${C.red} !important; }
  /* The sunburst stays still: turning it cost ~10 fps in the pocket app on a busy GPU's screen */
  .pb-backglass::before { content: ""; position: absolute; left: 50%; top: 45%; width: 260vmax; height: 260vmax; margin: -130vmax 0 0 -130vmax; background: repeating-conic-gradient(from 0deg, ${C.red} 0 10deg, #f0401c 10deg 20deg); }
  .pb-backglass::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 50% 45%, transparent 0 35%, rgba(20,15,12,.55) 75%); }
  .pb-backglass > * { position: relative; z-index: 1; }
  @media (prefers-reduced-motion: reduce) { .pb-card, .pb-paused { animation: none; } }
  .pb-card { max-width: 24rem; width: 100%; background: linear-gradient(#fbf0d6, ${C.cream}); color: #3a2a1c; border: 0; border-radius: 18px; box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 24px 60px rgba(0,0,0,.55); padding: 22px 22px 18px; animation: pb-pop .45s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes pb-pop { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
  .pb-paused { animation: pb-drop .45s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes pb-drop { from { opacity: 0; transform: translateY(-14px) scale(.94); } to { opacity: 1; transform: none; } }
  /* The 7-segment window brightens for a moment when the number changes */
  .pb-window svg { transition: filter .35s ease-out, transform .35s cubic-bezier(.34,1.56,.64,1); }
  .pb-window.bump svg { filter: brightness(1.6); transform: scale(1.05); transition-duration: .04s; }
  /* A static vignette over the playfield: one layer, never redrawn, so it costs nothing a frame */
  .pb-vignette { position: fixed; inset: 0; z-index: 5; pointer-events: none; background: radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(10,6,4,.3) 100%); }
  .pb-kicker { font: 600 11px Oswald, Impact, sans-serif; letter-spacing: .3em; text-transform: uppercase; color: ${C.red}; }
  .pb-title { margin: 6px 0 10px; font: 600 38px/1 Oswald, Impact, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: ${C.cream}; text-shadow: 0 2px 18px rgba(0,0,0,.5); }
  .pb-card .pb-title { color: ${C.red}; text-shadow: none; }
  .pb-card p { margin: 0 0 14px; font: 400 14px/1.5 Inter, system-ui, sans-serif; color: #3a2a1c; }
  .pb-keys { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font: 500 12px Oswald, Impact, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #3a2a1c; margin-bottom: 16px; }
  .pb-kbd { display: inline-block; min-width: 1.7em; padding: 0 .4em; background: #fffaf0; border: 0; border-radius: 5px; box-shadow: 0 0 0 1px rgba(20,15,12,.16), 0 1px 0 rgba(20,15,12,.2); color: ${C.black}; font: 600 10px/1.6 Oswald, Impact, sans-serif; letter-spacing: .04em; text-align: center; text-transform: none; }
  .pb-start { width: 100%; padding: 12px; font: 600 20px/1 Oswald, Impact, sans-serif !important; letter-spacing: .16em; text-transform: uppercase; color: #fff !important; background: linear-gradient(#f0332d, ${C.red}) !important; border: 0 !important; border-radius: 12px !important; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 6px 16px rgba(232,35,31,.3); cursor: pointer; }
  .pb-start { transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease; }
  .pb-start:hover { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 8px 22px rgba(232,35,31,.4); }
  .pb-start:active { transform: translateY(1px) scale(.99); box-shadow: 0 2px 6px rgba(232,35,31,.35); transition-duration: .05s; }
  .pb-or { margin-top: 10px; text-align: center; font: 500 11px Oswald, Impact, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #7a5a3c; }
  .pb-paused { font: 600 40px/1 Oswald, Impact, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: ${C.cream}; text-shadow: 0 2px 20px rgba(0,0,0,.5); }
  .pb-sub { margin-top: 10px; font: 500 12px Oswald, Impact, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: ${C.cream}; opacity: .7; }
  .pb-rows div { display: flex; justify-content: space-between; gap: 12px; margin: 7px 0; font: 500 12px Oswald, Impact, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #3a2a1c; }
  .pb-note { margin-top: 10px; font: 400 12px/1.45 Inter, system-ui, sans-serif; color: #6b4c30; }
  @media (max-width: 520px) { .pb-bar { gap: 7px; padding: 5px 6px; } .pb-window { padding: 3px 5px; } .pb-window svg { width: auto; height: 17px; } .pb-lights { gap: 2px; } .pb-btn { padding: 5px 7px !important; } .pb-bar .pb-btn { padding: 5px 6px !important; font-size: 10px !important; } .pb-cap .pb-badge { display: none; } }
  @media (max-width: 360px) { .pb-label { letter-spacing: .03em; } .pb-window svg { height: 15px; } }
  /* Tips and the attract line: a dark glass pill with cream type, quiet over any playfield */
  .pb-hint { display: inline-block; max-width: calc(100vw - 32px); padding: 6px 12px; background: rgba(14,10,8,.78); color: ${C.cream}; border-radius: 999px; box-shadow: 0 0 0 1px rgba(246,230,192,.12) inset, 0 6px 18px rgba(0,0,0,.35); font: 500 11px/1.3 Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  .pb-hint .pb-kbd { background: rgba(246,230,192,.14); color: ${C.cream}; box-shadow: none; }`;

  function install(options) {
    if (document.getElementById("pb-style")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = "pb-style";
    style.textContent = CSS;
    document.head.appendChild(style);
    if (options && options.vignette === false) return; // a launcher, or a game that bakes its own
    const vignette = document.createElement("div");
    vignette.className = "pb-vignette";
    (document.body || document.documentElement).appendChild(vignette);
  }

  // 7-segment digits (with the faint unlit segments real displays show), slightly italic
  const SEGS = { a: [2, 0, 8, 2], b: [10, 2, 2, 8], c: [10, 12, 2, 8], d: [2, 20, 8, 2], e: [0, 12, 2, 8], f: [0, 2, 2, 8], g: [2, 10, 8, 2] };
  const DIGITS = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"];
  function digitSvg(ch, x) {
    const on = ch === " " ? "" : DIGITS[+ch];
    return Object.entries(SEGS)
      .map(([k, [sx, sy, w, h]]) => `<rect x="${x + sx}" y="${sy}" width="${w}" height="${h}" rx="1" fill="${on.includes(k) ? C.segOn : C.segOff}"/>`)
      .join("");
  }
  function score(el, n, digits = 4) {
    const str = String(Math.max(0, Math.floor(n))).slice(-digits).padStart(digits, " ");
    if (el.dataset.pb === str) return;
    const rising = el.dataset.pb !== undefined && +str > +el.dataset.pb;
    el.dataset.pb = str;
    if (rising) {
      el.classList.add("bump");
      clearTimeout(el._bump);
      el._bump = setTimeout(() => el.classList.remove("bump"), 90);
    }
    const w = digits * 15;
    el.innerHTML = `<svg width="${w * 1.05}" height="22" viewBox="0 0 ${w} 22" aria-label="${n}"><g transform="skewX(-8) translate(3 0)">${[...str].map((ch, i) => digitSvg(ch, i * 15)).join("")}</g></svg>`;
  }

  // Ten playfield inserts; lit ones get a hard white highlight, not a glow
  function lights(el, pct, color) {
    if (!el.children.length) el.innerHTML = "<i></i>".repeat(10);
    const lit = Math.round(Math.max(0, Math.min(100, pct)) / 10);
    const key = lit + color;
    if (el.dataset.pb === key) return;
    el.dataset.pb = key;
    [...el.children].forEach((b, i) => {
      b.style.setProperty("--c", color);
      b.classList.toggle("on", i < lit);
    });
  }

  // ---- Sprites: everything with depth is painted once into a small offscreen canvas at the ----
  // canvas's device scale, then stamped with drawImage each frame
  const sprites = new Map();
  const layers = new Map();
  const TAU = Math.PI * 2;
  // The context's device scale, read once per canvas size (getTransform allocates, so not per call)
  function scaleOf(ctx) {
    if (ctx._pbW !== ctx.canvas.width) {
      ctx._pbW = ctx.canvas.width;
      ctx._pbA = ctx.getTransform().a;
    }
    return ctx._pbA;
  }
  const devScale = (ctx) => Math.max(1, Math.min(2, Math.ceil(scaleOf(ctx) * 2) / 2));
  function canvasOf(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  // A sprite w x h (CSS px) whose anchor sits at (ox, oy); paint(g) draws around the anchor
  function sprite(ctx, key, w, h, ox, oy, paint) {
    const S = devScale(ctx);
    const k = key + "@" + S;
    let s = sprites.get(k);
    if (!s) {
      if (sprites.size > 240) sprites.clear();
      const c = canvasOf(w * S, h * S);
      const g = c.getContext("2d");
      g.scale(S, S);
      g.translate(ox, oy);
      paint(g);
      s = { c, w, h, ox, oy };
      sprites.set(k, s);
    }
    return s;
  }
  const draw = (ctx, s, x, y, k = 1) => ctx.drawImage(s.c, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
  // A full-size static layer (the table art), painted once per key and size, stamped at 0,0
  function layer(ctx, key, W, H, paint) {
    const S = scaleOf(ctx);
    const k = key + "|" + W + "x" + H + "@" + S;
    let c = layers.get(k);
    if (!c) {
      if (layers.size >= 6) layers.delete(layers.keys().next().value);
      c = canvasOf(W * S, H * S);
      const g = c.getContext("2d", { alpha: false });
      g.scale(S, S);
      paint(g);
      layers.set(k, c);
    }
    ctx.drawImage(c, 0, 0, W, H);
  }

  // Colour mixing for the baked shading: mix("#e8231f", "#ffffff", 0.4)
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
  }
  const rgba = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;
  function radial(g, x, y, r0, r1, stops) {
    const gr = g.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  function disc(g, x, y, r, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  // The playfield: deep painted wood under a clear coat, tinted by tier, lit from below by the
  // GI lamps around the flippers, with a faint sheen off the glass and darker edges
  const FIELD = [["#090d1c", "#16234d"], ["#07120d", "#123826"], ["#140913", "#3c1433"], ["#150b06", "#43220d"]];
  function playfield(g, W, H, tier = 1) {
    const [top, bottom] = FIELD[(tier - 1) % 4];
    const lin = g.createLinearGradient(0, 0, 0, H);
    lin.addColorStop(0, top);
    lin.addColorStop(1, bottom);
    g.fillStyle = lin;
    g.fillRect(0, 0, W, H);
    g.fillStyle = radial(g, W / 2, H * 0.86, 0, Math.max(W, H) * 0.65, [[0, "rgba(255,214,150,0.12)"], [1, "rgba(255,214,150,0)"]]);
    g.fillRect(0, 0, W, H);
    const sheen = g.createLinearGradient(0, 0, W, H * 0.5);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.42, "rgba(255,255,255,0.035)");
    sheen.addColorStop(0.6, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H * 0.48);
    g.scale(1, H / W);
    g.fillStyle = radial(g, 0, 0, W * 0.32, W * 0.78, [[0, "rgba(6,4,3,0)"], [1, "rgba(6,4,3,0.5)"]]);
    g.fillRect(-W, -W, W * 2, W * 2);
    g.restore();
  }

  // A soft round halo of light for lit bulbs, caps and inserts (stamped, never blurred)
  function glow(ctx, x, y, r, color, a = 1) {
    if (a <= 0.01) return;
    const s = sprite(ctx, "glow" + color, 64, 64, 32, 32, (g) => disc(g, 0, 0, 32, radial(g, 0, 0, 0, 32, [[0, rgba(color, 0.55)], [0.35, rgba(color, 0.22)], [1, rgba(color, 0)]])));
    ctx.globalAlpha = a;
    draw(ctx, s, x, y, r / 32);
    ctx.globalAlpha = 1;
  }

  // A row of chaser bulbs: every third bulb lit, stepping each eighth note; all lit while flash > 0
  const BULBS = ["#ffd23f", "#ff4a1c", "#fff3c4"];
  const filament = [];
  let lastBulbs = 0;
  function bulbs(ctx, W, y, beatPos, flash) {
    const step = Math.floor(beatPos * 2);
    const now = performance.now();
    const dt = Math.min(0.1, (now - (lastBulbs || now)) / 1000);
    lastBulbs = now;
    const decay = Math.pow(0.004, dt); // falls to ~0.4% in a second: a warm tail, not a blink
    // The row: a black bezel with a hairline catching the light along its top edge, and the
    // dark sockets, baked as one strip; a lit bulb is one stamp (its halo baked in)
    const row = sprite(ctx, "bulbrow" + W, W, 18, 0, 9, (g) => {
      const lin = g.createLinearGradient(0, -9, 0, 9);
      lin.addColorStop(0, "#2a211b");
      lin.addColorStop(0.12, "#0d0907");
      lin.addColorStop(1, "#050302");
      g.fillStyle = lin;
      g.fillRect(0, -9, W, 18);
      g.fillStyle = "rgba(246,230,192,0.16)";
      g.fillRect(0, -9, W, 1);
      for (let x = 11; x < W; x += 22) {
        disc(g, x, 0, 4.5, radial(g, x - 1, -1.5, 0, 5, [[0, "#3b2a20"], [1, "#160e0a"]]));
        g.strokeStyle = "rgba(255,255,255,0.07)";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, 0, 4, Math.PI * 1.05, Math.PI * 1.7);
        g.stroke();
      }
    });
    draw(ctx, row, 0, y);
    for (let i = 0, x = 11; x < W; i++, x += 22) {
      const on = flash > 0 || (i + step) % 3 === 0;
      filament[i] = on ? 1 : (filament[i] || 0) * decay;
      if (filament[i] < 0.03) continue;
      const color = BULBS[Math.floor(i / 3) % 3]; // colours rotate along the row
      const lit = sprite(ctx, "bulb" + color, 28, 28, 14, 14, (g) => {
        disc(g, 0, 0, 13, radial(g, 0, 0, 0, 13, [[0, rgba(color, 0.4)], [0.35, rgba(color, 0.15)], [1, rgba(color, 0)]]));
        disc(g, 0, 0, 4.5, radial(g, -1.2, -1.5, 0, 5, [[0, "#fffdf2"], [0.35, mix(color, "#ffffff", 0.35)], [1, mix(color, "#000000", 0.25)]]));
      });
      ctx.globalAlpha = filament[i];
      draw(ctx, lit, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // Clean condensed lettering with a soft dark halo for legibility (not an offset shadow),
  // popping in with a little overshoot
  const lifted = new Map();
  const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
  function callout(ctx, text, x, y, color, size = 22, alpha = 1, age) {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (age !== undefined) {
      const k = 0.7 + 0.3 * easeOutBack(Math.min(1, age / 0.2));
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.translate(-x, -y);
    }
    const px = Math.round(size * 0.9);
    ctx.font = `600 ${px}px Oswald, Impact, sans-serif`;
    ctx.textAlign = "center";
    if ("letterSpacing" in ctx) ctx.letterSpacing = Math.round(px * 0.08) + "px";
    const label = String(text).toUpperCase();
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8,5,4,0.4)";
    ctx.lineWidth = Math.max(3, px * 0.22);
    ctx.strokeText(label, x, y);
    // Lifted a little toward white, so a tier colour still reads on its own tinted playfield
    let fill = lifted.get(color);
    if (!fill) lifted.set(color, (fill = /^#[0-9a-f]{6}$/i.test(color) ? mix(color, "#ffffff", 0.3) : color));
    ctx.fillStyle = fill;
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  // A pop bumper seen from above: a soft shadow, a chrome skirt, the cream body, a red rubber
  // ring and a cap light in the middle with a glint. Baked once per size and cap colour.
  function bumper(ctx, x, y, r, cap, pop = 0) {
    const k = 1 + pop * 0.16;
    const R = Math.round(r);
    const pad = Math.ceil(R * 1.55);
    const s = sprite(ctx, "bump" + R + cap, pad * 2, pad * 2, pad, pad, (g) => {
      disc(g, R * 0.1, R * 0.28, R * 1.42, radial(g, R * 0.1, R * 0.28, R * 0.6, R * 1.42, [[0, "rgba(0,0,0,0.5)"], [1, "rgba(0,0,0,0)"]]));
      const skirt = g.createLinearGradient(0, -R, 0, R);
      skirt.addColorStop(0, "#f4efe6");
      skirt.addColorStop(0.5, "#9d958b");
      skirt.addColorStop(1, "#4a443e");
      disc(g, 0, 0, R, skirt);
      disc(g, 0, 0, R * 0.9, radial(g, -R * 0.3, -R * 0.35, 0, R * 1.1, [[0, "#fffaf0"], [0.6, C.cream], [1, "#d9bf8c"]]));
      g.lineWidth = R * 0.2;
      g.strokeStyle = radial(g, -R * 0.25, -R * 0.3, 0, R, [[0, "#ff5a48"], [0.7, C.red], [1, "#a8150f"]]);
      g.beginPath();
      g.arc(0, 0, R * 0.63, 0, TAU);
      g.stroke();
      disc(g, 0, 0, R * 0.38, radial(g, -R * 0.1, -R * 0.12, 0, R * 0.4, [[0, mix(cap, "#ffffff", 0.55)], [0.55, cap], [1, mix(cap, "#000000", 0.35)]]));
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.beginPath();
      g.ellipse(-R * 0.13, -R * 0.17, R * 0.12, R * 0.07, -0.6, 0, TAU);
      g.fill();
    });
    if (pop > 0) glow(ctx, x, y, r * 2.2 * k, cap, pop * 0.6);
    draw(ctx, s, x, y, k);
  }

  // The ball: a contact shadow, a body graded by its finish, a dark band reflecting the playfield
  // and a sharp glint reflecting the glass. stops: [highlight, mid, edge] from the lifetime rank.
  function ball(ctx, x, y, r, stops, sx = 1, sy = 1) {
    const pad = Math.ceil(r * 1.7);
    const s = sprite(ctx, "ball" + r + stops.join(""), pad * 2, pad * 2, pad, pad, (g) => {
      disc(g, r * 0.25, r * 0.55, r * 1.3, radial(g, r * 0.25, r * 0.55, r * 0.3, r * 1.3, [[0, "rgba(0,0,0,0.5)"], [1, "rgba(0,0,0,0)"]]));
      disc(g, 0, 0, r, radial(g, -r * 0.35, -r * 0.4, r * 0.05, r * 1.35, [[0, stops[0]], [0.45, stops[1]], [1, stops[2]]]));
      g.save();
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.clip();
      const band = g.createLinearGradient(0, -r, 0, r);
      band.addColorStop(0, "rgba(255,255,255,0.18)");
      band.addColorStop(0.42, "rgba(255,255,255,0)");
      band.addColorStop(0.55, "rgba(0,0,0,0.22)");
      band.addColorStop(0.8, "rgba(0,0,0,0.05)");
      band.addColorStop(1, "rgba(255,240,210,0.22)"); // bounce light off the cream parts
      g.fillStyle = band;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      g.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.15, -0.6, 0, TAU);
      g.fill();
      disc(g, r * 0.38, r * 0.5, r * 0.08, "rgba(255,255,255,0.45)");
    });
    if (sx === 1 && sy === 1) return draw(ctx, s, x, y);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    draw(ctx, s, 0, 0);
    ctx.restore();
  }

  // An arrow insert set into the playfield: translucent plastic with a hairline rim when dark,
  // a hot centre and a halo when lit. lit 0..1 crossfades; angle turns it (0 points up).
  const INS = 16;
  function insertShape(g) {
    g.beginPath();
    g.moveTo(0, -INS);
    g.lineTo(INS * 0.92, INS * 0.62);
    g.quadraticCurveTo(0, INS * 0.2, -INS * 0.92, INS * 0.62);
    g.closePath();
  }
  function insert(ctx, x, y, size, color, lit = 0, angle = 0) {
    size = Math.round(size);
    const k = size / INS;
    const dark = lit < 0.6 && sprite(ctx, "insD" + color + size, size * 2.5, size * 2.5, size * 1.25, size * 1.25, (g) => {
      g.scale(k, k);
      insertShape(g);
      g.fillStyle = rgba(color, 0.16);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.09)";
      g.lineWidth = 1 / k;
      g.stroke();
    });
    const on = lit > 0.01 && sprite(ctx, "insL" + color + size, size * 4.4, size * 4.4, size * 2.2, size * 2.2, (g) => {
      disc(g, 0, 0, size * 2.2, radial(g, 0, 0, 0, size * 2.2, [[0, rgba(color, 0.33)], [0.35, rgba(color, 0.13)], [1, rgba(color, 0)]]));
      g.scale(k, k);
      insertShape(g);
      g.fillStyle = radial(g, 0, 0, 0, INS * 1.1, [[0, mix(color, "#ffffff", 0.7)], [0.45, color], [1, mix(color, "#000000", 0.2)]]);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 1 / k;
      g.stroke();
    });
    if (angle) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      x = y = 0;
    }
    if (dark) draw(ctx, dark, x, y);
    if (on) {
      ctx.globalAlpha = lit;
      draw(ctx, on, x, y);
      ctx.globalAlpha = 1;
    }
    if (angle) ctx.restore();
  }

  // A ball's motion streak: a soft smear of light along its last few positions, tapering in
  // three nested strokes (each one path, so the strokes never band where segments overlap)
  function streak(ctx, trail, r) {
    if (trail.length < 3) return;
    // Keep it short however fast the ball goes: a smear, never a beam
    let len = 1;
    for (let d = 0; len < trail.length && d < r * 5; len++) d += Math.hypot(trail[len][0] - trail[len - 1][0], trail[len][1] - trail[len - 1][1]);
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = C.cream;
    for (const [n, w, a] of [[len, 0.5, 0.1], [Math.ceil(len * 0.7), 1.1, 0.1], [Math.ceil(len * 0.45), 1.7, 0.08]]) {
      ctx.globalAlpha = a;
      ctx.lineWidth = r * w;
      ctx.beginPath();
      ctx.moveTo(trail[0][0], trail[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(trail[i][0], trail[i][1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }

  // A column of parts scrolling with the table (inserts, rail posts), baked as one tile of one
  // period and stamped down the screen: paint(g) draws within x -w/2..w/2, y 0..period, and a
  // part at tile y c sits at table y (k * period + c) - scroll
  function column(ctx, key, x, period, scroll, H, w, paint) {
    const s = sprite(ctx, "col" + key + period, w, period, w / 2, 0, paint);
    for (let y = (((-scroll % period) + period) % period) - period; y < H; y += period) draw(ctx, s, x, y);
  }

  // A rubber post: a chrome stud with a red rubber ring and a soft shadow
  function post(ctx, x, y, r = 4) {
    const s = sprite(ctx, "post" + r, r * 4, r * 4, r * 2, r * 2, (g) => {
      disc(g, r * 0.2, r * 0.5, r * 1.6, radial(g, r * 0.2, r * 0.5, 0, r * 1.6, [[0, "rgba(0,0,0,0.45)"], [1, "rgba(0,0,0,0)"]]));
      disc(g, 0, 0, r, radial(g, -r * 0.3, -r * 0.3, 0, r, [[0, "#ff6b55"], [1, "#a8150f"]]));
      disc(g, 0, 0, r * 0.5, radial(g, -r * 0.15, -r * 0.2, 0, r * 0.5, [[0, "#ffffff"], [1, "#8d867c"]]));
    });
    draw(ctx, s, x, y);
  }

  // A gold star insert with a warm hot centre
  function star(ctx, x, y, r) {
    const s = sprite(ctx, "star", 48, 48, 24, 24, (g) => {
      const R = 20;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? R * 0.45 : R;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = radial(g, 0, -2, 0, R, [[0, "#fff6c8"], [0.4, C.yellow], [1, "#e08a00"]]);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1;
      g.stroke();
    });
    glow(ctx, x, y, r * 2.4, C.yellow, 0.5);
    draw(ctx, s, x, y, r / 20);
  }

  window.PinballSkin = { install, score, lights, bulbs, callout, bumper, star, ball, streak, insert, column, post, glow, layer, sprite, draw, playfield, mix, colors: C, tiers: TIERS };
})();

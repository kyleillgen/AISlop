// Pinball skin: the shared look for Flow // Resonance and every game on the flow shell.
// A real machine's parts, drawn clean: a black backbox with an orange 7-segment score,
// insert lights for the flow meter, cream buttons with soft shadows, a sunburst backglass for
// the start screen, condensed Oswald type, and a row of chaser bulbs that runs on the beat.
// No thick black outlines, hard offset shadows or script lettering: those read as clip art.
//
// PinballSkin.install()                    fonts + CSS (once)
// PinballSkin.score(el, n, digits)         7-segment number into el
// PinballSkin.lights(el, pct, color)       10 insert lights into el
// PinballSkin.bulbs(ctx, W, y, beatPos, flash)   chaser bulbs along y
// PinballSkin.callout(ctx, text, x, y, color, size, alpha)
// PinballSkin.bumper(ctx, x, y, r, cap, pop)   a pop bumper (cap: the centre light's colour)
// PinballSkin.star(ctx, x, y, r)                a gold star insert
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
    segOff: "#3a1606"
  };
  // Playfield insert colours by tier
  const TIERS = ["#2f6bff", "#1fbf55", "#ff1f8a", "#ff7a00"];

  const CSS = `
  .pb-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: linear-gradient(#1b1410, ${C.black}); border: 1px solid rgba(255,196,0,.55); box-shadow: 0 8px 24px rgba(0,0,0,.45); border-radius: 12px; padding: 7px 10px; }
  .pb-cap { display: block; font: 600 10px/1 Oswald, Impact, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: ${C.cream}; opacity: .7; margin-bottom: 3px; }
  .pb-window { display: inline-flex; align-items: center; background: #000; border: 1px solid #2a1e15; border-radius: 6px; padding: 3px 5px; line-height: 0; }
  .pb-best { font: 500 10px Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: ${C.cream}; opacity: .55; margin-left: 6px; }
  .pb-label { display: block; font: 600 12px/1.1 Oswald, Impact, sans-serif !important; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pb-lights { display: flex; gap: 4px; margin-top: 5px; }
  .pb-lights i { position: relative; flex: 1; max-width: 12px; aspect-ratio: 1; border-radius: 50%; background: #2c1d14; }
  /* Incandescent: the lit layer snaps on fast and fades off slowly, like a real bulb's filament */
  .pb-lights i::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff 0 14%, var(--c, #ffc400) 30%); opacity: 0; transition: opacity .45s cubic-bezier(.2,.7,.3,1); }
  .pb-lights i.on::after { opacity: 1; transition: opacity .06s linear; }
  .pb-btn { white-space: nowrap; font: 600 11px/1 Oswald, Impact, sans-serif !important; letter-spacing: .1em; text-transform: uppercase; color: ${C.black} !important; background: ${C.cream} !important; border: 0 !important; border-radius: 8px !important; box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 2px 6px rgba(0,0,0,.35); padding: 6px 9px !important; cursor: pointer; }
  .pb-btn { transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease, background-color .2s; }
  .pb-btn:hover { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 4px 10px rgba(0,0,0,.4); }
  .pb-btn:active { transform: translateY(1px) scale(.98); box-shadow: 0 1px 2px rgba(0,0,0,.4); transition-duration: .05s; }
  .pb-btn svg { width: 15px; height: 15px; color: ${C.black}; }
  .pb-icon { display: flex; align-items: center; padding: 5px 7px !important; }
  .pb-badge { display: inline-block; font: 600 9px/1 Oswald, Impact, sans-serif; letter-spacing: .12em; text-transform: uppercase; padding: 3px 5px; border-radius: 4px; background: #2c1d14; color: ${C.cream}; opacity: .8; }
  .pb-badge.ready { background: ${C.yellow}; color: ${C.black}; opacity: 1; }
  .pb-backglass { overflow: hidden; background: ${C.red} !important; }
  /* The sunburst stays still: turning it cost ~10 fps in the pocket app on a busy GPU's screen */
  .pb-backglass::before { content: ""; position: absolute; left: 50%; top: 45%; width: 260vmax; height: 260vmax; margin: -130vmax 0 0 -130vmax; background: repeating-conic-gradient(from 0deg, ${C.red} 0 10deg, #f0401c 10deg 20deg); }
  .pb-backglass::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 50% 45%, transparent 0 35%, rgba(20,15,12,.55) 75%); }
  .pb-backglass > * { position: relative; z-index: 1; }
  @media (prefers-reduced-motion: reduce) { .pb-card, .pb-paused { animation: none; } }
  .pb-card { max-width: 24rem; width: 100%; background: ${C.cream}; color: #3a2a1c; border: 0; border-radius: 16px; box-shadow: 0 18px 48px rgba(0,0,0,.5); padding: 22px 22px 18px; animation: pb-pop .45s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes pb-pop { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
  .pb-paused { animation: pb-drop .45s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes pb-drop { from { opacity: 0; transform: translateY(-14px) scale(.94); } to { opacity: 1; transform: none; } }
  /* The 7-segment window brightens for a moment when the number changes */
  .pb-window svg { transition: filter .35s ease-out, transform .35s cubic-bezier(.34,1.56,.64,1); }
  .pb-window.bump svg { filter: brightness(1.7); transform: scale(1.06); transition-duration: .04s; }
  /* A static vignette over the playfield: one layer, never redrawn, so it costs nothing a frame */
  .pb-vignette { position: fixed; inset: 0; z-index: 5; pointer-events: none; background: radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(10,6,4,.3) 100%); }
  .pb-kicker { font: 600 11px Oswald, Impact, sans-serif; letter-spacing: .3em; text-transform: uppercase; color: ${C.red}; }
  .pb-title { margin: 6px 0 10px; font: 600 38px/1 Oswald, Impact, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: ${C.cream}; text-shadow: 0 2px 12px rgba(0,0,0,.45); }
  .pb-card .pb-title { color: ${C.red}; text-shadow: none; }
  .pb-card p { margin: 0 0 14px; font: 400 14px/1.5 Inter, system-ui, sans-serif; color: #3a2a1c; }
  .pb-keys { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font: 500 12px Oswald, Impact, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #3a2a1c; margin-bottom: 16px; }
  .pb-kbd { display: inline-block; min-width: 1.7em; padding: 0 .4em; background: #fff8e6; border: 1px solid rgba(20,15,12,.35); border-radius: 5px; box-shadow: 0 1px 0 rgba(20,15,12,.25); color: ${C.black}; font: 600 10px/1.6 Oswald, Impact, sans-serif; letter-spacing: .04em; text-align: center; text-transform: none; }
  .pb-start { width: 100%; padding: 12px; font: 600 20px/1 Oswald, Impact, sans-serif !important; letter-spacing: .16em; text-transform: uppercase; color: #fff !important; background: ${C.red} !important; border: 0 !important; border-radius: 12px !important; box-shadow: 0 6px 16px rgba(232,35,31,.35); cursor: pointer; }
  .pb-start { transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease; }
  .pb-start:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(232,35,31,.45); }
  .pb-start:active { transform: translateY(1px) scale(.99); box-shadow: 0 2px 6px rgba(232,35,31,.35); transition-duration: .05s; }
  .pb-or { margin-top: 10px; text-align: center; font: 500 11px Oswald, Impact, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #7a5a3c; }
  .pb-paused { font: 600 44px/1 Oswald, Impact, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: ${C.cream}; text-shadow: 0 2px 16px rgba(0,0,0,.5); }
  .pb-sub { margin-top: 10px; font: 500 13px Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: ${C.cream}; opacity: .8; }
  .pb-rows div { display: flex; justify-content: space-between; gap: 12px; margin: 7px 0; font: 500 12px Oswald, Impact, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #3a2a1c; }
  .pb-note { margin-top: 10px; font: 400 12px/1.45 Inter, system-ui, sans-serif; color: #6b4c30; }
  @media (max-width: 520px) { .pb-bar { gap: 6px; padding: 6px 7px; } .pb-window svg { width: auto; height: 18px; } .pb-lights { gap: 2px; } .pb-btn { padding: 5px 7px !important; } .pb-cap .pb-badge { display: none; } }
  .pb-hint { display: inline-block; padding: 6px 12px; background: rgba(246,230,192,.94); color: ${C.black}; border-radius: 999px; box-shadow: 0 4px 14px rgba(0,0,0,.35); font: 600 11px Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; }`;

  // The fonts ship beside this file (games/fonts, SIL Open Font License): no network on launch,
  // and it works offline. Variable fonts, Latin subset: Oswald 400-700, Inter 400-600.
  const here = document.currentScript && document.currentScript.src ? new URL("fonts/", document.currentScript.src).href : "fonts/";
  const FONTS = `
  @font-face { font-family: Oswald; font-weight: 400 700; font-display: swap; src: url(${here}oswald-latin.woff2) format("woff2"); }
  @font-face { font-family: Inter; font-weight: 400 600; font-display: swap; src: url(${here}inter-latin.woff2) format("woff2"); }`;

  function install(options) {
    if (document.getElementById("pb-style")) return;
    const style = document.createElement("style");
    style.id = "pb-style";
    style.textContent = FONTS + CSS;
    document.head.appendChild(style);
    if (options && options.vignette === false) return; // e.g. a launcher around a game frame
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
      .map(([k, [sx, sy, w, h]]) => `<rect x="${x + sx}" y="${sy}" width="${w}" height="${h}" rx="0.8" fill="${on.includes(k) ? C.segOn : C.segOff}"/>`)
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
    el.innerHTML = `<svg width="${w * 1.1}" height="24" viewBox="0 0 ${w} 22" aria-label="${n}"><g transform="skewX(-8) translate(3 0)">${[...str].map((ch, i) => digitSvg(ch, i * 15)).join("")}</g></svg>`;
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
    ctx.fillStyle = "#000";
    ctx.fillRect(0, y - 7, W, 14);
    for (let i = 0, x = 11; x < W; i++, x += 22) {
      const on = flash > 0 || (i + step) % 3 === 0;
      filament[i] = on ? 1 : (filament[i] || 0) * decay;
      ctx.fillStyle = "#3a2418";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      if (filament[i] < 0.03) continue;
      ctx.globalAlpha = filament[i];
      ctx.fillStyle = BULBS[Math.floor(i / 3) % 3]; // colours rotate along the row
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 2, y - 2, 1.5, 1.5); // the hot spot on the glass
      ctx.globalAlpha = 1;
    }
  }

  // Clean condensed lettering with a soft shadow, popping in with a little overshoot
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
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(label, x, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  // A pop bumper seen from above: a soft shadow, the cream body, a red rubber ring and a cap
  // light in the middle. Flat shapes, no outlines.
  function bumper(ctx, x, y, r, cap, pop = 0) {
    const k = 1 + pop * 0.16;
    r *= k;
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.arc(x + 2, y + 5, r * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.red;
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = C.yellow;
    ctx.fill();
  }

  window.PinballSkin = { install, score, lights, bulbs, callout, bumper, star, colors: C, tiers: TIERS };
})();

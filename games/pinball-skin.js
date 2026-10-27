// Pinball skin: the shared look for Flow // Resonance and every game on the flow shell.
// 70s pinball rather than "AI neon": a black backbox with an orange 7-segment score,
// insert lights for the flow meter, chunky cream buttons with hard shadows, a sunburst
// backglass for the start screen, Shrikhand display type, outlined callouts like printed
// plastics, and a row of chaser bulbs that runs on the beat.
//
// PinballSkin.install()                    fonts + CSS (once)
// PinballSkin.score(el, n, digits)         7-segment number into el
// PinballSkin.lights(el, pct, color)       10 insert lights into el
// PinballSkin.bulbs(ctx, W, y, beatPos, flash)   chaser bulbs along y
// PinballSkin.callout(ctx, text, x, y, color, size, alpha)
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
  .pb-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: ${C.black}; border: 3px solid #000; box-shadow: 0 0 0 2px ${C.yellow}, 0 6px 0 2px #000; border-radius: 10px; padding: 7px 10px; }
  .pb-cap { display: block; font: 600 10px/1 Oswald, Impact, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: ${C.cream}; opacity: .85; margin-bottom: 3px; }
  .pb-window { display: inline-flex; align-items: center; background: #000; border: 2px solid #3b2a1c; border-radius: 4px; padding: 3px 5px; line-height: 0; }
  .pb-best { font: 500 10px Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: ${C.cream}; opacity: .6; margin-left: 6px; }
  .pb-label { display: block; font: 600 12px/1.1 Oswald, Impact, sans-serif !important; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pb-lights { display: flex; gap: 4px; margin-top: 5px; }
  .pb-lights i { position: relative; flex: 1; max-width: 13px; aspect-ratio: 1; border-radius: 50%; background: #3a2418; border: 1px solid #000; }
  /* Incandescent: the lit layer snaps on fast and fades off slowly, like a real bulb's filament */
  .pb-lights i::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff 0 18%, var(--c, #ffc400) 22%); opacity: 0; transition: opacity .45s cubic-bezier(.2,.7,.3,1); }
  .pb-lights i.on::after { opacity: 1; transition: opacity .06s linear; }
  .pb-btn { white-space: nowrap; font: 600 11px/1 Oswald, Impact, sans-serif !important; letter-spacing: .08em; text-transform: uppercase; color: ${C.black} !important; background: ${C.cream} !important; border: 2px solid #000 !important; border-radius: 6px !important; box-shadow: 3px 3px 0 #000; padding: 6px 9px !important; cursor: pointer; }
  .pb-btn { transition: transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s cubic-bezier(.34,1.56,.64,1), background-color .2s; }
  .pb-btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #000; }
  .pb-btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #000; transition-duration: .05s; }
  .pb-btn svg { width: 15px; height: 15px; color: ${C.black}; }
  .pb-icon { display: flex; align-items: center; padding: 5px 7px !important; }
  .pb-badge { display: inline-block; font: 600 9px/1 Oswald, Impact, sans-serif; letter-spacing: .12em; text-transform: uppercase; padding: 3px 5px; border-radius: 3px; border: 1px solid #000; background: #3a2418; color: ${C.cream}; opacity: .8; }
  .pb-badge.ready { background: ${C.yellow}; color: ${C.black}; opacity: 1; }
  .pb-backglass { overflow: hidden; background: ${C.red} !important; }
  /* The sunburst stays still: turning it cost ~10 fps in the pocket app on a busy GPU's screen */
  .pb-backglass::before { content: ""; position: absolute; left: 50%; top: 45%; width: 260vmax; height: 260vmax; margin: -130vmax 0 0 -130vmax; background: repeating-conic-gradient(from 0deg, ${C.red} 0 10deg, ${C.orange} 10deg 20deg); }
  .pb-backglass::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 50% 45%, transparent 0 35%, rgba(20,15,12,.55) 75%); }
  .pb-backglass > * { position: relative; z-index: 1; }
  @media (prefers-reduced-motion: reduce) { .pb-card, .pb-paused { animation: none; } }
  .pb-card { max-width: 24rem; width: 100%; background: ${C.cream}; color: #3a2a1c; border: 4px solid ${C.black}; border-radius: 14px; box-shadow: 8px 8px 0 ${C.black}; padding: 22px 22px 18px; transform: rotate(-1.2deg); animation: pb-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes pb-pop { from { opacity: 0; transform: translateY(14px) rotate(-3deg) scale(.94); } to { opacity: 1; transform: rotate(-1.2deg); } }
  .pb-paused { animation: pb-drop .45s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes pb-drop { from { opacity: 0; transform: translateY(-18px) scale(.9); } to { opacity: 1; transform: none; } }
  /* The 7-segment window brightens for a moment when the number changes */
  .pb-window svg { transition: filter .35s ease-out, transform .35s cubic-bezier(.34,1.56,.64,1); }
  .pb-window.bump svg { filter: brightness(1.7); transform: scale(1.06); transition-duration: .04s; }
  /* A static vignette over the playfield: one layer, never redrawn, so it costs nothing a frame */
  .pb-vignette { position: fixed; inset: 0; z-index: 5; pointer-events: none; background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(10,6,4,.42) 100%); }
  .pb-kicker { font: 700 11px Oswald, Impact, sans-serif; letter-spacing: .28em; text-transform: uppercase; color: ${C.red}; }
  .pb-title { margin: 6px 0 10px; font: 400 36px/1.02 Shrikhand, Georgia, serif; color: ${C.red}; text-shadow: 2px 2px 0 ${C.yellow}, 4px 4px 0 ${C.black}; letter-spacing: .01em; }
  .pb-card p { margin: 0 0 14px; font: 400 14px/1.5 Inter, system-ui, sans-serif; color: #3a2a1c; }
  .pb-keys { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font: 500 12px Oswald, Impact, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #3a2a1c; margin-bottom: 16px; }
  .pb-kbd { display: inline-block; min-width: 1.7em; padding: 0 .4em; background: #fff8e6; border: 2px solid ${C.black}; border-radius: 4px; box-shadow: 2px 2px 0 ${C.black}; color: ${C.black}; font: 600 10px/1.5 Oswald, Impact, sans-serif; letter-spacing: .04em; text-align: center; text-transform: none; }
  .pb-start { width: 100%; padding: 12px; font: 700 21px/1 Oswald, Impact, sans-serif !important; letter-spacing: .14em; text-transform: uppercase; color: #fff !important; background: ${C.red} !important; border: 3px solid ${C.black} !important; border-radius: 10px !important; box-shadow: 5px 5px 0 ${C.black}; cursor: pointer; }
  .pb-start { transition: transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s cubic-bezier(.34,1.56,.64,1); }
  .pb-start:hover { transform: translate(-1px, -2px) scale(1.01); box-shadow: 6px 7px 0 ${C.black}; }
  .pb-start:active { transform: translate(3px, 3px); box-shadow: 2px 2px 0 ${C.black}; transition-duration: .05s; }
  .pb-or { margin-top: 10px; text-align: center; font: 500 11px Oswald, Impact, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #7a5a3c; }
  .pb-paused { font: 400 44px/1 Shrikhand, Georgia, serif; color: ${C.yellow}; text-shadow: 3px 3px 0 ${C.red}, 6px 6px 0 ${C.black}; }
  .pb-sub { margin-top: 10px; font: 500 13px Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: ${C.cream}; }
  .pb-rows div { display: flex; justify-content: space-between; gap: 12px; margin: 7px 0; font: 500 12px Oswald, Impact, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #3a2a1c; }
  .pb-note { margin-top: 10px; font: 400 12px/1.45 Inter, system-ui, sans-serif; color: #6b4c30; }
  @media (max-width: 520px) { .pb-bar { gap: 6px; padding: 6px 7px; } .pb-window svg { width: 50px; height: 19px; } .pb-lights { gap: 2px; } .pb-btn { padding: 5px 7px !important; } .pb-cap .pb-badge { display: none; } }
  .pb-hint { display: inline-block; padding: 6px 12px; background: ${C.cream}; color: ${C.black}; border: 2px solid #000; border-radius: 6px; box-shadow: 3px 3px 0 #000; font: 600 11px Oswald, Impact, sans-serif; letter-spacing: .1em; text-transform: uppercase; }`;

  function install(options) {
    if (document.getElementById("pb-style")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Shrikhand&family=Oswald:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = "pb-style";
    style.textContent = CSS;
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

  // Outlined, like the printing on a pinball plastic: black offset, black outline, colour fill
  const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
  function callout(ctx, text, x, y, color, size = 22, alpha = 1, age) {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (age !== undefined) {
      // Pops in over the first fifth of its life with a little overshoot
      const k = 0.55 + 0.45 * easeOutBack(Math.min(1, age / 0.2));
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.translate(-x, -y);
    }
    ctx.font = `${Math.round(size)}px Shrikhand, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.fillStyle = C.black;
    ctx.fillText(text, x + 3, y + 3);
    ctx.lineWidth = Math.max(3, size * 0.22);
    ctx.strokeStyle = C.black;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  window.PinballSkin = { install, score, lights, bulbs, callout, colors: C, tiers: TIERS };
})();

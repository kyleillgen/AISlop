// Keyboard cursor: full keyboard control for pointer-driven games and toys.
// Arrow keys show a soft cursor and glide it around (it speeds up the longer you hold).
// While the cursor is showing, Space is the mouse button at that spot: tap Space to tap,
// hold Space and steer with the arrows to drag. The cursor fades after a few idle seconds,
// and Space goes back to whatever the game itself does with it.
//
// It works by sending the same pointer events a mouse would, so the game needs no changes.
(() => {
  "use strict";
  if (window.KeyCursor) return;

  const IDLE_HIDE_MS = 4000;
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  let active = false, pressing = false, lastUsed = 0, hinted = false;
  const held = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
  let heldFor = 0, raf = 0, lastT = 0;

  const ring = document.createElement("div");
  ring.setAttribute("aria-hidden", "true");
  ring.style.cssText =
    "position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;pointer-events:none;" +
    "z-index:2147483002;border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 14px rgba(160,220,255,0.55);" +
    "opacity:0;transition:opacity .3s, transform .08s;";
  const tip = document.createElement("div");
  tip.setAttribute("aria-hidden", "true");
  tip.textContent = "space = tap · hold space + arrows = drag";
  tip.style.cssText =
    "position:fixed;left:0;top:0;transform:translate(-50%,22px);pointer-events:none;z-index:2147483002;white-space:nowrap;" +
    "font:600 11px system-ui,sans-serif;color:rgba(255,255,255,0.8);background:rgba(10,12,24,0.6);padding:4px 8px;" +
    "border-radius:999px;opacity:0;transition:opacity .4s;";
  function mount() { document.body.appendChild(ring); document.body.appendChild(tip); place(); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  function place() {
    ring.style.left = tip.style.left = x + "px";
    ring.style.top = tip.style.top = y + "px";
    ring.style.transform = pressing ? "scale(0.75)" : "scale(1)";
    ring.style.background = pressing ? "rgba(255,255,255,0.25)" : "transparent";
  }

  function show() {
    active = true;
    lastUsed = performance.now();
    ring.style.opacity = "1";
    if (!hinted) { hinted = true; tip.style.opacity = "1"; setTimeout(() => { tip.style.opacity = "0"; }, 3500); }
  }

  // Send a pointer event to whatever is under the cursor, like a real mouse would
  function send(type) {
    const target = document.elementFromPoint(x, y) || document.body;
    const init = {
      bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y,
      pointerId: 1, pointerType: "mouse", isPrimary: true, button: type === "pointermove" ? -1 : 0,
      buttons: pressing ? 1 : 0, width: 1, height: 1, pressure: pressing ? 0.5 : 0
    };
    target.dispatchEvent(new PointerEvent(type, init));
    if (type === "pointerdown") target.dispatchEvent(new MouseEvent("mousedown", init));
    if (type === "pointerup") {
      target.dispatchEvent(new MouseEvent("mouseup", init));
      target.dispatchEvent(new MouseEvent("click", init));
    }
  }

  function loop(t) {
    const dt = Math.min(0.12, (t - lastT) / 1000 || 0);
    lastT = t;
    const dx = (held.ArrowRight ? 1 : 0) - (held.ArrowLeft ? 1 : 0);
    const dy = (held.ArrowDown ? 1 : 0) - (held.ArrowUp ? 1 : 0);
    if (!dx && !dy) { raf = 0; return; }
    heldFor += dt;
    const speed = Math.min(720, 220 + heldFor * 520); // gentle start, then glides
    const len = Math.hypot(dx, dy);
    x = Math.max(2, Math.min(window.innerWidth - 2, x + (dx / len) * speed * dt));
    y = Math.max(2, Math.min(window.innerHeight - 2, y + (dy / len) * speed * dt));
    lastUsed = performance.now();
    place();
    send("pointermove");
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code in held) {
      e.preventDefault();
      if (!active) show();
      if (!held[e.code]) { held[e.code] = true; if (!raf) { heldFor = 0; lastT = performance.now(); raf = requestAnimationFrame(loop); } }
      return;
    }
    if (e.code === "Space" && active) {
      // Capture phase: the cursor owns Space while it's showing
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || pressing) return;
      pressing = true;
      lastUsed = performance.now();
      place();
      send("pointerdown");
    }
  }, true);

  window.addEventListener("keyup", (e) => {
    if (e.code in held) { held[e.code] = false; return; }
    if (e.code === "Space" && pressing) {
      e.preventDefault();
      e.stopImmediatePropagation();
      pressing = false;
      place();
      send("pointerup");
    }
  }, true);

  // A real mouse or touch hands control back and hides the cursor
  window.addEventListener("pointerdown", (e) => {
    if (e.isTrusted && active) { active = false; ring.style.opacity = "0"; x = e.clientX; y = e.clientY; place(); }
  }, true);

  setInterval(() => {
    if (active && !pressing && performance.now() - lastUsed > IDLE_HIDE_MS) { active = false; ring.style.opacity = "0"; }
  }, 500);

  window.KeyCursor = { get active() { return active; } };
})();

// Contract tests for the flow engine's controller (games/flow-engine.js).
// Run: node --test tests/
// The controller is pure, so these drive it at a simulated 60 fps with scripted taps.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

globalThis.window = {};
require(path.join(__dirname, "..", "games", "flow-engine.js"));
const { createController, fitTempo, BAND_MIN, BAND_MAX } = window.FlowEngine;

// phases: [{ every: ms between actions, secs, jitter: ms (uniform ±), skip }]
function run(phases, options, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = createController(options);
  const dt = 1 / 60;
  const log = [];
  let t = 0;
  let next = 0.2;
  for (const ph of phases) {
    const end = t + ph.secs;
    while (t < end) {
      if (ph.every && t >= next) {
        // stamped at the tap's true time, as real input events are
        c.recordTap(next * 1000 + (ph.jitter ? (rand() - 0.5) * 2 * ph.jitter : 0));
        next += ph.every / 1000;
      }
      if (!ph.every) next = t + 0.2;
      c.update(dt);
      log.push({ t, bpm: c.bpm, locked: c.locked, auto: c.auto });
      t += dt;
    }
  }
  return { c, log };
}
const firstLock = (log) => log.find((f) => f.locked);

test("fitTempo folds half and double time into the band", () => {
  assert.equal(Math.round(fitTempo(60000 / 56, [0.5, 1, 2], 108)), 112);
  assert.equal(Math.round(fitTempo(60000 / 220, [0.5, 1, 2], 108)), 110);
  assert.equal(Math.round(fitTempo(60000 / 110, [0.5, 1, 2], 108)), 110);
  // typing: 200 ms between keystrokes = 3 keys per beat at 100 BPM
  assert.equal(Math.round(fitTempo(200, [2, 3, 4], 108)), 100);
});

test("fitted tempo always stays inside the band", () => {
  for (let ms = 40; ms < 3000; ms += 7) {
    for (const per of [[0.5, 1, 2], [2, 3, 4]]) {
      const b = fitTempo(ms, per, 108);
      assert.ok(b >= BAND_MIN && b <= BAND_MAX, `${ms} ms -> ${b}`);
    }
  }
});

for (const tapBpm of [100, 108, 116, 122]) {
  test(`steady tapper at ${tapBpm} BPM locks within 2 BPM`, () => {
    const { log } = run([{ every: 60000 / tapBpm, secs: 15 }]);
    const lock = firstLock(log);
    assert.ok(lock, "never locked");
    assert.ok(Math.abs(lock.bpm - tapBpm) < 2, `locked at ${lock.bpm.toFixed(1)}`);
  });
}

test("half-time and double-time tappers lock inside the band", () => {
  for (const tapBpm of [56, 220]) {
    const { log } = run([{ every: 60000 / tapBpm, secs: 20 }]);
    const lock = firstLock(log);
    assert.ok(lock, `${tapBpm}: never locked`);
    assert.ok(Math.abs(lock.bpm - 110) < 3, `${tapBpm}: locked at ${lock.bpm.toFixed(1)}`);
  }
});

test("a saved tempo locks sooner", () => {
  const fresh = firstLock(run([{ every: 60000 / 116, secs: 10 }]).log);
  const c = createController();
  c.useSavedTempo(116);
  let t = 0, next = 0.2, locked = null;
  while (t < 10 && !locked) {
    if (t >= next) { c.recordTap(next * 1000); next += 60 / 116; }
    c.update(1 / 60);
    if (c.locked) locked = t;
    t += 1 / 60;
  }
  assert.ok(locked !== null && locked < fresh.t, `saved ${locked} vs fresh ${fresh.t}`);
});

test("tempo never moves while locked and steady", () => {
  const { log } = run([{ every: 60000 / 110, secs: 30, jitter: 15 }]);
  const lock = firstLock(log);
  const after = log.filter((f) => f.t > lock.t);
  assert.ok(after.every((f) => f.locked), "unlocked while steady");
  assert.ok(after.every((f) => f.bpm === lock.bpm), "tempo moved while locked");
});

test("re-sync after a tempo change walks in sub-threshold steps (<=1.5%/bar) and re-locks", () => {
  const { log } = run([{ every: 60000 / 120, secs: 20 }, { every: 60000 / 100, secs: 40 }]);
  const unlock = log.find((f, i) => i > 0 && log[i - 1].locked && !f.locked);
  assert.ok(unlock, "never re-synced");
  const relock = log.find((f) => f.t > unlock.t && f.locked);
  assert.ok(relock, "never re-locked");
  assert.ok(Math.abs(relock.bpm - 100) < 4, `re-locked at ${relock.bpm.toFixed(1)}`);
  // per-bar change during the walk
  for (let i = log.indexOf(unlock); log[i] !== relock; i++) {
    const barFrames = Math.round(((4 * 60) / log[i].bpm) * 60);
    const j = Math.min(i + barFrames, log.length - 1);
    const pct = Math.abs(log[j].bpm - log[i].bpm) / log[i].bpm;
    assert.ok(pct <= 0.0151, `step of ${(pct * 100).toFixed(2)}% per bar at ${log[i].t.toFixed(1)} s`);
    if (log[j] === relock) break;
  }
  // no lock/unlock wobble after re-locking
  const tail = log.filter((f) => f.t > relock.t);
  assert.ok(tail.every((f) => f.locked), "wobbled after re-lock");
});

test("typing rhythm (3 keys a beat, ragged) locks with typing settings", () => {
  const typing = { perBeat: [2, 3, 4], minMs: 60, maxMs: 900, stableTol: 2.5 };
  const { log } = run([{ every: 200, secs: 25, jitter: 45 }], typing);
  const lock = firstLock(log);
  assert.ok(lock, "never locked");
  assert.ok(Math.abs(lock.bpm - 100) < 4, `locked at ${lock.bpm.toFixed(1)}`);
});

test("idle starts autopilot after idleSec; any tap takes control back with two forgiven", () => {
  const { c, log } = run([{ every: 545, secs: 6 }, { secs: 4 }]);
  const autoAt = log.find((f) => f.auto);
  assert.ok(autoAt, "never entered autopilot");
  const lastTap = 0.2 + Math.floor((6 - 0.2) / 0.545) * 0.545;
  assert.ok(autoAt.t - lastTap > 2.4 && autoAt.t - lastTap < 2.8, `autopilot after ${(autoAt.t - lastTap).toFixed(2)} s`);
  c.recordTap(20000);
  assert.equal(c.auto, false);
  assert.equal(c.forgive, 2);
});

test("misses step the streak down by a quarter and raise the assist; it decays back", () => {
  const c = createController();
  c.score(40);
  assert.equal(c.tier, 4);
  c.clip();
  assert.equal(c.streak, 30);
  assert.equal(c.tier, 3);
  assert.ok(c.assist > 0.3);
  for (let i = 0; i < 60 * 40; i++) c.update(1 / 60);
  assert.equal(c.assist, 0);
  assert.ok(c.assistApplied < 0.01);
});

test("the streak never drops to zero from one miss", () => {
  const c = createController();
  c.score(3);
  c.clip();
  assert.equal(c.streak, 2);
});

test("typing with pauses between words still reads the keystroke rhythm", () => {
  // five-letter words at 180 ms a key, 600 ms between words: median 180 ms = 3 keys a beat
  const c = createController({ perBeat: [2, 3, 4], minMs: 60, maxMs: 900, stableTol: 2.5 });
  const taps = [];
  let at = 200;
  while (at < 30000) {
    for (let k = 0; k < 5; k++) { taps.push(at); at += 180; }
    at += 600 - 180;
  }
  let t = 0, i = 0, lockedAt = null;
  while (t < 30 && lockedAt === null) {
    while (i < taps.length && taps[i] <= t * 1000) c.recordTap(taps[i++]);
    c.update(1 / 60);
    if (c.locked) lockedAt = c.bpm;
    t += 1 / 60;
  }
  assert.ok(lockedAt !== null, "never locked");
  assert.ok(Math.abs(lockedAt - 60000 / 540) < 3, `locked at ${lockedAt.toFixed(1)}`);
});

test("tempo holds still through autopilot", () => {
  const { log } = run([{ every: 545, secs: 12 }, { secs: 20 }]);
  const autoFrames = log.filter((f) => f.auto);
  assert.ok(autoFrames.length > 0);
  const first = autoFrames[0];
  assert.ok(autoFrames.every((f) => f.bpm === first.bpm && f.locked === first.locked), "tempo or lock changed during autopilot");
});

test("Word Rain's typing fits leave no gaps from 125 to 620 ms a key", () => {
  const perBeat = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
  for (let ms = 125; ms <= 620; ms += 1) {
    const inBand = perBeat.some((k) => { const b = 60000 / (ms * k); return b >= BAND_MIN && b <= BAND_MAX; });
    assert.ok(inBand, `${ms} ms a key has no in-band fit`);
  }
});

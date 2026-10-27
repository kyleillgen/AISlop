#!/usr/bin/env node
// Tuning report: summarises ~/.flow-pocket/sessions.log per game and flags the mechanics that
// look off, each pointing at the knob to adjust. See docs/tuning.md for the loop.
//
//   node pocket/report.mjs            all sessions
//   node pocket/report.mjs --days 7   only the last 7 days
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG = process.env.FLOW_POCKET_LOG || join(homedir(), ".flow-pocket", "sessions.log");
if (!existsSync(LOG)) {
  console.log(`No sessions yet (${LOG}). Play a few rounds in Flow Pocket first.`);
  process.exit(0);
}
const daysArg = process.argv.indexOf("--days");
const since = daysArg > 0 ? Date.now() - Number(process.argv[daysArg + 1]) * 86400000 : 0;

// A session is reported several times as it goes; keep the latest report of each
const latest = new Map();
for (const line of readFileSync(LOG, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try {
    const s = JSON.parse(line);
    if (Date.parse(s.startedAt) < since) continue;
    latest.set((s.game || "?") + "|" + s.startedAt, s);
  } catch (e) {}
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const nums = (rows, k) => rows.map((r) => r[k]).filter((v) => typeof v === "number");
const fmt = (v, d = 2) => (v === null || v === undefined ? "  -" : typeof v === "number" ? v.toFixed(d) : v);

// Healthy ranges, from the research brief where it gives one, otherwise first guesses to
// revise as the data comes in. Each flag names the knob to try.
// Tap steadiness only means something where taps are meant to be regular: Rollover moves only
// when a light needs it, and typing is naturally raggeder
const CV_LIMIT = { rollover: Infinity, wordRain: 0.6 };
const CHECKS = [
  { test: (g) => g.clipsPerMin > 4, say: (g) => `${fmt(g.clipsPerMin, 1)} misses a minute: too hard right now. Widen the forgiving window or lower density (Orbit: the clean window; Rollover: LEAD, hold chance; Word Rain: fallBeats; all: pacer low/maxRoom).` },
  { test: (g) => g.cleanRate !== null && g.cleanRate > 0.97 && g.sessions >= 3, say: () => "Almost never misses: add variety, not difficulty (more doubles, holds, phrase shapes). The brief says slightly too easy is the safe side, so only if it feels flat." },
  { test: (g) => g.slowing !== null && g.slowing > 1.15, say: (g) => `Play slows ${Math.round((g.slowing - 1) * 100)}% after a miss: misses rattle the rhythm. Make miss feedback gentler (flash, cushion chord) or forgive more.` },
  { test: (g) => g.cv !== null && g.cv > (CV_LIMIT[g.name] ?? 0.35), say: (g) => `Tap rhythm stays ragged (interval CV ${fmt(g.cv)}): the game isn't settling people into a groove. Check spawn spacing is regular (pacer settle) and that obstacles land on the grid.` },
  { test: (g) => g.autoShare !== null && g.autoShare > 0.6, say: (g) => `${Math.round(g.autoShare * 100)}% of time on autopilot: fine while Claude works, but if you were trying to play, autopilot may be cutting in too soon (idleSec).` },
  { test: (g) => g.medianMin !== null && g.medianMin < 0.5 && g.sessions >= 3, say: () => "Sessions under 30 s: the first half-minute isn't pulling people in. Look at attract mode and the first tips." },
  { test: (g) => g.fluency !== null && g.fluency < 4.5, say: (g) => `Flow check: fluency ${fmt(g.fluency, 1)}/7. It doesn't feel smooth yet; read the comments on misses and slowing above.` },
  { test: (g) => g.absorption !== null && g.absorption < 4, say: (g) => `Flow check: absorption ${fmt(g.absorption, 1)}/7. Not absorbing; consider richer feedback (sound, lights) over more challenge.` }
];

const games = {};
for (const s of latest.values()) (games[s.game || "?"] ||= []).push(s);
console.log(`Sessions log: ${LOG}\n${latest.size} sessions${since ? ` in the last ${process.argv[daysArg + 1]} days` : ""}\n`);

for (const [name, rows] of Object.entries(games).sort()) {
  const active = nums(rows, "activeSec");
  const auto = nums(rows, "autoSec");
  const clips = nums(rows, "clips");
  const activeMin = active.reduce((a, b) => a + b, 0) / 60;
  const checks = rows.map((r) => r.check).filter((c) => c && typeof c === "object");
  const g = {
    name,
    sessions: rows.length,
    activeMin,
    medianMin: median(active) !== null ? median(active) / 60 : null,
    autoShare: auto.length ? auto.reduce((a, b) => a + b, 0) / Math.max(1, auto.reduce((a, b) => a + b, 0) + active.reduce((a, b) => a + b, 0)) : null,
    clipsPerMin: activeMin > 0 ? clips.reduce((a, b) => a + b, 0) / activeMin : null,
    cleanRate: mean(nums(rows, "cleanRate")),
    cv: mean(nums(rows, "intervalCv")),
    asyncSd: mean(nums(rows, "asyncSdMs")),
    slowing: mean(nums(rows, "postClipSlowing")),
    bpm: mean(nums(rows, "lockedBpm")),
    best: Math.max(0, ...nums(rows, "best"), ...nums(rows, "peak")),
    fluency: mean(checks.map((c) => c.fluency).filter((v) => typeof v === "number")),
    absorption: mean(checks.map((c) => c.absorption).filter((v) => typeof v === "number"))
  };
  console.log(`== ${name}`);
  console.log(
    `  sessions ${g.sessions} | played ${fmt(g.activeMin, 1)} min (median ${fmt(g.medianMin, 1)}) | autopilot ${g.autoShare === null ? "-" : Math.round(g.autoShare * 100) + "%"} | best ${g.best}`
  );
  console.log(
    `  misses/min ${fmt(g.clipsPerMin, 1)} | clean rate ${fmt(g.cleanRate)} | tap CV ${fmt(g.cv)} | timing SD ${fmt(g.asyncSd, 0)} ms | slowing after a miss ${fmt(g.slowing)} | tempo ${fmt(g.bpm, 1)} BPM`
  );
  if (g.fluency !== null || g.absorption !== null) console.log(`  flow check: fluency ${fmt(g.fluency, 1)}/7, absorption ${fmt(g.absorption, 1)}/7 (${checks.length} answers)`);
  const flags = CHECKS.filter((c) => c.test(g)).map((c) => c.say(g));
  console.log(flags.length ? flags.map((f) => "  ! " + f).join("\n") : "  No flags: nothing out of range.");
  console.log("");
}

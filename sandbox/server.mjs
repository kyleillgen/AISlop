// AISlop local sandbox: the generate → scrap/fix → submit loop, run on your own machine.
//
// Every player run gets one random game and MOVES total moves; a move is either a Scrap
// (re-roll a new random game) or a Fix (a short instruction, max FIX_MAX chars). The API
// key never leaves this process, the server only listens on 127.0.0.1, and MAX_CALLS caps
// how many model calls one server run can make.
//
//   node sandbox/server.mjs                 mock mode (no key: serves seed games, no spend)
//   ANTHROPIC_API_KEY=... node sandbox/server.mjs     live mode (calls Claude)

import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT, randomConcept, generatePrompt, fixPrompt } from "./prompts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "sandbox", "out");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4190);
const MOVES = 3;
const FIX_MAX = 100;
const MAX_CALLS = Number(process.env.AISLOP_MAX_CALLS || 15);
const MODEL = process.env.AISLOP_MODEL || "claude-opus-5-5";
const LIVE = Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AISLOP_MOCK !== "1";

// Generated games may not reach the network or this origin: inline code and data URLs only
const GAME_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
  "img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'";

const MOCK_POOL = ["orbit-hop", "lantern-drift", "pulse-garden", "two-tone", "ripple-pond"];

let callsMade = 0;
const sessions = new Map(); // sid -> { run: {id, concept, moves, history} | null }

await mkdir(OUT, { recursive: true });

let client = null;
if (LIVE) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  client = new Anthropic();
}

// ---------------------------------------------------------------------------
// Model calls

function extractHtml(text) {
  const start = text.search(/<!doctype html|<html/i);
  const end = text.toLowerCase().lastIndexOf("</html>");
  if (start < 0 || end < start) return null;
  const html = text.slice(start, end + 7);
  if (html.length > 200_000 || !/<script/i.test(html)) return null;
  return html;
}

async function callModel(userText) {
  if (callsMade >= MAX_CALLS) throw httpError(429, "This sandbox has used its call budget. Restart the server to reset it.");
  callsMade++;
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }]
  });
  const message = await stream.finalMessage();
  await log({ event: "usage", model: message.model, stop: message.stop_reason, usage: message.usage });
  if (message.stop_reason === "refusal") throw httpError(422, "The model declined that one. Your move was not used.");
  const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const html = extractHtml(text);
  if (!html) throw httpError(502, "The model returned something that isn't a playable game. Your move was not used.");
  return html;
}

async function mockGenerate(concept) {
  const pick = MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)];
  const html = await readFile(path.join(ROOT, "games", pick + ".html"), "utf8");
  return html.replace("<body>", `<body>\n<!-- mock: stands in for "${concept.replace(/-->/g, "")}" -->`);
}

// Mock fix: same game, plus a banner proving the instruction made the round trip
function mockFix(html, instruction) {
  const safe = JSON.stringify(instruction);
  const banner =
    `<script>(()=>{const d=document.createElement("div");d.textContent="Mock fix: "+${safe};` +
    `d.style.cssText="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:#fbbf24;color:#1b1400;` +
    `font:600 13px system-ui;padding:8px 12px;border-radius:10px;z-index:9;pointer-events:none";` +
    `document.body.appendChild(d);setTimeout(()=>d.remove(),3500)})();</script>`;
  return html.replace(/<\/body>/i, banner + "\n</body>");
}

// ---------------------------------------------------------------------------
// Runs

function newRunId() { return "g" + Date.now().toString(36) + randomBytes(3).toString("hex"); }

async function saveGame(id, html) { await writeFile(path.join(OUT, id + ".html"), html, "utf8"); }
async function loadGame(id) { return readFile(path.join(OUT, id + ".html"), "utf8"); }

async function produce(run, html) {
  run.version = (run.version || 0) + 1;
  await saveGame(run.id, html);
  return runView(run);
}

function runView(run) {
  return {
    id: run.id,
    concept: run.concept,
    movesLeft: run.moves,
    history: run.history,
    url: `/out/${run.id}.html?v=${run.version}`
  };
}

async function startRun(sess) {
  const concept = randomConcept();
  const run = { id: newRunId(), concept, moves: MOVES, history: [], version: 0 };
  const html = LIVE ? await callModel(generatePrompt(concept)) : await mockGenerate(concept);
  sess.run = run;
  await log({ event: "generate", id: run.id, concept });
  return produce(run, html);
}

async function scrap(sess) {
  const run = requireMoves(sess);
  const concept = randomConcept();
  const html = LIVE ? await callModel(generatePrompt(concept)) : await mockGenerate(concept);
  run.moves--;
  run.concept = concept;
  run.history.push({ type: "scrap", concept });
  await log({ event: "scrap", id: run.id, concept });
  return produce(run, html);
}

async function fix(sess, text) {
  const run = requireMoves(sess);
  const instruction = String(text || "").replace(/\s+/g, " ").trim();
  if (!instruction) throw httpError(400, "Say what to change.");
  if (instruction.length > FIX_MAX) throw httpError(400, `Keep it to ${FIX_MAX} characters.`);
  const current = await loadGame(run.id);
  const html = LIVE ? await callModel(fixPrompt(run.concept, current, instruction)) : mockFix(current, instruction);
  run.moves--;
  run.history.push({ type: "fix", text: instruction });
  await log({ event: "fix", id: run.id, instruction });
  return produce(run, html);
}

function requireMoves(sess) {
  if (!sess.run) throw httpError(400, "Roll a game first.");
  if (sess.run.moves <= 0) throw httpError(400, "No moves left. Submit it or let it go.");
  return sess.run;
}

async function submit(sess, title) {
  if (!sess.run) throw httpError(400, "Nothing to submit.");
  const run = sess.run;
  const entry = {
    id: run.id,
    title: String(title || "").trim().slice(0, 40) || "Untitled Slop",
    blurb: run.concept,
    prompt: run.history.filter((h) => h.type === "fix").map((h) => h.text).join(" · ") || null,
    path: `/out/${run.id}.html`,
    status: "fresh",
    hue: Math.floor(Math.random() * 360),
    movesUsed: MOVES - run.moves,
    submittedAt: new Date().toISOString()
  };
  const list = await readFresh();
  list.push(entry);
  await writeFile(path.join(OUT, "fresh.json"), JSON.stringify(list, null, 2), "utf8");
  sess.run = null;
  await log({ event: "submit", id: run.id, title: entry.title });
  return entry;
}

async function readFresh() {
  try { return JSON.parse(await readFile(path.join(OUT, "fresh.json"), "utf8")); } catch { return []; }
}

async function log(obj) {
  await appendFile(path.join(OUT, "log.jsonl"), JSON.stringify({ t: new Date().toISOString(), ...obj }) + "\n");
}

// ---------------------------------------------------------------------------
// HTTP

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

function session(req, res) {
  const m = /(?:^|;\s*)aislop_sid=([a-f0-9]{32})/.exec(req.headers.cookie || "");
  let sid = m && m[1];
  if (!sid || !sessions.has(sid)) {
    sid = randomBytes(16).toString("hex");
    sessions.set(sid, { run: null });
    res.setHeader("Set-Cookie", `aislop_sid=${sid}; Path=/; HttpOnly; SameSite=Strict`);
  }
  return sessions.get(sid);
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw httpError(413, "Request too large.");
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw httpError(400, "Bad JSON."); }
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

async function serveFile(res, urlPath) {
  const isOut = urlPath.startsWith("/out/");
  const base = isOut ? OUT : ROOT;
  const rel = decodeURIComponent(isOut ? urlPath.slice(5) : urlPath === "/" ? "index.html" : urlPath.slice(1));
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep) || rel.includes("..") || /(^|[\\/])(\.|sandbox[\\/]|node_modules)/.test(rel) && !isOut) {
    res.writeHead(404); res.end("Not found"); return;
  }
  if (!existsSync(file)) { res.writeHead(404); res.end("Not found"); return; }
  const headers = { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" };
  if (isOut) headers["Content-Security-Policy"] = GAME_CSP;
  res.writeHead(200, headers);
  res.end(await readFile(file));
}

const routes = {
  "GET /api/status": async (req, res, sess) => ({
    mode: LIVE ? "live" : "mock",
    model: LIVE ? MODEL : null,
    moves: MOVES,
    fixMax: FIX_MAX,
    callsLeft: LIVE ? MAX_CALLS - callsMade : null,
    run: sess.run ? runView(sess.run) : null
  }),
  "GET /api/fresh": async () => readFresh(),
  "POST /api/new": async (req, res, sess) => {
    if (sess.run) throw httpError(409, "Finish this game first: submit it or let it go.");
    return startRun(sess);
  },
  "POST /api/scrap": async (req, res, sess) => scrap(sess),
  "POST /api/fix": async (req, res, sess) => fix(sess, (await body(req)).text),
  "POST /api/submit": async (req, res, sess) => submit(sess, (await body(req)).title),
  "POST /api/discard": async (req, res, sess) => { sess.run = null; return { ok: true }; }
};

const busy = new Set(); // one model call in flight per session

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const sess = session(req, res);
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) throw httpError(404, "No such endpoint.");
      if (req.method === "POST") {
        // Same-origin only: the sandbox UI is the sole client
        const origin = req.headers.origin;
        if (origin && origin !== `http://${HOST}:${PORT}` && origin !== `http://localhost:${PORT}`) throw httpError(403, "Forbidden origin.");
        if (busy.has(sess)) throw httpError(429, "Still working on your last move.");
        busy.add(sess);
        try { json(res, 200, await route(req, res, sess)); } finally { busy.delete(sess); }
      } else {
        json(res, 200, await route(req, res, sess));
      }
      return;
    }
    if (req.method !== "GET") throw httpError(405, "Method not allowed.");
    await serveFile(res, url.pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) json(res, status, { error: status === 500 ? "Something broke in the sandbox." : err.message });
  }
}).listen(PORT, HOST, () => {
  console.log(`AISlop sandbox on http://${HOST}:${PORT}  (${LIVE ? `LIVE · ${MODEL} · ${MAX_CALLS} calls max` : "MOCK · no API calls"})`);
});

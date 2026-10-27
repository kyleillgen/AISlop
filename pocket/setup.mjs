#!/usr/bin/env node
// One-time setup for Flow Pocket on Windows, and a re-sync after the games change.
//   node pocket/setup.mjs          download the runtime (if missing) and copy the games in
//   node pocket/setup.mjs --sync   only copy the games in
//
// Downloads, from the official Neutralinojs GitHub releases, pinned to v6.10.0:
//   neutralinojs-v6.10.0.zip (8.1 MB; only neutralino-win_x64.exe is extracted)
//   neutralino.js (18 KB, the client library)
// Nothing else is fetched, and nothing is installed system-wide: the app uses the WebView2
// runtime that ships with Windows 11.
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = "6.10.0";
const BIN = join(HERE, "bin");
const RES = join(HERE, "resources");
const GAMES = join(HERE, "..", "games");

// The pocket app carries its own copy of the games, so it works without the repo's server
function syncGames() {
  const out = join(RES, "games");
  mkdirSync(out, { recursive: true });
  for (const f of ["flow-engine.js", "pinball-skin.js", "flow-shell.js", "flow-resonance.html", "word-rain.html", "template.html"]) {
    copyFileSync(join(GAMES, f), join(out, f));
  }
  console.log("games copied into pocket/resources/games");
}

async function download(url, to) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(to, buf);
  console.log(`${url}\n  -> ${to} (${(buf.length / 1e6).toFixed(2)} MB, sha256 ${createHash("sha256").update(buf).digest("hex")})`);
}

async function main() {
  if (!process.argv.includes("--sync")) {
    mkdirSync(BIN, { recursive: true });
    const exe = join(BIN, "neutralino-win_x64.exe");
    if (!existsSync(exe)) {
      const zip = join(BIN, `neutralinojs-v${VERSION}.zip`);
      await download(`https://github.com/neutralinojs/neutralinojs/releases/download/v${VERSION}/neutralinojs-v${VERSION}.zip`, zip);
      execFileSync("tar", ["-xf", zip, "-C", BIN, "neutralino-win_x64.exe"]); // tar ships with Windows 10+
      rmSync(zip);
      console.log("extracted neutralino-win_x64.exe");
    }
    mkdirSync(join(RES, "js"), { recursive: true });
    const client = join(RES, "js", "neutralino.js");
    if (!existsSync(client)) {
      await download(`https://github.com/neutralinojs/neutralino.js/releases/download/v${VERSION}/neutralino.js`, client);
    }
  }
  syncGames();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

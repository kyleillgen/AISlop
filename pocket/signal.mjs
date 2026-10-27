#!/usr/bin/env node
// Tells Flow Pocket what Claude Code is doing. Run from Claude Code hooks:
//   node pocket/signal.mjs start   when you send a prompt (UserPromptSubmit)
//   node pocket/signal.mjs done    when Claude finishes its turn (Stop)
//   node pocket/signal.mjs needs   when Claude needs your input or approval (Notification)
// It writes one line to ~/.flow-pocket/signal; the pocket app polls that file. It never fails
// the hook: any error is swallowed so Claude Code is never slowed or blocked by the game.
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const kind = process.argv[2];
if (["start", "done", "needs"].includes(kind)) {
  try {
    const dir = join(homedir(), ".flow-pocket");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "signal"), `${Date.now()} ${kind}\n`);
  } catch (e) {}
}

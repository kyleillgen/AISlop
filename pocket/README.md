# Flow Pocket

A small desktop window for playing Flow // Resonance, Word Rain and Drop Catch while Claude (or a build) works, without running Chrome.

It runs on [Neutralinojs](https://neutralino.js.org): an 8 MB runtime that uses the WebView2 engine already built into Windows 11, instead of bundling a browser the way Electron does. There are no tabs or extensions, it's one window, and it runs in **pocket mode**:

- 30 frames a second, dropping to 20 on autopilot. Nothing renders while minimised.
- 1× pixels instead of 2×.
- The audio clock is suspended while the window is hidden.

The launcher also passes WebView2 a few options: one renderer process, GPU work kept in the main process, and no background networking. Measured on this machine, the whole app comes to **163 MB working set (55 MB private) across 3 processes**, down from 393 MB (170 MB private) across 7 without them.

## Set up (once)

```bash
node pocket/setup.mjs
```

This downloads the Neutralino runtime from its official GitHub release, pinned to v6.10.0: the 8.1 MB zip (sha256 `e633f480…08329`), from which only the Windows exe is kept, as `pocket/flow-pocket.exe`, plus the 18 KB `neutralino.js` client. The exe sits beside `neutralino.config.json` because the runtime treats its own folder as the app folder. The exe is not code-signed, which is normal for Neutralino releases. It then copies the games into `pocket/resources/games`. Nothing is installed system-wide.

After changing a game, run `node pocket/setup.mjs --sync` to copy the new version in.

## Run

Double-click **`pocket/Flow Pocket.cmd`**. You can also pin a shortcut to it on the taskbar.

- **FLOW / RAIN / DROP** switches games. The last one you played is remembered.
- **SIDE / CORNER / MINI** docks the window. Claude Code's own games draw right above the prompt, where your eyes already are. A separate window can't go there without covering it, so Flow Pocket docks into the margin beside Claude's centred chat column:
  - **Side** is a full-height column on the right edge (the default).
  - **Corner** is bottom-right.
  - **Mini** is a small bottom-right square.
  If you drag or resize the window, the new spot is remembered for that dock.
- **PIN** keeps the window on top of your editor.
- **The lamp** shows what Claude is doing, once the hooks below are set up.

## Weave in and out with Claude Code

Tell the pocket app when Claude starts, finishes or needs you. It then plays along with your work:

- **You send a prompt:** the lamp turns yellow (Claude working). If the window was minimised, it comes back without taking the keyboard. Play while you wait.
- **Claude finishes:** the lamp blinks green, a chime plays, a "Claude is done" callout appears and the bulbs blink. The game goes to autopilot and the music winds down, so there's a natural place to switch back.
- **Claude needs you** (a permission prompt or a question): the same cue, but red.

Add these hooks to `~/.claude/settings.json`, merged into any `hooks` you already have:

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node D:/AIFolders/AISlop/pocket/signal.mjs start" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node D:/AIFolders/AISlop/pocket/signal.mjs done" }] }],
    "Notification": [{ "hooks": [{ "type": "command", "command": "node D:/AIFolders/AISlop/pocket/signal.mjs needs" }] }]
  }
}
```

`signal.mjs` writes one line to `~/.flow-pocket/signal`, and the app reads it every 1.5 s. The script swallows its own errors, so it can't slow down or break Claude Code. Any other tool can use the same file. For a build script, add `node pocket/signal.mjs done` at the end.

## Tuning from your own sessions

Every session's numbers are logged to `~/.flow-pocket/sessions.log`: steadiness, timing, misses, slowing after a miss, autopilot time and flow-check answers. Run:

```bash
node pocket/report.mjs --days 7
```

It summarises each game and flags anything out of range, naming the knob to adjust. The loop is described in [docs/tuning.md](../docs/tuning.md).

## Files

| File | What it is |
|---|---|
| `neutralino.config.json` | Window size, a fixed local port (41823, below the ranges Windows reserves for Hyper-V and WSL) so settings persist, and the short list of native calls the app may use: size, move, pin, un-minimise, read the signal file, exit |
| `resources/index.html` | The launcher: game switcher, pin, Claude lamp, and the game in a frame |
| `setup.mjs` | Downloads the runtime and copies the games in |
| `signal.mjs` | Writes the signal for Claude Code hooks or build scripts |
| `report.mjs` | The tuning report from `sessions.log` |
| `Flow Pocket.cmd` | Starts the app |
| `flow-pocket.exe`, `bin/`, `resources/games/`, `resources/js/` | Downloaded or copied by setup; not in git |

The games load their fonts from Google Fonts, and Flow also loads Tailwind from its CDN. Offline, the look falls back to plain system fonts, but play is unaffected.

# AISlop sandbox

The generate → scrap/fix → submit loop, running only on your machine.

Each player run gets **one random game and 3 moves**. A move is either:

- **Scrap**: throw it away and roll a new random concept.
- **Fix**: a single instruction of up to 100 characters ("It's too hard", "Add sound", …).

When the moves are spent (or earlier), you name it and **Submit to Fresh**, or let it go.

## Run it

```
cd sandbox
npm install
node server.mjs
```

Open http://localhost:4190 and use **+ Make one**.

- **Mock mode** (no `ANTHROPIC_API_KEY`, or `AISLOP_MOCK=1`): rolls hand out the seed games and fixes show a banner. No spend.
- **Live mode** (`ANTHROPIC_API_KEY` set): calls Claude. Defaults to `claude-opus-5-5`; set `AISLOP_MODEL=claude-sonnet-5-5` for roughly half the cost.

| Setting | Default | |
|---|---|---|
| `PORT` | 4190 | |
| `AISLOP_MAX_CALLS` | 15 | Model calls allowed per server run; restart to reset |
| `AISLOP_MODEL` | `claude-opus-5-5` | |
| `AISLOP_MOCK` | unset | `1` forces mock even with a key |

## Why it's safe to run

- The server listens on `127.0.0.1` only; the key never reaches the browser.
- POSTs must come from the sandbox's own origin, one model call in flight per player.
- Fix text is capped at 100 characters and framed to the model as design feedback only.
- Generated games are served with a CSP that blocks all network access, and play inside `sandbox="allow-scripts"` iframes with no access to the arcade page.
- Everything is logged to `sandbox/out/log.jsonl`, including token usage per call.

## Before this goes public

This is deliberately local. A public version needs the same loop behind a hosted backend
(e.g. a Cloudflare Worker), plus per-player quotas, sign-in or a captcha, a daily spend cap,
and a headless smoke test that auto-scraps games that don't load.

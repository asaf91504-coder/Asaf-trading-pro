# ASAF TRADING PRO — AI Beta

Responsive Hebrew trading workspace, TradingView charts and screener, watchlist, risk calculator, and server-side OpenAI chat.

## Deploy on Netlify
Connect this GitHub repository to your existing Netlify site (Project configuration → Build & deploy → Continuous deployment → Link repository). Publish directory is `.`, functions directory is `netlify/functions`, configured in netlify.toml. Verify GET /.netlify/functions/chat returns 405 (not 404).

## Required Netlify environment variables
- OPENAI_API_KEY: OpenAI Platform API key. Never commit or share it.
- ASAF_CHAT_ACCESS_CODE: a long private access passcode that you choose; the chat endpoint is disabled until configured.
- OPENAI_MODEL (optional): defaults to gpt-4.1-mini.

Redeploy after setting variables. A shared access code is **not** sufficient for a public production launch. Before opening the app to others, add authentication, server-side quotas and rate limiting, usage monitoring, and billing controls. Never rely on a soft API budget as a hard cap.

## Limitations
Market charts and screener are TradingView embeds, not direct licensed market data. The AI chat has no live price, news, or screening API. This is a beta and has not been verified in a deployed browser. Trading signals are not investment advice.


## October 20, 2026 — local stock analyzer and safety update
- `/analyzer.html` accepts a CSV file on-device and displays MA20, MA150, ATR14, prior 20-day high, breakout flag and relative volume. Requires dated OHLC rows, and 150 valid daily candles for SMA150.
- `/journal.html` keeps trade entries in the current browser only. Export CSV before clearing site data.
- `tests/analyzer.test.mjs` contains automated local-math checks (run with `node --test tests/analyzer.test.mjs`).
- Paid OpenAI chat is **disabled by default**, even when `OPENAI_API_KEY` is present. Enabling it requires `ASAF_CHAT_ENABLED=true`, which should **not** be configured for a public service until strong identity verification, server-side rate limiting, hard quota enforcement and provider billing safeguards are implemented. The shared access code is insufficient by itself.
- The GitHub commits alone do not deploy this application. Link the existing Netlify site to this repository and verify deploy status; no live deployment is confirmed.

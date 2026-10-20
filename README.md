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


## Stock-only chart chat — free, data-grounded mode (2026-10-20)
- The stock chat on `index.html` no longer invokes OpenAI by default. Its local rule-based responses are **not** presented as live AI vision or a stock quote feed.
- Select the ticker in the chart input. In the chat tab upload a daily OHLCV CSV (Date or Time; Open, High, Low, Close, Volume). TradingView epoch-second and epoch-millisecond time exports are supported. At least 21 valid rows are required; MA150 needs 150 rows.
- The app draws its **own original candlestick chart** from the same uploaded bars, with MA20, MA150, OHLC tooltips and volume bars. It appears beneath the TradingView widget in the Charts tab after upload. This local chart and the chat use the *same* data.
- You can also use the CSV analyzer page and click "Continue to chat"; data is shared within the current browser tab via `sessionStorage`. No uploaded market data leaves the device in this mode. Refreshing the tab preserves data until the tab/session ends or user clears it.
- When the chart ticker and the uploaded-file ticker label do not match, the analysis is blocked to avoid accidentally answering about the wrong security. The ticker label is user-entered and **not independently verified against the CSV**.
- Answers discuss historical computed trends, breakouts, volume, volatility and approximate range levels. They do not confirm complex patterns from visual screenshots and do not provide live earnings, analyst recommendations, fundamentals or prices.
- **TradingView's embedded chart is a cross-origin widget**: the site cannot read its underlying price candles or what is on screen. Reading screenshots using a remote AI vision model or receiving licensed live candles requires a separate integration and could incur costs; neither has been enabled.
- `netlify/functions/chat.mjs` remains disabled unless explicitly enabled via `ASAF_CHAT_ENABLED=true` (do not enable on a public site without actual server-side identity, quotas and cost protection).
- Regression checks for the local market chat are in `tests/market-chat.test.mjs`; run `node --test tests/*.test.mjs` locally. A successful GitHub commit is not a confirmed Netlify deployment.

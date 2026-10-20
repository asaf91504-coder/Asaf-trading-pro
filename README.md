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


## Owner-only live/near-live market chart + snapshot (October 2026)
The app now includes an **optional**, server-side Twelve Data connector (`netlify/functions/market.mjs`) that loads 200 OHLCV bars on a **manual button click** only. Supported timeframes: 1min, 5min, 15min, 30min, 1h, 1day, 1week. The original HTML Canvas candlestick chart, snapshot PNG and stock-only chat derive from exactly the same bars (not from the cross-origin TradingView iframe). Prices are *not guaranteed real time*: verify provider plan, exchange availability and the last bar timestamp. Incomplete bars can move. The snapshot is generated locally and can be downloaded without image/AI API calls. There is no paid AI vision model.

**Nothing is activated on Netlify by a GitHub commit alone. The market endpoint is OFF unless all safety gates are met.**

### Market environment variables (set in Netlify dashboard only; never commit credentials)
- `ASAF_MARKET_ENABLED=true` — opt-in. Without this, the function exits before contacting a provider.
- `ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED=true` — opt-in *only after verifying your subscription permits displaying these quotes*. Twelve Data's FREE Basic plan is advertised as "internal non-display"; it is **not a license to display its market data in your chart or redistribute it**. Individual subscription plans do not allow commercial/public redistribution; do not enable this site for other people without data display/redistribution rights.
- `ASAF_MARKET_ACCESS_CODE=<long random secret, 20+ characters>` — private owner passcode, entered in the browser when fetching. Do not share.
- `TWELVE_DATA_API_KEY=<secret>` — source-specific credential with appropriate license. Never set it as public/build variable or put it in client code.
- `ASAF_MARKET_ALLOWED_SYMBOLS=AAPL,NVDA,MSFT` — **required** comma-separated allowlist (short list), limits which symbols can consume provider requests.

After redeploy, choose a symbol and timeframe and click "📡 הבא נתוני שוק" in Charts. Supply **the private market access code** (not your API key). The provider response appears in an original chart and becomes the sole source of the market chat's numerical statements. Use "📸 צלם את הגרף ונתח" to capture it and receive local analysis of the same bars, or download a PNG.

### Security and cost limitations
- Market fetch requires a long access code and ticker allowlist, and runs only on explicit clicks. The browser throttles repeat calls to the same ticker/timeframe for five minutes. The function keeps a per-instance five-minute cache. **Neither is a durable distributed quota or a hard cost cap**, and provider API credits and Netlify usage limits may apply if enabled.
- No automatic polling, payments, purchases, subscriptions, paid OpenAI requests or live API requests are performed by the code merely being in the repository. No provider connection has been activated or tested with a real key.
- Do **not** open this endpoint for public use until server-side authentication, distributed usage caps, data rights and hosting billing controls are in place.
- The still-present OpenAI server endpoint is disabled by default, `ASAF_CHAT_ENABLED` unset. The client app uses free deterministic market calculations, not paid screenshot interpretation.
- See `tests/market.test.mjs` for mocked offline backend tests. Run `node --test tests/*.test.mjs` with Node 20+ (tests do not call a real data vendor).
- TradingView is independently embedded for visual reference. Its data and image are not accessible to the app. Only the original Canvas chart is snapshotted and analyzed.

Docs: https://twelvedata.com/docs | https://twelvedata.com/pricing | https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage | https://www.tradingview.com/widget-docs/widget-formats/


## Real conversational chart AI (free model, private opt-in) — October 20, 2026
**The former keyword-generated chat responses have been replaced in `stock-chat-ui.mjs` with a real multilingual LLM conversation via `netlify/functions/free-chat.mjs`.** The AI receives the user's question, up to eight conversation turns, computed OHLC technical indicators, the last 30 chart candles, and — when included — a compressed chart screenshot / uploaded image. This is different from the optional **"local mathematical analysis"** button, which remains explicitly deterministic.

No cost activation takes place from the GitHub commit. The server returns HTTP 503 and calls no model unless the site owner explicitly sets:
1. `OPENROUTER_API_KEY` — the owner-created OpenRouter key, secret in Netlify only
2. `ASAF_FREE_AI_ACCESS_CODE` — an independent 24+ character personal passcode
3. `ASAF_FREE_AI_ENABLED=true` — enable the *free model only*

The model ID is **hardcoded `openrouter/free`**, which OpenRouter currently advertises with zero prompt and completion token prices. There is *no fallback* to premium models or OpenAI. Free accounts currently have a 50-request/day quota and limited availability, and model choice can change; image support depends on the dynamically selected free model. This is a research beta, not a guaranteed free hosted service or SLA; Netlify hosting usage still matters. The backend includes an owner passcode and only a per-instance best-effort 6-request/minute throttle — **not durable global authorization, spending protection, or a public service quota**. Keep private until proper authentication and server-side quotas have been deployed.

The frontend now prefers actual AI over canned replies. If disabled or unavailable, it says so openly rather than pretending to be AI. Deterministic analysis only runs when specifically selected. A mobile user may upload a chart screenshot or click "Capture and analyze" on the site's original Canvas graph, which includes the same OHLC candles analyzed. The embedded third-party TradingView iframe itself **cannot be screenshotted/read directly by JavaScript**; take a normal device screenshot and upload it if needed.

### Premium upgrade is optional and *not* currently implemented or enabled
OpenRouter Standard is pay-as-you-go, with no minimum subscription commitment. Upgrading the site to a paid model should be done only after agreeing a spending cap, adding authentication and durable request quotas, using restricted API keys, and receiving the owner's explicit approval for the specific provider and budget. This deployment remains fixed to free-only routing.

See `tests/free-chat.test.mjs` for mocked no-credential regression tests; no live LLM call or purchase has been performed.

Official docs: https://openrouter.ai/openrouter/free | https://openrouter.ai/pricing | https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request

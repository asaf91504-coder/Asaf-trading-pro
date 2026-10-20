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

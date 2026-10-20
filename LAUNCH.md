# ASAF Trading Pro — launch state

The application is an unfinished research platform. The source has features ready for deployment; a commit or a passing offline test does not verify the live deployment. Never call the site complete until the deployed flows are checked.

## Available without a data subscription

- Original candlestick chart: CSV upload or paste, MA20/MA150, volume, crosshair, zoom/pan, fullscreen and PNG capture. Trendlines are saved locally by symbol and candle date; only lines whose anchor candles remain available are restored.
- Daily CSV screening with price, MA20, ATR and relative-volume filters. No automatic market-cap verification, pattern certainty or promised return.
- Watchlist with research notes, local price-level checks and JSON backup/merge. A level is checked only against the last two loaded bars, not in the background.
- Long/short position planner bounded by risk and available capital.
- Free-only AI, cancellation and dataset-switch protection. The model is hardcoded `openrouter/free`; no paid fallback.

## Prepared but NOT activated

1. **Invited users:** same-origin login, salted scrypt password hashes, opaque one-hour server sessions, HttpOnly/Secure/SameSite cookies, logout and member revocation. This is invitation-only; there is no self-signup, password recovery, email verification or subscription billing. Provision accounts manually before enabling. Choose an external identity provider if those flows are needed.
2. **Distributed quotas:** atomic global 40/day maximum, global 6/minute and member 10/day maximum. Failed provider attempts consume a slot. UTC day boundaries apply. Store failure blocks model access. These counters are request limits, not a hosting or vendor billing guarantee. Keep provider and Netlify spending controls independently configured.
3. **News:** Marketaux adapter, safe title/source links, deduplication, shared Redis snapshot, stale labels after 30 minutes, prior-snapshot retention on failure and one provider attempt per 15-minute bucket. No full article body, translation, generated summary, or AI news research is included. Public display/storage rights must be confirmed for this exact use.

## Payment and activation rule

The owner must write **מאושר** for a concrete charge before any purchase or paid commitment. A $700/month ceiling is not authorization to subscribe. Do not set approval/license flags based on a budget or a pending quote. No accounts, purchases, credits, licenses or new external credentials were created by these code changes.

All new services default OFF. Do not set these until approval and provider configuration have actually been completed:

| Server variable | Purpose |
|---|---|
| `ASAF_EXTERNAL_SERVICES_APPROVED=true` | Explicit approval gate for external persistent storage/service use |
| `ASAF_REDIS_REST_URL`, `ASAF_REDIS_REST_TOKEN` | Upstash REST endpoint and secret server token, never frontend/build-public |
| `ASAF_PUBLIC_AUTH_ENABLED=true` | Switch AI from owner passcode to invited-user sessions; requires working storage and provisioned members |
| `ASAF_FREE_AI_DURABLE_QUOTA=true` | Optional distributed limits in owner-only mode; public mode always requires them |
| `ASAF_FREE_AI_DAILY_LIMIT` | Optional integer 1–40, default 40 |
| `ASAF_NEWS_ENABLED=true` | Enable the cached news endpoint/refresh pipeline |
| `ASAF_NEWS_LICENSE_CONFIRMED=true` | Only after confirming display, attribution and caching rights |
| `MARKETAUX_API_TOKEN` | Secret provider token |

Keep existing `ASAF_CHAT_ENABLED` and `ASAF_MARKET_ENABLED` unset. Existing owner free-AI settings remain required for owner mode. Public mode still needs `ASAF_FREE_AI_ENABLED=true` and the OpenRouter secret.

### News schedule — not installed

After approval and provider/storage testing, add this to `netlify.toml` and redeploy:

```toml
[functions."news-refresh"]
  schedule = "*/15 * * * *"
```

This is 96 scheduled attempts per day, one page of up to 10 provider results per attempt. It does not claim coverage of all financial news. Confirm quota, hosting costs and license scope before activation. Netlify executes scheduled functions in the production deployment. The function also checks `CONTEXT=production` and namespaces production vs preview data. Do not place the schedule in production merely to test it.

### Invited-user administration — not run

`node scripts/manage-member.mjs` consumes a single JSON object on stdin: action `save` with email and 12–200 character password, or action `disable` with email. Supply secrets through a protected interactive/admin workflow, never shell arguments, logs, chat, checked-in files, or client code. Environment must include the approved storage configuration and `CONTEXT=production`. Password reset uses `save`; disabling a member blocks existing sessions. This utility has not provisioned any real member. No password-recovery flow exists yet.

### Deployment acceptance checks still required

- Confirm latest main commit in Netlify and inspect build/function bundling logs.
- Verify health, free-chat and unchanged paid/market gates without exposing secrets.
- Verify CSV paste/upload, timeframe label, zoom, drawings, watchlist reload/backup, mobile touch layout, and cancellation during AI/data changes.
- Verify invited login/logout/revocation, global quotas across two function instances, store outage behavior and password throttling using test accounts before public AI launch.
- Verify licensed news refresh, cache reads, attribution, duplicate handling and stale content after a provider outage.
- Configure host-level abuse controls and approved spending limits. Do not remove site protection until session-backed AI and quotas have been verified, or keep AI disabled while publishing the static interface.

## Development

`node --test tests/*.test.mjs` runs mocked/local checks without real provider requests or credentials. No dependency installation is needed.

Official integration references: https://www.marketaux.com/documentation ; https://upstash.com/docs/redis/features/restapi ; https://docs.netlify.com/build/functions/scheduled-functions/

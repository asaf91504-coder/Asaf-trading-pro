# ASAF Trading Pro — launch state

The application is an unfinished research platform. The source has features ready for deployment; a commit or a passing offline test does not verify the live deployment. Never call the site complete until the deployed flows are checked.

## Available without a data subscription

- Original candlestick chart: CSV upload or paste, MA20/MA150, optional SMA-seeded EMA50 and Wilder RSI14, candles/closing-line display, volume, crosshair, zoom/pan, fullscreen and PNG capture. Trendlines are saved locally by symbol and candle date; only lines whose anchor candles remain available are restored. Display style and indicator toggles persist locally. Indicators are cached on dataset load; they are chart-only and are not added to the AI payload.
- Daily CSV screening with price, MA20, ATR and relative-volume filters. No automatic market-cap verification, pattern certainty or promised return.
- Watchlist with research notes, local price-level checks and JSON backup/merge. A level is checked only against the last two loaded bars, not in the background.
- Long/short position planner bounded by risk and available capital.
- Free-only AI, cancellation and dataset-switch protection. The model is hardcoded `openrouter/free`; no paid fallback.

## Member access and integrations

1. **Invited users:** same-origin login, salted scrypt password hashes, opaque one-hour server sessions, HttpOnly/Secure/SameSite cookies, logout and member revocation. This is invitation-only; there is no public self-signup, automatic recovery email, email verification or subscription billing. Operator-issued one-time recovery links support user-chosen replacement passwords and invalidate all prior sessions. A single-use invitation can activate a new account with a user-chosen password; existing accounts cannot be overwritten. Account, membership, session and invite consumption are committed atomically. Provision an invitation before enabling and complete live login/logout/revocation checks.
2. **Distributed quotas:** atomic global 40/day maximum, global 6/minute and member 10/day maximum. Failed provider attempts consume a slot. UTC day boundaries apply. Store failure blocks model access. These counters are request limits, not a hosting or vendor billing guarantee. Keep provider and Netlify spending controls independently configured.
3. **News:** Marketaux adapter, safe title/source links, deduplication, shared Redis snapshot, stale labels after 30 minutes, prior-snapshot retention on failure and one provider attempt per 15-minute bucket. No full article body, translation, generated summary, or AI news research is included. Public display/storage rights must be confirmed for this exact use.

## Payment and activation rule

The owner must write **מאושר** for a concrete charge before any purchase or paid commitment. A $700/month ceiling is not authorization to subscribe. Do not set approval/license flags based on a budget or a pending quote. No accounts, purchases, credits, licenses or new external credentials were created by these code changes.

All integration gates default OFF in source. On 2026-10-21, the owner approved connecting a Free Upstash Redis database to Netlify. Production-only storage secrets, external-service approval and durable owner quotas were configured and deployed; health reported durableQuotaEnabled=true. Redis CLI diagnostics confirmed per-member/global quota rejection on isolated test keys, and mocked independent function instances confirmed fail-closed quota/outage behavior. These checks do not substitute for a complete authenticated live chat test. No market/news provider was enabled.

Set the remaining gates only after their prerequisites are completed:

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

`node scripts/manage-member.mjs` consumes one JSON object on stdin: `status` or `disable` with email, or `invite` / `reset` with email and a cryptographically random 64-hex token held in the approved private delivery workflow. Invite TTL is 24 hours; reset TTL is 15 minutes. Reset binds to the current account version and cannot reactivate a disabled member. The CLI prints only redacted operation status. Supply secrets through a protected interactive/admin workflow, never shell arguments, logs, chat, checked-in files, or client code. Environment must include the approved storage configuration and `CONTEXT=production`. Password recovery is completed by the user on `/activate#reset=...`; disabling a member blocks existing sessions. This utility has not provisioned any real member. The old password-provisioning CLI has been replaced: no operator chooses a member password.

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

## One-time invitation activation

`activate.html` reads a 32-byte random invitation token from the URL fragment, immediately removes the fragment from browser history, retains it in tab-scoped session storage for at most 30 minutes to survive refresh, and submits it only to the same-origin activation function. Passwords are entered by the invited user in the browser, never in chat. The endpoint requires the public-auth gate and approved storage.

An admin provisions a Redis key `asaf:production:auth:invite:<sha256-of-token>` with JSON `{"emailHash":"<sha256-of-normalized-email>","expires":<unix-milliseconds>}` and a matching Redis TTL. Use a short expiry, e.g. 24 hours. The raw token must never be stored in Redis, source, logs or chat; deliver the activation page through a private browser handoff. There is no invitation-email sender or admin web console yet. GET does not consume an invitation. POST requires same-origin JSON, validates input, applies a shared activation throttle, and cannot replace an existing account. Account creation, session creation and invite consumption use one atomic Redis script.


## Account lifecycle update — 2026-10-21

Source adds short-lived single-use password recovery, invalidation of all old sessions after reset, non-password-setting operator tools, public-interface labels, and explicit account watchlist/notes copies. Watchlist copies are isolated by the authenticated member ID and use atomic revision checks to reject concurrent stale writes. Signing in never uploads device data automatically. Users explicitly load/merge or save; local data stays local on sign-out. A shared device's local list is not a private per-account vault. Journal, research bookmarks, chart preferences, drawings and conversation history are not yet synced.

Offline tests cover activation, reset/replay, old sessions, disabled users, two-member data isolation, concurrent revision conflicts, throttling, foreign origins and store outage. Production verification and owner activation are separate acceptance steps, never inferred from tests. Invitations are operator-issued; there is no admin web console, automatic email sender, verified-email state, public signup or self-service recovery request. Do not advertise these missing capabilities.

Netlify production interface was made public on explicit owner approval. Invited-user AI authentication and durable quotas remain enabled; market/paid-AI/news flags remain disabled. No new subscriptions or credits were purchased.


## Runtime namespace correction

Netlify exposes CONTEXT during build, not as a guaranteed Functions runtime variable. `scripts/write-runtime-context.mjs` now writes a non-secret namespace module before function bundling. Production bundles use production storage even when runtime CONTEXT is absent; preview/branch bundles use preview. The tracked module defaults to preview for local checks; unknown build contexts fail the build. No automatic migration or sharing between namespaces is performed.

Activation now supports same-origin `action:check` with token/email and no password. This applies the shared throttle and validates the stored invitation without consuming it, hashing a password, creating an account or issuing a session. The page offers this check explicitly before password entry. Invalid token/expiry and email mismatch have separate useful errors. A valid invitation alone does not verify account creation.


## Authenticated production QA and AI context correction

Owner activation, user-completed recovery, and secure password login were verified on production. A genuine free-model concept response was received. A 160-row synthetic CSV named QA.TEST produced close 259, MA20 249.5 and MA150 184.5 at 2025-06-09; model analysis received the matching symbol/date/computed values. This was test data, not live market evidence. A follow-up exposed confusion between the summarized series and the 30 detailed candles, now addressed by explicit total/detail counts, first/last timestamps and prompt instructions. Long model responses now carry a truncation warning for provider length stops or the local safety cap, with no automatic retry and no paid fallback.

Account watchlist save and load in a second tab succeeded with the existing three entries; concurrent stale saves were rejected, preserving the newer account copy. These checks do not verify another physical device, email verification, journal/settings synchronization, or real-time market/news feeds. Logout/unauthenticated rejection remain separate live checks.

## Scanner filter update — 2026-10-23

The CSV scanner adds a minimum ATR percentage, optional close above the previous 20 daily highs, and optional higher close with volume strictly above the previous 20-day mean. Higher close plus elevated volume is an observable daily-bar proxy, not measured buy-side volume. CSV export includes rejection reasons. These filters do not establish market cap, pattern targets, a 15% return, or real-time market coverage. GitHub write access was verified on 2026-10-23. This source update passed 91 offline tests; the production deployment must be verified separately.

## Production scanner acceptance — 2026-10-23

Production serves the new ATR, breakout and rising-volume filters. Browser QA used an explicitly synthetic QA.TEST dataset (30 daily bars, last close 130, MA20 120.5, ATR 2.31%, relative volume 2). The rising-volume filter accepted it; the breakout filter rejected the equal-to-prior-high close; minimum ATR 3 rejected it with both reasons visible. Opening its chart preserved the matching symbol, close, MA20 and date. The synthetic dataset was not market evidence and no provider/AI calls were made. Health reported status ok, free-only AI/auth/durable quotas enabled, and market/paid AI/news disabled. Automated checks passed 91/91 before rollout. These checks do not verify mobile hardware, live market coverage, licensed news, or authenticated AI on this deployment.

## Remaining product roadmap — 2026-10-23

Owner requests both Google and Apple ID sign-in for end users. Neither is implemented or enabled yet. Preserve existing member sessions, revocation and quotas; social login must not automatically grant AI access or merge accounts on an unverified email match.

1. Google OIDC authorization code flow, server-side identity verification, login UI, safe account linking and console credentials/approved callback URLs.
2. Sign in with Apple web flow, Services ID associated with a primary App ID, approved domains/return URLs, server-only signing credentials, private relay email handling and membership prerequisites. No purchase is authorized by this request.
3. Public onboarding/account lifecycle: decide invited versus public membership, self-service recovery, transactional email, email verification, account deletion and administration.
4. Licensed market data: active provider account/keys, public redistribution rights, current/delayed labels, exchange coverage, refresh/WebSocket limits and spending controls.
5. Expand original chart styles, intervals, indicators and drawings to the original specification; preserve chart/data/AI synchronization and add real-device mobile verification.
6. Automatic multi-symbol scanner: market cap, expanded technical/fundamental filters, sector/exchange metadata, pattern candidates, levels and explained risk/reward; no guaranteed pattern or 15% return claims.
7. Background alerts: server-side price/technical checks, user notification channels and delivery/quiet-hour settings.
8. Licensed news: enable provider/cache and production 15-minute refresh after quota/license approval; verify stale/outage behavior and attribution.
9. AI: current-market/chart context from connected data, screenshots, requested-indicator context, earnings/news grounding, quotas, vision availability and controlled costs.
10. Account synchronization for journal, research bookmarks, chart preferences/drawings and conversation history; current account copies cover watchlist/notes only.
11. Public launch operations: custom domain, privacy/terms, host abuse controls, production login/logout/revocation checks, backups/monitoring and load/mobile coverage.
12. Optional commercial plans/billing only after a separate explicit product decision and concrete charge authorization. No broker integration is requested.

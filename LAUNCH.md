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

`node --test tests/*.test.mjs` runs mocked/local checks without real provider requests or credentials. Run `npm ci` first; Google ID tokens use the maintained `google-auth-library`.

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

Owner requests Google-only sign-in. Apple ID was explicitly removed from scope. Google source is implemented but remains disabled pending console configuration and live acceptance checks. Preserve existing member sessions, revocation and quotas; social login must not automatically grant AI access or merge accounts on an unverified email match.

1. Google Identity Services popup ID-token flow: source implemented with signature/audience/issuer/expiry verification, browser-bound one-use nonce and explicit linking of existing password accounts. Console client ID and production verification remain required.
2. Account management source now includes self-deletion, logout of all sessions and allowlisted administrator status/enable/disable controls. Configure the admin member ID and verify production actions before advertising them.
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


## Google and member market integration — 2026-10-23

108 offline tests passed. Google and public market access default OFF; source readiness does not establish a live connection. No subscriptions were purchased. A reply from Twelve Data dated October 20 requests product details; a follow-up is drafted, not sent.

### Google activation

Create a Web application OAuth client using Google Auth Platform. Add the exact JavaScript origin `https://joyful-seahorse-967889.netlify.app` (no path). Configure Branding/Audience with an accurate support email, consent information and published privacy/terms pages as required by Google. Testing mode requires approved test users. This implementation uses a JavaScript popup callback, not a redirect callback or a client secret. Never put secrets in the frontend.

Set server-side `GOOGLE_CLIENT_ID`, `ASAF_GOOGLE_AUTH_ENABLED=true` and, only when public onboarding is intended, `ASAF_GOOGLE_SIGNUP_ENABLED=true`. Default new-Google-account cap: 100 (`ASAF_ACCOUNT_MAX_MEMBERS`). Existing password accounts must first sign in and explicitly link the same verified email. Provider subject, rather than email alone, is the linked identity. Missing storage/config fails closed. New Google users receive the same existing free-AI member quota, without paid AI.

Set `ASAF_ADMIN_MEMBER_IDS` to comma-separated existing member UUIDs to grant the account administration UI. Never accept administrator roles from browser input or Google email alone. Existing password users must sign in again to create their management index. Account deletion removes the server watchlist/notes copy and revokes all sessions; local device data is unchanged. Automatic password recovery email remains unimplemented.

### Member market activation

The new `public-market` endpoint uses authenticated sessions, shared 60-second snapshots, a distributed fetch lock and provider counters. It does not implement a WebSocket or second-by-second stream. The legacy owner passcode does not grant member access.

Only after written display/redistribution rights for this site and intended AI use: set `TWELVE_DATA_API_KEY`, `ASAF_MARKET_ENABLED=true`, `ASAF_MARKET_DISPLAY_LICENSE_CONFIRMED=true`, `ASAF_MARKET_PUBLIC_LICENSE_CONFIRMED=true`, an explicit numeric `ASAF_MARKET_DELAY_MINUTES` (0 only if contracted real-time), and comma-separated `ASAF_MARKET_ALLOWED_SYMBOLS`. Keep provider quotas within the actual contract; defaults are 8 requests/minute and 800/day, configurable by `ASAF_MARKET_REQUESTS_PER_MINUTE` and `ASAF_MARKET_REQUESTS_PER_DAY`. Failed provider attempts consume quota. These counters do not guarantee vendor or hosting costs. All fetching currently uses OHLCV `/time_series`, UTC timestamps and at most 200 bars; fundamentals, earnings and market-wide scanning are not connected.

Live acceptance still required: actual Google login/link/logout/revocation/deletion with a test account; configured admin authorization; actual licensed market timestamps, entitlement, cache and quota behavior. Keep unavailable features labelled pending.


## Chart indicator and AI context update — 2026-10-23

Added optional Bollinger bands (20 closing prices, population deviation ×2), MACD (12/26/9, SMA-seeded EMA) and Wilder ATR14 panels, alongside existing RSI14/EMA50 and simple averages. ATR uses the same seed convention as the scanner: 14 changes, excluding the first bar. MACD signal starts at bar 34. Missing warmup values are null, never zero substitutes. Each oscillator has a separate vertical scale and the same candle x-axis. Display toggles persist locally. Plot drawing points are restricted to the price pane. No extra provider calls or subscriptions.

The frontend now sends at most 2,000 loaded bars to the authenticated free-chat function (700 KB request cap, existing image bounds and quotas preserved). The server validates and recomputes indicators with the same shared formulas as the chart. The LLM receives a bounded summary, enabled-indicator names, display style and only the final 30 detailed candles, not 2,000 raw candles. Browser-supplied indicator numbers are ignored. Zoom does not change the indicator seed or calculation history. Data provenance/freshness remains unverified for browser-supplied CSV. Existing provider adapter remains capped at 200 bars, so extending local history does not expand its coverage.

Historical documentation referring to a 200-bar AI request cap or indicators being chart-only is superseded by this update. Google and licensed market integrations remain disabled pending external configuration.


### Production indicator acceptance

114 automated tests passed before deployment (commit 962eb2f). On production, a synthetic 200-bar QA.TEST dataset ending 2025-07-19 displayed close 128.5755, RSI14 77.7757, ATR14 2, MACD 0.5275, signal -0.0303 and Bollinger bounds 127.8928/121.4202. Browser QA verified the three toggles, candle/line display, zoom, fullscreen drawing and separate RSI/MACD/ATR panes. The three toggles and line style survived reload. Synthetic bars and test conversation were cleared afterward. No AI or market-provider calls were made by this browser check. Actual authenticated model interpretation and physical-phone touch remain separate checks.


## Personal account copies and journal update — 2026-10-23

The account workspace now supports explicit individual copies of journal trades, research sources, chart preferences and date-anchored trendlines, alongside watchlist/notes. No sign-in-triggered uploads. No raw chart bars, screenshots or chat conversations are stored in this account copy. Existing section writes preserve the other sections. All changes share an atomic revision; stale writes are rejected. Request identity must match the authenticated member. The commit also checks the session and membership records atomically and uses Redis server time to reject expired sessions, preventing deletion/revocation races from resurrecting private workspace records. Account deletion removes this entire workspace.

Limits: 300 journal trades, 100 research sources, 30 symbols × 30 trendlines and 750 KB UTF-8 for request/stored workspace. All records are validated and limits fail visibly instead of truncating. There is no automatic background or two-way synchronization: users save, load/merge and handle conflicts explicitly. Cloud records win matching IDs; cloud preferences and per-symbol drawings take priority. Deleting a local entry does not alter the account copy until explicit save; loading/merging an older copy may restore deleted local entries.

Journal now supports editing existing trades, local JSON backup/import and account-copy controls on the journal page. The account uses the existing same-origin session; sign in on the main page. Trade edits retain IDs. Failed local saves preserve the prior dataset and the edit form. Invalid existing local journals are not silently overwritten. CSV export remains available. Personal backup imports do not accept credentials, script URLs or incompatible section types. Templates for chart styles and indicator booleans only include implemented controls.

125 automated tests passed, covering backup round trips, validation, long/short net P&L, duplicate IDs, limits, conflicting writes, preserved sections, foreign-member rejection, revocation/deletion during commit and outage behavior. Actual production signed-in save/load on a second device remains an acceptance check. Physical-mobile verification and chat-history synchronization remain outstanding.

# ASAF Trading Pro — launch state

The application is an unfinished research platform. The source has features ready for deployment; a commit or a passing offline test does not verify the live deployment. Never call the site complete until the deployed flows are checked.

## Current work-order summary — 2026-10-24

This table supersedes historical capability and pending-quote summaries later in this document. The system remains a beta, and implemented source is not equivalent to licensed/activated/live-accepted service.

| Item | Current implementation | Outstanding |
| --- | --- | --- |
| 1 Google | Verified-token flow, nonce, explicit linking | Client configuration and real sign-in; OFF |
| 2 Accounts | Sessions, revocation, deletion, allowlisted admin controls | Full live management acceptance |
| 3 Onboarding | Invitations and one-use recovery links | Automatic verified transactional email/public onboarding |
| 4 Market | Shared gated cache, quotas, declared-delay enforcement | Licensed subscription/key and actual coverage acceptance; OFF |
| 5 Charts | Seven styles, seven drawing tools, precise anchors, MA20/50/100/150/200, EMA50, RSI, ATR, Bollinger, MACD, Stochastic, OBV | Remaining original indicators/timeframes/tools and physical-phone acceptance |
| 6 Scanner | Daily CSV/provider batch adapter, technical filters, seven pattern-candidate rules, measured scenarios and risk-planner handoff | Market cap/fundamentals, whole-market universe, remaining pattern families, licensed provider activation |
| 7 Alerts | Account daily closed-bar rules/inbox, quiet hours/dedup, prepared background worker | Schedule activation, real delivery acceptance, email/Push channels; background OFF |
| 8 News | Gated title/link cache, symbol filtering, prepared refresh | Commercial rights/key and scheduled production acceptance; OFF |
| 9 AI | Fixed free-model router, shared server indicators/patterns, provider-cache binding, gated news context | Actual licensed live data/vision tests, earnings integration |
| 10 Personal copies | Explicit save/load and JSON backup of journal, research, preferences, drawings, text archives; pasted restore fallback verified with synthetic research | Actual signed-in second-device acceptance; native file chooser restore remains unverified |
| 11 Launch | Anonymous health/security/privacy checks, data-use explanation and current setup guide | Domain/DNS, legal contact/terms, host spending/backups/load/mobile acceptance |
| 12 Billing | Disabled | Optional product/pricing decision and concrete charge approval |

## Available without a data subscription

- Original CSV/paste chart and scanner; all prices remain labelled with loaded source/date. Current chart/indicator/drawing scope is in the table above. Same calculations are used for scanner results and server AI context; no fabricated live prices.
- Heuristic daily pattern research is bounded at 200 loaded candles. Each candidate carries rules/levels/date; measured moves are not return promises. Market capitalization remains unverified.
- Watchlist, notes, journal, local backups, explicitly saved text conversations, and optional explicit account copies with revision/identity guards. No sign-in-triggered upload or automatic cross-device merge.
- Long/short position planner bounded by user risk and capital; no broker integration or order submission.
- Authenticated, quota-limited free-model chat with cancellation and dataset-switch protection; no paid-model fallback.

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

108 offline tests passed. Google and public market access default OFF; source readiness does not establish a live connection. No subscriptions were purchased. A reply from Twelve Data dated October 20 requests product details; the follow-up was sent with owner approval, and the supplier answered on October 23.

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


## Scanner momentum filters and journal UI checks — 2026-10-23

The daily CSV scanner now computes RSI14 and MACD using the chart's shared formulas on the scanner's bounded 200-bar series. Added opt-in inclusive RSI range, strict MACD-above-signal and MACD-positive filters. Incomplete warmup explicitly rejects enabled filters; MACD line needs 26 bars and its signal needs 34. The table and CSV include RSI, MACD and signal values, and CSV also includes the histogram and rejection reasons. This is still a local uploaded-data scanner, not a market-wide automatic scan. No fundamental/market-cap verification or guaranteed target calculation was added. 127 automated tests pass.

Production journal UI verified adding a synthetic QA.TEST long trade (100 to 110, quantity 10, fees 2) with net P&L 98, then editing the same trade to exit 112 with P&L 118 and count still 1. JSON backup download succeeded. The browser connection timed out during the restore attempt, so that restore attempt and final local QA cleanup were not confirmed. No real account data or provider requests were involved; the fixture was labelled synthetic. Account save/load on an authenticated second device remains unverified.


## Work-order 4–9 update — 2026-10-24

Supplier reply (October 23): Venture $149/month or $1,490/year; independent operator eligible; 610 API credits/minute and 500 WebSocket credits; no additional US exchange/per-user/reporting fees per written clarification. Public chart display, screening, derived alerts and selected-data LLM inference are permitted; raw-data redistribution is excluded. Intraday feed covers approximately 5% of US volume from selected venues; it is not consolidated. Daily/EOD history is consolidated per supplier. Attribution is required. Retention is permitted during subscription, with raw data deleted within 30 days after access ends. No subscription has been purchased or activated. The historical pending-quote paragraphs above are superseded by this reply.

4. Refactored one shared market adapter for chart, scanner and background processing with distributed provider quotas and locks. Declared delay is now enforced using completed-bar end times; delayed daily/weekly bars are conservatively withheld until the full UTC period ends. Cached snapshots retain their original receivedAt and expire from storage within two days. Coverage labels distinguish daily/EOD from the partial intraday volume feed. Provider flags and API key remain unset in production.
5. Added Area, OHLC bars, hollow candles, Heikin Ashi and Baseline alongside candles/line. Heikin Ashi uses recursive averaged prices; raw close/indicators/AI OHLC stay on original bars. Missing open values reject HA display. Added horizontal/vertical lines, rectangles and Fibonacci retracements; date-anchored drawings and all implemented styles survive account schema validation. Baseline references the first loaded close. This does not complete every requested timeframe, indicator or drawing tool.
6. Added an authenticated, bounded five-symbol daily provider scanner, sharing cache and quotas with charts. It validates all selections before fetching; one provider failure yields an explained partial result. Optional frontend refresh runs every five minutes while visible and stops on error/logout. No market-wide universe, market-cap/fundamental verification or pattern-target certainty is claimed.
7. Added account-scoped daily alert rules (price, MA20, RSI crossings), UTC quiet hours and an in-site inbox. Workers only inspect closed daily bars, avoid back-firing before rule creation, reject stale data and deduplicate per rule/bar. Account deletion removes alert rules, state, inbox and membership index; worker appends compare account/rule records atomically to prevent resurrection. Rules are limited to approved symbols. No email, SMS or Push delivery is implemented. A background cycle rotates two approved symbols per run and evaluates up to 100 accounts. The public manual trigger is admin-session-only. `deployment/market-refresh-function.mjs` is a schedule activation template, NOT an installed cron.
8. News refresh now uses the built runtime namespace rather than assuming runtime CONTEXT exists. Added symbol filtering of the shared title/link feed. Marketaux commercial display, retention and AI rights still require confirmation and a provider key. The 15-minute news cron is NOT installed.
9. Provider AI analysis reads server-cached bars and binds the exact receivedAt of the displayed chart; altered/stale snapshots are rejected before model calls. Browser-provided provider bars are ignored in this mode. Requires `ASAF_MARKET_AI_LICENSE_CONFIRMED=true`. Optional news grounding reads at most three symbol-matching cached headlines only when `ASAF_NEWS_AI_LICENSE_CONFIRMED=true`; future, unmatched or stale items are omitted. Missing earnings sources are explicitly identified. CSV remains browser-supplied/unverified; screenshots/HA are not executable market prices. Free-model and distributed request caps remain unchanged.

### Activation still outstanding

- Explicit approval of the concrete $149 recurring monthly subscription, then provider checkout and secure server-key configuration; set display/public/AI license flags only for the clarified permitted uses. No raw-data export service.
- Confirm plan quotas, the approved symbol list (1–50 symbols) and explicit delay; test actual timestamps, OHLCV and attributed coverage with the real subscription. Default provider limits stay 8/minute and 800/day until deliberately changed within the contract.
- Set `ASAF_BACKGROUND_REFRESH_ENABLED=true` only after data, admin authorization, quotas and hosting spending controls are checked. Copy the prepared function to `netlify/functions/market-refresh.mjs` to install its private 15-minute schedule; at most 192 symbol refresh attempts/day from this schedule, in addition to interactive requests under the same global counters. No schedule was installed by this update.
- Marketaux rights/key plus reviewed 15-minute schedule remain separate. News/AI news flags remain OFF.
- Actual signed-in alert save/load, provider fetches, scheduled invocations, source-grounded LLM responses and physical-mobile UI still require live acceptance. Google setup remains outstanding.

140 automated tests passed, including delay boundaries, shared cache/quota behavior, HA formulas, drawing schemas, cached-provider AI context through the authenticated route, news filtering, batch scanning, rule revision/identity checks, quiet hours, deduplication, account deletion and revocation during inbox append.

### Production UI acceptance for 4–9

Production health reports the new version; licensed market, background and news flags remain OFF. Scanner configuration reports disabled and anonymous alerts return 401. A synthetic 200-bar QA.TEST dataset verified the seven-style selector including Heikin Ashi, Area, OHLC bars, hollow candles and Baseline, unchanged raw close/indicator values, and the five drawing choices. Screenshot captured with the actual rendered Heikin Ashi chart. UI inspection found the legacy tab handler hiding nested sections; it now limits visibility toggles to top-level main panels so the account alerts section stays visible within Watch. Provider scanner auto-refresh remains unchecked. No provider or LLM requests were made. Real authenticated alert writes, scheduled execution and paid-data integration remain unverified.


## Work-order 10 and launch transparency — 2026-10-24

Added an explicitly saved text conversation archive. At most 20 immutable snapshots, eight alternating successful user/assistant messages per snapshot, 6,000 characters/message and 350KB UTF-8 per archive; invalid/oversize input fails before storage, without silent clipping. Only allowlisted text, symbol, title and save time are retained. Images, raw candles, credentials/unknown fields and system-role messages are not part of the archive schema. Text itself may contain personal information; the UI explains this. New snapshot IDs keep earlier copies intact.

The archive uses the existing explicit personal-section save/load/backup workflow, shared account revision CAS and atomic member/session commit guard. No sign-in upload, automatic cross-device synchronization or automatic conversation restore. Historical previews use textContent in a separate bounded pane, never change current chart/context, never enter model history and label the analysis historical. Logout clears the preview; local archives remain, as with other local personal records. Account deletion already removes the whole workspace key, including this section. Production authenticated archive save/load on a second device is still outstanding.

Added a factual data-use explanation linked from the main footer: local versus account copies, explicit sharing, AI transfer, third-party retention limitations, archive limits, backups and account deletion scope. This is not a completed public-launch legal terms/privacy package: operator contact, legal identity, applicable retention commitments and reviewed terms still need owner-supplied details. Custom domain, external monitoring, provider backup/restore acceptance, physical-phone checks and production load/abuse review remain open. Paid user plans/billing (12) remain off and require a separate product decision.

142 automated tests passed, including text-only archive serialization, disallowed roles, alternating pairs, duplicate IDs, byte/record caps, backup round trips and archive patches preserving all other account sections through authenticated workspace saves. Market/news/background flags stay OFF; free-model controls unchanged.

Production acceptance: health version `2026-10-24-conversation-archive-1` is live, workspace/alerts reject anonymous reads with 401 and the data-use page returns 200 with nosniff. Browser verified archive controls, empty-conversation rejection and the Conversations option in account-copy/backup controls. No model/provider requests or real account writes were made. Added local snapshot removal with an explicit confirmation and a warning that account copies remain until explicitly overwritten; this deletion action was not exercised on user data.


## Launch check continuation — 2026-10-24

Added `node scripts/check-deployment.mjs [https-origin]`, a bounded nine-check operator command. It verifies health/configuration, no-store, basic response security headers, data-use page availability, anonymous workspace/alerts/account denial, method guards on model/admin jobs, and foreign-origin workspace rejection. It does not log response bodies, error details or credentials and never calls market providers or model POST routes. No recurring monitoring or load traffic is installed. Run once after deployments; a passed report is not authenticated/mobile/provider acceptance.

All nine checks passed on the actual production site; 145 automated tests passed including detection of private endpoint exposure, accidental paid-AI enablement, invalid origin inputs and safe network failure reports. Replaced obsolete setup instructions (old GitHub owner, passcode-only flow and outdated quota statements) with the current user workflow. Account-deletion confirmation now explicitly lists archived conversations among removed account copies.

Current access boundaries: code and production source deployment work. Google OAuth console setup/client ID, signed-in browser account acceptance, physical iPhone checks, custom-domain selection/DNS, legal operator contact/terms, provider/host spending settings and licensed provider activation are not verified or available for autonomous completion in this session. Supplier discussions are pending; no purchases, paid user billing or scheduled jobs were enabled. Item 12 remains a separate product decision, not missing mandatory implementation.


## Autonomous work continuation — chart/scanner expansion, 2026-10-24

Item 5: added SMA50/100/200 overlays, Slow Stochastic 14/3/3 (%K and %D) and OBV in independent panes. All defaults are OFF, persist in the existing preference copy and share the same loaded-history seed on zoom. Full-period warmup remains null. Stochastic uses the 14-bar high/low range followed by two SMA3 smoothings; first slow K is bar 16 and first D bar 18. Missing OHLC/zero range is unavailable, not a neutral fabricated value. OBV starts at zero at the first loaded bar and adds/subtracts that bar's volume for rising/falling closes; equal closes add zero. Missing volume breaks continuity and all subsequent OBV values remain null. OBV is signed cumulative volume, not measured buyer/seller flow. Provider remains bounded at 200 bars, so MA200 has only one defined value at that history length.

Item 6: scanner now displays and exports slow K/D and OBV, with optional K>D and final-bar OBV-rising filters. Equality, missing data and inadequate warmup fail those enabled filters. Local/provider scans share the indicator implementation; no new provider requests. Market cap, fundamentals, whole-market scanning and pattern/target coverage remain incomplete.

Item 9: free AI receives the added enabled-indicator names from a strict allowlist and fresh server-computed snapshots; browser-provided indicator values are not accepted. Shared source calculations preserve existing provider-cache and license gates. Existing no-paid-fallback/quota protections remain unchanged.

150 automated tests passed, including independent SMA arithmetic, double-smoothed Stochastic alignment, missing/zero-range behavior, OBV direction/zero volume/gaps, scanner-filter equality/gap handling, independent oscillator layouts down to 180px, preference validation and the actual mocked authenticated AI route receiving only server indicators. Real-device touch and licensed production market/model runs remain separate acceptance checks.

Blocked work is not marked complete: Google client configuration; supplier trials/pricing/keys; real signed-in cross-device acceptance; email/Push delivery; production schedules; custom domain/DNS choice; legal contact/terms; host spending controls; physical phone and production load checks. Item 12 (paid plans) remains intentionally disabled pending a product/pricing decision and explicit charge approval. Code work on 5/6/9 continued while these blockers remained.

Production UI acceptance: synthetic 240-bar QA.TEST data ending 2025-08-28 displayed SMA50 132.2015, SMA100 128.4514, SMA200 120.9512, slow K/D 18.6835/16.6736 and OBV 295780. New overlays and independent Stochastic/OBV panes rendered and persisted after reload. The scanner bounds history to 200 bars, so its zero-seeded OBV was 331520; opening its chart displayed the same 331520, K/D and close from that exact 200-bar series. This confirms shared calculations while documenting why different loaded histories can change OBV/EMA seeds. Both new scanner filters passed on this fixture with Above-MA20 explicitly disabled. Synthetic scanner/chart data and test messages were cleared and preferences restored afterward. No model/provider calls were made by these checks.


## Precise drawing tools continuation — 2026-10-24

Added arrow and percentage-change measurement tools to the existing five drawing modes. Both use two date/price anchors and persist through local storage/account-copy schemas. Measurements show signed price change, percent change and loaded-bar index difference between the chosen points, not predicted returns, elapsed calendar time or risk/reward. Overflowing percentage arithmetic is labelled unavailable rather than rendered as infinity. Arrow heads scale down for short lines and omit the head on a zero-length line.

Added an accessible exact-anchor form for all seven tools, using the selected tool and loaded candle timestamps. Daily and intraday timestamps must match existing data exactly; prices are finite/positive and bounded. Horizontal/vertical tools require only the start point. The form pre-fills from the latest loaded bars, refuses more than 30 drawings and supports keyboard use without canvas pointer coordinates. Existing mouse/touch drawing and legacy trendline records remain compatible. A missing date produces a visible error without adding a drawing. Zoom/pan preserve the original date anchors.

154 automated tests passed, including signed/flat/overflow measurement cases, exact daily/intraday date selection, unsafe numeric input, zero-length arrow geometry and account/backup schema round trips. Supplier inbox check found no replies from Massive or Intrinio at the time of this work. No emails sent, subscriptions purchased or provider/model requests activated.

Production browser acceptance: added a synthetic QA.DRAW 30-bar fixture, created a measurement from 2025-01-05/100 to 2025-01-15/120 and an arrow through the exact-anchor form. A missing end date was rejected visibly. Both drawings survived reload; canvas rendered +20.00%, price delta 20 and 10 bars. Improved measurement text contrast and spacing above the canvas after visual review. No signed-in account-copy write, model call or provider call was performed.


## Backup restore fallback — 2026-10-24

Added pasted-JSON restore to the existing personal sync controls on the main page and journal. It supports journal, research, preferences, drawings and text conversation archives. Parsing/merging is local and uses the existing strict schema and 750KB UTF-8 import cap. A preview reports existing/incoming/overlapping/merged record counts before a separate explicit apply action. Backup entries win overlapping IDs/keys; other local entries remain. No automatic cloud write or provider request. Account change clears the pending preview and pasted content. Changing text/section clears it; changed local data between preview/apply rejects before saving. Local storage write errors preserve the prior value.

This provides a usable alternative to the previously timed-out file-chooser restore test, without retrying that file-upload path. Original file import remains available. Source tests pass 159 cases including duplicate re-import idempotence, backup priority, preserved local-only rows, changed-data/text/section guards, incompatible/oversize/malformed backup rejection and object-section merge boundaries. Production browser paste-restore acceptance remains required before calling that earlier verification gap resolved. Authenticated second-device cloud save/load is a separate outstanding check.

Production browser acceptance for pasted restore: restored one explicitly synthetic research source from an empty local set; changed its title and re-imported the same ID, preview reported one overlap/one final row and exactly one updated source was rendered. Deleting that synthetic source through the app while a preview was pending caused apply to reject stale local data, without resurrecting the source. The source was confirmed absent afterward. No user data, signed-in account writes, provider/model requests or file uploads were involved. This verifies the pasted-JSON fallback; native file-chooser import remains unverified and actual cross-device account acceptance is still open. Cleared old status messages when starting a new preview to avoid displaying a prior success alongside an unapplied preview.


## Scanner pattern research continuation — 2026-10-24

Implemented daily candidate research over at most 200 loaded candles: latest-close breakout/breakdown of prior 20-bar extremes; range compression at no more than 8% of close; opening gaps of at least 2%; Bollinger 20/2 width rank at or below the tenth percentile of 60 prior defined widths; and a double-bottom heuristic with two confirmed sharp pivots. Double-bottom rules: two bars on each side before the latest bar, trough separation 5–40 bars, low-price difference within 3% of their mean, intervening peak at least 5% above the lower low, a prior eight-bar close at least 8% above that low, second low no older than 20 bars, and invalidation if a later low falls more than 3% below support. Latest-close stage distinguishes waiting, current-bar crossing and already above the neckline. The latest bar is not guaranteed closed.

For valid breakouts/breakdowns/double bottoms, measured targets use range height from the trigger, with a reference stop 1% beyond the range. Reference entry is at current close or the trigger as appropriate; a target already behind entry or nonpositive/invalid reward produces no scenario. Numeric targets, moves and reward/risk are illustrative geometry with no probability estimate. A candidate is never assigned a 15% move merely to satisfy a filter. Selected-pattern filters require that SAME candidate to meet any crossing/move/RR thresholds. Missing market cap remains explicitly unverified, so technical matches do not claim to satisfy the owner's full rules.

Added a details panel with levels, timestamps, source and method explanations; optional handoff fills only direction/entry/stop/target in the existing risk calculator, preserving the owner's account/risk/capital fields. Manual price/direction edits clear imported provenance. CSV export includes derived candidate/scenario information. Free AI independently computes the same bounded daily research server-side and never accepts browser-supplied pattern claims. Intraday/weekly AI context does not silently get daily-pattern labels. No new provider requests, schedules, email or paid services.

Concept references (thresholds are our explicit engineering choices, not thresholds endorsed by Fidelity):
- https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/bollinger-band-width
- https://www.fidelity.com/bin-public/060_www_fidelity_com/documents/learning-center/Deck_Chart%20patterns.pdf (double-bottom geometry, pages 19–20)

169 automated tests pass, covering known candidate geometry, prior-window boundaries, absent targets, pivot confirmation without future bars, invalidation, Bollinger warmup/ranking, unavailable opens, invalid dates/order, selected-candidate filtering, unchanged capital/risk limits and the mocked authenticated AI route's server research. A local 50-symbol × 200-bar research batch completed in approximately 99ms on this container; this is not a production load test. Live scanner/filter/details/risk handoff and deployment acceptance remain required before marking this rollout checked.

Production browser acceptance: an explicitly synthetic QA.PATTERN 30-bar double-bottom fixture (2025-01-13 and 2025-01-25 troughs, latest bar 2025-01-30) yielded trigger 121, support 99, entry reference 123, stop reference 98.01, measured target 143, move 16.2602% and reward/risk 0.8003. Pattern/crossing/move-15 filters accepted it; move-25 and RR-2 filters rejected it. Handoff preserved 10000 account/budget and 1% risk, producing four shares, 99.96 planned risk and 80 potential target reward. Visual acceptance exposed reversed ratio notation in the old risk display; both report and calculator now show reward:risk consistently. Selected pattern is listed first, numeric scenario fields have a readable grid and detail scroll accounts for sticky navigation. No real market/model requests or account writes were involved.

## Shared calendar validation and legacy data route retirement — 2026-10-24

CSV, provider normalization, free-AI candle validation, drawing/backup anchors and daily pattern research now share strict calendar/clock validation. Impossible dates and 24:00/invalid minutes/seconds are rejected rather than silently rolling into a different candle. CSV offset timestamps are validated before UTC conversion. Valid daily/intraday/leap-year inputs remain supported. Malformed provider rows return null safely.

The original passcode-only market endpoint is retired with HTTP 410 whenever public account mode is enabled, before any provider call or credential check. Account mode uses the authenticated public-market route with durable shared quotas. The legacy owner-only route is unchanged outside account mode. This prevents its instance-only cache from becoming a quota bypass if market data is enabled later. Provider flags remain disabled. Added this boundary to the anonymous deployment acceptance script (now ten checks).

175 automated tests passed, including leap-century boundaries, invalid date/clock and CSV offset handling, malformed provider rows, drawing backups, rejected AI requests with zero model calls, and retirement with zero provider calls. Live rollout acceptance follows separately.

# ASAF Trading Pro — release acceptance, 2026-11-05

This checklist supersedes older launch-status claims where they conflict. A passing automated test is not a successful production account or real-device test.

## Verified

- Production UI and standalone chat published; chart/chat navigation preserves an unsent draft (desktop browser acceptance).
- Quick prompts prepare a draft instead of immediately consuming an AI request.
- 439 automated tests pass after asset-search submission fix: unique company/Hebrew names resolve to symbols; ambiguous results require selection; type filter is respected.
- Netlify credits restored. Batch deployments to conserve the existing credit balance.

## Required before a public release

1. **Account journey:** actual Google login, welcome, refresh, logout, expired session, recovery and a second account isolation check. Confirm Google audience configuration permits intended users.
2. **Chat journey:** authenticated real response, cancel/retry, temporary network failure, headline context, preserved draft/history; confirm active chart identity and timeframe match the response. No fabricated prices when the data feed is unavailable.
3. **iPhone acceptance:** Safari keyboard, composer visibility, long-chat scrolling, portrait/landscape, chart pinch/pan and dialogs. Desktop tests do not satisfy this item.
4. **Market activation:** obtain explicit Intrinio activation and end date, allowed display/cache/AI uses and credentials. No activation/end date has been verified. Latest incoming provider message found on November 5 was dated October 30.
5. **Provider implementation:** current shared stock-feed adapter is Twelve Data, not Intrinio. Implement and test the actual contracted provider, interval/coverage metadata, delayed vs real-time labels, error handling and quotas before enabling it.
6. **Scanner acceptance:** provider-backed candles and fundamentals, verified market capitalization, covered-symbol universe, results matching chart selection. Existing shortcuts are not whole-market search.
7. **News/alerts:** observe scheduled production refresh and stale-cache behavior; verify intended alert delivery end to end. Closed-site push/email is not yet established.
8. **Personal data:** signed-in save/load on a second device, backup/restore, account deletion and isolation acceptance.
9. **Release operations:** final contact/legal pages, production usage limits, monitoring and rollback procedure. No new charge or automatic plan change without concrete authorization.

## Separate distribution milestones

- PWA/native wrapper source is not an App Store or Google Play release. Signing, developer accounts, device acceptance, store metadata and review remain separate.
- Global exchanges, a complete security catalogue and TradingView feature parity are not demonstrated by the current beta.

## Intrinio reminders

An existing scheduled task checks for a verified trial end date and warns three days and one day before it in Asia/Jerusalem. Do not infer activation from a request or email acceptance; do not create duplicate reminders or cancel/purchase automatically.

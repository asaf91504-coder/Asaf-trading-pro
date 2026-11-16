# Twelve Data activation handover

Prepared 2026-11-16. No paid requests, credential changes or license activation are performed by this change.

## Already wired

Authenticated chart loading, shared cache and atomic provider-credit reservation; scanner for selected symbols; exact server-snapshot binding for AI; chart command overlays and entry/stop scenarios. The chart and AI use the same OHLCV snapshot. Browser candles never override provider prices for AI analysis.

REST refresh is at most once per minute, not a WebSocket tick stream. Daily bars exclude the current New York date; weekly/intraday last bars may be incomplete. History defaults to 500 bars (200–2,000 configurable), supporting MA150/MA200 where enough history exists. Missing volume stays missing. Invalid candles or a mismatched response interval stop the update.

## Configure after the agreement

Use `deployment/twelve-data.env.example` as a checklist, not an executable production configuration. Preserve existing authentication/storage/billing settings. Add the API key to server secrets only. Fill allowed symbols (currently up to 50), exact delay, permitted intervals and shared provider-credit budgets. Select partial/consolidated volume only with written confirmation; unconfirmed is the safe default. Plan changes invalidate the shared price cache through a settings fingerprint.

Public-display and external-AI permissions are separate switches. Leave both disabled until confirmed. Fundamental statistics are separately opt-in and consume 50 credits/request. A selected-symbol scanner is not a whole-US-market scanner. Do not silently expand coverage or remove spending caps.

Run in the configured server environment:

    node scripts/check-twelve-readiness.mjs

This makes no network requests and reports no credentials. Exit 2 means configuration is incomplete. A green report only validates configuration; it does not prove credentials, licensing, subscription access or model availability.

## Authorized live smoke test after activation

1. As a signed-in entitled account, load one approved US symbol on 1day and an approved intraday interval. Verify symbol, timezone, declared delay, latest candle time and volume coverage against provider output.
2. Confirm ascending candles, sufficient history for requested indicators, and an unchanged chart on 429, timeout or malformed data. Check shared caching across two accounts without additional provider credits.
3. With explicit AI rights, request analysis and an entry/stop drawing. Verify that levels use the same selected symbol, timeframe and server snapshot. A stale snapshot must request refresh, not analyze mismatched candles.
4. Test a non-approved symbol/interval, anonymous access and expired subscription: all must fail before a provider call.
5. Watch actual credit consumption and response freshness before expanding the symbol list. Daily budget is an application cap even if the vendor plan has no daily cap.

Rollback: set ASAF_MARKET_ENABLED=false. AI analysis has its own ASAF_MARKET_AI_LICENSE_CONFIRMED switch. Never substitute another unlicensed feed.

## Outstanding dependencies

Signed-off commercial display and AI terms; final symbol/venue/volume/delay scope; approved key and quota. Paid AI/search and their cost controls remain a separate rollout; this connector does not enable them or remove the current model quotas.

## Provider references reviewed

- https://support.twelvedata.com/en/articles/5615854-credits
- https://support.twelvedata.com/en/articles/5656039-how-to-get-historical-prices
- https://support.twelvedata.com/en/articles/5179064-are-the-prices-adjusted
- https://twelvedata.com/news/april-2026-updates

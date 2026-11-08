# Provider beta preparation — 2026-11-08

## Observed production state

The existing Netlify site responded successfully. Google authentication, account access, durable AI quotas, the free OpenRouter route and public RSS news report configured. Stock data and stock AI analysis report disabled. These are configuration checks, not completed signed-in journeys.

The implemented stock adapter is Twelve Data. No Intrinio adapter, paid subscription, provider credentials or activation was added in this change. Existing feature gates remain unchanged.

## Delivered

- Daily stock snapshots exclude the current New York calendar date (including after the market close until New York midnight). Requests allow one extra bar to retain up to 200 prior daily bars, enough for MA150/MA200. Daily dates use the exchange timezone; intraday timestamps use UTC.
- Historical EOD consolidation is provider-declared, not independently verified. The provider says full-market EOD becomes available after midnight on the next trading day, so date exclusion alone does not prove volume consolidation on holidays/weekends or immediately after midnight. Historical values can be revised. Weekly bars remain explicitly potentially partial; intraday data remains partial-market (~5% volume), not consolidated.
- Scanner, chart, session restore and AI retain snapshot identity, receipt time, coverage and daily-bar policy. AI reads the corresponding server cache and rejects changed/mismatched snapshots.
- Optional `/statistics` adapter obtains company market capitalization in USD, checks symbol/currency/positive value and caches for at most 24 hours. Receipt time is explicit; the provider does not supply a market-cap as-of date here. This is current fundamentals, not historical market cap aligned to an older candle.
- Scanner default and Asaf preset require market cap >= $1 billion. Missing, stale or invalid values fail the filter. The threshold may be set to 0 for technical-only exploration. MA150 is displayed, not a required price threshold.
- The provider quota now reserves credits atomically: 1 per time-series request and 50 per statistics request, including failed attempts. Both share minute/day counters. Parallel duplicates use a lock; cached fundamentals do not spend provider credits.

## Activation configuration after a separately approved subscription

No secret belongs in this document, the browser, a commit or a chat message. Set the provider key only in Netlify runtime settings.

Existing prerequisites: `ASAF_MARKET_ENABLED`, display/public-use flags, an explicit `ASAF_MARKET_DELAY_MINUTES`, server key, authenticated accounts/storage and an allowed-symbol list. AI additionally requires `ASAF_MARKET_AI_LICENSE_CONFIRMED`.

New opt-in: `ASAF_MARKET_FUNDAMENTALS_ENABLED=true` only when `/statistics` access is confirmed on the actual account. If it is off or unavailable, the price chart can work but the scanner cannot claim a full match to Asaf's market-cap rule.

`ASAF_MARKET_REQUESTS_PER_MINUTE` and `ASAF_MARKET_REQUESTS_PER_DAY` retain their names for compatibility but now mean credits. Defaults remain 8/minute and 800/day: the 8/minute default intentionally cannot accommodate a 50-credit statistics request. Confirm the contracted plan before changing these values. The quoted Venture entry tier is 610 API credits/minute; a cold five-symbol scan costs 255 credits. Keep a deliberate daily ceiling even if the vendor has no daily limit. No configuration here is a guarantee against hosting charges.

## Acceptance before inviting testers

1. Confirm Venture subscription rights, `/time_series` and `/statistics` entitlements, actual quotas and the provider's EOD publication timing. Verify symbol, USD market cap, last candle and timestamp for AAPL/NVDA on the actual feed. No demo results qualify.
2. Confirm a completed daily scanner result opens exactly the same bars in the chart and AI. Change AAPL to NVDA and switch intervals; stale responses must not replace the selected dataset.
3. Confirm a missing-cap symbol is rejected, an exactly $1B fixture passes that boundary, price exactly $5 fails, MA150 is not mandatory, and rising volume/measured-move filters retain their semantics. A measured target is not a return forecast.
4. Test real Google login and two-account isolation, then real AI response/retry. The current automated route tests use mocked provider/model responses.
5. Run Safari on an actual iPhone: keyboard, scrolling, rotation, chart gestures. Desktop browser QA is not a substitute.

The beta scans 1–5 selected symbols per request within the configured allowlist (up to 50). Whole-market discovery, earnings, comprehensive global coverage and store distribution remain separate work.

## Sources checked

- https://twelvedata.com/docs/fundamentals/statistics — Venture, 50 credits/symbol, `statistics.valuations_metrics.market_capitalization`.
- https://twelvedata.com/docs/fundamentals/market-cap — historical `/market_cap` requires Enterprise; not used for the $149 plan.
- https://support.twelvedata.com/en/articles/9935903-us-equities-market-data — intraday versus EOD volume and timing.
- https://support.twelvedata.com/en/articles/5745849-timezones — exchange timezone rules.

# Intrinio owner trial

The first integration supports US equities, USD, daily EOD history only. It requests up to 201 records once and displays at most 200 completed previous daily candles. Adjusted OHLCV (splits and dividends) is used consistently. It does not claim a live quote, intraday coverage or consolidated real-time volume.

## Activation

In the existing Netlify site's **production function environment**, configure:

- `INTRINIO_API_KEY`: existing private key from Intrinio Access; never put it in this repo, browser JavaScript, a URL or chat.
- `ASAF_INTRINIO_ENABLED=true`.
- `ASAF_INTRINIO_TRIAL_ENDS_AT`: exact ISO timestamp verified in the account. Do not infer it from a signup email. Requests stop after this time; this does not cancel the provider subscription or its billing.
- Existing Google authentication, Redis quota storage and `ASAF_ADMIN_MEMBER_IDS` must remain configured.
- `ASAF_INTRINIO_AI_LICENSE_CONFIRMED=true` only after the actual plan's rights permit sending these data to the external AI provider. Until then the owner can load candles and use local indicators; Intrinio model analysis is blocked before inference.

Deploy after configuration. GET `/.netlify/functions/intrinio-research` returns non-secret readiness, owner-only scope and supported intervals. Log in as owner, select AAPL with `1day`, click the existing load-data button and confirm source Intrinio, latest completed date, adjusted-price label and at least 21 candles. Repeat with NVDA. An ordinary account must receive 403, and a signed-out account 401. No public Twelve Data flags need to change.

## Limits and failure behavior

Manual loading only for this trial. One upstream request per refresh, shared atomic cap 5/minute and 100/day, per-symbol lock, one-minute cache. Cache-only AI reads expire after 5 minutes and must match the chart's receivedAt exactly. A bad symbol, foreign listing, malformed/old candles, expired trial, storage failure or provider error must not overwrite a valid chart or leak the key. Trial candles are not persisted to browser session storage and are cleared on logout.

The OpenRouter model remains `openrouter/free`; no paid model or automatic credit purchase is activated by this change. The conversation prompt allows general topics while retaining market specialization. A paid-model change needs a concrete usage budget and provider-side key spending cap.

## Validation record

Automated tests use synthetic provider responses and mock authentication/storage. Real account entitlement, billing deadline, production key and live candles still require authenticated account verification. Do not describe this as an active live-data connection until that verification succeeds.

Official protocol: https://docs.intrinio.com/documentation/api_v2/authentication and https://docs.intrinio.com/documentation/web_api/get_security_stock_prices_v2

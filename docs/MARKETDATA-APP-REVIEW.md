# MarketData.app review — 2026-11-13

Decision: promising candidate, not yet validated for ASAF Pro. Documentation review only; no API test, purchase, signup, provider reply, or deployment.

## Published offer

https://www.marketdata.app/docs/account/plans/commercial/

Commercial display rights, derived live stock/options prices, REST/WebSocket, AI assistant access through MCP. Monthly equivalent: months 1–6 $333, months 7–12 $666, thereafter $999; quarterly charges $999/$1,998/$2,997. Advertises 14-day trial and no per-user/exchange fees. Do not treat derived prices as consolidated exchange trades.

## Integration blocker

https://www.marketdata.app/docs/api/stocks/candles/

Standard stock candles endpoint explicitly excludes real-time data under every plan/entitlement. Professional users receive historical candles (one day old). Commercial page mentions live streaming, but does not resolve whether an alternative provides current complete OHLCV. Do not build a supposedly live chart by attaching a derived quote to incompatible historical candles.

## Contract and retention

https://www.marketdata.app/terms/

Terms require a separate commercial agreement for companies. Generic restrictions on distribution must be reconciled with that agreement. Market Data adds no derived-data restriction, but underlying exchange rules still apply; copied values are not derived data. Downloaded subscription values generally must be deleted when paid access ends, including trials. Chat retention may therefore need treatment distinct from retention of original commentary.

## Required written answers before activation

1. Does the commercial agreement cover a public paid/trial multi-user AI chat, sending OHLCV and indicators to OpenRouter and its downstream inference providers and/or OpenAI, without model training?
2. Can customers retain/export analysis, prices embedded in conversations, annotated charts and trading-journal entries, including after our subscription ends? Which deletion/attribution rules apply?
3. Which documented commercial endpoints provide live candles for 1m/5m/15m/1h/1d, historical backfill, pre/post-market and splits? Alternatively, may we build candles from the stream, and what volume does it represent?
4. Specify covered instruments/exchanges, derived-price methodology, timestamps/latency, historical/live consistency, concurrent symbol caps, subscription limits and reconnect/backfill behavior.
5. Confirm trial entitlements, card requirements, automatic billing, cancellation deadline and full quarterly charges. Request a startup offer without automatic paid conversion.

## Acceptance gate

Obtain commercial agreement and technical endpoint documentation first. Then test price/volume provenance, closed-bar consistency, MA20/MA150/ATR calculations and reconnection on a sandbox branch. Use exactly the same canonical bars for charts and AI. Preserve honest freshness/source labels. No production activation or paid commitment is authorized by this review.

All changes remain on feat/account-chat-readiness. Owner instructed GitHub storage first; merge/deployment awaits a later explicit instruction.

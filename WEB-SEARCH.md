# Chat web research

The chat now has an explicit per-message web-search checkbox. Search uses the
existing server OpenRouter key and a separate, isolated research request with
Parallel basic (up to five results). Only the current question and selected
symbol enter that request; chart candles, images, tool receipts and conversation
history do not. The answer request receives bounded provider citation excerpts,
not the research model's generated summary. Source text is untrusted evidence.
Links and retrieval time are rendered separately, and source metadata is retained
in the conversation text. Retrieval time is not represented as publication time.
This does not supply live prices or replace licensed chart data.

## Activation (owner cost approval required)

Disabled by default, even if the client checks the box. Set only after explicit
owner approval in the intended Netlify context:

- `ASAF_WEB_SEARCH_APPROVED=true`
- `ASAF_WEB_SEARCH_MONTHLY_LIMIT=100` (example; 1–1000; required)

Existing OpenRouter key and approved persistent Upstash storage are required.
The durable calendar-month counter is atomic and separate for preview/production.
Attempts consume quota even on failure, without automatic retries. Existing
member authentication, subscription checks and chat quotas run before search.
Each search-enabled message makes two model calls (research, then answer).

Official pricing checked 2026-11-13:
https://openrouter.ai/docs/guides/features/plugins/web-search
Parallel basic: $0.005/search up to ten results, plus any model token charges.
Both requests retain the existing free-only model router. At unchanged search
pricing, 100 attempts cost at most $0.50 in search fees per calendar month per
environment, 1000 cost $5. This is a request cap, not a provider dollar budget;
set an OpenRouter key credit limit as well before production activation.
No paid fallback, X search, scraping, or credential collection is introduced.

## Validation

Run `node --test tests/*.test.mjs`. Mock tests cover disabled configuration,
shared quota denial/failure, upstream failure, missing citations, context
isolation and URL/excerpt validation. Live search and authenticated browser QA
remain required after approval/configuration. Do not describe this as activated
or live-tested until those steps succeed.

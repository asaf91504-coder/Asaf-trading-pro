# Candidate chat data repair — 27 November 2026

The reported Hebrew request (`תרשום לי 2 מניות להשקיע לטווח של חודש מניות לונג`) did not match the discovery verb list. It fell through to general chat without verified stock context. Discovery now recognizes ordinary Hebrew and English listing/suggestion requests and compact numbered requests; educational guides and checklists stay general questions.

A live recognized candidate request also returned HTTP 504 before this patch. The candidate reader previously loaded every cached candle series from the expanded stock pool. Chat now pages cached rows in groups of 25 and stops when it finds the requested distinct candidates. Preparation has a 12-second budget; inspected coverage remains partial when applicable. The scanner universe and provider limits are unchanged. Exclusions are applied before loading records and explicit filters apply on every page.

Candidate context includes the verified dated close, MA20/MA150, signed daily move and derived candidate support/resistance. Watch-only status and missing confirmations remain explicit; no returns or fills are promised. Existing authentication, licensing, freshness, billing and source checks remain enforced.

Validation: 1,951 offline tests passed, including the exact reported request through the browser payload and authenticated handler, a 10,000-symbol manifest read limited to one 25-row batch, exclusion/filter pagination and a stalled-read deadline. Production verification is recorded after publication.

## Continuity and verified-data recovery

Bare selection goals (for example `מניות ללונג` and `stocks to buy`) now use discovery without depending on a particular verb. Explicit named-asset questions retain the named asset. `עוד שתיים` carries the immediately preceding scanner filters and direction; intervening unrelated/named-asset topics and unsupported prior filters cannot silently become a new discovery context.

When inference fails, times out, returns no text or is rate-limited, authorized current-request scanner/single-asset evidence can produce a clearly labelled deterministic data summary in all ten interface languages. Only validated server provenance is eligible; CSV/browser data, old prose, unavailable evidence, source-permission failures and expired trial data cannot become verified quotes. There are no automatic model retries or additional provider requests. Application credits reserved for an uncompleted model answer are refunded when a data-only recovery is returned.

Validation after this extension: all 1,961 offline tests pass. They cover routing, short follow-ups, outages, empty responses, quota failures, expiry, refund behavior, all recovery languages and unchanged crypto payload provenance. Production publication and live acceptance remain pending the explicit merge approval.

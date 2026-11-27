# Candidate chat data repair — 27 November 2026

The reported Hebrew request (`תרשום לי 2 מניות להשקיע לטווח של חודש מניות לונג`) did not match the discovery verb list. It fell through to general chat without verified stock context. Discovery now recognizes ordinary Hebrew and English listing/suggestion requests and compact numbered requests; educational guides and checklists stay general questions.

A live recognized candidate request also returned HTTP 504 before this patch. The candidate reader previously loaded every cached candle series from the expanded stock pool. Chat now pages cached rows in groups of 25 and stops when it finds the requested distinct candidates. Preparation has a 12-second budget; inspected coverage remains partial when applicable. The scanner universe and provider limits are unchanged. Exclusions are applied before loading records and explicit filters apply on every page.

Candidate context includes the verified dated close, MA20/MA150, signed daily move and derived candidate support/resistance. Watch-only status and missing confirmations remain explicit; no returns or fills are promised. Existing authentication, licensing, freshness, billing and source checks remain enforced.

Validation: 1,951 offline tests passed, including the exact reported request through the browser payload and authenticated handler, a 10,000-symbol manifest read limited to one 25-row batch, exclusion/filter pagination and a stalled-read deadline. Production verification is recorded after publication.

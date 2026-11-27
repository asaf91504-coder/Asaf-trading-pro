# Approved setups loading repair — 27 November 2026

The setups page aborted GET after 15 seconds and showed the raw browser error `Fetch is aborted`. Its server handler loaded every candle series from the expanded scanner cache, including for ordinary viewers who only needed the approved book.

Published views now read authorized scanner metadata and the approved review book without loading candle rows. Owner queue reads use 25-row pages, stop at the existing 200-candidate display cap, and have a 10-second data-preparation budget. Queue failures can return the approved book with an explicit partial-queue state. Identity, subscription, private-trial access, freshness, exact 2×ATR and compare-and-swap mutation checks remain enforced. No setup is approved or published by this fix.

The UI uses a Safari-compatible local AbortController with a 30-second ceiling and localized messages in all ten languages. Request timers are released and controls re-enabled after failures. A timed-out mutation asks the user to refresh and check the result before resubmitting, rather than claiming no write happened. Failed refreshes retain only previously loaded unexpired published cards and mark the view stale; authentication/authorization failures still clear the page. Raw browser and HTML gateway errors are not shown.

Validation: all 1,966 offline tests pass. A 10,000-symbol manifest test verifies zero candle-row reads for a viewer and only one 25-row read for 200 owner candidates; approved items survive an unavailable owner queue. Tests also cover portable timeout/network/invalid JSON paths, mutation uncertainty, localized messages, expired-card removal and all existing edit/approval actor and CAS races. Production acceptance is performed after publication.

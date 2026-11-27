# 10,000-symbol pool and 50-result stop

Both `us1000` (the existing deployment preset) and `us10000` now resolve to a pool of 10,000 unique US stock symbols. Explicit configured lists without a preset remain unchanged, with a maximum of 10,000. Existing configured/index symbols keep their previous priority; the expansion uses a dated Twelve Data common-stock reference directory, with listed exchanges before OTC. No ETFs, warrants or invented symbols were added to fill the pool. Reference inclusion does not certify provider access, active trading, history, volume or market cap.

The public reference snapshot can be reproduced from a saved `/stocks?country=United%20States&type=Common%20Stock` response with `python scripts/import-us-stock-directory.py input.json YYYY-MM-DD`. Only symbols and provenance are committed, not prices or credentials.

Each user discovery stops after 50 distinct full matches to the submitted filters, or after exhausting the available pool. Multiple scenarios for one symbol count once. Missing data and watch-only candidates never count toward 50. A batch can contain more than 50 matches; only the first 50 unique matches are retained. Changing filters searches the entire pool again, including symbols beyond the previous stopping point. Manual cancellation and authentication guards remain in force.

Shared cache reads remain bounded to 100 symbols per request and 25 server rows per storage read. The per-user shared read quota is 120 pages/minute, sufficient for one full pool search; provider credit budgets are unchanged. The result shortlist can show all 50 matches.

The background cache keeps enriching the shared universe independently of an individual user's 50-match stop. The prior 1,000-symbol cache is retained during migration and per-symbol freshness checks still apply. Background progress is reported separately from the search pool size. A 10,000-symbol directory is not a claim that all 10,000 have complete fresh data.

With statistics and daily volume enabled, a fully cold 10,000-symbol fill can require 520,000 provider credits and 1,000 one-minute ticks at the existing maximum batch size of 10. Actual quota pauses can take longer. No provider limits, paid plans, data licenses or access permissions are changed by this rollout.

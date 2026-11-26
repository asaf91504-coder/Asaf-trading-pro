# 1,000-stock scanner rollout

The code supports up to 1,000 unique US stock symbols. Enable the catalogue preset with `ASAF_SCANNER_UNIVERSE=us1000`, or supply an explicit list of up to 1,000 symbols in `ASAF_MARKET_ALLOWED_SYMBOLS`. The preset retains configured symbols, then uses the existing dated catalogue. Catalogue inclusion is not verification of current provider coverage or company size; actual provider responses and the normal filters remain authoritative.

The company/volume enrichment changes must be deployed with this update. Keep the existing private-trial owner, expiry, authentication and paid-access settings intact. This change does not enable cryptocurrency scanning.

## Data capacity

With company statistics and the separate daily volume series enabled, a cold stock consumes 52 API credits. An initial 1,000-stock load therefore needs up to 52,000 credits. Charts and other consumers share the same atomic quota.

| Configured minute quota | Cold stocks per scheduled tick | Approximate initial load |
| --- | --- | --- |
| 60 | 1 | 1,000 minutes |
| 610 | 10 | 100 minutes |

These are application budget examples, not assertions about the connected subscription. Verify the account's `/api_usage` limits and actual `/statistics` availability before setting runtime budgets. The previously observed application cap of 2,000 credits/day cannot populate 1,000 fresh company records. Do not describe the full universe as available until the live refresh confirms it.

## Update and read behavior

Large scans store each stock separately and publish a small manifest. Unfinished work continues across three-hour boundaries and pauses on provider quota exhaustion. Batches become readable as they finish; the API reports progress and per-stock dates. Rows older than 24 hours are excluded. Company refreshes are requested before their 24-hour validity expires, allowing time for the remaining queue.

Client discovery returns up to 1,000 configured symbols. Shared reads load 100 symbols per request, without provider calls. The table displays 100 rows per page while filtering, sorting, counts and watch-candidate ranking use all loaded records. Refiltering uses cached data.

## Verified locally

1,785 offline tests pass, including an actual 1,000-record worker simulation, ten API read pages, client pagination/refiltering, quota pauses, cycle-boundary resume, expiry, fencing and company/volume projection. Actual provider calls and production activation remain pending.

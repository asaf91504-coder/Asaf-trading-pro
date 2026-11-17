# Shared hourly scanner

When `ASAF_HOURLY_SCANNER_ENABLED=true`, authenticated scan requests read one shared
snapshot and never call Twelve Data. Missing, invalid, or expired snapshots return
503 without an on-demand refresh. Existing subscription checks and market access
checks apply before reading. The private trial remains restricted to its configured
owner until its expiry; this change does not grant customer licensing.

The Netlify `scanner-refresh` scheduled function ticks once a minute in production.
It starts one cycle per UTC hour and processes one credit-bounded batch per tick.
Idle ticks do not contact the provider. This avoids sleeping through Netlify's
30-second scheduled-function limit. All 50 allowed symbols finish in five ticks at
10 per batch, or up to 50 ticks at one per batch, barring failures. The stock universe
is the existing allowlist (maximum 50), not the full US market. Data remains previous
completed daily candles, so hourly refresh does not imply intraday signals.

Redis stores progress, deduplicates each minute, and publishes the complete cycle
atomically with a lock-token check. Failed symbols are identified as partial data.
A completely failed cycle keeps the previous result, marked overdue at the next
hour; results older than 24 hours are refused. Provider calls still reserve against
the existing global minute/day limits shared with charts and other features.
There is no automatic increase, plan purchase, recharge, or billing change.

Each cold bar request costs one configured provider credit; enabled cold company
statistics reserve another 50 per symbol and reuse the existing 24-hour cache.
For 50 symbols, 24 hourly cycles would reserve up to 1,200 bar credits/day plus cold
statistics (2,500 for 50 symbols), before charts and other traffic. The existing
800/day default cannot support that workload and will stop requests safely.
Confirm the account's actual daily allowance and costs before configuring limits;
610/minute is throughput, not a per-scan bill or site AI credit deduction.

Deployment checklist:
- Merge the preceding scanner pacing PR and this change; leave the feature off
  until the existing provider credentials, storage, allowlist and license settings
  are verified. No environment settings are activated by this PR.
- Keep private trial owner/expiry settings for the personal evaluation. Customer
  activation requires the separate public license settings and confirmed rights
  for browser OHLCV/derived data; a server-image license is not sufficient evidence.
- Set the feature flag only for production; verify the scheduled badge and logs.
  No public URL or customer action can trigger this scheduled function.
- Check first snapshot completion, then repeated customer reads without extra
  provider calls. Monitor `progress`, `updated`, `failed`, `superseded` and
  `unavailable` results. If interrupted, progress resumes on the next minute;
  at the next hour an unfinished cycle is discarded and a new cycle starts.
- Disable the flag to restore the legacy manual endpoint (which does call the
  provider). Disabling is not a purge of prior data.

The browser reads up to 50 results in cached groups of ten without quota waits, applies existing filters locally and
shows completion time/partial/overdue status. Opening the cached graph uses the
stored bars. Separate chart refreshes and AI analysis retain their own costs.

Validation: offline unit/integration tests cover duplicate/concurrent ticks,
atomic publication, shared cache reads, failures, stale expiry, trial ownership,
preview disabling, provider quota enforcement and no customer-triggered fallback.
No live provider request or production configuration change was used for testing.

Scheduling reference: https://docs.netlify.com/build/functions/scheduled-functions/

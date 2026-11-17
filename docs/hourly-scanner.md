# Shared three-hour scanner and reviewed setups

When `ASAF_HOURLY_SCANNER_ENABLED=true`, authenticated scan requests read one shared
snapshot and never call Twelve Data. Missing, invalid, or expired snapshots return
503 without an on-demand refresh. Existing subscription checks and market access
checks apply before reading. The private trial remains restricted to its configured
owner until its expiry; this change does not grant customer licensing.

The Netlify `scanner-refresh` scheduled function ticks once a minute in production.
It starts one cycle per UTC three-hour window and processes one credit-bounded batch per tick.
Idle ticks do not contact the provider. This avoids sleeping through Netlify's
30-second scheduled-function limit. All 50 allowed symbols finish in five ticks at
10 per batch, or up to 50 ticks at one per batch, barring failures. The stock universe
is the existing allowlist (maximum 50), not the full US market. Data remains previous
completed daily candles, so three-hour refresh does not imply intraday signals.

Redis stores progress, deduplicates each minute, and publishes the complete cycle
atomically with a lock-token check. Failed symbols are identified as partial data.
A completely failed cycle keeps the previous result, marked overdue at the next
three-hour window; results older than 24 hours are refused. Provider calls still reserve against
the existing global minute/day limits shared with charts and other features.
There is no automatic increase, plan purchase, recharge, or billing change.

Each cold bar request costs one configured provider credit; enabled cold company
statistics reserve another 50 per symbol and reuse the existing 24-hour cache.
For 50 symbols, eight three-hour cycles would reserve up to 400 bar credits/day plus cold
statistics (2,500 for 50 symbols), before charts and other traffic. The existing
800/day default cannot support cold statistics for that workload and will stop requests safely.
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
  at the next three-hour window an unfinished cycle is discarded and a new cycle starts.
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


## Setup approval

`/setups.html` shows only approved setups. Configure
`ASAF_SETUPS_REVIEWER_MEMBER_ID` to Asaf's verified member UUID in server-side
settings. With no explicit reviewer, nobody can approve. This does not grant market
access: subscription and existing public-license/private-trial gates still apply.
No reviewer ID is guessed or activated by this change.

The private queue is derived from pattern candidates with valid scenario levels in
the latest shared scan. These are candidates for manual review, not guaranteed
matches for the browser's personal scanner filters or Asaf's saved preset. Cards
show pattern, direction, entry/stop/target, candle date and scan time. No extra AI
or market-provider call is made by loading, approving or rejecting a setup.

Each cycle has fresh candidate IDs; no previous approval is inherited. Approval
copies the server's candidate data, never client-supplied prices. Rejection removes
it from the published feed; existing approved entries can also be withdrawn there.
Published entries retain their original scan time for up to 24 hours, even when a
new cycle starts. Review decisions use a Redis compare-and-swap against both the
scan and decision book to prevent lost updates and approvals of replaced scans.
Stale scans cannot be approved. The decision book is bounded and expires after
48 hours without activity; it is operational cache, not a permanent audit archive.

The scheduled function continues ticking each minute only to finish bounded batches.
New cycles begin at UTC 00:00, 03:00, 06:00, etc. The legacy environment flag name
`ASAF_HOURLY_SCANNER_ENABLED` is kept for compatibility; the interval is now fixed
at three hours and cache keys are versioned so old hourly state cannot carry over.

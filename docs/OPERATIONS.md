# Operations — 16 November 2026

## Availability monitoring
`.github/workflows/operations.yml` checks production every six hours, on manual dispatch, and when monitor code is published. It checks access controls, pages, service configuration and RSS freshness (45 minutes). It makes no model call, purchase or authenticated mutation. It runs within existing GitHub Actions usage; no separate monitoring service was purchased. GitHub Actions limits/billing still apply. Scheduling is best-effort, not a guaranteed incident-response SLA.

A failed check fails the workflow and preserves its JSON artifact for seven days. The repository owner must enable GitHub Actions failure notifications in their personal GitHub notification settings; creating the workflow does NOT prove an email arrived. Review Actions → Production availability checks. A failed news check can mean a scheduled feed refresh failed even when the homepage is healthy.

## Rollback
Use Netlify's previously successful production deploy to restore application code, then run `node scripts/check-operations.mjs`. Review the deployment diff and provider configuration before publishing. A code rollback does not roll back the database, payments or environment variables. Do not replay PayPal charges or reset credit counters during recovery.

## Personal-data export
`node scripts/account-backup.mjs export personal-backup.enc` reads only durable `workspace:member` and `conversations:member` records from production and encrypts them with AES-256-GCM and a separate random 32-byte hex key. It excludes authentication, session tokens, billing, credit counters and rate limits. Output contains no record contents in logs. Empty, malformed and excessive exports fail closed. Export reads are not a transactionally consistent full database snapshot.

The manual-only `Encrypted personal-data backup` workflow requires repository secrets:
- `ASAF_REDIS_REST_URL`
- `ASAF_REDIS_READONLY_TOKEN` (provider-created read-only token)
- `ASAF_BACKUP_KEY` (independent random key; preserve separately from the backup)

These credentials were not available in this session. No production export or automatic backup schedule has been activated. Never put credentials in source, shell arguments, reports or chat. Only encrypted output is uploaded as an artifact, retained seven days. Preserve an approved durable copy and its encryption key separately for longer retention.

Run `node scripts/account-backup.mjs verify personal-backup.enc` with the same key to verify decryption/schema before recovery. This verifies an export; it is NOT evidence of an actual database restore. Existing user-level import/merge handles exported personal JSON with previews. An operator recovery from this encrypted format requires reviewed mapping to the same still-active account and must not resurrect deleted accounts.

## Full disaster recovery — external configuration still required
Enable and inspect native database backup retention in the current database provider account. Restore to a separate staging database first. Verify account ownership, journals, conversations, billing references and credit balances; re-verify subscriptions against PayPal. Invalidate restored sessions. Confirm a recovery point and time before switching production. Do not restore stale billing records over newer payments.

A provider-console restore drill, retention settings and delivery of an incident notification were not verified in this session. Personal JSON round trips and encrypted export tests do not replace those steps.


## Backup activation checkpoint — 2026-11-17
The personal-data workflow now has a daily 02:41 UTC schedule, gated by the repository variable `ASAF_BACKUP_SCHEDULE_ENABLED=true`. It remains inactive until credentials are installed and a manual export succeeds. Required secrets: `ASAF_REDIS_REST_URL`, a read-only `ASAF_REDIS_READONLY_TOKEN`, and an independent random 32-byte hexadecimal `ASAF_BACKUP_KEY`. Retention is seven days. Keep the decryption key separately in the owner's password manager.

Netlify access was verified; Upstash currently requires sign-in. No production backup, provider backup policy, or restore test has been verified. Do not describe backup as active. The encrypted export covers conversations and workspaces only; use provider-native consistent backups for auth, billing and credit state. Before activation, restore a provider snapshot to an isolated database, verify account isolation and billing/credit consistency, and document retention and cost. Do not restore production from the partial export.

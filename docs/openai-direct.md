# Direct OpenAI rollout (disabled by default)

The existing `free-chat` endpoint, authentication, history construction, technical
analysis and validated chart actions are reused. No UI replacement, DNS changes,
billing activation or API calls are part of this code rollout.

## Activation gates

Set server-only Netlify variables only after verifying the actual account:

- `ASAF_CHAT_PROVIDER=openai`, `ASAF_OPENAI_ENABLED=true`.
- `OPENAI_API_KEY`: a project secret entered in Netlify, never in source/chat.
- `ASAF_OPENAI_MEMBER_ID`: the verified Asaf member UUID, not an admin list.
- `ASAF_PUBLIC_AUTH_ENABLED=true` and the existing durable storage configuration.
- `ASAF_OPENAI_FUNDING_VERIFIED=true` plus `ASAF_OPENAI_FUNDING_EXPIRES_AT`:
  verify available promotional credits, their expiry, applicable model/project,
  disabled automatic recharge and that usage cannot trigger an unauthorized
  payment. These flags are an operator attestation, not a live balance check.
  Leave them unset if no-charge operation cannot be guaranteed. Revoke them on
  funding depletion or changes; never purchase credits to unblock requests.

The signed-in billing overview showed **$0.00** remaining and an unlinked offer of up to $100 on 2026-11-17. Eligibility and the grant have **not** been verified or activated. A ChatGPT
subscription is not itself proof of usable API balance. No real API test was run.

## Separate data approval

The prior OpenRouter permission does not authorize direct OpenAI. Leave
`ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED` unset until the updated written approval
covers direct OpenAI and its monitoring retention. Setting `store:false` does
not establish zero retention or disable provider abuse monitoring.

After approval, the flag must be `true`, `ASAF_TWELVE_TRIAL_MEMBER_ID` must equal
the single OpenAI member ID, and `ASAF_TWELVE_TRIAL_ENDS_AT` must remain in the
future. Existing market license/cache/owner checks also apply to server snapshots.
Until then, only a fresh text-only request is allowed: all bars, images, tool
receipts and history (including unlabelled legacy history) are rejected before
inference. This deliberately prevents derived licensed values crossing from old
conversations; start a new chat without attachments for a synthetic smoke test.
Intrinio remains blocked for direct OpenAI even if its earlier AI flag is enabled.
Do not open trial data to any other customer.

## Bounded cost and failure handling

The pinned model is `gpt-4.1-mini-2025-04-14`, matching the family previously used
by the legacy OpenAI route. Official documentation currently marks it deprecated;
verify project availability before enabling. A different model needs a fresh
cost/compatibility review and tests; there is no automatic model fallback.

At documented standard prices ($0.40/M input, $1.60/M output), the conservative
bound is 28,000 UTF-8 bytes of message text/JSON, 1,024 framing tokens, at most one
image (ceil(6144 * 1.62) < 10,000 tokens), and 1,800 output tokens: < $0.019.
Oversized requests fail closed. Existing one-credit consent/reservation and daily
quotas remain. Provider errors, malformed JSON, empty output, scope refusals,
timeouts and unusable chart-action output refund the site credit. There is no
provider retry/fallback. Failed refunds retry once idempotently; persistent storage
failure returns `credit_refund_pending` rather than claiming a refund. The existing
reservation remains in storage for operator reconciliation; this is not an
automated recovery queue. Request-rate quota remains consumed on failed attempts
to prevent retry abuse; it is distinct from refunded site credits.

Sources checked 2026-11-17:
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create

Rollback: unset `ASAF_CHAT_PROVIDER` (existing explicitly enabled OpenRouter
configuration applies). Never enable OpenAI or change provider data approvals as
part of rollback. No secrets, raw prompts, charts or provider errors are logged.

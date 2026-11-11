# ASAF Pro subscriptions

Implemented offer: one 14-day trial per account identity, followed by USD 10 every calendar month through PayPal. No payment method is needed for the trial. Checkout opens after the trial expires; users explicitly approve recurring billing. Existing accounts get their full trial on their first authenticated use after activation.

## Activation (not yet completed)

Production billing is OFF until the merchant is connected. Merely deploying this code does not activate billing, start trials, or change existing access.

1. Use the owner's PayPal Business account and create a REST app. Put `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in Netlify's server runtime environment, never in Git or chat. Use separate sandbox and live apps.
2. Create an ACTIVE fixed-price plan: USD 10, MONTH interval 1, unlimited cycles (`total_cycles: 0`), no setup fee, no tax surcharge, no shipping, no quantity, no PayPal trial. The 14-day trial is managed by ASAF so it cannot be repeated by cancelling a PayPal subscription. Set `PAYPAL_PLAN_ID`. Set payment failure threshold to 1 and disable automatic outstanding-balance collection.
3. Register `https://joyful-seahorse-967889.netlify.app/.netlify/functions/paypal-webhook` in the same PayPal app for BILLING.SUBSCRIPTION.CREATED/ACTIVATED/UPDATED/CANCELLED/SUSPENDED/EXPIRED/PAYMENT.FAILED and PAYMENT.SALE.COMPLETED/REFUNDED/REVERSED. Set `PAYPAL_WEBHOOK_ID`.
4. Test first in a Netlify preview with a dedicated sandbox app, webhook, plan and isolated Redis namespace; set `PAYPAL_ENVIRONMENT=sandbox` and `ASAF_BILLING_ENABLED=true`. Live credentials are rejected outside `CONTEXT=production`.
5. Verify a complete sandbox journey: new/existing account trial, expiration, approval, payment verification, renewal, payment failure, cancel, refund, duplicate/out-of-order webhook, account deletion, and re-registration. Never charge the owner's real card as a test.
6. Once the sandbox journey passes, set live credentials, `PAYPAL_ENVIRONMENT=live`, `ASAF_BILLING_ENABLED=true` in production and deploy. Preserve existing authentication, data licensing and service quota flags.

## Behavior and reliability

- Server time and Redis `SET NX` establish the trial once. Authenticated app entry or first premium API use starts it. A pseudonymous billing identity derived from the stable account email hash prevents trial reset after account recreation.
- Chat, public market fetch, market scanner, community publishing, new alert rules and background alerts enforce trial/paid access in the server. Account management, personal-data read/sync/export, existing community content and public news remain accessible. Private owner research routes keep their separate admin/license restrictions.
- Checkout accepts neither prices nor account IDs from the client. The server validates the actual PayPal plan and stores its subscription ID before returning the allowlisted approval URL. Idempotency keys survive network failures; unresolved attempts older than 70 hours are quarantined for operator reconciliation, rather than risking a duplicate subscription.
- Redirect parameters never grant access. PayPal's authenticated API supplies subscription ownership, plan, status and completed USD 10 transactions. Signed webhooks re-read current authoritative state under an account lock. Refund/reversal transaction IDs remain revoked even while provider reads converge.
- Successful payments grant access through the provider's next billing date, bounded to 32 days, with a calendar-month fallback for cancellation. Cancelling renewal preserves paid access through that date. Failed or pending payments grant nothing. A provider outage does not extend cached access past its paid expiration.
- Webhook failures return 503 for provider retry. The user can use **Check payment** to reconcile a delayed webhook. Expired users are never automatically charged to regain access.
- Account deletion requires cancelling an ongoing subscription first. Minimal pseudonymous billing/trial records survive self-deletion for payment reconciliation and trial-abuse prevention. See the privacy disclosure.
- No PayPal credentials, live/sandbox merchant operations, actual payment, or authenticated production billing were available during implementation. Offline tests do not replace the sandbox gate.

API references: https://developer.paypal.com/api/subscriptions/v1 and https://developer.paypal.com/api/webhooks/v1

## Verified sandbox checkpoint — 11 November 2026

- Production remains at `fcb2a56af13140a8a9b07dca0ae9d72f182bfe85`; billing is disabled (`enabled:false`, `ready:false`). No real payment was created.
- PayPal app `ASAF Pro Sandbox` has subscriptions enabled. Its client ID and client secret are stored as Netlify secret variables in **Deploy Previews only**. Production and local-development values remain empty.
- `PAYPAL_ENVIRONMENT=sandbox` and `PAYPAL_PLAN_ID=P-25594368XS441945CNL2GLRY` are saved in Deploy Previews only.
- The dedicated draft [PR #28](https://github.com/asaf91504-coder/Asaf-trading-pro/pull/28) runs guarded provisioning only when `CONTEXT=deploy-preview`, `HEAD=paypal-sandbox-setup`, and `PAYPAL_ENVIRONMENT=sandbox`.
- At 14:55 Israel time, Netlify deployment `6af465b8ed0eaa64b7ddd3bc` passed **569/569 tests**, authenticated to PayPal Sandbox, and created/validated ACTIVE plan `P-25594368XS441945CNL2GLRY` for product `PROD-50W61281JR312021R`. Exact terms: USD 10 monthly, unlimited monthly cycles, no PayPal trial or setup fee, no outstanding-balance auto collection, failure threshold 1. ASAF manages the 14-day trial.
- The provisioning response explicitly recorded `paymentCreated:false`. It did not create a customer subscription.

### Still required before any activation

1. Connect an isolated sandbox datastore. Existing Redis credentials are production-only and were **not** changed or copied. Upstash is currently at its sign-in page; owner sign-in is needed to inspect a suitable isolated test setup.
2. Register a sandbox webhook and save `PAYPAL_WEBHOOK_ID`. Netlify Deploy Previews currently require Netlify authentication, so a public PayPal callback cannot simply use the protected preview URL. Resolve this without exposing production data or weakening authentication on the live site.
3. Complete actual sandbox approval, payment, renewal/failure, cancellation, refund/reversal and webhook reconciliation. The 569 automated tests are offline application tests, not proof of a completed PayPal payment journey.
4. Only after sandbox verification, configure a separate PayPal Live app/plan/webhook and explicitly enable production billing. Remove the temporary preview provisioning command before merging PR #28.

No credentials are stored in this document or repository.


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

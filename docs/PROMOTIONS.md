# Payment promotions

No active discount is shipped. Set `ASAF_PROMOTIONS_JSON` in production only after the owner chooses code, eligible tier, monthly price and signup dates and a dedicated PayPal plan is created.

Example (disabled; replace the placeholder provider ID):
```json
[{"code":"FRIENDS","planId":"starter","monthlyPrice":44,"paypalPlanId":"P-REPLACE","enabled":false,"startsAt":"2026-11-17T00:00:00Z","expiresAt":"2026-12-01T00:00:00Z"}]
```

This mechanism supports a discounted recurring monthly price for the entire subscription, not a first-month-only coupon. Signup expiration does not remove an existing customer's agreed price. Weekly credits and the first-month credit bonus follow the selected tier unchanged. Codes are reusable by eligible accounts; there is no global redemption quota or one-person restriction. Do not advertise those restrictions without implementing them.

Checkout displays the recurring price and requires explicit consent. The server resolves the code, rejects expired/invalid codes, and verifies the dedicated PayPal plan's exact USD price, monthly frequency, unlimited regular cycle and absence of extra fees. The browser cannot supply a price. An immutable snapshot binds retries, webhook verification and paid access to the agreed discounted price. An unresolved checkout must be resolved before changing code/tier. No promotion means normal checkout.

Before enabling a real code, verify a sandbox subscription and renewal, cancellation, refund and duplicate webhook using the dedicated plan. Automated mocked tests do not replace provider-side confirmation. Disable a code to stop new signups; existing approved subscriptions retain their price until cancelled.

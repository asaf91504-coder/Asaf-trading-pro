# Owner credit management

The existing explicit ASAF_CHAT_OWNER_MEMBER_ID, together with membership in ASAF_ADMIN_MEMBER_IDS, identifies the sole owner. Browser flags, request bodies and other administrator accounts cannot select an owner. The account API exposes separate admin and owner capabilities.

The owner has unlimited application credits and is exempt from the application's trial/paid subscription gates. Existing provider permissions, data entitlements, global budgets and owner request-burst protection remain in effect. Owner billing UI displays unlimited credits without starting another subscription.

An owner-only credit-admin endpoint grants one-time non-renewing credits to an existing enabled account. The owner interface is in user management. Every grant records actor, request ID, time and quantity; retries with the same request ID cannot grant twice. An atomic storage commit rechecks the actor's session and version, the target's account and version, and the billing record. A grant never changes an existing payment, trial expiry or plan. A previously unstarted account receives only its standard seven-day trial.

Gift consumption is separate from the renewable weekly/trial allowance. Reservations atomically consume the ordinary allowance first, then gift credits; refunds restore exactly those two amounts once. Used gifts do not reset at weekly rollover. The customer sees the ordinary allowance and gift balance separately. An expired account retains gifts but must separately regain access.

# Weekly credit plans: staging only

Approved commercial proposal: USD 55/75/115/359 monthly for 150/300/600/2500 weekly credits, first-calendar-month bonuses 10/12/20/20 percent. A fourteen-day trial gets 100 each week, no carryover. Mail support goes directly to asaf91504@gmail.com.

This branch is not a completed paid-AI launch. Keep ASAF_WEEKLY_CREDITS_ENABLED unset/false in production until the following gates pass. No provider or payment settings were changed by this code update.

## Implemented
- Server-owned plan IDs/prices and per-plan payment consent. Four distinct PAYPAL_PLAN_{STARTER,PLUS,PRO,PREMIUM}_ID environment values are required when the flag is enabled.
- Early trial upgrade; paid allowance starts only after a completed matching USD payment. Existing unversioned USD10 subscriptions remain untouched. Pending checkout for a different plan cannot be silently reused.
- Durable Redis weekly consumption, atomic reserve, one-time failure refund, account-based trial identity, calendar-month bonus cutoff. Paid allowance anchor is preserved across webhook replay/renewal.
- Balance and reset date on subscription page, server quote and user confirmation before a credit-bearing request. Normal free-model chat costs one credit. Weekly mode explicitly blocks separately billable web search and the legacy private paid endpoint until their costs are bounded.
- Direct mail support; no new Netlify Forms submissions.

## Required before activation
1. Configure and validate four sandbox PayPal plans with the exact fixed USD monthly prices, no setup fees or PayPal trial. Test real approval, first payment, renewal, cancellation, refund, and webhook retries. Then configure equivalent LIVE IDs after successful validation. No forced migration of legacy subscriptions.
2. Select and fund a paid AI provider/model. Implement and test a conservative request upper bound covering all input/history, output tokens, searches, routing and retries. One credit's internal cost ceiling is USD0.02, not a provider tariff or profit guarantee. Currently only the existing zero-price OpenRouter model is integrated into the ledger.
3. Replace the existing free-model shared 40/day and member 10/day operational caps with reviewed paid service rate limits, while keeping anti-abuse/global-spend protection. Do not simply remove these limits.
4. Implement an operator-visible trial admission budget. The financial forecast assumes only 50 new fully used trials/month (up to USD200); this is NOT yet a production-enforced signup cap. Do not advertise unlimited trials on that budget.
5. Exercise Redis Lua against the real sandbox storage, including outages/refund reconciliation, concurrency and timeout reconciliation. Local tests model Redis atomic results; they are not evidence of hosted Redis execution. A refund storage outage needs an operational reconciliation process.
6. Run browser/mobile and translated-price/consent QA. New billing text currently has Hebrew plus English plan summaries; full multilingual copy is not yet complete.
7. Provider data licensing is separate and unresolved. No live market data claim or new market subscription is enabled.

## Forecast (assumptions, not verified invoices)
100 paying accounts; fixed monthly budget USD2373.25 after removing email, bookkeeping and maintenance allowances. Includes market data1250, marketing700, infrastructure100, domain5, Apple99/year, free trials200, contingency120. Payment assumption5% + USD0.50/charge; budget up to five weekly grants per billing month. Profit is pre-tax and depends on these assumptions. No OpenAI/ChatGPT subscription price is implied by credit values.

## 2026-11-16 production preparation
Four live PayPal plans were created as DRAFT and their IDs saved in Netlify Production only:
- starter: P-5CY7099903090172NNL5ONGQ
- plus: P-7JM97420421000708NL5ONTY
- pro: P-3FY57568TA048361TNL5ON4Q
- premium: P-4RV64860H11306603NL5OOFQ
Product: PROD-27505635D31938544. Prices were reviewed in PayPal: USD55/75/115/359 monthly, no setup fee/trial/tax, auto-bill outstanding OFF, pause after one missed cycle. This is UI verification, not a completed transaction test.

User requested publishing and personally testing a real payment. Added a server-enforced admin-only checkout pilot whenever weekly credits are enabled and ASAF_PUBLIC_PAID_LAUNCH is not true. Non-admin subscribe requests fail before PayPal is called; cancellation/sync remain available. A visible warning identifies real recurring charges and unfinished paid AI/search. No new authorization is granted by request body fields.

Live Starter activation was blocked by automatic approval review pending explicit approval of its USD55 monthly recurring charge. Keep weekly credits disabled and all four plans DRAFT until resolved. Publishing this code does not activate checkout. General paid launch remains blocked on the gates above. 623 local tests pass.

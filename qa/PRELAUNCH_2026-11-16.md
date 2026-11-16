# ASAF Trading Pro — full prelaunch regression, 2026-11-16

Baseline: 790e5527947dc45fdb7ea57446ad297abb3a6c28 (Twelve Data readiness).
Decision: NOT ready for unrestricted paid launch. Passing code tests do not prove all production journeys.

## Automated result

`env -i PATH="$PATH" node --test tests/*.test.mjs mobile/tests/*.test.mjs`

638 passed; 0 failed, skipped or cancelled. Includes 635 website tests and 3 native packaging tests. Initial checkout lacked google-auth-library; npm ci installed the locked dependencies, after which the baseline passed 633 website tests plus 3 mobile tests. Two localization regressions were added and the complete suite rerun successfully. This was an environment setup problem, not a production login failure.

Coverage includes authentication/authorization, account isolation fixtures, subscription/webhook state transitions, weekly credits, conversation recovery, chart actions and indicators, journal, watchlist, scanner, provider quotas, news, translations, offline behavior and native asset packaging. Most service/account scenarios use mocks; they are not successful live payments or real market/model acceptance.

## Live checks

All 10 existing anonymous deployment checks passed: health, security headers, privacy page, anonymous workspace/account/alerts rejection, GET rejection on model/admin routes, retired private feed and rejected foreign-origin write.

Public billing reports ready=true, pricingVersion=2, paymentPilot=true, checkoutAllowed=false for anonymous access, sandbox=false. Public stock-feed configuration reports enabled=false. Google auth configuration endpoint, journal, terms, help and manifest returned HTTP 200. A guessed /chart.html path returned 404; it is not a tracked page or an application link (charts are a tab of index.html), so it is not classified as a broken product link.

Desktop browser acceptance:
- Chat, risk, news, scanner, watchlist, journal and subscription navigation opened.
- Risk: $25,000 account / 1% / entry $100 / stop $95 => 50 shares. Invalid long stop $105 rejected; short at the same values => 50 shares.
- Temporary TSLA watchlist entry survived reload, then was removed. Existing entries preserved.
- Quick prompt populated a draft without sending it; draft survived risk-tab round trip, then was cleared.
- Journal showed empty local history and disabled account sync while signed out. No trade or financial action executed.
- News showed fresh cached international headlines with original-source links. Hebrew translations were still partially pending; original titles remained visible with a notice. Translation completion is NOT signed off.
- Scanner truthfully showed no provider data; no invented results.

## Defect fixed

Subscription feature cards mixed Hebrew and English because new copy lacked translations and substring replacement translated pieces of longer Hebrew words (e.g. inside account/research words). Added card translations in all nine non-Hebrew languages and word-boundary protection for partial replacements. Regression checks cover every pricing-card text and dynamic billing templates in all languages. This does not establish full translation coverage of every page.

## Required acceptance before launch

1. Twelve Data agreement, credentials and scope; live chart-to-AI-to-overlay smoke test, delay/volume validation and actual vendor quotas. No market service enabled by this work.
2. Paid AI/search routing, cost caps and real end-to-end responses. Existing free-model quotas are not the marketed paid allowance.
3. Public checkout enablement only after billing/AI acceptance. User previously reported a successful payment; this run did not independently verify payment, webhook receipt, entitlement or cancellation against PayPal.
4. Real Google login and two-account/two-device save/load/isolation, not just mocked tests or public configuration.
5. Physical iPhone/Android keyboard, orientation, touch charts and long-chat scrolling. Native packaging tests are not device tests.
6. Confirm translated headlines finish and scheduled refresh/alert delivery behaves correctly over time.

No live provider/model calls were deliberately submitted, no subscription purchase/cancellation performed, and no licensing or paid-launch flags changed. This report is a bounded snapshot, not a promise of zero defects.

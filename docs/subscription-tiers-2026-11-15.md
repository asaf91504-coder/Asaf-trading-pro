# ASAF Pro: revised pricing and rollout

Owner decision, 15 November 2026. Proposed policy module and tests only; this
branch does not activate new billing, quotas or paid models in production.

| Tier | Monthly USD | Daily messages | Trial duration |
|---|---:|---:|---|
| Trial | 0 | 7 | 14 days, once per account |
| Pro | 22 | 40 | Paid immediately on explicit checkout |
| Max | 45 | 100 | Paid immediately on explicit checkout |

The owner's latest reference to two weeks is interpreted as retaining the
14-day trial, not introducing a perpetual free plan. Friends' existing trial
extensions remain supported; extension changes duration, not daily allowance.

## Customer wording for the terms and subscription page

תקופת הניסיון נמשכת 14 ימים, פעם אחת לחשבון, וכוללת עד 7 הודעות לצ׳אט בכל יום.
הניסיון אינו דורש אמצעי תשלום. אפשר לשדרג בכל שלב, גם לפני סיום השבועיים,
ולקבל את המכסה של המסלול שנבחר מיד לאחר אימות התשלום.

מסלול Pro עולה 22 דולר ארה״ב לחודש וכולל עד 40 הודעות ביום. מסלול Max עולה
45 דולר ארה״ב לחודש וכולל עד 100 הודעות ביום. המנוי מתחדש מדי חודש עד ביטולו.
המחיר, מועד החיוב וכל התאמת חיוב במעבר בין מסלולים יוצגו לפני אישור התשלום.
לא מתבצע חיוב אוטומטי נוסף עקב הגעה למכסת ההודעות. בסיום המכסה אפשר להמתין
לחידושה או לבחור בשדרוג זמין ולאשר את מחירו במפורש.

המכסה מתחדשת בחצות לפי UTC, משותפת לכל המכשירים באותו חשבון ואינה נצברת.
שדרוג מגדיל את המכסה הכוללת לאותו יום; הודעות שכבר נוצלו נספרות גם לאחר השדרוג.
הודעה היא בקשה שנשלחה לצ׳אט וקיבלה תשובה; בקשה שנכשלה ללא תשובה אינה נספרת.
בקשת המשך שקיבלה תשובה נחשבת הודעה נוספת. ייתכנו מגבלות נפרדות על חיפוש,
קצב בקשות ואורך ההקשר, שיוצגו לפני הפעלת השירות הרלוונטי.

אפשר לבטל את החידוש החודשי בעמוד המנוי או אצל ספק התשלום. גישה ששולמה נשמרת
עד תום התקופה, בכפוף לדין החל. לא ייגבה תשלום ללא אישור מפורש.

**Draft publication gate:** failure refund, immediate upgrade, account-wide usage,
reset and paid plan switching must actually work before this wording replaces
the live terms. Existing USD 10 subscribers require a separate migration policy;
never silently change their recurring price or create two recurring subscriptions.

## Economics, not a guarantee

Assumptions: 30 days, 100 paying subscribers, every daily message consumed,
80% economy / 20% premium, 5,000 input + 1,000 billed output tokens per turn,
one Parallel Basic search in 20% of turns. Official direct model standard rates:
GPT-6 Luna $0.10 input / $0.50 output per million; GPT-6.1 Sol $2 / $10.
Parallel Basic $0.005 per search. Routing through a gateway must be checked
against its actual model catalog and fees before activation.

| All 100 users on | Revenue | Estimated AI + search | Before other expenses |
|---|---:|---:|---:|
| Pro | $2,200 | $696 | $1,504 |
| Max | $4,500 | $1,740 | $2,760 |

Doubling billed context and output increases AI + search to $1,272 / $3,180.
Free trials add expense without revenue: at 7/day and 20% premium, a fully
used 14-day trial costs about $0.57 under the baseline assumptions. Conversion,
abuse, refunds and gateway fees are not included. These are not profit numbers.

Sources checked 15 November 2026:
- https://developers.openai.com/api/docs/pricing
- https://openrouter.ai/docs/guides/features/plugins/web-search

15–30 messages/day is a product hypothesis for the pilot, not measured day-trader
usage. Track median and p90 daily successful messages and cost per paying user.
Max offers 2.5x messages for 2.045x price, so marginal contribution per message
falls at full utilization. Do not infer profitability before supplier pricing.

## Required integration before activation

1. Create and validate separate PayPal USD 22 / USD 45 monthly plan IDs.
   Keep legacy plan validation for existing subscribers; record verified tier.
2. Permit trial-to-paid immediately. Implement consented paid-plan revision,
   reconcile webhooks, proration/next renewal, cancellations and refunds in sandbox.
3. Add durable atomic daily account counters with idempotent request IDs and
   reservations, successful completion and failed-request refunds; prevent account
   recreation, multiple devices, retries or plan changes from resetting usage.
4. Feed verified server entitlement into policy, never a client-supplied tier.
   Show remaining quota and local rendering of UTC reset time in chat.
5. Route by validated task needs, with premium daily caps of 1/8/20 for trial/Pro/Max.
   80/20 is a planning target, not random routing or an assurance that every complex
   request uses the premium model. Validate economical fallback quality explicitly.
6. Replace the free-router 40-global/10-member daily ceiling only after configuring
   a funded provider, token ceilings, monthly spend cap, per-user search allowance,
   usage accounting and alerts. Never enable a paid fallback without these controls.
7. Translate the confirmed prices, terms and quota errors into every supported
   interface language; remove old $10 checkout wording only when compatible.
8. Acceptance: trial signup, immediate checkout, 7/40/100 boundaries, UTC reset,
   double-click, concurrent requests, failed model/refund, paid upgrade/downgrade,
   duplicate/out-of-order webhooks and no cross-account entitlement.

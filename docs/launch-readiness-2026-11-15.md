# ASAF Trading Pro — launch readiness, 15 November 2026

## Implemented in this release
- Journal requests in Hebrew/English open an editable draft in chat. Explicit
  symbol/entry/exit/quantity/fees are extracted from the user's text only. Missing
  fields remain editable; no market quote or AI recommendation becomes a fill.
- One save action stores the draft locally, and for a signed-in member, appends
  it to their cloud workspace. A stable ID makes retry after a lost response
  idempotent. Concurrent workspace writes are re-read and merged with bounded
  retries. Account changes prevent cross-account writes.
- Journals on this device are now scoped to the signed-in member. Legacy local
  records remain in the guest/device journal; they are not silently assigned to
  the next person who signs in. Existing cloud records are unchanged. The journal
  page still provides explicit cloud load/merge/save and JSON/CSV backup.
- Open trades have a null exit and no realized P/L. Closing a trade in the journal
  updates realized profit and win-rate. Unrated drafts have no fabricated rating.
- Conversation memory retains up to 400 recent stored messages in the client.
  Model context uses the newest 24 plus at most 6 matching earlier messages when
  the new question refers to them, under a 24,000-character text budget.
  This is bounded lexical retrieval, not perfect recall of the entire archive.
  Historical source/symbol restrictions remain attached and enforced.
- Background headline translation may consume at most one quarter of the current
  shared free-model daily allowance; global and per-minute caps remain unchanged.
  This protects chat capacity but does NOT solve commercial-scale AI capacity or
  guarantee that every headline in every language translates within a day.
- Web search is disabled in the UI unless configured and budget-gated server-side;
  a stale client request is rejected before model usage. Search has NOT been
  activated and no paid service was enabled.
- New journal/search labels cover all ten existing interface languages.

## Verification
- 617 automated tests passed with an empty environment before publication. Covers auth isolation, expired
  trials, PayPal signature checks, refunds, cancellation, idempotent retries,
  conflicting writes, chat cancellation, stock switching, bounded older recall,
  source restrictions, and journal validation.
- Local browser: 375px draft layout without horizontal overflow; English labels;
  NVDA open trade (10 shares at 100) saved in the isolated local preview; journal
  editing to exit 110 resulted in exactly $100 realized profit and 100% win rate.
  Preview account status was a test fixture. No live account/cloud write or
  financial transaction was performed in this test.
- Production read-only billing endpoint reports enabled=true, ready=true,
  sandbox=false, 14 trial days, USD10 monthly. This is configuration evidence,
  not proof that a real payment completed.
- Production Google button reaches Google's ordinary sign-in page. The browser
  has no signed-in Google account. Full sign-in/refresh/logout/login/cloud history
  acceptance remains blocked on secure user authentication.
- Post-release production checks: all 10 anonymous deployment checks passed.
  The new journal module is served and health exposes webSearchEnabled=false.
  Source release: 401aa226a3637dc3b167c3db363bf0b0b7eaedc4.
  Google/free AI/auth/durable quota are enabled; paid AI remains disabled.

## Remaining release gates (not declared complete)
1. Signed-in acceptance with a real test account, plus a second account/device for
   end-to-end isolation. Do not bypass authentication or fabricate a login.
2. PayPal transaction lifecycle using a dedicated sandbox environment/account,
   or a specifically approved live purchase. Current production is live; do not
   change it to sandbox or charge the owner merely to run a test.
3. Apple: draft PR #32 remains separate. Needs eligible Apple Developer primary
   App ID, Services ID, registered domain/return URL and private key, as well as
   completion of provider token revocation/account-change handling and real-device
   acceptance. The disabled draft must not be represented as a finished login.
4. Internet search: owner spending approval and funded/configured OpenRouter
   search. Current code uses Parallel basic; official OpenRouter documentation
   lists $0.005/search, i.e. up to $5 for a 1,000-search monthly cap, excluding any
   separately priced model tokens or funding fees. Reverify before enabling.
5. Commercial AI capacity/quality: current code caps 40 shared requests/day and
   at most 10/day per member. Free routing is not a capacity or latency guarantee.
   Need an approved model/budget before promising 100 users x 50 messages/day.
6. Physical iPhone/Safari keyboard, rotation and background/resume acceptance.
   A 375px browser layout check is not a real-device test.
7. Market-data supplier remains a separate known dependency.

Official references:
- https://openrouter.ai/docs/guides/features/plugins/web-search
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/
- https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key

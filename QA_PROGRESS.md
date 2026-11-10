# ASAF Trading Pro: QA progress

Updated: 2026-11-10

## Current verified baseline

- Repository: asaf91504-coder/Asaf-trading-pro, branch main.
- Production: https://joyful-seahorse-967889.netlify.app/
- 542 Node tests pass, including source restrictions on chat history, safe
  emphasis rendering, analysis intent, chart preparation, authentication,
  cancellation, retry snapshots and provider metadata.
- The 10 anonymous deployment checks passed after the chat-formatting update. These cover
  health, security headers, protected routes and rejected cross-origin writes.
  They do not prove model availability, provider freshness or mobile usability.

## Changes in this pass

- Customer chart editing is now chat-only. Manual drawing selectors, the quick
  drawing rail, anchor forms, pointer drawing, undo/redo drawing shortcuts and
  manual indicator menus are removed. Pan, zoom, timeframe and fullscreen remain.
- Old manual drawings stay in storage without being restored to the chart.
  Allowlisted chat annotations and indicator/style changes remain supported.
- A chart conversation button opens the existing chat and prepares an editable
  analysis draft. It never sends automatically or overwrites a nonempty draft.
- Chart analyses include a deterministic entry and stop section. The scenario
  is a prior-20-bar breakout with a 0.25 ATR14 buffer, invalidation beyond the
  opposite range edge, and a required close/retest condition. It is a reference
  scenario, not a personalized trade recommendation or an executed order.
- Numeric levels require source provenance resolved by the server. Potentially
  partial latest bars are excluded; insufficient/unverified data show explicitly
  unavailable entry and stop fields. General conversation gets no trade section.
- Source licensing, authentication, owner restrictions, quotas and free-only
  model routing remain unchanged. Intrinio inference remains blocked unless
  independently authorized by the existing license gate.
- Regression tests cover navigation without manual drawing, legacy-storage
  isolation, working chat annotations, long/short geometry, partial bars,
  invalid data, educational intents and server response integration.

## 2026-11-10: chat gateway error recovery

- Reproduced: a 502/503/504 HTML gateway response incorrectly told the customer
  that the AI function was not deployed and GitHub needed reconnecting.
- Fixed: report the actual HTTP failure without claiming a deployment cause.
  Invalid successful JSON has a separate message; aborts during body parsing
  retain the cancellation message. Existing draft/snapshot recovery is retained,
  with no automatic model retry.
- Validation: regression failed before the fix, then all 535 Node tests passed
  after installing locked dependencies in a fresh checkout. Ten anonymous live
  availability/security checks passed on 2026-11-10 before deployment.
- Gateway/abort cases were simulated in code, not induced on production.
  No live model call, provider fetch or physical-device test was performed.

## 2026-11-10: news selection follows the active stock

- Reproduced in a DOM fixture: filtered AAPL headlines remained visible after
  selecting NVDA, including when reopening the already-loaded news tab.
- Fixed by refiltering the existing snapshot on symbol input and on returning
  to news. The free-text query is preserved; selection changes add no network
  request. A missing symbol match shows the existing explicit empty state.
- Both regression scenarios failed before the fix; all 537 Node tests pass.
  The 10 anonymous production availability/security checks passed before this
  deployment. No AI/provider request or real-device test was performed.
- This confirms event wiring and rendered fixture content; it does not establish
  live headline coverage, authenticated AI output, or iPhone behavior.

## 2026-11-10: stale authentication status after logout

- Reproduced with the actual auth UI module and delayed mocked responses: a
  status check started before logout could arrive afterward and mark the UI
  signed in again. Server session enforcement was not bypassed.
- Status checks now carry a revision. Confirmed sign-in/logout and native
  authentication handoffs start a fresh server check; older responses, errors,
  and cleanup cannot overwrite or unlock the newer check. Routine refreshes
  still share one in-flight request.
- The logout regression failed before the fix. All 539 Node tests pass,
  including obsolete success/error responses and concurrent refresh joining.
  Ten anonymous production availability/security checks passed before deployment.
- These were simulated login transitions; no real account was signed out,
  no model/provider calls were made, and physical iPhone testing remains open.

## 2026-11-10: Google and account transitions use fresh auth checks

- Reproduced with the actual auth and Google UI modules in a mocked DOM/network:
  a pending pre-login status check could make successful Google sign-in appear
  to fail; pre-transition checks could also leave the UI signed in after
  logout-all or account deletion. Server authentication was not bypassed.
- Confirmed Google sign-in, logout-all and deletion now request a fresh auth
  check, using the existing revision protection against obsolete responses.
- All three new regressions failed before the change and passed afterward.
  All 542 Node tests pass; ten anonymous live deployment/security checks passed
  before deployment. No real account was signed in, signed out or deleted.
- No model/provider requests, billing or license changes. Physical-device and
  real Google login acceptance remain unverified in this pass.

## Known limits and next checks

- Intrinio external-AI permission remains disabled pending verified permission.
  Do not change licensing flags, model pricing or access scope as a QA fix.
- The configured free model can time out or return no content. Do not claim
  end-to-end AI availability merely because the route responds or tests pass.
- Real iPhone acceptance remains open: keyboard, reading position, portrait /
  landscape rotation, zoom, and opening the chart from the chat panel.
- The current browser has no authenticated session. Anonymous chat recovery
  was verified; a live model response was not verified during this pass.
- Check mixed-provider conversation continuity, news headline expiration,
  authentication recovery and scanner behavior when relevant changes occur.
- Scheduled checks must inspect current main and deployment state, preserve
  unrelated work, and avoid replaying paid/model/provider calls just to poll.
- Make a concrete regression test for a reproduced defect; run applicable
  checks before deploying. Do not manufacture changes when the checks pass.
- Keep test artifacts free of secrets, personal account details and real
  provider data. Record actual verification limits rather than assumed passes.

## 2026-11-10: Ten-language interface release

- Added language selection across application pages with local catalogs for
  English, Spanish, Arabic, French, German, Portuguese, Russian, Simplified
  Chinese and Japanese alongside Hebrew (1,458 strings per catalog).
- Browser testing reproduced an untranslated textarea placeholder; adjusted
  attribute translation while leaving textarea values and user messages intact.
- Added regressions for switching/restoring languages, RTL/LTR, dynamic UI,
  failed catalog requests, blocked storage, complete catalogs and unchanged
  symbols/prices. Mocked free-chat coverage verifies the response-language
  instruction without changing free-only routing or data-use restrictions.
- Browser preview verified English/Spanish/Arabic selection, translated primary
  chat controls/greeting and preservation of a mixed-language draft. This was
  desktop browser testing, not a physical mobile-device test.
- Ten anonymous live availability/security checks passed before release.
  No live model/provider call, paid change or Intrinio permission change.
- Remaining: native-speaker review, physical iPhone acceptance, live multilingual
  AI acceptance and any server/interpolated messages outside the local catalog.

# ASAF Trading Pro: QA progress

Updated: 2026-11-10

## Current verified baseline

- Repository: asaf91504-coder/Asaf-trading-pro, branch main.
- Production: https://joyful-seahorse-967889.netlify.app/
- 533 Node tests pass, including source restrictions on chat history, safe
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

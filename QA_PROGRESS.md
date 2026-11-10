# ASAF Trading Pro: QA progress

Updated: 2026-11-10

## Current verified baseline

- Repository: asaf91504-coder/Asaf-trading-pro, branch main.
- Production: https://joyful-seahorse-967889.netlify.app/
- 524 Node tests pass, including source restrictions on chat history, safe
  emphasis rendering, analysis intent, chart preparation, authentication,
  cancellation, retry snapshots and provider metadata.
- The 10 anonymous deployment checks passed after the chat-formatting update. These cover
  health, security headers, protected routes and rejected cross-origin writes.
  They do not prove model availability, provider freshness or mobile usability.

## Changes in this pass

- Model replies and archived replies render bold emphasis and inline code as
  DOM text, without parsing model-provided HTML, media or executable links.
- Completed replies keep their original text and chart source in conversation
  history. Local chart tool turns also retain their provider source.
- Client and server exclude restricted Intrinio history from external model
  requests when not permitted, including after changing or clearing charts.
- Educational and explicitly negated analysis requests do not automatically
  fetch candles. Existing genuine chart-analysis preparation remains intact.
- A missing sign-in keeps the question and offers a direct button to the
  actual account dialog, replacing the obsolete instruction to look above chat.

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

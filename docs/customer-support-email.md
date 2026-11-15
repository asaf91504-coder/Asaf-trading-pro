# Customer support email — activation pending

Adds a support dialog on the main, chart, journal, subscription and help pages.
Visitors supply name, reply email and message; no subscription or AI credits are
required. No conversation history, account credentials or chart data is attached.
The dialog explicitly says that replies arrive by email, not real-time chat.

Transport: Netlify Forms (`customer-support`) with honeypot and `email` field
for Reply-To. No new mail API credential or public relay is introduced. Netlify
must enable form detection before deployment, then a form-submission notification
must target **asaf91504@gmail.com**. Verify provider plan usage before activation.
Provider spam filtering can withhold notifications; delivery is not guaranteed.

Activation checklist:
1. Sign into the existing Netlify project joyful-seahorse-967889.
2. Enable form detection; deploy this branch.
3. Confirm `customer-support` appears in Forms.
4. Set verified-submission email notification to asaf91504@gmail.com.
5. Submit one clearly labeled test; verify receipt in Gmail and Reply-To.
6. Add the support form to production and update the help/privacy descriptions.

Current status: code prepared, syntax checked; local preview failure preserves
message and restores submit button. Live email delivery is unverified because
Netlify currently presents a login screen. Do not describe it as operational.
Core labels support ten languages; detailed notices currently Hebrew/English.
No browser-local persistence of names, emails or messages is introduced.

# ASAF Trading Pro — mobile release handoff

Updated 2026-10-29. This directory is preparation, **not a signed native build or a store submission**.

## Available now

The HTTPS website has an installable web app manifest, 192/512 PNG icons, a maskable icon, Apple touch icon, standalone display and an installation help dialog. Its start page is ASAF AI. The offline worker caches only a fixed reconnection page, never account or chart/chat responses. Google authentication, AI, news and provider data remain online services. Device installation and standalone Google login must still be accepted on physical iPhone and Android devices.

`mobile/` contains the separate Capacitor project and a reproducible bundled web build. It uses local packaged interface assets and a fixed HTTPS native API transport, not a remote live-reload URL. See `mobile/README.md` for toolchain and platform generation commands. Platform source preparation is distinct from compiling or signing a binary.

## Native account connection (implemented, disabled)

`/.netlify/functions/mobile-session` stays disabled unless `ASAF_NATIVE_APP_ENABLED=true` and existing public authentication/storage are configured. Do not enable it before native device acceptance. No production flag was changed.

The app generates a temporary PKCE verifier in memory and opens `mobile-connect.html` in the system browser. The user signs in with the existing website flow, compares the displayed request code, and explicitly approves connecting the app to that account. The app redeems the one-use approval to a normal HttpOnly server session through its native HTTP cookie jar. No Google token, bearer token or session cookie is returned in the JSON response or stored by the app's JavaScript. Cancellation, expiry, account revocation and replay fail closed. Re-entering or restarting the app after losing its in-memory verifier requires starting a new connection.

## Store account costs (not purchased)

- Apple Developer Program: USD99/year, local prices/taxes may differ. https://developer.apple.com/help/account/membership/program-enrollment
- Google Play Console: USD25 one-time registration. https://support.google.com/googleplay/android-developer/answer/6112435
- Existing memberships, if any, have not been verified. Do not create duplicate paid accounts or accept renewals without owner approval.

## Store release blockers

1. An owner-controlled Apple Developer/App Store Connect membership and Google Play Console account must be available, with identity/entity details verified by the owner. No agreement was accepted and no enrollment was started here.
2. Native platform builds and signing still need verification. This environment has no Xcode or Android SDK installation; no IPA, AAB or APK has been produced. Do not label a PWA, platform source tree or ZIP as a native binary.
3. Apple requires utility beyond a repackaged website and a complete functional product. Do not submit a thin wrapper as if review were guaranteed. https://developer.apple.com/app-store/review/guidelines/#minimum-functionality
4. A native container needs a separately tested Google sign-in flow using the appropriate system authentication browser, callback/session handoff and cancellation handling. Do not assume the browser website login works inside a WebView. Review current Apple login-service requirements before choosing an iOS login implementation; no Apple ID login was added.
5. Stock charts and pattern tools need licensed provider OHLCV. The live feed remains disabled. Do not claim live data or full chart functionality in store metadata before connection and acceptance.
6. Obtain real screenshots, device keyboard/orientation tests, review access, support/privacy links, and accurate privacy/data-safety declarations before submission. Metadata below is a draft, not a completed privacy declaration.
7. New personal Google developer accounts may require a closed test with at least12 continuously opted-in testers for14days before applying for production access. https://support.google.com/googleplay/android-developer/answer/14151465

## Prepared draft metadata

Product name: ASAF Trading Pro

Hebrew short description: סביבת מחקר מניות וגרפים בשליטת ASAF AI.

English short description: Stock research and chart tools controlled through ASAF AI.

Draft full description: ASAF Trading Pro brings market research, a conversational AI assistant, a watchlist, research notes and a risk calculator into one workspace. Ask ASAF AI to select a stock, adjust supported indicators and request geometric chart research. Pattern markings are research candidates, not verified signals or investment advice. AI and data services require internet access. Market data availability and timestamps depend on the configured licensed provider; do not describe the current release as a real-time feed.

Privacy URL: https://joyful-seahorse-967889.netlify.app/data-privacy.html

Support contact, seller identity, bundle/package IDs, age/content rating, store categories and production pricing: owner/platform verification required. Do not invent contact details, rights, credentials or store ratings.

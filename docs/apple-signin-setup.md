# Apple sign-in: prepared, not activated

Google and PayPal billing are unchanged. Apple UI stays hidden until server configuration is valid and ASAF_APPLE_AUTH_ENABLED is true. Do not advertise Apple sign-in as available until a real Apple login has been tested.

## Developer account setup

In Apple Developer, enable Sign in with Apple for the primary app, create a Services ID associated with that app, and register the website:

- Domain: joyful-seahorse-967889.netlify.app
- Return URL for the popup flow: https://joyful-seahorse-967889.netlify.app/subscription.html

Create a Sign in with Apple private key. Store it only as a production secret in Netlify, not in chat, source control, or client JavaScript. Do not enroll in a paid developer plan without the owner's explicit spending approval.

Production environment variables:

- APPLE_CLIENT_ID: registered Services ID
- APPLE_TEAM_ID: developer Team ID
- APPLE_KEY_ID: private key identifier
- APPLE_PRIVATE_KEY: secret .p8 PEM contents
- APPLE_REDIRECT_URI: registered exact return URL above
- ASAF_APPLE_AUTH_ENABLED: true only after setup
- ASAF_APPLE_SIGNUP_ENABLED: true only when accepting new Apple accounts

Keep production credentials out of deploy previews.

## Flow and account handling

The server binds a five-minute single-use nonce to an HttpOnly cookie. The browser opens Apple's official popup after an explicit second click (preserving Safari's user activation), validates state, then sends the authorization code to our server. The server exchanges it with Apple and verifies the returned token's RSA signature, issuer, audience, expiry, nonce, verified email and subject before committing an identity and session atomically.

Matching email addresses never automatically merge identities. Existing users sign in using their existing method first and then link Apple with the same email. A newly selected Apple private relay email creates a separate account if signed out; linking a different relay address to an existing account is rejected rather than silently moving billing or granting another trial to that account.

## Required before activation

- Verify Apple Developer eligibility and configuration for this website/app.
- Complete successful and cancelled Apple popup flows on Safari/iPhone and desktop.
- Test private relay, repeat login, existing-account linking and blocked accounts with real provider responses.
- Add provider token revocation on account deletion and Apple server-to-server account-change handling before general availability. Current draft deliberately does not retain provider access/refresh tokens; local account deletion removes the Apple identity mapping.
- Verify existing trial/paid entitlement survives sign-in; do not perform a real charge during auth testing.

References:
https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple
https://developer.apple.com/documentation/signinwithapple/verifying-a-user

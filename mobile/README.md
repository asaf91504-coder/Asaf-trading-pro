# ASAF Trading Pro — native project preparation

This is an isolated Capacitor 8 project. It bundles the existing public web interface; it does not load a remote website through `server.url`, weaken TLS, or include the backend's source or environment files.

`com.asaftradingpro.app` is a provisional identifier. Store availability, legal owner and signing identity have not been verified. This repository does not contain signing keys.

## Reproduce

Use Node22+ and the lockfile:

```sh
cd mobile
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run add:android
npm run add:ios
npm run sync
```

`add` is run once per platform. Use `sync` for later bundled web changes. `www/` is generated and ignored. Generated platform projects contain their own required Gradle/Xcode files; never include signing credentials or build output.

The first injected script is `native-bootstrap.js`, bundled from `native-bootstrap.mjs`. It owns native API transport and the external-browser account handoff. The ordinary website's Google sign-in must never be allowed to run in an embedded WebView. The native-session server capability is disabled until explicit acceptance on devices.

## Native compilation and release

- Android: Android Studio2025.2.1+/Android SDK and the associated JDK are required for Capacitor8. A device/emulator run and a signed release AAB are separate steps.
- iOS: Mac/Xcode26+ and Apple signing configuration are required. Linux cannot compile or sign the iOS app.
- No paid build service, developer enrollment or store submission is part of these commands.
- Before submission, verify native Google login, account revocation/logout, keyboard/rotation, local backup/export links, charts, native networking and app return handling on physical devices.

Native generation or a successful JS bundle is not evidence that an APK/AAB/IPA has been compiled, signed or accepted by a store. See `../mobile-release/README.md` for the remaining owner and product prerequisites.

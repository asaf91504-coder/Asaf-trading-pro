# Twelve Data trial: isolated raster preparation (2026-11-17)

## Verified state

Inspected main commit cfa66ee (merge #56). The production origin is
https://joyful-seahorse-967889.netlify.app/ . Ten anonymous availability/security
checks passed on 2026-11-17; the live health endpoint reported public market data
and background market refresh disabled. No production settings were changed.

The existing `public-market` handler serializes `readMarketSnapshot`, including
raw `bars`, to the browser. Browser charts, scanner, chat context, local indicators,
and persisted conversations have downstream numeric-data paths. Turning on the
existing flags is NOT the raster-only Venture architecture described by sales.
Do not set public-display/AI flags to bypass this mismatch.

The provider email reports a Venture trial through 2026-11-29. This is not proof
of an unrestricted public redistribution licence, automatic-expiry timestamp,
no-charge terms, or external-LLM retention compliance. Obtain exact trial scope
and billing/expiry terms before activating data access. No paid subscription,
provider request, credential change, or external-AI transfer was performed here.

## Implemented only on an isolated local branch

`server/market-raster.mjs` converts validated chronological OHLCV to an RGB PNG
with raster candles, date endpoints, price ticks and optional volume bars.
It uses Node's built-in zlib; there are no third-party rendering dependencies.
Only IHDR, IDAT and IEND chunks are emitted: no JSON, SVG or text metadata with
provider values. The module has no route, fetch, credentials, activation logic,
AI invocation or persistence. It is NOT a working integration or complete chart.

Tests use synthetic values only. The generated synthetic preview was visually
inspected. Three renderer tests cover format, bounds, invalid history, missing
volume, flat prices, determinism and input preservation. All 651 tests passed
on this branch (baseline main ran 648), with secrets excluded from test env.

## Required integration work, in order

1. Reconcile current main, the separate active development conversation, and
   the actual deployed commit. Do not overwrite newer payments/auth changes.
2. Recover the approved API key through a secure server-secret workflow and
   obtain hosting access. No key is present in this workspace. Never request a
   key in chat or place it in a public repo/browser bundle.
3. Add a separate trial gate that defaults OFF, requires a verified owner
   account and explicit approved scope, fails closed after a confirmed expiry,
   and is independently constrained by quotas/symbols/intervals. Do not fake
   commercial-public flags to reuse `readMarketSnapshot`.
4. Refactor server-only provider access behind the trial gate while preserving
   atomic shared credit reservations, source validation, caching, explicit delay
   and per-interval volume provenance. Daily volume and partial intraday volume
   must not be conflated. Keep the existing public JSON route OFF.
5. Build an authenticated POST image route and owner-only preview UI. Return
   PNG bytes plus only contract-permitted non-price metadata. Do not expose
   OHLCV through JSON, SVG, error logs, alt text, client storage, exports, scanner,
   alerts, journal or chat. Enforce no-store and same-origin protections.
6. Add image commands, annotations and render controls server-side. The current
   renderer has no symbol/provider/delay labels, MA overlays, AI drawings,
   price-pan/zoom interaction, or robust long-history paging. It is a substrate.
7. A 500-bar default / 2,000-bar maximum is not one year of minute candles.
   Implement bounded historical pagination/storage only after entitlement,
   retention and quota confirmation. Avoid unlimited backfills.
8. Keep external AI OFF until the provider licence and actual no-training /
   no-retention configuration of every inference intermediary are verified.
   Implement retention/deletion of source-bearing images/chats as required.
9. Test access/expiry/CSRF/quotas, PNG-only payloads, source/error preservation,
   cache isolation and no raw-data leakage end to end. Then perform a minimal
   authorized owner-account live smoke test. Check expected commit on remote
   and CI/deployment before declaring connected.

No endpoint was published, no main changes made, no provider data fetched, and
no live credential, data freshness or external-AI test passed or was attempted.

## Isolated pipeline continuation

`server/twelve-raster-trial.mjs` now supplies an unwired handler factory for
synthetic integration testing. It requires separate explicit scope/enable flags,
a configured owner member ID, authenticated account storage, a precise UTC expiry,
a server API key, allowed symbols and a declared delay no greater than 15 minutes.
There are NO actual values configured here, and no default expiry is inferred.

It rejects anonymous/non-owner and cross-origin requests before provider access;
reserves the existing atomic shared provider-credit budget; fetches only daily
or minute series from the fixed Twelve Data API host with redirect rejection;
bounds response size and validates symbol/interval/candles; applies delay; renders
in server memory; and returns PNG only. A bounded process-local PNG cache avoids
repeated fetches for 60 seconds. No raw series are cached/persisted. Expiry is
checked even on cache hits and after provider fetches. Errors are generic and
never reflect provider bodies/URLs. No external AI is invoked.

This is not wired to a deployed route or browser UI. It does not replace the
public JSON routes. It deliberately leaves volume scope labelled unconfirmed,
uses no production credentials, and supports neither a year of minute history
nor AI annotations. The renderer still needs provider/symbol/delay attribution
inside the image before customer-facing use. A production-grade shared raster
cache and authenticated UI remain to be integrated and reviewed. Continue to
keep all existing commercial market flags OFF.

## Isolated image UI and attribution continuation

The image renderer now burns provider (or explicitly SYNTHETIC DEMO), symbol,
interval, declared delay, owner-trial scope, unconfirmed volume and actual bar
count into raster pixels. Daily images say prior sessions/not live; minute
images warn that the latest candle may be incomplete. No numeric source series
or PNG text metadata is sent alongside the image.

`previews/twelve-raster/index.html` is an isolated Hebrew synthetic-only preview,
not linked from the live application. Its sole transport fetches the checked-in
synthetic PNG; it has no real provider/market route. It supports load/cancel,
keeps a previous image on failure, ignores obsolete responses, validates PNG
signatures, releases blob URLs and avoids client persistent storage. The
controller's synthetic tests cover repeat, failure, cancellation, race and
cleanup flows. The generated labelled PNG was visually inspected; full browser
and physical-device usability have NOT been tested.

History audit: the isolated pipeline deliberately limits output to 1,000 bars
(default 500) and makes exactly one bounded time_series request. It contains no
historical pagination and must not be described as supporting a year of minute
data. Existing main allowed 2,000 bars, likewise not a full year of minute data.
Tests reject over-limit configuration and oversized provider history. No real
entitlement/history fetch was performed. Year-long storage, paging and quota
planning remain blocked on verified entitlement and retention scope.

All 666 tests pass on this continuation. Source changes remain local; there is
no live route, provider activation, credential provisioning, push or deployment.

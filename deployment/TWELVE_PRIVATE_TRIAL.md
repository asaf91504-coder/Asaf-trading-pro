# Twelve Data private trial — 17 November 2026

Provider approved the owner as sole internal tester until 29 November 2026. The later email explicitly permits the described selected OHLCV/indicator inference through OpenRouter to an external model, provided there is no model training and no other user. This does not authorize a customer rollout.

Production uses the existing server-only API key. Private access requires the exact configured member ID, authenticated sessions, billing access, and an unexpired trial. Anonymous users, other members, public scanner jobs and fundamentals do not receive this feed. Public licensing remains false. Cache keys are isolated from public mode; cache retention is bounded by the trial end.

The conservative cutoff is 2026-11-28T22:00:00Z (29 November 00:00 Israel), because the provider gave a manual downgrade date without a time. No paid plan was activated. REST refresh is at most once per minute; 50 configured US tickers, seven intervals, 500 bars. Daily candles exclude the current New York session; intraday may include an open candle. Volume is partial, not consolidated.

OpenRouter requests require data_collection=deny and zdr=true, including subsequent chat history. If no compliant free endpoint exists the request fails; no paid model fallback is enabled.

Before a customer launch obtain the appropriate display and external-AI permissions, review raw browser data exposure versus licensed rendering, and deliberately replace the private trial settings. Do not simply disable private mode and assume public permission.

Validation: 654 automated tests passed, including owner/other/anonymous isolation, expiry, AI cached-data authorization, and cache separation. Live verification is recorded separately after deployment.

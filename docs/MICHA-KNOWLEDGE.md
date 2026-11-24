# Reviewed educational methods in ASAF Pro

The existing authenticated Q&A route retrieves original educational review notes for both configured OpenRouter and OpenAI providers. This is reference retrieval, not model fine-tuning or a claim to know every detail in unseen lessons. The user authorized the existing paid route and deployment; models, account keys, quotas and the conservative request cost reservation stay unchanged. No extra inference or embedding request is introduced.

Snapshot: 286 unique reviewed sources, including 241 transcript reviews and 45 video reports; 118 are Academy lessons and 59 Academy lessons remain unread. 236 records include fuller original review sections. Gemini-only summaries, failed accesses, raw full transcripts, private work ledgers and account/credit data are excluded.

## Chat behavior

Private records retain original source titles, URLs, coverage, timestamps and limitations. Request-time context uses neutral educational wording and private IDs, with no automatic training-source video links. Customer answers do not mention the creator/channel; final text is also neutralized, including chart-action answers after JSON validation. Market-data provider attribution and current factual citations stay intact. No false claim of original authorship or endorsement is added.

Bilingual local retrieval selects up to four relevant records within 7,000 UTF-8 bytes, using spare capacity below the existing 48,000-byte text ceiling. The analysis framework applies even when retrieval finds no matching lesson, provided the input budget allows it. It covers source/date/timeframe, candle completion, trend and MA20/MA150 context, support/resistance, pattern stage, comparable volume, conditional triggers and invalidation, ATR and risk. Historical examples, opinions and forecasts are not verified current facts. Existing licensing guards, language, auth, quotas and server-calculated entry/stop remain authoritative. The owner current-news pilot keeps its independent research flow; its final answer uses the same neutral naming filter. The legacy paid endpoint is unchanged.

## Scanner behavior

Both manual and shared scans run deterministic methodology checks on server records, without calling a model or fetching extra market data. A match must satisfy the selected custom filters plus the ASAF baseline: fresh verified USD market cap >=1 billion, price >5, above MA20, rising close, verified consolidated above-average volume, completed daily candles with valid ATR14, and a long pattern with measured potential >=15%. MA150 remains context rather than a mandatory gate. Missing evidence fails closed with a reason; it is not inferred from titles, charts or partial feeds.

Pattern risk/reward is recomputed using an exact 2×ATR stop, rather than the old illustrative range stop. Waiting, latest-candle crossings and already-above patterns get separate states. Only current matches enter the shortlist. The full table retains rejected results unless match-only view is selected, so missing data is visible. Gap risk and unchecked earnings/news are disclosed. Derived-only response allowlists and existing provider licensing/quotas remain in force. Generic low-level custom filter utilities and owner-curated setup publication are unchanged; they are not new automatic buy recommendations. Cup-and-handle and other unsupported classifications are not invented.

## Validation and later lessons

Tests cover every source being individually retrievable; exclusions; request bytes/images; private attribution versus neutral customer context; the actual OpenAI request and chart-action output; scanner missing/partial evidence; exact ATR risk/reward; and distinct pattern stages. No live billed model call was made. Offline tests establish code behavior, not guaranteed live answer quality.

Only add lessons actually read, upsert by video ID and preserve original coverage/timestamps/limitations. Reconcile counters with the canonical review state. Never count a title, failed access or service report as independent full video viewing.

## User-supplied Academy study guide

The follow-up outline lists 11 lesson URLs and a pre-entry checklist. It is stored in `server/knowledge/academy-study-guide.json` as 12 explanatory topic records with question examples, editorial clarifications and explicit `user_provided_study_guide` provenance. It is not 11 newly watched videos, full transcripts or proof that the remaining Academy is complete. Reviewed-source and Academy counters are unchanged. Lesson references and independent factual verification URLs remain internal documentation; model context omits training-source YouTube links.

Topics cover compounding/inflation, stock/exchange basics, indexes/ETFs, first purchase, order types, horizon/discipline, stops/invalidation, trailing profits, ATR/position sizing, approximate volume profile, liquidity/long moving averages, and the pre-trade checklist. User material is interpreted alongside verified SEC/Investor.gov, FINRA, Fidelity and TradingView explanations and the implementation's actual volume-profile limitations. Examples are clearly hypothetical. Market orders lack a fixed price; limit/stop-limit orders may not fill; stops do not guarantee a maximum loss. Neither company size nor a volume profile alone establishes liquidity or support. Broad ETFs do not remove market risk, and narrowly focused ETFs may not diversify.

The study guide's $10B and MA150/200 preferences are optional context; existing ASAF screening thresholds and exact server ATR stop remain authoritative. No screener threshold, licensed feed, model, API quota or cost ceiling was changed. The guide is retrieved through the same single bounded inference request; no video extraction, paid video API or new model request is introduced.

A creator-name filter regression was corrected: matching a Hebrew name inside the word `תמיכה` previously corrupted technical support terminology. Unicode word boundaries now preserve support wording. New tests cover concept retrieval in Hebrew/English, user-guide provenance, unchanged review counts and filters, mathematical position sizing, the real authenticated OpenAI request boundary (mock provider), names versus support terminology, and input limits. These are not live inference quality tests.

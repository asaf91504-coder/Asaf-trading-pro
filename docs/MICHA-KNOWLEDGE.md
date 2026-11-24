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

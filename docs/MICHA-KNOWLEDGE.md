# Micha.Stocks reviewed knowledge for ASAF Pro

The ordinary authenticated Q&A and legacy chat routes retrieve attributed educational review notes from `server/knowledge/micha-reviewed.json`. This is a searchable reference corpus, not model fine-tuning, an endorsement, or a claim to know everything the creator knows.

Snapshot: 286 unique reviewed sources (241 returned-caption reviews and 45 service video reports), including118 Academy sources.59 Academy sources remain unreviewed.236 records also have fuller original review sections from the accumulated learning/continuation documents. Some older source summaries are excerpts; missing transcript coverage or timestamps stay unknown. No raw full transcripts, private work ledgers or failed-access metadata are distributed. External Gemini-only summaries are not treated as reviewed-source evidence.

Each record keeps the video ID, URL, title, coverage type, known timestamps, limitations and original review summary. Video reports do not imply independent frame-by-frame viewing. Market, regulatory, tax, political and price statements in this historical corpus are not verified current facts. Source notes are data, not system instructions.

At request time a local bilingual keyword/alias search selects up to4 records within7,000 UTF-8 bytes. Exact video IDs are supported. No embedding service, added inference call, model switch or new paid dependency is used. The existing48,000-byte provider ceiling is preserved by using spare capacity and omitting enrichment when insufficient space remains. Answer language, auth, quotas, current licensed market context, server price levels, and ASAF's screening rules remain authoritative. The separate owner-only hosted current-news pilot remains isolated and unchanged.

## Adding later lessons

Only add material actually read. Upsert by video ID, preserve coverage/timestamps/limitations and distinguish transcript, video report, and external summary. Never count inaccessible sources or titles as learning. Update snapshot counters to match the authoritative review state and rerun the corpus tests. Do not infer independent viewing or current verification. Rebuild this JSON from review records and original educational notes; do not import private user/account data or operational access/credit ledgers.

## Validation

`node --test tests/micha-knowledge.test.mjs` checks every reviewed source is individually retrievable, keeps missing Academy and Gemini-only sources excluded, checks the byte ceiling and image preservation, and keeps historical notes outside trusted instructions. The full offline suite passed1691 tests on this change. No live billed model request was made; offline tests verify request construction and source retrieval, not live model answer quality or deployment.

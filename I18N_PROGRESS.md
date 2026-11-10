# Interface languages

## 2026-11-10 release

Ten selectable interface languages: Hebrew, English, Spanish, Arabic, French,
German, Portuguese, Russian, Simplified Chinese and Japanese.

- 1,458 local UI strings per non-Hebrew language; no external translation API.
- Persistent selection; Hebrew/Arabic RTL, other languages LTR. Existing UI,
  dynamic messages, placeholders, accessible labels and chart canvas labels
  use the selected language. User drafts and authored content remain unchanged.
- Chat payload includes the selected response language. The server validates
  the language against a fixed allowlist; routing, quotas and licensing remain
  unchanged. Localized quick-action drafts map back to existing chart intents.
- Failed language downloads preserve the previous working language. Storage
  failures do not disable the selector.

Verification: Node regression suite, catalog coverage, browser switching among
English/Spanish/Arabic and preservation of a mixed Hebrew/ticker draft. Anonymous
production protection checks do not invoke a model or market-data provider.

Limits: translations need native-speaker editorial review before broad campaigns.
Some interpolated/server-provided messages can retain untranslated fragments;
news/source articles and user-authored content are intentionally not translated.
No live model response or physical iPhone acceptance was performed in this pass.
Provider licensing and data access remain separate from interface localization.

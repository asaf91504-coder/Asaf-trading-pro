# Multilingual interface — work in progress

Requested languages: Hebrew, English, Spanish, Arabic, French, German,
Portuguese, Russian, Chinese and Japanese.

The initial catalog defines navigation labels and locale resolution. It is not
wired to production and does not represent a fully translated interface.
Two catalog tests cover key parity, direction, regional tags and invalid input.

Remaining implementation before release:
- Replace hardcoded UI strings with keyed messages across all screens.
- Add a language selector, resilient local preference storage and startup restore.
- Localize placeholders, accessible labels, validation and server error codes.
- Apply direction-aware layout rules and locale-aware date/number formatting.
- Pass response language to the chat without modifying provider licensing gates.
- Preserve user messages, symbols and licensed data verbatim.
- Verify each language, dynamic updates, keyboard navigation and mobile layout.
- Run the full regression suite and preview checks before production release.

No external translation service, model upgrade, or paid service was introduced.

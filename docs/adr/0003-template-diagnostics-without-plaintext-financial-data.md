# Template diagnostics without plaintext financial data

Fidy will improve email and notification evidence extraction through deterministic Evidence Extractors and optional Template Diagnostics, but it will not persist raw capture content or plaintext financial values remotely. Template Diagnostics may record source family, channel, extractor version, Template Shape fingerprints, canonical field names, redacted value types, matched rule names, missed structural signals, and aggregate success or failure counts; they must not include email bodies, notification text, merchants, amounts, dates, user names, email addresses, authorization numbers, account suffixes, parsed transactions, or account hints as raw values.

**Considered Options**

- Store raw or sanitized bank examples remotely: fastest way to improve extractors, but it creates a remote corpus of user financial activity and conflicts with the Local Ledger boundary.
- Keep all extractor learning local and manual: strongest privacy posture, but makes template drift hard to observe across users.
- Store only non-sensitive Template Diagnostics: gives enough operational signal to discover template drift and extractor gaps while preserving the rule that Plaintext Financial Data is not persisted remotely.

**Consequences**

Extractor updates must be driven by redacted structure, tests, and explicit user/dev-provided examples rather than a backend archive of financial emails. If an extractor needs account identity such as a card last four, the value may be returned to the app and stored in the Local Ledger as Capture Evidence, but remote diagnostics can only record that a masked suffix was present, not the suffix itself.

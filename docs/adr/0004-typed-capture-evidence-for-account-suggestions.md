# Typed capture evidence for account suggestions

Fidy will split AI and deterministic capture evidence into typed account and counterparty buckets before account suggestions are derived. Account suggestions may use Account Identity Evidence, Account Product Hints, and cautiously repeated Account Type Hints. Counterparty Evidence such as merchants, payees, and payers must not create or link financial accounts.

**Considered Options**

- Keep one broad LLM account-hint field and patch bad values with heuristics: fastest to ship, but merchants such as Rappi can be interpreted as bank accounts when the source email is from a bank.
- Disable LLM account hints entirely: safest against false account suggestions, but loses useful weak evidence for templates that do not expose deterministic account identifiers.
- Split evidence into typed buckets: requires parser, evidence, and UI changes, but makes account attribution safer and lets the UI show uncertainty honestly.

**Consequences**

Parser contracts must distinguish account identity, account product, account type, and counterparty fields. Existing broad LLM account hints should be treated as weak legacy evidence and filtered conservatively. Onboarding can still suggest accounts from repeated weak evidence, but product-only suggestions should be framed as confirmation requests rather than unique account identity. Merchant and payee values remain useful for transaction interpretation and categorization, but they are excluded from account suggestion derivation.

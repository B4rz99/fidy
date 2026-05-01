# Capture Evidence Extractors and Template Diagnostics Plan

## Problem

Email and notification templates differ by bank and can drift over time. The Capture Interpreter can parse many cases, but account suggestions need stable evidence for account attribution. Generic LLM account hints can produce duplicate or vague suggestions, while deterministic account identity evidence such as masked card suffixes can produce clearer suggestions and safer future auto-linking.

Fidy must improve this without storing Plaintext Financial Data remotely.

## Target

- Use deterministic Evidence Extractors for high-confidence account identity signals.
- Keep the Capture Interpreter as a fallback for ambiguous or fragile evidence.
- Distinguish Account Identity Evidence, Account Product Hints, Account Type Hints, and Counterparty Evidence in ranking and suppression.
- Use Template Diagnostics to observe extractor drift without storing raw capture content or financial values.
- Preserve the Local Ledger as the only durable store for Capture Evidence and account identifiers.

## Domain Terms

- Capture Evidence: source facts from emails, notifications, wallets, or payment surfaces.
- Evidence Extractor: deterministic rule set that produces Capture Evidence from source structure.
- Account Identity Evidence: specific account-identifying signal, such as masked card suffix.
- Account Product Hint: product signal such as Visa Oro or Mastercard Black that names a product but not a specific account instance.
- Account Type Hint: generic kind signal such as credit card or savings account.
- Counterparty Evidence: merchant, payee, payer, or other transaction counterparty evidence that must not drive account suggestions.
- Template Shape: redacted structural representation of a source template.
- Template Diagnostic: operational metadata about extractor behavior for a Template Shape.

## Near-Term Implementation

1. Add dev-only diagnostics for account suggestions.

   - Log suggestion `scope`, `value`, `evidenceType`, `occurrences`, and `confidenceScore` in development only.
   - Use this to confirm whether duplicate cards come from LLM wording variants or real distinct evidence.
   - Do not log raw email bodies, notification text, merchants, amounts, or tokens.

2. Add local deterministic email Evidence Extractors.

   - Start with conservative high-confidence patterns such as `Metodo de pago *0746` for RappiCard.
   - Emit `email:{sourceFamily}:last4` only when surrounding labels prove account/card context.
   - Avoid extracting authorization numbers, dates, times, amounts, reference numbers, or arbitrary four-digit values.

3. Thread email body into evidence building.

   - Pass the email body to the capture-evidence builder at the same boundary that already receives parsed LLM account hints.
   - Persist extracted evidence only in the Local Ledger.

4. Improve suggestion ranking and suppression.

   - Rank Account Identity Evidence above Account Product Hints, and Account Product Hints above generic Account Type Hints.
   - Suppress generic same-source hints when a stronger same-source identity signal exists.
   - Keep weaker hints when there is no account identity evidence only if they are account-like.
   - Exclude Counterparty Evidence from account suggestions even when repeated.

5. Add tests from sanitized fixtures.

   - RappiCard payment method with `*0746` yields `last4 = 0746`.
   - RappiCard authorization number `446288` does not yield last4.
   - DAVIbank `tarjeta Visa Oro` yields an Account Product Hint but no Account Identity Evidence.
   - Rappi merchant/payee text in a DAVIbank email yields Counterparty Evidence, not account suggestion evidence.
   - Same-source `last4` suppresses generic LLM/card hints in suggestions.

6. Split Capture Interpreter output into typed evidence buckets.

   - Keep transaction fields separate from evidence fields.
   - Return merchant/payee/payer as Counterparty Evidence, not account hints.
   - Return card/account product names as Account Product Hints.
   - Return generic account kinds as Account Type Hints.
   - Return masked suffixes only as Account Identity Evidence.

7. Update onboarding account suggestions.

   - Strong suggestions can be created from Account Identity Evidence.
   - Product-only suggestions should be labeled as confirmation requests, not treated as unique account identity.
   - Account Type Hints should be used cautiously and only when repeated with no stronger evidence.
   - Counterparty Evidence should never produce create/link account actions.

## Later Implementation

1. Move mature extractors to the Edge Function response boundary.

   - Edge already receives sanitized/truncated capture text for Cloud AI Processing.
   - Edge can return deterministic evidence alongside LLM results without persisting source content.
   - Mobile persists returned evidence in the Local Ledger.

2. Add production-safe Template Diagnostics.

   - Compute Template Shape fingerprints from canonical field names and redacted value types.
   - Report only new or changed shapes per source family, channel, app version, and extractor version.
   - Aggregate by shape and extractor outcome, not by raw content.

3. Add drift detection.

   - Detect new Template Shapes.
   - Detect removed fields such as `payment_method` from previously known shapes.
   - Detect extractor success-rate drops for known shapes.
   - Alert only after a threshold across users/devices to avoid reacting to one-off emails.

4. Move typed evidence extraction closer to the Edge parser contract.

   - Update the parser schema so account evidence and Counterparty Evidence cannot share one field.
   - Treat AI evidence as typed suggestions that deterministic validation can accept, downgrade, or discard.
   - Keep remote processing transient; mobile persists only accepted Local Ledger evidence.

## Privacy Rules

- Do not persist email bodies or notification text remotely.
- Do not persist merchants, amounts, dates, account suffixes, authorization numbers, user names, or email addresses in Template Diagnostics.
- Do not persist parsed transactions, account hints, or Capture Evidence as plaintext remote financial rows.
- If account identity evidence is extracted remotely, return it to mobile for Local Ledger persistence only.
- Template Diagnostics may say `masked_last4_present: true`; they must not include the last four value.
- Template Diagnostics may record that Counterparty Evidence was present, but not the counterparty name.

## Open Questions

- Should mature extractors live in mobile first, Edge first, or both during transition?
- What threshold should promote a repeated Account Type Hint into an onboarding suggestion when no Account Identity Evidence exists?
- Should Account Product Hints be shown in onboarding by default, or only after the sync completes enough emails to avoid premature suggestions?
- Should Template Diagnostics be opt-in only at first, or enabled by default with strict redaction and aggregation?
- Which source families should be prioritized after RappiCard and DAVIbank?

# Financial Accounts V1 Implementation Plan

## Goal

Ship first-class **Financial Accounts** without slowing onboarding:

- auto-create one default financial account before first sync
- keep onboarding fast: `connect email -> sync -> optional improve accuracy -> budget`
- assign every transaction to a financial account
- suggest account creation/linking after sync from repeated scoped evidence
- separate **Transfer** from **Transaction**

## Non-goals for this slice

- automatic card statement obligation generation
- one-sided transfer inference
- wealth/net-worth features
- transfer fee modeling
- deep unresolved-review UX beyond account suggestions

## Why this needs slices

The current app is transaction-only:

- `transactions` have no `accountId` in [apps/mobile/shared/db/schema.ts](../apps/mobile/shared/db/schema.ts#L34)
- onboarding syncs captures before any account setup in [apps/mobile/app/(auth)/onboarding.tsx](../apps/mobile/app/(auth)/onboarding.tsx#L51)
- capture pipelines save transactions directly from coarse source data in:
  - [apps/mobile/features/email-capture/services/email-pipeline.ts](../apps/mobile/features/email-capture/services/email-pipeline.ts#L56)
  - [apps/mobile/features/capture-sources/services/notification-pipeline.ts](../apps/mobile/features/capture-sources/services/notification-pipeline.ts#L31)
  - [apps/mobile/features/capture-sources/services/apple-pay-pipeline.ts](../apps/mobile/features/capture-sources/services/apple-pay-pipeline.ts#L24)
- manual entry has no account field in [apps/mobile/app/(tabs)/add.tsx](../apps/mobile/app/(tabs)/add.tsx#L1)

Trying to land accounts, onboarding suggestions, and transfers in one step will create too much drift.

## Recommended sequence

### Slice 1: Ledger foundation

Create the financial-account core first.

Scope:

- add branded types and generators:
  - `FinancialAccountId`
  - `FinancialAccountIdentifierId`
  - `OpeningBalanceId`
  - `TransferId`
- add tables:
  - `financial_accounts`
  - `financial_account_identifiers`
  - `opening_balances`
  - `transfers`
  - `transfer_links` only if needed for capture relinking, otherwise keep link on source tables
- extend `transactions` with:
  - `account_id` `NOT NULL`
  - `account_attribution_state`
  - optional `superseded_at` or equivalent active/superseded marker
- remove `"transfer"` from transaction categorization/schema

Implementation notes:

- because the app is unreleased, make the schema change cleanly instead of adding temporary nullable account fields
- keep balances derived from opening balances + transactions + transfers
- every new table must use sync queue integration

Exit criteria:

- the app can create and read financial accounts locally
- every transaction row has an owning account
- transfers exist as a separate persisted record type

Entry points:

- [apps/mobile/shared/db/schema.ts](../apps/mobile/shared/db/schema.ts#L1)
- [apps/mobile/shared/types/branded.ts](../apps/mobile/shared/types/branded.ts#L1)
- [apps/mobile/shared/lib/generate-id.ts](../apps/mobile/shared/lib/generate-id.ts#L1)
- [apps/mobile/features/transactions/schema.ts](../apps/mobile/features/transactions/schema.ts#L1)

Execution checklist:

- [ ] Add branded types for financial accounts, account identifiers, opening balances, and transfers.
- [ ] Add typed ID generators and Drizzle `$type<>()` annotations for new entities.
- [ ] Add `financial_accounts`, `financial_account_identifiers`, `opening_balances`, and `transfers` tables.
- [ ] Extend `transactions` with non-null `account_id` and explicit `account_attribution_state`.
- [ ] Add the minimal repository/build/decoder layer needed to read and write the new entities cleanly.
- [ ] Wire sync queue support for every new user-data table introduced in this slice.
- [ ] Remove `"transfer"` from transaction categorization/schema so transfer semantics stop leaking through categories.

Guardrails:

- Do not introduce a temporary nullable `transactions.account_id`.
- Do not add a writable current-balance field; balances stay derived.
- Do not fold transfers into the transaction record shape.

### Slice 2: Bootstrap and transaction ownership

Make day-zero ownership real before touching suggestions.

Scope:

- create one default financial account automatically at registration/onboarding start
- wire onboarding initialization so the default account exists before first sync
- update manual transaction creation/edit flows to require an account with default preselected
- update repositories/builders/stores so `StoredTransaction` includes `accountId` and `accountAttributionState`

Primary files:

- [apps/mobile/app/(auth)/onboarding.tsx](../apps/mobile/app/(auth)/onboarding.tsx#L1)
- [apps/mobile/features/transactions/store.ts](../apps/mobile/features/transactions/store.ts#L1)
- [apps/mobile/features/transactions/schema.ts](../apps/mobile/features/transactions/schema.ts#L1)
- [apps/mobile/app/(tabs)/add.tsx](../apps/mobile/app/(tabs)/add.tsx#L1)

Exit criteria:

- first sync works without explicit account setup
- manual transactions always save with an account
- default account exists exactly once per user

Entry points:

- [apps/mobile/app/(auth)/onboarding.tsx](../apps/mobile/app/(auth)/onboarding.tsx#L1)
- [apps/mobile/features/transactions/store.ts](../apps/mobile/features/transactions/store.ts#L1)
- [apps/mobile/app/(tabs)/add.tsx](../apps/mobile/app/(tabs)/add.tsx#L1)
- capture save paths in:
  - [apps/mobile/features/email-capture/services/email-pipeline.ts](../apps/mobile/features/email-capture/services/email-pipeline.ts#L1)
  - [apps/mobile/features/capture-sources/services/notification-pipeline.ts](../apps/mobile/features/capture-sources/services/notification-pipeline.ts#L1)
  - [apps/mobile/features/capture-sources/services/apple-pay-pipeline.ts](../apps/mobile/features/capture-sources/services/apple-pay-pipeline.ts#L1)

Execution checklist:

- [ ] Add a bootstrap path that creates exactly one default financial account before onboarding sync begins.
- [ ] Ensure the bootstrap is idempotent so it does not create duplicate default accounts.
- [ ] Thread default-account lookup into every capture pipeline save path.
- [ ] Extend `StoredTransaction` and transaction builders/rows with `accountId` and `accountAttributionState`.
- [ ] Add account selection to manual transaction create/edit with the default account preselected.
- [ ] Keep first-sync onboarding working without any new required account setup step.

Guardrails:

- Do not surface required account setup before sync.
- Do not create more than one default account per user.
- Unresolved fallback-assigned transactions must remain provisional for account-specific balances.

### Slice 3: Capture evidence persistence

Do not build suggestions until evidence is durable.

Scope:

- add structured evidence persistence for captures
- preserve enough source detail to support:
  - bank sender / email `from`
  - scoped last-4 or alias tokens when present
  - package/bank family
  - Apple Pay `card` hint
- link evidence to created transaction or kept capture record

Recommended shape:

- add a `capture_evidence` table or equivalent normalized table rather than overloading `processed_emails` / `processed_captures`
- keep raw text where it already exists, but also persist normalized fields needed for matching

Why this comes first:

- current parsed outputs throw away most account-level evidence
- suggestion quality will be poor without a stable evidence layer

Exit criteria:

- every newly ingested capture stores normalized evidence alongside its transaction/capture record
- evidence can be queried on-device to count repeated scoped matches

Entry points:

- [apps/mobile/features/email-capture/schema.ts](../apps/mobile/features/email-capture/schema.ts#L1)
- [apps/mobile/features/capture-sources/schema.ts](../apps/mobile/features/capture-sources/schema.ts#L1)
- [apps/mobile/features/email-capture/services/email-pipeline.ts](../apps/mobile/features/email-capture/services/email-pipeline.ts#L1)
- [apps/mobile/features/capture-sources/services/notification-pipeline.ts](../apps/mobile/features/capture-sources/services/notification-pipeline.ts#L1)
- [apps/mobile/features/capture-sources/services/apple-pay-pipeline.ts](../apps/mobile/features/capture-sources/services/apple-pay-pipeline.ts#L1)

Execution checklist:

- [ ] Add a normalized evidence persistence model for capture facts needed by account attribution.
- [ ] Persist email sender/domain evidence from captured emails.
- [ ] Persist notification source family and any extractable alias/last-4 style tokens when present.
- [ ] Persist Apple Pay `card` hint evidence instead of dropping it.
- [ ] Link evidence to the created transaction or retained capture record.
- [ ] Add query helpers that can count repeated scoped evidence for one user on-device.

Guardrails:

- Do not use merchant name alone as account evidence.
- Do not skip raw capture persistence that existing flows already rely on.
- Do not build suggestion UI in this slice.

### Slice 4: Account suggestion engine

Build the derivation, not the UI first.

Scope:

- derive `Account Creation Suggestions` on-device from repeated scoped evidence
- only emit suggestions when evidence repeats across multiple captures
- cap onboarding-visible suggestions to top 3 by confidence
- support dismissal suppression until stronger evidence appears
- when a suggestion is accepted, reprocess matching unresolved records only

Recommended persistence:

- derive suggestions from evidence each time
- persist only what must survive:
  - dismissed suggestion fingerprints
  - maybe accepted suggestion metadata for audit/debug

Exit criteria:

- given repeated scoped evidence, the app produces stable account suggestions
- single-capture / sender-only evidence produces no suggestion
- dismissed suggestions stay suppressed until stronger evidence appears

Entry points:

- new suggestion derivation module under the financial-account/capture-evidence boundary
- [CONTEXT.md](../CONTEXT.md#L1) sections covering `Account Creation Suggestion`, scoped identifiers, and dismissal suppression

Execution checklist:

- [ ] Derive suggestions only from repeated scoped evidence for one user.
- [ ] Rank suggestions so onboarding can take the top 3 strongest candidates.
- [ ] Persist dismissal fingerprints or equivalent suppression state.
- [ ] Reprocess matching past unresolved records when a suggestion is accepted.
- [ ] Expose a thin query/API boundary that the onboarding/home UI can consume without reimplementing matching logic.

Guardrails:

- Do not auto-create financial accounts from suggestions.
- Do not emit suggestions from a single capture or sender alone.
- Only reprocess unresolved records automatically, not confirmed ones.

### Slice 5: Suggestion review UX

Add the user-facing accuracy flow after the engine works.

Scope:

- insert optional onboarding step after sync and before budget setup
- auto-enter that step only when strong suggestions exist
- skip it entirely when none exist
- reuse the same consolidated review screen from onboarding and later home prompt
- show for each suggestion:
  - lightweight reason
  - `Create account`
  - `Link existing`
  - `Skip for now`
- `Create account` opens prefilled form
- `Link existing` starts with filtered likely matches

Primary files:

- [apps/mobile/features/onboarding/store.ts](../apps/mobile/features/onboarding/store.ts#L1)
- [apps/mobile/app/(auth)/onboarding.tsx](../apps/mobile/app/(auth)/onboarding.tsx#L1)
- [apps/mobile/features/onboarding/components/SyncProgressStep.tsx](../apps/mobile/features/onboarding/components/SyncProgressStep.tsx#L1)
- [apps/mobile/features/dashboard/components/HomeScreen.tsx](../apps/mobile/features/dashboard/components/HomeScreen.tsx#L1)

Exit criteria:

- onboarding stays fast when there are no suggestions
- onboarding shows at most 3 suggestions when they exist
- skipped/lower-priority suggestions reappear later from home

Entry points:

- [apps/mobile/features/onboarding/store.ts](../apps/mobile/features/onboarding/store.ts#L1)
- [apps/mobile/app/(auth)/onboarding.tsx](../apps/mobile/app/(auth)/onboarding.tsx#L1)
- [apps/mobile/features/onboarding/components/SyncProgressStep.tsx](../apps/mobile/features/onboarding/components/SyncProgressStep.tsx#L1)
- [apps/mobile/features/dashboard/components/HomeScreen.tsx](../apps/mobile/features/dashboard/components/HomeScreen.tsx#L1)

Execution checklist:

- [ ] Insert the optional post-sync account-accuracy step after sync and before budget setup.
- [ ] Auto-enter the step only when strong suggestions exist; skip it entirely otherwise.
- [ ] Reuse one consolidated suggestion-review screen from onboarding and later home prompt.
- [ ] Cap onboarding-visible suggestions at 3.
- [ ] Show lightweight suggestion reasons plus create, link, and skip actions.
- [ ] Make create-account prefilled and link-to-existing filtered before showing the full account list.
- [ ] Persist skipped/deferred suggestions so they can resurface later from home.

Guardrails:

- Do not show unresolved captured-record review in this onboarding step.
- Do not frame the screen as required setup; it is an optional accuracy improvement.
- Do not bury deferred suggestions only in settings.

### Slice 6: Financial account management

Make accounts editable outside onboarding.

Scope:

- add financial-account list/detail/create/edit flows
- allow optional identifier entry during account setup
- support kinds:
  - checking
  - savings
  - wallet
  - cash
  - credit_card
- allow optional billing profile for credit cards
- explain unavailable cycle-aware features when billing profile is missing
- support opening balance + effective date

Exit criteria:

- users can create/edit accounts manually
- users can add identifiers later
- credit-card setup supports optional `fecha de corte` and `fecha límite de pago`

Entry points:

- current connected/capture account surface in [apps/mobile/app/connected-accounts.tsx](../apps/mobile/app/connected-accounts.tsx#L1)
- any new financial-account feature module created in slices 1-2

Execution checklist:

- [ ] Add a financial-account list surface distinct from connected email/capture accounts.
- [ ] Add create and edit flows for supported account kinds.
- [ ] Support optional financial account identifiers during setup and editing.
- [ ] Support optional opening balance plus effective date.
- [ ] Support optional credit-card billing profile fields.
- [ ] Explain which cycle-aware features are unavailable when billing profile data is missing.

Guardrails:

- Do not force billing-profile entry during onboarding or account creation.
- Keep connected email accounts/capture sources distinct from financial accounts in naming and UI.
- Keep identifiers optional, not required.

### Slice 7: Transfer domain

This is the accounting fix for the credit-card-payment problem.

Scope:

- add manual transfer creation
- require two explicit sides
- allow generic external side only through explicit user choice
- exclude transfers from spending/income analytics and budgets
- include transfers in account balance derivation
- remove transaction-category misuse of transfer

Primary files likely impacted:

- transaction category/schema modules
- analytics repository
- home/activity rendering
- manual entry flows

Exit criteria:

- users can record debit-to-credit-card, cash-to-card, and bank-to-cash transfers
- credit-card payments no longer have to masquerade as expenses

Entry points:

- transaction category/schema modules
- analytics repository/store boundaries
- any new transfer repository/module added in slice 1

Execution checklist:

- [ ] Add transfer creation and validation with two explicit sides and one amount.
- [ ] Support tracked-account to tracked-account transfers.
- [ ] Support explicit generic external side only through an outside-tracked-accounts choice.
- [ ] Exclude transfers from spending, income, and budget derivations.
- [ ] Include transfers in account balance derivation.
- [ ] Remove the remaining UI/domain paths that rely on `"transfer"` as a transaction category.

Guardrails:

- Do not infer one-sided transfers in v1.
- Do not add fee or split-amount semantics to transfers.
- Do not let transfers pollute expense/income analytics.

### Slice 8: Reclassification and review follow-up

Do this after transfers exist.

Scope:

- allow reclassifying a captured transaction into a transfer
- preserve capture evidence and relink it
- supersede the original transaction so it stops counting
- add separate later-phase review queues for:
  - financial meaning
  - account attribution

Exit criteria:

- mistaken captured expenses can be converted into transfers without delete/recreate flows

Entry points:

- [apps/mobile/features/email-capture/components/NeedsReviewScreen.tsx](../apps/mobile/features/email-capture/components/NeedsReviewScreen.tsx#L1)
- transaction edit/details flows
- capture evidence linkage introduced in slice 3

Execution checklist:

- [ ] Add a reclassification path from captured transaction to transfer.
- [ ] Preserve and relink capture evidence instead of discarding it.
- [ ] Mark the original transaction as superseded so it stops counting in active views and derivations.
- [ ] Add the separate later-phase review flows for financial meaning and account attribution as needed by the new model.

Guardrails:

- Do not keep the original transaction active after successful reclassification.
- Do not require delete-and-recreate user workflows for captured transfers.
- Keep financial-meaning review separate from account-attribution review.

## Testing strategy

Focus tests at the deepest owning modules:

- direct unit tests for:
  - suggestion derivation
  - scoped identifier matching
  - balance derivation with opening balances + transfers
  - onboarding step gating
- repository tests for:
  - account-scoped transaction queries
  - transfer persistence
  - unresolved-record reprocessing
- orchestration tests for:
  - onboarding auto-bootstrap of default account
  - onboarding suggestion-step insertion/skipping
  - accepting a suggestion updates unresolved records

## Recommended first tracer bullet

Do **Slices 1-2 together** before anything else:

1. add `financial_accounts`
2. auto-create default account
3. add `transactions.account_id`
4. thread account ownership through manual entry + sync save paths

That gives a working backbone for every later slice.

After that, do **Slices 3-5** as the onboarding/account-suggestion feature.

Keep **Slices 7-8** separate if you want to reduce scope and land account attribution before transfer reclassification.

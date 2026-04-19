# `Financial Accounts, Post-Sync Account Suggestions, and Transfers`

## Problem

Fidy automatically captures transactions from email, notifications, Apple Pay, and manual entry, but the ledger still behaves as if money movement has no owning account.

That creates three user-facing problems:

- captured transactions cannot reliably be attributed to the financial account that actually sent or received the money
- credit-card payments are at risk of being treated like new expenses instead of debt-settling transfers, which double-counts spending
- onboarding sync happens before any account setup exists, so multi-account accuracy cannot start working on day one without adding friction

The result is a product that can show automated capture, but cannot yet tell a user which bank account, wallet, cash balance, or credit card a record belongs to, and cannot cleanly distinguish spending from settlement.

## Proposal

Introduce first-class **Financial Accounts** and make every transaction belong to exactly one account. Auto-create a default financial account before first sync so onboarding remains fast, then use repeated scoped capture evidence to suggest likely account creation or linking after sync as an optional accuracy improvement.

Keep **Transaction** narrow as `expense | income`. Add a separate first-class **Transfer** record for money moving between accounts or between a tracked account and a generic external side. This fixes the credit-card-payment problem without polluting spending analytics or budgets.

The onboarding experience should remain:

- connect email
- sync
- optionally improve account accuracy
- continue

Users should not be forced to do account setup before they see the core product value.

## Intended users

- new Fidy users going through onboarding and expecting automated capture to work immediately
- users with multiple bank accounts, wallets, cash balances, or credit cards
- credit-card users who want spending counted on purchase date and payments treated as settlement, not new spending
- users who want better attribution accuracy without heavy up-front setup

## User stories

- As a new user, I want Fidy to start capturing transactions as soon as I connect my sources, so that I see value before doing extra setup.
- As a user with multiple financial accounts, I want captured transactions to belong to the right account, so that my balances and history are trustworthy.
- As a credit-card user, I want card payments treated as transfers instead of expenses, so that my spending is not double-counted.
- As a user who skips setup during onboarding, I want account suggestions to remain available later, so that “not now” does not become “never.”
- As a user reviewing suggested accounts, I want to see why Fidy is making a suggestion, so that I can decide quickly whether to create or link it.

## Module sketch

- `financial-accounts` ledger core
  Add the new account model, account kinds, identifiers, opening balances, and account-attribution state. This should become a deep module that owns account creation, default-account bootstrap, account-owned identifiers, and derived account balance rules instead of scattering them across onboarding, capture, and transaction stores.

- `transactions` ownership boundary
  Extend transaction schema, builders, repositories, and manual-entry flows so every transaction persists with `accountId` and `accountAttributionState`. This module should stay responsible for expense/income only; it should stop carrying transfer semantics through category misuse.

- `capture-evidence` normalization and attribution engine
  Extract a deep, testable module that turns raw capture inputs into normalized account-evidence facts, derives repeated scoped matches, and emits account-creation suggestions. It should own the rules for sender/last-4/alias scope, suppression of dismissed suggestions, and reprocessing of unresolved records after a suggestion is accepted.

- `onboarding` account-accuracy orchestration
  Update onboarding to auto-bootstrap the default account before sync, skip the optional post-sync step when there are no strong suggestions, and otherwise route into a shared suggestion-review screen capped at three items. This orchestration should stay thin and depend on the suggestion module rather than containing matching logic.

- `financial-account review` surface
  Add a shared suggestion-review flow used from onboarding and the later home/dashboard prompt. It should support:
  - lightweight suggestion reasons
  - create-account with a prefilled form
  - link-existing with filtered likely matches first
  - skip/dismiss behavior that suppresses repeated low-value prompts

- `transfers` domain module
  Add a separate persisted record for completed money movement with two explicit sides. This module should own transfer validation, balance effects, generic external side handling, and exclusion from spending/income analytics and budgets.

- `review and reclassification` follow-up
  After transfers exist, extend review/edit flows so a captured transaction can be reclassified into a transfer while preserving source evidence and superseding the old transaction. This should stay separate from the initial account-suggestion onboarding work.

## Security and permissions

- Capture evidence can include sensitive financial metadata such as sender domains, account aliases, and last-4 identifiers. Persist only the normalized fields needed for matching and continue treating raw capture text as sensitive user data.
- Financial account suggestions must always be user-confirmed. The app must not auto-create financial accounts from capture evidence.
- Dismissed captures and unresolved records may still sync, but their states must remain explicit so other devices do not reinterpret them silently.
- Linking evidence to accounts must stay user-scoped. No identifier matching or suggestion generation should cross user boundaries.

## Testing

- Direct unit tests for:
  - account-attribution state transitions
  - scoped identifier matching
  - account-creation suggestion derivation and ranking
  - dismissal suppression until stronger evidence appears
  - transfer validation and balance effects
  - derived balance rules using opening balances, transactions, and transfers

- Repository and mutation tests for:
  - default-account bootstrap
  - transaction persistence with `accountId`
  - capture-evidence persistence
  - reprocessing unresolved records after account creation/linking
  - transfer persistence and sync queue integration

- Integration/orchestration coverage for:
  - onboarding flow: sync with and without strong suggestions
  - onboarding auto-entry into optional account-accuracy step
  - reuse of the same suggestion-review screen from onboarding and home
  - manual transaction entry with a default preselected account
  - credit-card payment modeled as transfer, not expense

## Success criteria

- [ ] Every new transaction saved by manual entry or automatic capture persists with a non-null financial account and explicit account-attribution state.
- [ ] Onboarding still reaches first captured value before any required account setup, while showing an optional post-sync account-accuracy step only when strong suggestions exist.
- [ ] The post-sync account-accuracy step shows at most 3 high-confidence account suggestions, and skipped suggestions remain available later from the home/dashboard prompt.
- [ ] Accepting an account suggestion immediately improves matching for future captures and reprocesses matching unresolved past records.
- [ ] Credit-card payments can be recorded as transfers and no longer need to appear as expenses in spending analytics or budgets.

## Out of scope

- automatic credit-card statement-obligation generation
- one-sided transfer inference from broad evidence
- transfer fee modeling
- wealth or net-worth calculations
- forcing users to provide `fecha de corte` or `fecha límite de pago` during onboarding
- merging transfers into the transaction model
- surfacing unresolved account-attribution review inside the onboarding suggestion step

# Fidy

Fidy keeps the user's financial source of truth in the cloud while allowing local app state for interaction and capture workflows. This context captures the boundary between cloud-owned financial records, local cached state, and remote processing used to improve capture quality.

## Language

**Capture Interpreter**:
The AI-assisted ingestion boundary that turns capture evidence into a structured transaction, transfer, or review candidate.
_Avoid_: Regex parser, email parser

**Review Candidate**:
A proposed financial record or attribution that needs user confirmation before it becomes a committed Cloud Ledger record.
_Avoid_: Low-confidence transaction, pending transaction

**Account Attribution Review**:
A review of which financial account owns an already committed transaction.
_Avoid_: Review candidate, financial meaning review

**Transaction Source**:
The closed origin category that explains how a committed transaction entered the Cloud Ledger.
_Avoid_: Provider name, bank source, free-form source string

**Capture Evidence**:
Observed source facts from emails, notifications, wallets, or payment surfaces that can support transaction interpretation or account attribution.
_Avoid_: Parsed transaction, raw email data

**Processed Source Event**:
The Cloud Ledger intake record that marks a captured source event as handled, needing review, dismissed, duplicated, or failed.
_Avoid_: Raw email, raw notification, source archive

**Evidence Extractor**:
A deterministic source-specific or generic rule that turns capture text shape into Capture Evidence without storing the source content.
_Avoid_: Regex parser, bank scraper

**Account Identity Evidence**:
Capture Evidence that can identify a specific financial account instance, such as a masked card suffix or account ending.
_Avoid_: Account type hint, card brand

**Account Type Hint**:
Capture Evidence that describes a generic account kind, such as credit card, savings account, or wallet, without naming a product or identifying a specific financial account instance.
_Avoid_: Account identity, account id

**Account Product Hint**:
Capture Evidence that names a specific card or account product without identifying the individual account instance, such as Visa Oro or Mastercard Black.
_Avoid_: Account identity, merchant name

**Counterparty Evidence**:
Capture Evidence that describes the merchant, payee, payer, or other transaction counterparty and must not be used as account attribution evidence.
_Avoid_: Account hint, card product

**Transaction Description**:
User-authored ledger text that labels or notes a committed transaction without necessarily identifying the counterparty.
_Avoid_: Merchant, counterparty

**Counterparty**:
The merchant, payee, payer, or other party on the other side of a financial movement.
_Avoid_: Description, category, account

**Template Shape**:
A non-sensitive structural representation of a capture source template made from canonical field names and redacted value types.
_Avoid_: Email template, raw sample

**Template Diagnostic**:
A non-financial operational signal that records extractor behavior for a Template Shape without storing Plaintext Financial Data.
_Avoid_: Stored email, template archive

**Raw Capture Content**:
The original email, notification, wallet, or payment-surface content observed by a capture source before Fidy reduces or redacts it.
_Avoid_: Capture Evidence, Template Diagnostic, Capture Improvement Sample

**Capture Improvement Sample**:
A structural capture-improvement record made from source templates, field labels, redacted value types, parser outcomes, and extractor metadata without actual financial or personal values.
_Avoid_: Raw Capture Content, Template Diagnostic, debug log

**Capture Improvement Preference**:
The user's setting that controls whether Fidy may retain Capture Improvement Samples for product-wide capture quality improvements.
_Avoid_: Cloud Ledger consent, backup opt-in, analytics toggle

**Cloud Ledger**:
The cloud-hosted source of truth for financial records, capture evidence, and financial derivations.
_Avoid_: Sync, backup, remote copy

**Local Ledger**:
The legacy on-device source-of-truth model for financial records, capture evidence, and financial derivations.
_Avoid_: Cloud Ledger, local cache

**Pending Ledger Change**:
A locally recorded financial change that the user made while the Cloud Ledger was unavailable and that still needs to be accepted by the Cloud Ledger.
_Avoid_: Local Ledger record, synced transaction, draft

**Pending Change Set**:
An ordered batch of Pending Ledger Changes submitted together so the Cloud Ledger can validate dependencies and return per-change acceptance, retry, or repair outcomes.
_Avoid_: Sync batch, transaction dump, offline snapshot

**Optimistic Ledger View**:
The user's displayed financial state after applying Pending Ledger Changes before the Cloud Ledger accepts them.
_Avoid_: Committed ledger, pending UI

**Ledger Cache**:
The local full-user copy of Cloud Ledger records and projections used for offline reads, optimistic presentation, and fast interaction.
_Avoid_: Local Ledger, source of truth, backup

**Ledger Repair**:
A user-visible recovery flow for a Pending Ledger Change that the Cloud Ledger cannot accept after automatic retry.
_Avoid_: Sync error, rollback, failed transaction

**Ledger Conflict**:
A Pending Ledger Change that the Cloud Ledger cannot accept because the cloud record changed after the user acted.
_Avoid_: Last write wins, merge error

**Ledger Change Identity**:
A stable identity for a Pending Ledger Change that lets retries be accepted once without creating duplicate financial records.
_Avoid_: Request id, transaction id, row id

**Ledger Edit History**:
A minimal history of accepted Cloud Ledger changes kept to explain financial edits, resolve conflicts, and preserve audit-relevant transitions.
_Avoid_: Event-sourced ledger, debug log, analytics history

**Ledger Projection**:
A rebuildable read model or cached total derived from Cloud Ledger source records for fast display, search, analytics, or progress calculations.
_Avoid_: Source of truth, ledger record, manual total

**Ledger Cursor**:
A user-scoped monotonic position that lets clients refresh accepted Cloud Ledger changes and projections incrementally.
_Avoid_: Record version, sync token, timestamp

**Plaintext Financial Data**:
Readable financial records or capture evidence that reveal a user's financial activity without user-held decryption material.
_Avoid_: Synced data, normal app data

**Cloud AI Processing**:
Default remote AI processing of task-scoped capture evidence or financial context for Fidy product features.
_Avoid_: Sync, backup, remote storage

**Financial Context Packet**:
A minimal, task-scoped summary assembled from the Cloud Ledger or Optimistic Ledger View and sent for Cloud AI Processing.
_Avoid_: Database dump, remote profile

**Remote Financial Sync**:
The legacy model of replicating financial records between device and server as peer data stores.
_Avoid_: Cloud Ledger, backup, recovery

**Remote API Boundary**:
The authenticated server-side boundary that owns Cloud Ledger reads, writes, and operational remote access instead of letting the mobile app communicate with Fidy-controlled database tables directly.
_Avoid_: API extra layer, proxy, backend wrapper

**User Profile**:
The authenticated user's non-financial identity details used for account UI, such as display name, email address, and provider profile image.
_Avoid_: Financial profile, remote profile

**Profile Image**:
A provider-supplied user avatar used as an account navigation affordance and backed by initials when unavailable.
_Avoid_: Settings icon, uploaded document, financial image

## Relationships

- The **Cloud Ledger** is the source of truth for transactions, transfers, financial accounts, budgets, goals, capture evidence, and financial derivations
- Committed transactions and committed transfers are both first-class **Cloud Ledger** financial records
- The app may keep **Pending Ledger Changes** locally so users can enter financial changes while offline
- A **Pending Ledger Change** is not committed until the **Cloud Ledger** accepts it
- Pending Ledger Changes should be submitted as a **Pending Change Set** when offline work is flushed to the Cloud Ledger
- A **Pending Change Set** preserves local change order so the Cloud Ledger can validate dependent changes
- A **Pending Change Set** may be partially accepted when changes are independent
- Dependent changes in a **Pending Change Set** must not be accepted when their required prior change fails
- The app presents an **Optimistic Ledger View** so ordinary financial screens do not expose commit status for each Pending Ledger Change
- An **Optimistic Ledger View** may affect displayed balances, budgets, goals, transaction lists, and financial derivations before cloud acceptance
- The app keeps a full-user **Ledger Cache** for MVP offline reads, optimistic presentation, and local projections
- The **Ledger Cache** is not the source of truth and is reconciled from the Cloud Ledger through the Remote API Boundary
- The **Ledger Cache** should be encrypted at rest on device
- Ledger Cache encryption protects local cached data but does not create a recovery mechanism or Recovery Key flow
- Pending Ledger Changes and Pending Change Sets should be encrypted at rest on device
- Pending Ledger Changes must survive app close, app kill, crash, battery loss, and OS eviction until accepted, repaired, or explicitly discarded on logout
- Logout deletes the Ledger Cache and any pending outbox state from the device
- If pending changes exist during logout, Fidy warns that they will be discarded before completing logout
- Failed **Pending Ledger Changes** should retry automatically before interrupting the user
- A **Ledger Repair** is shown only when automatic retry cannot get a Pending Ledger Change accepted
- The app must not silently roll back an Optimistic Ledger View when a Pending Ledger Change fails
- The **Cloud Ledger** should reject stale Pending Ledger Changes instead of silently overwriting newer cloud state
- A stale Pending Ledger Change becomes a **Ledger Conflict** and enters **Ledger Repair**
- Per-record versions guard Cloud Ledger writes against stale edits to the same record
- A **Ledger Cursor** tracks accepted Cloud Ledger progress for cache refresh, projection freshness, and multi-device reconciliation
- The **Ledger Cursor** must not be the only write-conflict guard because unrelated edits should not conflict
- A retried Pending Ledger Change must use its **Ledger Change Identity** so cloud acceptance is idempotent and does not duplicate transactions, transfers, or capture evidence
- Offline-created Cloud Ledger records may use client-generated branded IDs that remain stable after Cloud Ledger acceptance
- The **Remote API Boundary** validates client-generated IDs for shape, ownership, and idempotency before accepting them
- Normal Cloud Ledger delete operations should create tombstones for offline acceptance, conflict handling, idempotency, audit history, and cache invalidation
- Account deletion is different from normal Cloud Ledger deletes and physically removes user financial records
- The **Cloud Ledger** keeps **Ledger Edit History** for financial records where needed for repair, conflict resolution, auditability, and transfer reclassification
- **Ledger Edit History** should be minimal and physically deleted with the user's Cloud Ledger records during account deletion
- Transactions, transfers, budgets, goals, goal contributions, tombstones, and needed edit history are canonical Cloud Ledger source records
- Budget progress, goal progress, account balances, monthly totals, search indexes, and analytics summaries are **Ledger Projections**
- **Ledger Projections** may be stored for performance but must be rebuildable from canonical Cloud Ledger source records
- If a **Ledger Projection** disagrees with canonical source records, the source records win
- Server-built **Ledger Projections** represent accepted Cloud Ledger state
- Mobile-built **Ledger Projections** may include Pending Ledger Changes only as part of the **Optimistic Ledger View**
- The app reconciles optimistic mobile projections with server projections after Cloud Ledger acceptance, retry, or repair
- **Capture Evidence** belongs in the **Cloud Ledger** unless it is sent transiently for **Cloud AI Processing**
- **Account Identity Evidence** is stronger than an **Account Type Hint** for account suggestions and future account attribution
- **Account Product Hints** are weaker than **Account Identity Evidence** but stronger than generic **Account Type Hints** for onboarding suggestions
- **Counterparty Evidence** may explain who money moved to or from, but it must not create or link financial accounts
- An **Evidence Extractor** may produce **Capture Evidence** from email or notification text only when the matched structure is precise enough to avoid false account attribution
- A **Template Shape** may describe source structure, but it must replace sensitive values such as amounts, names, merchants, dates, account suffixes, authorization numbers, and email addresses with type tokens
- **Raw Capture Content** must not be retained for capture improvement
- Fidy may retain **Capture Improvement Samples** by default to improve transaction capture quality
- Actual financial and personal values must be stripped or tokenized before a **Capture Improvement Sample** is retained
- **Capture Improvement Samples** may contain source channel, coarse source family, safe provider category, normalized subject or title shape, field labels, field order, tokenized value types, extractor version, matched rule, missed-field markers, parse outcome, confidence bucket, and safe locale or country metadata
- **Capture Improvement Samples** must not contain raw values, full source text, account suffixes, authorization or reference numbers, merchant names, person names, email addresses, phone numbers, or unredacted locations
- **Capture Improvement Samples** must be redacted on device before upload
- The **Remote API Boundary** should reject Capture Improvement Samples that still contain personal or sensitive values
- **Capture Improvement Samples** must not be confused with the **Cloud Ledger**; they exist for capture improvement, not user-facing financial state
- The **Capture Improvement Preference** is enabled by default and can be disabled from settings
- The **Capture Improvement Preference** controls only Capture Improvement Samples, not required Cloud Ledger storage
- Capture Improvement Samples may keep operational account linkage for opt-out deletion, abuse prevention, and deduplication
- Operational account linkage must not make Capture Improvement Samples part of the user's Cloud Ledger history
- Disabling the **Capture Improvement Preference** stops future sample retention and deletes the user's previously retained Capture Improvement Samples
- Account deletion deletes Cloud Ledger financial records, operational API records, and user-linked Capture Improvement Samples
- Account deletion physically deletes user financial records instead of retaining them as soft-deleted Cloud Ledger history
- Fidy may retain only minimal non-financial audit or security records after account deletion when legally or operationally necessary
- Account export includes Cloud Ledger financial records and settings, and must account for user-linked Capture Improvement Samples as exportable or explicitly deletable improvement artifacts
- **Remote Financial Sync** is legacy durability language and should not be used for the Cloud Ledger model
- Fidy requires an authenticated account to use Cloud Ledger-backed financial features
- Anonymous local-only financial use is outside the Cloud Ledger model
- Cloud Ledger login restores financial records after app deletion, reinstall, or device loss
- **Cloud AI Processing** is default for product tasks that need remote AI interpretation or analysis
- **Cloud AI Processing** is core product infrastructure and does not have a global user-disable preference
- **Cloud AI Processing** may receive **Plaintext Financial Data** only through task-scoped boundaries such as capture interpretation or Financial Context Packets
- **Cloud AI Processing** must not persist AI inputs or outputs as Cloud Ledger financial records without deterministic ledger validation
- When **Cloud AI Processing** is unavailable, deterministic high-confidence capture may still proceed
- Ambiguous AI-dependent capture should retry or create a **Review Candidate** instead of fabricating a committed financial record
- Advisor features should report unavailable or retry when Cloud AI Processing cannot produce a reliable answer
- A **Capture Interpreter** may use **Cloud AI Processing** to interpret fragile capture evidence
- Low-confidence capture interpretation must create a **Review Candidate**, not a committed transaction
- A **Review Candidate** becomes a committed transaction only after user confirmation or another high-confidence domain decision
- A **Review Candidate** must not affect balances, budgets, analytics, search, or other Cloud Ledger financial derivations until it becomes a committed transaction
- A **Review Candidate** resolves whether captured evidence should become a financial record; **Account Attribution Review** resolves which account owns an already committed transaction
- High-confidence capture interpretation may create a committed transaction automatically after deterministic validation, duplicate checks, account attribution policy, and Capture Evidence linkage succeed
- A committed transaction created from Capture Evidence must be saved atomically with its Capture Evidence linkage
- A committed transaction created from a captured source event must be saved atomically with that source event's processed status
- A **Review Candidate** created from a captured source event must be saved atomically with its Capture Evidence and processed status
- A **Processed Source Event** exists to make capture intake idempotent without storing raw source content as a corpus
- A **Transaction Source** is limited to domain origin categories such as manual entry or capture-driven entry; provider, bank, and template details belong in Capture Evidence or source metadata
- Duplicate detection is an import decision for capture and retry flows, not a reason to reject deliberate manual transaction entry
- Committed transactions and committed transfers must not be future-dated
- Automated transfer interpretation requires very high-confidence two-sided evidence, such as matching outgoing and incoming values for the same movement
- When committed transactions are reclassified as a transfer, the original transactions must be preserved for audit history but excluded from income, spending, and budget derivations
- Reclassifying committed transactions as a transfer must be one atomic Cloud Ledger operation
- A **Capture Interpreter** must keep account evidence separate from **Counterparty Evidence** so merchants such as Rappi are not suggested as bank accounts or cards
- Automated capture may populate a **Counterparty**, but it must not treat inferred counterparty text as a user-authored **Transaction Description**
- UI may display a **Counterparty** as the primary transaction label when no **Transaction Description** exists
- Deterministic ledger validation owns the final save decision after a **Capture Interpreter** produces a candidate
- Deterministic **Evidence Extractors** should handle high-confidence structural evidence, while the **Capture Interpreter** remains a fallback for fragile or ambiguous capture evidence
- A **Financial Context Packet** is narrower than the **Cloud Ledger** and should be built per advisor request
- AI advisor features should use task-scoped **Financial Context Packets** instead of unrestricted Cloud Ledger access
- The **Remote API Boundary** assembles the minimum Financial Context Packet needed for a specific advisor or capture task
- Weekly digest-style insights may use a **Financial Context Packet** rather than unrestricted Cloud Ledger access
- The **Remote API Boundary** owns Cloud Ledger reads, Cloud Ledger writes, offline change acceptance, conflict checks, notification preferences, and push device registration
- The mobile app must not communicate directly with Fidy-controlled database tables for financial reads or writes
- Financial realtime updates must go through the **Remote API Boundary** instead of direct mobile subscriptions to Fidy-controlled database tables
- The **Remote API Boundary** does not replace Supabase Auth, and table RLS remains defense-in-depth behind it
- The **Remote API Boundary** is capability-scoped so Cloud Ledger, notification, and push-device operations can be validated, rate-limited, and revoked independently
- A **User Profile** may come from Supabase Auth provider metadata and must remain separate from the **Cloud Ledger**
- A **Profile Image** may be loaded directly from the provider URL when available, with initials as the fallback

## Example dialogue

> **Dev:** "If the user deletes the app, how do they recover their financial records?"
> **Domain expert:** "They authenticate, and Fidy restores financial records from the **Cloud Ledger** through the **Remote API Boundary**."

> **Dev:** "Can we store a few bank email examples so we can improve account suggestions?"
> **Domain expert:** "Do not treat examples as casual diagnostics. Capture improvement data must be governed as financial data or reduced to a safe **Template Diagnostic**."

> **Dev:** "The AI returned `rappi colombia` in an account hint. Should onboarding suggest a Davibank Rappi account?"
> **Domain expert:** "No. Rappi is **Counterparty Evidence** in that scenario. Only **Account Identity Evidence**, **Account Product Hints**, or explicit **Account Type Hints** can drive account suggestions."

## Flagged ambiguities

- "local-first" was used to mean both on-device source of truth and offline-capable user experience. Resolved: use **Cloud Ledger** for the source of truth, **Pending Ledger Change** for offline writes, and **Optimistic Ledger View** for local presentation.
- "sync" was used to mean both recovery and cross-device plaintext replication. Resolved: use **Cloud Ledger** for durable financial records and **Remote Financial Sync** for the legacy peer-replication model.
- "AI-first" could imply either cloud-only AI or private on-device-only AI. Resolved: MVP permits **Cloud AI Processing** through task-scoped boundaries.
- "API extra layer" could imply either a generic proxy or a domain boundary. Resolved: use **Remote API Boundary** for authenticated server-side ownership of Cloud Ledger reads, writes, realtime updates, and operational remote access.
- "template" could mean a raw bank email sample or a safe structural shape. Resolved: use **Template Shape** for redacted structure and avoid storing raw capture content.
- "account hint" was used for both specific card endings and generic product labels. Resolved: use **Account Identity Evidence** for specific account-identifying signals and **Account Type Hint** for product/kind labels.
- "account hint" also absorbed merchants and payees returned by AI. Resolved: use **Counterparty Evidence** for merchant, payee, and payer facts, and keep it out of account attribution.
- "profile" could mean either financial behavior/persona or authenticated identity details. Resolved: use **User Profile** only for non-financial identity UI.

# Cloud Ledger API as the financial source of truth

Fidy will replace the Local Ledger source-of-truth model with a Supabase-backed **Cloud Ledger** accessed only through the **Remote API Boundary**. The mobile app keeps local cache, mobile-built projections, and a pending-change outbox for offline optimistic use, but Cloud Ledger acceptance is authoritative for committed financial records.

**Status**: accepted

**Supersedes**

- ADR-0002 Local ledger, encrypted recovery, and explicit cloud AI processing
- ADR-0005 Local Ledger Clean Architecture boundary

**Considered Options**

- Keep Local Ledger plus encrypted backup: strongest privacy posture and already reflected in the old architecture, but it preserves recovery, backup, AI-context, and local source-of-truth complexity the product no longer wants.
- Use direct mobile Supabase reads and writes: initially simple, but spreads ledger validation, idempotency, stale-write rejection, realtime behavior, and repair policy across client code and RLS.
- Use a Cloud Ledger behind the Remote API Boundary: accepts server-held financial data and backend surface area, but gives one durable source of truth while preserving offline optimistic UX through local pending changes.

**Consequences**

Encrypted Backup, Private Backup, and Recovery Key are removed from the financial recovery model; login and API access restore Cloud Ledger records after reinstall or device loss. Because the app has not launched, implementation does not need backward compatibility with the existing SQLite Local Ledger schema or migrations. New implementation should be API-first, keeping SQLite only for local cache, mobile-built projections, and pending-change outbox state.

The first Remote API Boundary implementation will use Supabase Edge Functions rather than a separate backend service. This keeps auth, service-role database access, and deployment close to the existing Supabase surface while leaving room to extract a separate backend later if Edge Functions become limiting.

Cloud Ledger writes will be command-oriented, with named operations for domain changes such as recording transactions, amending records, deleting records, reclassifying transfers, applying pending changes, and resolving repairs. Cloud Ledger reads may be query-oriented around user-facing views such as transaction lists, budget progress, account balances, review queues, and search.

Offline work will flush through ordered pending-change batches rather than independent one-by-one writes. The API validates dependency order and returns per-change outcomes such as accepted, retryable, or repair-required so the mobile optimistic view can reconcile without silent rollback. Batches may be partially accepted when changes are independent, but dependent changes must fail or enter repair when their required prior change cannot be accepted.

Offline-created records may keep client-generated branded IDs after Cloud Ledger acceptance. The API validates ID shape, ownership, and idempotency instead of replacing accepted IDs with server-generated IDs, avoiding remapping across dependent pending changes and mobile projections.

Cloud Ledger conflict detection uses per-record versions for write guards and a user-scoped ledger cursor for cache refresh, projection freshness, and multi-device reconciliation. The ledger cursor is not the sole write-conflict guard because unrelated edits should not force repair.

The MVP mobile app keeps a full-user local Ledger Cache rather than only recent or paged data. The cache supports offline reads, local optimistic projections, and fast interactions, but it is reconciled from the Cloud Ledger and is not the source of truth. The Ledger Cache, Pending Ledger Changes, and Pending Change Sets should be encrypted at rest on device; this protects cached/offline data but does not reintroduce encrypted backup or Recovery Key recovery.

The Cloud Ledger will not use whole-ledger application-level or user-held-key encryption for the MVP. Cloud storage relies on Supabase platform encryption at rest, TLS in transit, API-only access through Edge Functions, least-privilege database roles, RLS as defense-in-depth, and operational auditability. Keeping Cloud Ledger records readable to authorized server code is required for server projections, Financial Context Packets, search, repair flows, and recovery by login.

Logging out deletes the local Ledger Cache and any pending outbox state. If unsent Pending Ledger Changes exist, the app warns that they will be discarded before completing logout rather than blocking logout until upload succeeds. Ordinary app lifecycle events such as app close, crash, battery loss, or OS eviction must preserve encrypted pending changes until they are accepted, repaired, or explicitly discarded on logout.

Fidy requires an authenticated account for Cloud Ledger-backed financial features. Anonymous local-only financial use is intentionally out of scope because it would reintroduce a temporary local source of truth and later migration path.

Supabase Auth remains the identity provider. The Remote API Boundary validates Supabase-issued authentication, and login is the recovery path for Cloud Ledger records.

Cloud Ledger financial tables should live in a non-exposed `ledger` database schema rather than the client-exposed Supabase API surface. Mobile access goes through Edge Functions; table privileges and RLS remain defense-in-depth behind that API boundary.

Edge Functions should use a narrow database role for Cloud Ledger access when practical, with service-role access allowed only as a bootstrap or fallback path. Migrations should be designed toward least-privilege privileges on the `ledger` schema and approved database functions.

Cloud Ledger validation is split between Edge Function TypeScript and Postgres. TypeScript owns request parsing, command orchestration, idempotency response shaping, and user-friendly errors. Postgres owns invariants that must not be bypassed, including ownership, foreign keys, uniqueness, tombstones, check constraints, and transactional consistency for critical multi-row acceptance.

Cloud Ledger APIs return typed domain error and outcome codes rather than localized user-facing strings. The mobile app maps codes such as stale records, dependency failures, duplicate changes, invalid accounts, retryable failures, and repair-required states to localized UI copy.

Cloud Ledger API contracts use lightweight versioning from the first implementation. Versioned command schemas let the API intentionally accept, migrate, reject, or repair pending changes created by older app versions and flushed later.

The API supports the current and previous Cloud Ledger command versions. Pending changes from older unsupported command versions enter Ledger Repair and may require an app update rather than keeping every historical command shape indefinitely.

Pending Change Set envelopes include API command version, device id, batch id, ordered changes, per-change idempotency keys, dependencies, expected record versions, and client timestamps. User ownership is derived from the authenticated Supabase request, not trusted from the request body; any body-provided user id is ignored or rejected.

MVP refresh uses API-mediated incremental polling with the Ledger Cursor rather than direct Supabase Realtime or a custom event stream. The app refreshes on foreground, after successful pending-change flush, pull-to-refresh, and periodic/background opportunities. Push-triggered refresh can be added later without exposing financial table subscriptions to the mobile app.

The first Ledger Repair UX supports three actions: retry, edit-and-resubmit, and discard local change. Retryable failures should auto-retry before surfacing repair; stale records and dependency failures should offer edit/resubmit or discard; unsupported command versions may require app update before retry.

The first Cloud Ledger schema slice centers on transactions and includes categories, financial accounts, tombstones, minimal edit history, projection cursor state, and pending-change acceptance records. This slice is large enough to prove create/edit/delete transactions, references, offline batch flush, idempotency, conflict detection, cache refresh, projection rebuild, and repair before budgets, goals, and transfers move over.

Capture Improvement Samples retain structural template data only: source channel, coarse source family, safe provider category, normalized subject/title shape, field labels and order, tokenized value types, extractor version, matched rule, missed-field markers, parse outcome, confidence bucket, and safe locale/country metadata. They must not retain raw values, full text, account suffixes, authorization/reference numbers, merchant names, person names, email addresses, phone numbers, or unredacted locations.

Before shipping this architecture, privacy policy and in-app settings copy must disclose that Cloud Ledger stores financial records on Fidy-controlled cloud infrastructure, Cloud AI Processing is core and default for capture/advisor features, Capture Improvement Samples are default-on but structural/redacted and can be disabled/deleted, and account deletion physically deletes Cloud Ledger financial records plus user-linked improvement samples except for minimal non-financial security or audit records.

MVP observability uses Sentry and common Supabase logs. Cloud Ledger command telemetry should include operational metadata such as authenticated user id, command type/version, device id, batch/change id, outcome code, latency, retry/repair status, and correlation id, but must not log raw financial payloads, full AI packets, raw capture text, amounts, merchants, descriptions, or account suffixes outside governed Cloud Ledger tables.

The first Cloud Ledger vertical slice should be built test-first with unit tests, public-interface functional tests, API contract tests, real Postgres/Supabase integration tests, concurrency tests, security/access tests, crash/restart persistence tests, projection rebuild tests, and redaction/sanitization tests. Mutation testing is used selectively for pure validation, redaction, projection, and conflict logic rather than broad Edge Function or UI flows.

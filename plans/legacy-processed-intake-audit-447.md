# Legacy Processed Intake Audit (#447)

Date: 2026-05-16

## Scope

This audit checks the remaining `processedEmails` and `processedCaptures` paths after the Local Ledger clean architecture slices from PRD #413. The goal is to decide whether the remaining source-specific processed tables are acceptable transitional scope or whether they mean PRD #413 is still unmet.

## Decision

PRD #413 is not fully complete while `processedEmails` remains an active email intake queue/status table. The current email pipeline does route successful transaction writes through Local Ledger and creates Local Ledger review candidates for low-confidence emails, but it still writes and mutates `processedEmails` for idempotency, retry scheduling, failed-email review, duplicate markers, and review-status coordination. That is not a trivial cleanup and should be split into follow-up work.

The remaining `processedCaptures` table is acceptable transitional scope. Production notification, widget, and Apple Pay intake now records source-agnostic `processedSourceEvents` and Local Ledger review candidates/capture evidence. The only remaining `processedCaptures` production references are read-only legacy fallback/read-model paths and backup snapshot compatibility. There is no production `processedCaptures` insert/update path outside snapshot restore.

Snapshot support for both legacy tables is acceptable transitional scope until the app has either migrated or intentionally dropped legacy local data. Backup export/import and validation must keep preserving these rows while live code can still contain them.

The remaining capture-evidence `processedEmailId` and `processedCaptureId` columns are also transitional compatibility. They are still part of the local schema, migrations, snapshot row shape, and uniqueness checks, but new source-agnostic capture paths write `processedSourceEventId`. Removing those legacy foreign-key columns is cleanup work that should happen after email intake and legacy capture fallback are migrated.

## Findings

- `apps/mobile/features/email-capture/lib/repository.ts` still owns CRUD and status mutation for `processedEmails`, including failed, needs-review, pending-retry, duplicate, and success states.
- `apps/mobile/features/email-capture/services/email-pipeline-service/incoming-email.ts` still writes `processedEmails` for parse failures, filtered/skipped emails, cross-source duplicates, and pending retries.
- `apps/mobile/features/email-capture/services/email-pipeline-service/transactions.ts` writes a `processedEmails` row alongside Local Ledger transaction recording or review candidate creation. The committed transaction path uses `RecordTransaction`, but email intake state is still source-specific.
- `apps/mobile/features/email-capture/services/email-pipeline-service/retry.ts`, `apps/mobile/features/email-capture/lib/financial-meaning-review.ts`, `apps/mobile/features/email-capture/store.ts`, `apps/mobile/features/email-capture/store/reviewed-email.ts`, and `apps/mobile/features/email-capture/transfer-reclassification.public.ts` still coordinate user-visible email review/retry flows through `processedEmails`.
- `apps/mobile/features/capture-sources/lib/dedup.ts` checks `processedSourceEvents` first and falls back to `processedCaptures` by fingerprint. This is acceptable for legacy duplicate protection.
- `apps/mobile/features/capture-sources/lib/repository.ts` exposes read-only `processedCaptures` queries for legacy source history checks. These are transitional read-model paths, not canonical writes.
- `apps/mobile/infrastructure/local-ledger/source-events.ts` is the active source-agnostic capture intake persistence path for notification/widget/Apple Pay outcomes.
- `apps/mobile/mutation-runtime/local-ledger-handlers.ts` also writes `processedSourceEvents` for write-through review-candidate creation/resolution. This is the desired source-agnostic path, not a legacy processed path.
- `apps/mobile/shared/mutations/write-through/commands.ts` includes `processedSourceEvents` in Local Ledger review-candidate command shapes.
- `apps/mobile/shared/db/schema.ts` still defines `captureEvidence.processedEmailId` and `captureEvidence.processedCaptureId` alongside `processedSourceEventId`. These columns preserve old evidence links while new source-event paths can link through `processedSourceEventId`.
- `apps/mobile/shared/db/index.ts` still re-exports `processedEmails` and `processedCaptures` from the broad DB barrel. This is not a direct PRD violation by itself, but it makes legacy imports easy and should be cleaned up with the migration.
- `apps/mobile/supabase/migrations/20260419104500_capture_evidence.sql` is an old remote capture-evidence migration with only `processed_email_id` / `processed_capture_id`. Because PRD #413 keeps user financial data local-first and remote durability belongs to encrypted backups, this is stale remote schema history rather than an active Local Ledger write path. It still deserves separate cleanup or archival review so it does not mislead future work.
- `apps/mobile/infrastructure/local-ledger/snapshot.ts` exports/imports `processedEmails` and `processedCaptures` to preserve existing local backup data. This is transitional compatibility, not proof that the legacy tables are still canonical.
- `apps/mobile/local-ledger/snapshot/*` validates both legacy tables plus `processedSourceEvents` so backup snapshots remain restorable across the transition.

## Follow-up Work

1. Migrate email idempotency, retry, failed/skipped/duplicate status, and provider progress coordination from `processedEmails` to source-agnostic `processedSourceEvents`.
2. Move email review/retry UI read models from `processedEmails` to Local Ledger review candidates plus source events, keeping raw body retry privacy constraints explicit.
3. After email no longer writes `processedEmails`, remove legacy `processedCaptures` fallback/read-model paths, narrow broad DB barrel exports, remove legacy capture-evidence source columns when safe, and decide whether backup snapshots should continue restoring legacy tables or drop them with an explicit snapshot-version change.
4. Review stale Supabase capture-evidence migration/schema history so remote plaintext financial tables are not treated as an active Local Ledger persistence target.

## Non-goals

- Do not close or modify PRD #413 from this audit.
- Do not perform broad legacy table cleanup inside #447.
- Do not remove backup compatibility without a separate migration/snapshot-version decision.

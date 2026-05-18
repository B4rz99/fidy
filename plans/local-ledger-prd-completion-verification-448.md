# Local Ledger PRD Completion Verification (#448)

Date: 2026-05-17

## Scope

This verification checks PRD #413 and ADR #0005 after the audit-fix issues and the legacy intake decision in #447. It re-checks the Local Ledger boundary, write paths, source intake, review candidates, transfer reclassification, snapshots, and the required verification commands.

## Result

PRD #413 is complete enough to mark the Local Ledger Clean Architecture boundary as implemented. The remaining legacy `processedEmails` and `processedCaptures` source-specific tables/paths called out by #447 have since been removed from active mobile code and schema identifiers. The only remaining `processed` email wording found under `apps/mobile` is user-facing copy for failed/unprocessed email review UI, not a legacy processed table or write path.

## Findings

- Audit finding #447 is resolved in the current tree: `rg "processedEmails|processedCaptures" apps/mobile` only finds `unprocessedEmails` i18n/UI copy.
- `apps/mobile/local-ledger/**` is present as a pure boundary with domain, ports, use cases, public surfaces, review-candidate resolution, transfer reclassification, and snapshot validation.
- Architecture guardrails pass: Local Ledger imports no features, and Dependency Cruiser reports no dependency violations.
- Manual transaction writes use `recordManualTransactionWithLocalLedger()` in infrastructure and delegate policy to `recordTransaction()`.
- Manual transfer writes use `recordManualTransferWithLocalLedger()` and delegate policy to `recordTransfer()`.
- Email high-confidence transaction recording uses Local Ledger `recordTransaction()`, then persists `processedSourceEvents` and capture evidence in the same database transaction when transactional DB support is available.
- Email low-confidence, retry, duplicate, failed, and review flows now use source-agnostic `processedSourceEvents`, Local Ledger review candidates, and capture evidence rather than `processedEmails`.
- Notification, widget, and Apple Pay intake use source-agnostic processed source events, review candidates, and Local Ledger transaction writers.
- Capture evidence now links through non-null `processedSourceEventId`; legacy `processedEmailId` and `processedCaptureId` columns are not present in the mobile schema.
- Counterparty/description separation is represented in transaction schema, Local Ledger transaction commands, capture deduplication, and transaction display tests. Duplicate matching uses `counterpartyName`, not user-authored `description`.
- Transfer reclassification is represented as a Local Ledger use case and is covered by transfer reclassification tests, including superseding source transactions.
- Backup snapshots include transactions, transfers, capture evidence, processed source events, review candidates, review-candidate evidence links, and active/inactive soft-deleted records. They do not include analytics/query caches.

## Verification Commands

- `bun run lint:architecture` passed.
- `bun run lint:mobile` passed.
- `bun run typecheck` passed.
- `bun run test` passed: 270 test files, 1942 tests.
- `bun run lint:duplication` completed and reported 11 existing clones, 0.43% duplicated lines overall. No new production change was made by this issue.
- `bun run lint:dead-code` failed on an existing Knip backlog: 55 unused files, 6 unused dependencies, 2 unused devDependencies, 1 unlisted dependency, and 295 unused exports. This is broad repo hygiene, not specific evidence against Local Ledger PRD completion.

## Decision

Issue #448 can be considered verified from the Local Ledger PRD perspective. The only remaining follow-up is general dead-code hygiene from the existing Knip backlog, which should be handled separately from PRD #413 completion.

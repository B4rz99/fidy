# Email Capture Pipeline Reliability and Latency

## Problem

Email-captured transactions can take 1-2 minutes to appear after opening the app, even when the bank email is already present. Some transaction emails may also be fetched but never become a visible transaction or review item, making the failure mode opaque to both users and developers.

The current email pipeline is safe primarily because it is serialized. Normal parsing uses one worker with a fixed 3 second delay between parse starts, and account `lastFetchedAt` only advances when every processed email in the fetched batch succeeds. This can turn one bad email into repeated provider re-fetches of old emails. If concurrency is increased naively, the current shared mutable counters and separate duplicate-check-then-insert flow can create progress-order bugs or duplicate transaction races.

## Proposal

Refactor email capture so slow remote interpretation can run concurrently while transaction persistence remains atomic and deterministic.

The target behavior is:

- Initial onboarding sync stays conservative.
- Normal foreground sync parses concurrently with no artificial fixed start delay.
- Background sync uses moderate concurrency and bounded work.
- Fetched emails are always persisted into a terminal or retryable local state before advancing provider `lastFetchedAt`.
- Failed parse/save work retries from the local `processedEmails` queue instead of forcing repeated provider re-fetches.
- Home updates as soon as a new transaction is saved.
- Telemetry exposes timing and outcome reasons for diagnosing missing or delayed transactions.

## Intended Users

- Fidy users relying on email capture for near-real-time transaction registration.
- Developers diagnosing missing transactions, slow email sync, parse failures, or duplicate transaction behavior.

## User Stories

- As a user, I want a bank email that already exists in my inbox to appear in Home quickly after opening the app, so I can trust my ledger is current.
- As a user, I want emails that cannot be confidently turned into transactions to show up in the appropriate review or retry state, so transactions do not disappear silently.
- As a developer, I want structured timing and outcome telemetry, so I can tell whether latency came from provider fetch, parsing, persistence, retries, or UI refresh.
- As a developer, I want concurrent parsing without duplicate races, so we can improve latency without weakening ledger correctness.

## Module Sketch

- `features/email-capture/services/email-pipeline-service/incoming-batch.ts` - Split batch processing into concurrent parse work and serialized persistence work. Remove shared mutable result/progress counters from worker context. Return per-email outcomes and reduce them into the final batch result.
- `features/email-capture/services/email-pipeline-service/incoming-email.ts` - Separate parse/interpret outcome from persistence outcome. Ensure every fetched email becomes `success`, `needs_review`, `skipped`, `skipped_duplicate`, `pending_retry`, or `failed`.
- `features/email-capture/services/email-pipeline-service/transactions.ts` - Keep duplicate detection and transaction insertion in a serialized or transactional persistence section. Verify whether current DB constraints are sufficient; if not, add an atomic local write boundary or uniqueness guard appropriate for local-first data.
- `features/email-capture/services/email-pipeline-service/runtime.ts` - Replace one global default parse throttle with profile-specific parse policies for initial sync, foreground sync, and background sync.
- `features/email-capture/services/email-capture-fetch-service.ts` - Advance `lastFetchedAt` when provider fetch succeeds and every fetched email has been persisted into a retryable or terminal local state. Add optional max-email limits for background fetch.
- `features/email-capture/store.ts` - Thread parse policy and work bounds through `fetchAndProcessEmails`. Keep foreground refresh behavior on first saved transaction and after completion.
- `features/background-fetch/task.ts` - Use the background parse policy and bounded work. Ensure saved background transactions are visible on next foreground refresh without repeating provider work.
- `features/email-capture/hooks/useEmailCapture.ts` - Use the foreground parse policy: higher concurrency, no fixed start delay.
- `features/onboarding/components/SyncProgressStep.tsx` - Keep initial sync conservative and explicit via `parseProfile: "initial_sync"` or a clearer sync-mode option.
- `shared/lib/sentry.ts` and email telemetry call sites - Add timing and outcome telemetry without plaintext financial data, merchant names, amounts, email content, or subject lines.

## Implementation Plan

1. Baseline current behavior with tests and telemetry gaps.

- Add targeted tests documenting current foreground sync behavior, `lastFetchedAt` advancement rules, retry persistence, and duplicate handling.
- Add a test that proves concurrency greater than one would be unsafe today if duplicate detection and insert are both parallel.
- Identify existing `processedEmails` statuses used by review/retry screens and confirm which statuses are user-visible.

2. Introduce explicit sync modes and parse policies.

- Replace the loose `parseProfile` shape with a clearer sync mode if needed: `foreground`, `background`, `initial_sync`.
- Define policy defaults: foreground parse concurrency `3`, delay `0`; background parse concurrency `2`, delay `0`, bounded candidate count; initial sync conservative, likely concurrency `1`, delay `1000` or existing behavior.
- Keep these policies internal to email capture; do not expose UI configuration.

3. Refactor batch processing into immutable per-email outcomes.

- Make each email parse return a value describing parse result instead of mutating shared batch metrics.
- Aggregate final `PipelineResult` with a pure reduce.
- Report progress from completed outcome counts rather than shared `context.completed` mutation.

4. Run remote parsing concurrently, but persist serially.

- Allow parse calls to use policy concurrency.
- Feed parsed outcomes into a single persistence lane so duplicate lookup and insert remain ordered.
- Keep local writes deterministic and testable.

5. Make fetched email state durable before advancing `lastFetchedAt`.

- Ensure parse failures persist as `pending_retry` with retry metadata when retryable.
- Ensure permanent failures persist as `failed` where appropriate.
- Ensure filtered/skipped emails persist as `skipped` so they are not repeatedly fetched.
- Update account `lastFetchedAt` after provider fetch success if all fetched emails reached local durable state, even when some are pending retry or failed.

6. Add bounded background work.

- Limit background runs to a small number of newest unprocessed candidate emails per provider account.
- Keep background parsing moderate to respect OS execution limits and network/battery constraints.
- Avoid progress UI assumptions in background mode.

7. Improve Home refresh semantics.

- Keep foreground `refreshTransactions` on first saved transaction.
- Ensure completion refresh still happens after batch persistence.
- Confirm that transactions saved in background appear immediately after the next foreground bootstrap/refresh without re-fetching old provider emails.

8. Add diagnostic telemetry.

- Capture fetch duration per provider family, fetched count, skipped already processed count, durable failed count, pending retry count, duplicate count, saved count, needs review count, time to first saved transaction, parse duration summary, and retry results.
- Keep Sentry payloads structural only: no merchant names, amounts, subject lines, email bodies, account identifiers, or email addresses.

9. Verify with tests and local QA.

- Unit-test policy resolution, pure outcome aggregation, retry persistence, `lastFetchedAt` advancement, and duplicate-safe serialized persistence.
- Integration-test foreground fetch with multiple emails where one fails and one succeeds.
- Integration-test concurrency with two duplicate-like emails and assert only one transaction is saved.
- Test background bounded work separately from foreground sync.

## Security and Permissions

- Do not log plaintext financial data, merchant names, amounts, email bodies, subjects, account numbers, card hints, or email addresses.
- Continue using existing OAuth tokens and provider adapters; no new provider permissions are required.
- Ensure telemetry uses counts, durations, statuses, and provider family only.
- Background sync must respect authenticated session boundaries and local user database boundaries.

## Testing

- Direct unit tests for parse policy resolution and per-email outcome aggregation.
- Direct unit tests for `lastFetchedAt` advancement with success, skipped, pending retry, failed, and mixed batches.
- Direct unit tests for retry queue persistence when parse or save fails.
- Integration tests for foreground sync refreshing Home after the first saved transaction.
- Integration tests for concurrent parse plus serialized persistence to prevent duplicate transaction races.
- Integration tests for background bounded work and no repeated provider re-fetch after durable local failure state.
- Telemetry tests asserting structural fields are emitted and no PII fields are included.

## Success Criteria

- [ ] Normal foreground sync starts parsing without a fixed 3 second delay.
- [ ] Normal foreground sync supports parse concurrency of 3 while preserving duplicate safety.
- [ ] Background sync uses a separate bounded policy with moderate concurrency.
- [ ] Initial sync remains conservative and does not burst historical LLM requests.
- [ ] A single failed email no longer prevents provider `lastFetchedAt` from advancing after durable local state is recorded.
- [ ] Failed parse/save work retries from local `processedEmails` instead of repeated provider re-fetches.
- [ ] Home refreshes after the first saved foreground email transaction and after completion.
- [ ] Duplicate-like emails processed under concurrent parsing save at most one transaction.
- [ ] Telemetry reports fetch, parse, persistence, retry, and first-saved timing without PII.

## Out of Scope

- Adding push/webhook-based provider integrations for true real-time email events.
- Changing bank sender discovery rules beyond telemetry needed to identify missed sender filters.
- Redesigning the review UI, except for ensuring existing retry/review states are populated correctly.
- Adding full-text search or remote plaintext financial storage.
- Changing notification or Apple Pay capture pipelines unless shared deduplication logic must be hardened.

## Open Questions

Resolved decisions:

- `skipped` emails should emit privacy-preserving structural diagnostics to Sentry. Do not log raw subject, body, amount, merchant, email address, account/card details, sender domains, deterministic fingerprints, or any free-text financial content. Use provider, skip reason, length buckets, and finite structural flags only.
- Background sync should start with a max of 10 newest candidate emails per run, parse concurrency 2, and no fixed parse delay. Raise only if telemetry shows runs finish reliably and safely.
- Foreground sync should not be capped initially. It should process fetched candidates newest-first with parse concurrency 3, no fixed parse delay, refresh Home after the first saved transaction, and rely on corrected `lastFetchedAt` behavior to prevent recurring stale backlogs.

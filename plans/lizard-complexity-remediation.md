# Lizard Strict Burn-Down Plan

## Status

Completed on April 21, 2026.

Final state on `origin/main`:

- `bun run lint:complexity` passes
- `plans/lizard-complexity-debt.json` is at `0` violations
- Waves 1-4 and MRs 1-5 are merged

The rest of this document is kept as historical planning context.

## Target

Use one enforced Lizard target for the repo:

- `CCN <= 5`
- `NLOC <= 30`
- `parameter_count <= 3`

No second profile. No softer long-term gate.

## Historical Reality Check

At the start of this effort, this target was coherent, but it was not one-shot reachable from the codebase.

Based on the initial scan:

- Total functions violating the target: `340`
- Test violations: `129`
- Non-test violations: `211`

Largest current violation clusters:

- `tests`: `129`
- `email-capture`: `34`
- `transactions`: `23`
- `capture-sources`: `15`
- `ai-chat`: `11`
- `mutations`: `3`, but one of them is the single worst function in the repo

Top production hotspots in the initial baseline snapshot:

1. `apps/mobile/mutations/index.ts::applyTransactionSave` — `CCN 45`, `NLOC 190` (omit parameter count here; Lizard counted the TypeScript overload signatures as `params 39`, which overstated the real function surface)
3. `apps/mobile/shared/types/assertions.ts::assertNonEmptyString` — `CCN 28`, `NLOC 68`, `params 4`
4. `apps/mobile/features/transactions/lib/build-transaction.ts::parseDigitsToAmount` — `CCN 22`, `NLOC 36`
5. `apps/mobile/features/email-capture/services/parse-email-api.ts::stripPii` — `CCN 22`, `NLOC 23`
6. `apps/mobile/features/email-capture/services/gmail-adapter.ts::getHeader` — `CCN 21`, `NLOC 72`, `params 4`
7. `apps/mobile/features/email-capture/services/create-email-pipeline-service.ts::runEmailEffect` — `CCN 19`, `NLOC 102`
8. `apps/mobile/features/capture-sources/services/notification-pipeline.ts::processNotification` — `CCN 17`, `NLOC 163`

One caution: some regex-heavy JS/TS files appear inflated by Lizard's parser, especially `apps/mobile/features/capture-sources/lib/notification-parser.ts`. That file still needs manual verification before using its reported score as a hard refactor priority.

## Enforcement Strategy

There should be one target, but it still needs a migration path.

The practical setup is:

1. Add one checked-in Lizard command that always runs with `-C 5 -L 30 -a 3`.
2. Generate one checked-in debt ledger from today's failures.
3. CI fails if:
   - a new violation appears
   - an existing violation gets worse
   - a touched file still violates after a slice that was supposed to fix it
4. Remove entries from the debt ledger as each slice lands.
5. The project is done when the debt ledger is empty.

This is still one setup:

- one target
- one command
- one shrinking exception list

It is not two standards. It is one standard with tracked migration debt.

## Why This Target Is Reasonable

### Why `CCN <= 5`

Yes, this is strict. That is the point.

It is still defensible because:

- functions above `5` in this repo are often orchestration boundaries that have absorbed too many responsibilities
- the codebase already prefers small pure functions and explicit boundaries
- this threshold pushes logic toward deeper modules instead of giant workflow functions

The cost:

- some service/orchestration code will need real redesign, not cosmetic extraction
- a few adapter-style functions may feel slightly over-constrained

### Why `NLOC <= 30`

This is also strict, but still workable.

It is good because:

- it discourages giant "do everything" functions

The cost:

- if applied carelessly, it can encourage shallow helper fragmentation
- the refactors must deepen modules, not just scatter code into many tiny wrappers

### Why `parameter_count <= 3`

This is the hardest threshold operationally, but it exposes real design smells in this repo:

- broad row bags
- procedural service APIs
- mutation helpers with too many positional dependencies

The cost:

- some call sites will need value objects or typed context objects
- careless wrapping can make APIs more indirect without making them clearer

So the rule is: use smaller domain objects only when they hide a coherent concept, not just to game Lizard.

## Refactor Principles

Every slice should follow these rules:

1. Reduce responsibilities, not just line count.
2. Prefer handler registries and staged pipelines over giant switches and `if` chains.
3. Extract coherent domain objects, not generic `options` blobs.
4. Test the deeper boundary that owns behavior.
5. Do not spend early slices on test cleanup while production orchestration remains oversized.

## Burn-Down Phases

## Phase 0: Install The Single Gate And Debt Ledger

### Objective

Turn the target into the only official standard now, while acknowledging current debt.

### Deliverables

- one repo command that runs Lizard with:
  - `-C 5`
  - `-L 30`
  - `-a 3`
- one checked-in ledger of current violations
- one CI/pre-push rule that rejects regressions against that ledger

### Exit Criteria

- the strict target exists in code, not just in a plan
- nobody can add new violations while the backlog is being burned down

## Phase 1: Kill The Monster Orchestrators

### Why first

A small number of orchestration functions account for a disproportionate amount of the repo's pain.

### Scope

- `apps/mobile/mutations/index.ts`
- `apps/mobile/features/capture-sources/services/notification-pipeline.ts`
- `apps/mobile/features/email-capture/services/create-email-pipeline-service.ts`

### Work

- replace switch/if dispatch with handler registries
- split workflows into named stages
- collapse repeated persistence + telemetry branches behind shared boundaries
- replace giant parameter surfaces with domain command payloads or stage contexts

### Success

- no top-level orchestrator in this phase exceeds the target
- the surrounding files become composition modules rather than logic dumps

## Phase 2: Break Up The Row-Bag APIs

### Why second

`parameter_count <= 3` will not happen unless broad row-shaped APIs are reduced.

### Scope

- mutation payloads
- transaction builders
- service entry points with many independent scalar inputs

### Work

- introduce coherent domain payload types where they represent one concept
- move mapping logic closer to the repository or service that owns it
- replace functions that accept many unrelated scalars with smaller typed objects

### Success

- parameter count violations disappear from the core production paths
- APIs become more obvious, not more abstract

## Phase 3: Decompose Shared Utilities

### Why third

Shared utilities are reused everywhere. Reducing their complexity lowers pressure across the codebase.

### Scope

- `apps/mobile/shared/types/assertions.ts`
- `apps/mobile/features/transactions/lib/build-transaction.ts`
- parser and header extraction helpers in email/capture flows

### Work

- split `assertions.ts` into branded-id assertions, date validators, datetime validators, and `requireX` constructors
- split builder/parser logic into parse, validate, normalize, and map steps
- convert branch-heavy utilities into small pipelines of pure functions

### Success

- shared utility files no longer mix unrelated responsibilities
- branch-heavy pure logic is easier to unit test directly

## Phase 4: Refactor Store And Service Clusters

### Why fourth

After the biggest orchestrators are fixed, medium-sized clusters become tractable.

### Scope

- `apps/mobile/features/email-capture/store.ts`
- `apps/mobile/features/goals/store.ts`
- `apps/mobile/features/calendar/store.ts`
- `apps/mobile/features/ai-chat/services/create-streaming-chat-service.ts`
- `apps/mobile/features/financial-accounts/lib/management-service.ts`

### Work

- move timers, streaming steps, and queue transitions behind narrower service boundaries
- keep stores as coordination shells
- isolate pure state transitions from effectful scheduling

### Success

- most remaining non-test violations are concentrated in a small tail of files

## Phase 5: Validate Parser Outliers And Refactor Only The Real Ones

### Objective

Avoid wasting slices on fake complexity.

### Scope

- `apps/mobile/features/capture-sources/lib/notification-parser.ts`
- other regex-heavy/parser-heavy files surfaced by Lizard

### Work

- manually verify whether the reported complexity matches visible control flow
- if the complexity is real, split by source family or matcher registry
- if the complexity is inflated, document it and remove it from the debt ledger only if the measurement approach is corrected

### Success

- parser work is driven by real complexity, not parser artifacts

## Phase 6: Burn Down Test Violations

### Why last

Test readability matters, but production hotspots should be fixed first.

### Scope

- large anonymous test blocks
- giant scenario files
- test helpers with too many parameters

### Work

- split large scenario files into table-driven cases and focused builders
- extract repeated setup into helpers with coherent inputs
- reduce giant inline anonymous functions

### Success

- test violations no longer dominate the ledger

## Suggested Slices

### Slice 1

Introduce the single enforced target and check in the debt ledger.

### Slice 2

Refactor `apps/mobile/mutations/index.ts`.

### Slice 3


### Slice 4

Refactor `processNotification`.

### Slice 5

Refactor `create-email-pipeline-service.ts`.

### Slice 6

Decompose `shared/types/assertions.ts` and transaction builders.

### Slice 7

Clean up medium-sized stores and services.

### Slice 8

Validate parser outliers and fix only the legitimate ones.

### Slice 9+

Burn down tests until the ledger is empty.

## Parallelization Map

### Must run first

- `Slice 1` should run alone.
- Reason: it defines the single gate, the debt ledger, and the baseline every other slice will burn down against.

### Safe parallel tracks after Slice 1

- `Slice 2` (`mutations/index.ts`)
- `Slice 4` (`processNotification`)
- `Slice 5` (`create-email-pipeline-service.ts`)

These are the best first parallel candidates because each attacks a different hotspot cluster and mostly different files.

### Parallelization cautions

- `Slice 4` and `Slice 5` are both in capture/email territory. They can run in parallel, but only if each agent stays in its assigned files and avoids opportunistic cleanup in shared helper modules.
- `Slice 2` should avoid broad edits in `shared/mutations/write-through.ts` unless that file is explicitly assigned to the same agent.

### Should wait until the first hotspot wave settles

- `Slice 6` should mostly wait for `Slice 2` through `Slice 5`.
- Reason: it touches shared utilities and transaction builders that the first hotspot slices may naturally modify. Running it too early creates merge churn.

### Slice 6 can itself be split

- `Slice 6A`: `shared/types/assertions.ts`
- `Slice 6B`: transaction builders and parser/header helpers

Those can run in parallel once the orchestrator slices are merged or nearly merged.

### Slice 7 is highly parallelizable

After `Slice 5` and most of `Slice 6` are done, split `Slice 7` into file-cluster agents:

- `Slice 7A`: `features/goals/store.ts`
- `Slice 7B`: `features/calendar/store.ts`
- `Slice 7C`: `features/ai-chat/services/create-streaming-chat-service.ts`
- `Slice 7D`: `features/financial-accounts/lib/management-service.ts`
- `Slice 7E`: `features/email-capture/store.ts`

`Slice 7E` should start after `Slice 5`, because both are in the email-capture area.

### Slice 8 depends on earlier capture/transaction work

- `Slice 8` should wait for `Slice 4`, `Slice 5`, and `Slice 6B`.
- Reason: parser outliers overlap with capture-sources, email parsing, and transaction-building code. Refactoring them earlier risks duplicate work.

### Slice 9+ is the easiest to fan out

Once production hotspots are mostly stable, test cleanup can be parallelized aggressively by file group:

- capture-sources tests
- calendar tests
- goals tests
- email-capture tests
- financial-accounts tests

### Recommended agent wave plan

1. One agent on `Slice 1`
2. Four agents in parallel on `Slice 2` through `Slice 5`
3. Two agents in parallel on `Slice 6A` and `Slice 6B`
4. Four or five agents in parallel on `Slice 7A` through `Slice 7E`
5. One agent on `Slice 8`
6. Many agents on `Slice 9+` by test cluster

## Historical Remaining Baseline

After the first burn-down wave landed and the ledger was refreshed on April 20, 2026, the remaining strict debt is:

- total violations: `200`
- production violations: `106`
- test violations: `94`

Largest remaining production clusters:

- `transactions`: `13`
- `email-capture`: `9`
- `account-suggestions`: `8`
- `capture-sources`: `7`
- `goals`: `7`
- `financial-accounts`: `6`
- `budget`: `5`
- `transfers`: `5`

Highest-value remaining production hotspots:

1. `apps/mobile/features/notifications/lib/display.ts::getCategoryVisuals` — `CCN 15`
2. `apps/mobile/plugins/withFidyWidget.js::addWidgetExtensionTarget` — `CCN 13`, `NLOC 109`
3. `apps/mobile/features/email-capture/lib/progress-phases.ts::buildProgressDisplay` — `CCN 13`, `NLOC 34`
4. `apps/mobile/features/goals/lib/derive.ts::computeMedian` — `CCN 12`
5. `apps/mobile/features/auth/store.ts::{restoreSession, signIn}` — `CCN 11`, `NLOC 44/42`
6. `apps/mobile/features/qa/devtools-store.ts::parseStoredFlags` — `CCN 11`, `NLOC 41`

## Historical Parallel Waves

The original hotspot slices are largely complete. The next plan should burn down the remaining debt by feature cluster, not by the old orchestrator order.

### Wave 1: Standalone production hotspots

These are the best immediate parallel tasks because they are high-value and low-conflict:

- `notifications` agent: `apps/mobile/features/notifications/lib/display.ts`, `apps/mobile/features/notifications/lib/derive.ts`
- `goals` agent: `apps/mobile/features/goals/lib/derive.ts`
- `auth` agent: `apps/mobile/features/auth/store.ts`
- `qa` agent: `apps/mobile/features/qa/devtools-store.ts`, `apps/mobile/features/qa/network-inspector.ts`
- `plugin` agent: `apps/mobile/plugins/withFidyWidget.js`
- `calendar` agent: `apps/mobile/features/calendar/lib/calendar-utils.ts`

### Wave 2: Feature-cluster production cleanup

Run these in parallel, but keep each cluster owned by one agent because the files within each cluster share helpers, types, and tests:

- `transactions` cluster: `apps/mobile/features/transactions/lib/repository.ts`, `apps/mobile/features/transactions/lib/group-by-date.ts`, `apps/mobile/features/transactions/services/create-transaction-query-service.ts`, `apps/mobile/features/transactions/store.ts`
- `email-capture` cluster: `apps/mobile/features/email-capture/lib/repository.ts`, `apps/mobile/features/email-capture/lib/progress-phases.ts`, `apps/mobile/features/email-capture/services/create-parse-email-service.ts`
- `account-suggestions` cluster: `apps/mobile/features/account-suggestions/lib/dismissals-repository.ts`, `apps/mobile/features/account-suggestions/lib/presentation.ts`, `apps/mobile/features/account-suggestions/services/create-account-suggestion-service.ts`
- `financial-accounts` cluster: `apps/mobile/features/financial-accounts/lib/repository.ts`, `apps/mobile/features/financial-accounts/lib/opening-balances-repository.ts`, `apps/mobile/features/financial-accounts/lib/balance-repository.ts`
- `capture-sources` cluster: `apps/mobile/features/capture-sources/services/capture-ingestion.ts`, `apps/mobile/features/capture-sources/lib/dedup.ts`

### Wave 3: Medium shared/service clusters

These are parallelizable, but each one should stay inside its own feature boundary:

- `budget` cluster: `apps/mobile/features/budget/store.ts`, `apps/mobile/features/budget/services/subscribe-budget-to-transactions.ts`
- `review-queues` cluster: `apps/mobile/features/review-queues/lib/attribution-review-service.ts`
- `activity` cluster: `apps/mobile/features/activity/services/create-activity-query-service.ts`
- `search` cluster: `apps/mobile/features/search/lib/repository.ts`
- `transfers` cluster: `apps/mobile/features/transfers/lib/build-transfer.ts`, `apps/mobile/features/transfers/lib/repository.ts`
- `ai-chat` cluster: `apps/mobile/features/ai-chat/store.ts`
- `shared` cluster: `apps/mobile/shared/effect/runtime.ts`, `apps/mobile/shared/lib/format-date.ts`, `apps/mobile/shared/db/supabase.ts`

### Wave 4: Test burn-down

Once the paired production cluster is stable, test cleanup can fan out aggressively by domain:

- `email-capture tests`: start with `apps/mobile/__tests__/email-capture/store.test.ts`, `email-pipeline.test.ts`
- `financial-accounts tests`: start with `apps/mobile/__tests__/financial-accounts/identifiers.test.ts`, `balance-repository.test.ts`, `opening-balances.test.ts`
- `account-suggestions tests`: `apps/mobile/__tests__/account-suggestions/service.test.ts`
- `budget/activity/transfers tests`: `budget/repository.test.ts`, `budget/store.test.ts`, `activity/query-service.test.ts`, `transfers/repository.test.ts`
- `capture-evidence tests`: `apps/mobile/__tests__/capture-evidence/repository.test.ts`

### Parallelization rules for the remaining work

- Do not split one feature cluster across multiple agents in the same wave.
- Do not start a feature's test cleanup before that feature's production cluster is merged.
- `withFidyWidget.js` should run alone because it is isolated and likely to be noisy.
- `shared` cleanup should start after the first two production waves, because shared helpers create merge churn.
- If a cluster only has parameter-count violations, prefer API reshaping over helper extraction.

## Historical Serial Execution Mode

If one agent is doing the whole burn-down instead of parallel waves, execute the remaining work one cluster at a time and open one MR per cluster.

### Serial rules

- Finish one cluster completely before starting the next.
- After each cluster:
  - run the cluster's targeted tests
  - run `bun run lint:complexity`
  - refresh the strict report if needed
  - open one MR
- Do not batch multiple clusters into one MR.
- Do not start a feature's test cluster before its production cluster is merged.

### Serial cluster order

1. `notifications`
2. `goals`
3. `auth`
4. `qa`
5. `plugin`
6. `calendar`
7. `transactions`
8. `email-capture`
9. `account-suggestions`
10. `financial-accounts`
11. `capture-sources`
12. `budget`
13. `review-queues`
14. `activity`
15. `search`
16. `transfers`
17. `ai-chat`
19. `shared`
21. `email-capture tests`
22. `financial-accounts tests`
23. `account-suggestions tests`
24. `budget/activity/transfers tests`
25. `capture-evidence tests`

### Why this order

- start with isolated high-value production hotspots
- then clear the larger feature clusters
- then do the medium shared/service cleanup
- leave test burn-down until the matching production code is stable

## Historical Final Micro-Plan After Waves 1-4

After rebasing against `origin/main` on April 21, 2026, the remaining strict debt is:

- total violations: `57`
- production violations: `33`
- test violations: `24`

At this point the old wave model is mostly complete. The remainder should be burned down with a short tail of tiny MRs.

### MR 1: Route params and small branching helpers

Scope:

- `apps/mobile/features/goals/lib/route-params.ts`
- `apps/mobile/features/search/lib/route-params.ts`
- `apps/mobile/features/qa/lib/route-params.ts`
- `apps/mobile/features/search/lib/filters.ts`
- `apps/mobile/features/settings/store.ts`
- `apps/mobile/features/categories/store.ts`
- `apps/mobile/features/onboarding/lib/flow.ts`

Reason:

- these are isolated helpers and lightweight stores
- most remaining debt here is small branching or single-file NLOC/parameter cleanup
- low merge risk and fast payoff

### MR 2: Parameter-count and repository-shape cleanup

Scope:

- `apps/mobile/features/capture-evidence/lib/repository.ts`
- `apps/mobile/features/transactions/lib/mutation-service.ts`
- `apps/mobile/features/transactions/lib/format-date.ts`
- `apps/mobile/features/calendar/lib/repository.ts`
- `apps/mobile/features/capture-sources/store.ts`
- `apps/mobile/features/financial-accounts/lib/form-screen.ts`

Reason:

- this batch is mostly `parameter_count` cleanup and small API reshaping
- they are easier to fix together than as separate one-file PRs
- the changes should be narrow and mostly mechanical

### MR 3: Remaining production orchestration tail

Scope:

- `apps/mobile/features/calendar/lib/bill-mutation-service.ts`
- `apps/mobile/features/ai-chat/hooks/use-streaming-chat.ts`
- `apps/mobile/features/ai-chat/lib/parse-action.ts`
- `apps/mobile/features/budget/lib/notifications.ts`
- `apps/mobile/features/capture-sources/hooks/setup.ts`
- `apps/mobile/features/financial-accounts/lib/identifiers-repository.ts`

Reason:

- these are the remaining real branching/orchestration hotspots
- they need slightly more judgment than the parameter-count tail
- still small enough to fit in one focused cleanup MR

### MR 4: Final production leftovers with adjacent cleanup

Scope:

- any remaining production violations after MRs 1-3
- likely candidates:
  - `apps/mobile/features/account-suggestions/lib/dismissals-repository.ts`
  - `apps/mobile/features/account-suggestions/lib/presentation.ts`
  - `apps/mobile/features/account-suggestions/services/create-account-suggestion-service.ts`
  - `apps/mobile/features/email-capture/lib/repository.ts`
  - `apps/mobile/features/financial-accounts/lib/opening-balances-repository.ts`

Reason:

- by this point the remaining production debt should be a small mixed tail
- keep one MR reserved for whatever is still left instead of over-planning now

### MR 5: Final test tail

Scope:

- remaining test violations only
- expected hotspots:
  - `apps/mobile/__tests__/email-capture/financial-meaning-review.test.ts`
  - `apps/mobile/__tests__/setup.ts`
  - `apps/mobile/__tests__/review-queues/attribution-review-service.test.ts`
  - `apps/mobile/__tests__/goals/repository.test.ts`

Reason:

- by this point production code should be nearly or fully clean
- the remaining debt is mostly long anonymous blocks and oversized scenario setup
- keeping tests in the final MR avoids mixing production and test churn

### Endgame rules

- after each MR, refresh the ledger and reassess before starting the next one
- if MRs 1-3 eliminate more debt than expected, merge MR 4 into MR 5 or skip it
- do not reopen broad wave planning unless the remaining debt stops shrinking cleanly

## Historical Starting Point

The initial burn-down started with `apps/mobile/mutations/index.ts` because they were the worst hotspots in the original baseline.

That guidance is historical. The burn-down is complete; the sections above are retained only as archive/history.

## Non-Negotiable Guardrail

Do not "hit the numbers" by turning one large function into many shallow wrappers.

A slice only counts as successful if it:

- reduces the violation count
- preserves or improves readability
- creates deeper module boundaries
- improves testability at the owning boundary

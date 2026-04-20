# Lizard Strict Burn-Down Plan

## Target

Use one enforced Lizard target for the repo:

- `CCN <= 5`
- `NLOC <= 30`
- `parameter_count <= 3`

No second profile. No softer long-term gate.

## Reality Check

This target is coherent, but it is not one-shot reachable from the current codebase.

Based on the current scan:

- Total functions violating the target: `340`
- Test violations: `129`
- Non-test violations: `211`

Largest current violation clusters:

- `tests`: `129`
- `email-capture`: `34`
- `transactions`: `23`
- `capture-sources`: `15`
- `sync`: `12`
- `ai-chat`: `11`
- `mutations`: `3`, but one of them is the single worst function in the repo

Top production hotspots in the initial baseline snapshot:

1. `apps/mobile/mutations/index.ts::applyTransactionSave` — `CCN 45`, `NLOC 190` (omit parameter count here; Lizard counted the TypeScript overload signatures as `params 39`, which overstated the real function surface)
2. `apps/mobile/features/sync/services/syncEngine.ts::processEntry` — `CCN 34`, `NLOC 70`, `params 3`
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

- it forces long flows like sync, email capture, and mutations to split into staged operations
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
- `apps/mobile/features/sync/services/syncEngine.ts`
- `apps/mobile/features/capture-sources/services/notification-pipeline.ts`
- `apps/mobile/features/email-capture/services/create-email-pipeline-service.ts`

### Work

- replace switch/if dispatch with handler registries
- split workflows into named stages
- move per-entity sync logic into per-entity handlers
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
- sync mappers
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

Refactor sync push dispatch in `syncEngine.ts`.

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
- `Slice 3` (`syncEngine.ts`)
- `Slice 4` (`processNotification`)
- `Slice 5` (`create-email-pipeline-service.ts`)

These are the best first parallel candidates because each attacks a different hotspot cluster and mostly different files.

### Parallelization cautions

- `Slice 4` and `Slice 5` are both in capture/email territory. They can run in parallel, but only if each agent stays in its assigned files and avoids opportunistic cleanup in shared helper modules.
- `Slice 2` should avoid broad edits in `shared/mutations/write-through.ts` unless that file is explicitly assigned to the same agent.
- `Slice 3` should avoid shared utility cleanup while it is focused on sync dispatch and per-table handlers.

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

- sync tests
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

## Recommended Starting Point

Start with `apps/mobile/mutations/index.ts`.

Reason:

- it contains the worst function in the repo by a large margin
- it has both complexity and parameter-count problems
- it is central enough that improving it will set the boundary pattern for later slices

The second slice should be `syncEngine.ts`, because it has the next-highest concentration of real orchestration debt.

## Non-Negotiable Guardrail

Do not "hit the numbers" by turning one large function into many shallow wrappers.

A slice only counts as successful if it:

- reduces the violation count
- preserves or improves readability
- creates deeper module boundaries
- improves testability at the owning boundary

# File Size Governance Plan

## Goal

Reduce oversized files by enforcing a practical max file length policy that improves cohesion without fighting legitimate composition roots.

Target outcome:

- new or touched feature files converge toward a `300 LoC` cap
- oversized files are split by responsibility, not mechanically
- enforcement lives in repo tooling, not reviewer memory
- exemptions are explicit and rare

## Non-goals

- forcing every file in the repo under 300 lines immediately
- splitting central schema or composition-root files just to satisfy a number
- counting locale dictionaries, tests, generated artifacts, or migrations as design debt
- replacing architectural review with a single lint error

## Current repo shape

Rebased against `origin/main` on April 22, 2026.

Production-code scan summary, excluding tests and locale dictionaries:

- `494` production TS/TSX/JS files
- `36` files over `300` lines
- `10` files over `500` lines

Source scan including tests and locale dictionaries:

- `62` TS/TSX/JS files over `300` lines

Concentration of oversized files:

- `12` components/screens
- `5` stores
- `4` services
- `3` `lib/` modules
- `3` app/root files
- `2` Supabase edge-function entrypoints
- `1` DB schema file
- `6` other/tooling files

Largest current hotspots:

- [apps/mobile/features/email-capture/services/create-email-pipeline-service.ts](../apps/mobile/features/email-capture/services/create-email-pipeline-service.ts)
- [apps/mobile/features/transfers/components/TransferFormScreen.tsx](../apps/mobile/features/transfers/components/TransferFormScreen.tsx)
- [apps/mobile/features/goals/components/GoalDetail.tsx](../apps/mobile/features/goals/components/GoalDetail.tsx)
- [apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx](../apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx)
- [apps/mobile/features/financial-accounts/lib/management-service.ts](../apps/mobile/features/financial-accounts/lib/management-service.ts)
- [apps/mobile/features/capture-sources/services/notification-pipeline.ts](../apps/mobile/features/capture-sources/services/notification-pipeline.ts)
- [apps/mobile/mutations/index.ts](../apps/mobile/mutations/index.ts)
- [apps/mobile/app/_layout.tsx](../apps/mobile/app/_layout.tsx)
- [apps/mobile/features/transactions/store.ts](../apps/mobile/features/transactions/store.ts)

Existing architecture gate already on `origin/main`:

- [plans/lizard-complexity-remediation.md](../plans/lizard-complexity-remediation.md) is marked complete
- [plans/lizard-complexity-debt.json](../plans/lizard-complexity-debt.json) is at zero violations
- [scripts/check-lizard-complexity.ts](../scripts/check-lizard-complexity.ts) already runs through root `verify`

Initial report-only baseline with the current explicit allowlist:

- `30` oversized non-exempt files reported by `bun run analyze:file-size`

## Why this plan now complements Lizard instead of replacing it

The repo now has a strict enforced function-level complexity gate:

- `CCN <= 5`
- `NLOC <= 30`
- `parameter_count <= 3`

That means file-size governance should target a different smell:

- concept sprawl across many individually simple functions
- screens that mix route integration, state, validation, and presentational sections
- stores that combine state container concerns with async orchestration
- service files that are still large because they own too many stages, even if each function is small

The repo still shows two different categories of large files:

### Split-worthy mixed-responsibility files

These are large because they blend multiple concerns:

- screens that combine route parsing, async orchestration, local state, validation, and presentational sections
- stores that combine session guards, async workflows, cache updates, and mutation orchestration
- services that combine row mapping, fetch/push logic, retry flows, persistence helpers, and telemetry

Examples:

- [apps/mobile/features/transfers/components/TransferFormScreen.tsx](../apps/mobile/features/transfers/components/TransferFormScreen.tsx)
- [apps/mobile/features/goals/components/GoalDetail.tsx](../apps/mobile/features/goals/components/GoalDetail.tsx)
- [apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx](../apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx)
- [apps/mobile/features/financial-accounts/lib/management-service.ts](../apps/mobile/features/financial-accounts/lib/management-service.ts)
- [apps/mobile/features/transactions/store.ts](../apps/mobile/features/transactions/store.ts)
- [apps/mobile/features/email-capture/services/create-email-pipeline-service.ts](../apps/mobile/features/email-capture/services/create-email-pipeline-service.ts)

### Legitimate boundary files

These may still deserve cleanup, but size alone is not enough to classify them as design debt:

- [apps/mobile/shared/db/schema.ts](../apps/mobile/shared/db/schema.ts)
- [apps/mobile/app/_layout.tsx](../apps/mobile/app/_layout.tsx)
- [supabase/functions/ai-chat/index.ts](../supabase/functions/ai-chat/index.ts)
- [supabase/functions/weekly-digest/index.ts](../supabase/functions/weekly-digest/index.ts)

Policy implication:

- the repo should adopt a `300 LoC` target
- enforcement should start as reporting, not as a second immediate hard fail
- refactor priorities should focus on file-level cohesion that Lizard does not already police
- enforcement should start with feature modules, not structural roots
- exemptions must be named, not implicit

## Recommended policy

### Default rule

For non-test feature code, files should stay at or under `300` lines.

Primary scope:

- `apps/mobile/features/**/components/**/*.{ts,tsx}`
- `apps/mobile/features/**/services/**/*.ts`
- `apps/mobile/features/**/store.ts`
- `apps/mobile/features/**/lib/**/*.ts`
- `apps/mobile/app/**/*.tsx`

### Explicit exemptions

Do not fail the build on these initially:

- locale dictionaries:
  - `apps/mobile/shared/i18n/locales/*.ts`
- tests:
  - `**/__tests__/**`
  - `**/*.test.ts`
  - `**/*.test.tsx`
- DB schema and migration bundles:
  - `apps/mobile/shared/db/schema.ts`
  - `apps/mobile/drizzle/**`
- composition roots and entrypoints:
  - `apps/mobile/app/_layout.tsx`
  - `supabase/functions/**/index.ts`
- tooling config:
  - `apps/mobile/eslint.config.js`
  - `scripts/check-branded-boundaries.ts`

### Decision rule for future exemptions

Exempt only when the file is primarily one of:

- a schema registry
- a route/composition root
- a generated or data-dictionary file
- an external platform entrypoint where splitting would reduce clarity

Do not exempt because:

- a screen has many sections
- a store has many actions
- a service handles many cases
- a file is inconvenient to split right now

## Enforcement design

### Mechanism

Add a repo-level script such as `scripts/check-max-file-lines.ts`, but do not put it into root `verify` immediately.

Reason:

- root lint uses Biome
- `apps/mobile` uses ESLint
- root `verify` already enforces strict Lizard complexity
- repo-wide file-size reporting is cleaner with one allowlisted script than with partial ESLint coverage
- if file-size becomes enforceable later, it should mirror the existing Lizard governance pattern instead of inventing a separate workflow

### Rule behavior

Phase the rule in:

- report-only mode first
- optionally add a debt ledger only if changed-file enforcement proves useful
- fail only on new violations next
- fail on all non-exempt violations last

Script responsibilities:

- count lines in tracked source files
- ignore explicit allowlist patterns
- print offending files sorted by line count
- optionally support `--changed-only`
- exit non-zero only when policy phase says to fail

### Root entry points

- [package.json](../package.json)
- [apps/mobile/package.json](../apps/mobile/package.json)
- new script candidate:
  - `scripts/check-max-file-lines.ts`

Recommended root scripts:

- `analyze:file-size`: report line caps
- add `lint:file-size` only after changed-file enforcement is ready and the false-positive rate is acceptable

## Refactor strategy

### Principle

Split by responsibility boundary, not by arbitrary chunks of 300 lines.

Good split signals:

- a presentational section can become a child component
- route-param parsing can move out of a screen
- store async workflows can move to a service/module
- conversion or mapping helpers can move to dedicated mapper files
- one file contains both incoming flow and retry flow

Bad split signals:

- extracting tiny helpers that only hide linear UI markup
- creating “utils.ts” buckets with no domain meaning
- splitting one algorithm across many files without improving boundaries

## Execution slices

### Slice 1: Baseline and policy wiring aligned with Lizard

Scope:

- create the file-size check script
- encode the initial allowlist
- support report-only output
- keep it out of `verify` initially
- document the policy in the repo

Exit criteria:

- a single command reports all current violations consistently
- current structural exemptions are explicit in code
- the repo can track progress over time without creating a second redundant hard gate

Execution checklist:

- [ ] Add `scripts/check-max-file-lines.ts`.
- [ ] Ignore tests, locales, schema, migrations, and named structural entrypoints.
- [ ] Print grouped violations by category and line count.
- [ ] Add a root script such as `analyze:file-size`.
- [ ] Keep initial mode report-only so the branch does not fail immediately.

### Slice 2: Prove value on high-signal screen and pure-lib files

Prioritize files where line count still clearly correlates with mixed responsibility after Lizard cleanup.

Targets:

- [apps/mobile/features/financial-accounts/lib/management-service.ts](../apps/mobile/features/financial-accounts/lib/management-service.ts)
- [apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx](../apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx)
- [apps/mobile/features/transfers/components/TransferFormScreen.tsx](../apps/mobile/features/transfers/components/TransferFormScreen.tsx)
- [apps/mobile/features/goals/components/GoalDetail.tsx](../apps/mobile/features/goals/components/GoalDetail.tsx)

Recommended splits:

For `FinancialAccountFormScreen.tsx`:

- `FinancialAccountFormBody.tsx`
- `FinancialAccountKindChip.tsx`
- `FinancialAccountIdentifierChip.tsx`
- `useFinancialAccountForm.ts`

For `TransferFormScreen.tsx`:

- `TransferSideCard.tsx`
- `TransferSidePicker.tsx`
- `useTransferFormController.ts`
- keep route integration in the screen file

For `GoalDetail.tsx`:

- `GoalProgressRing.tsx`
- `GoalProjectionCard.tsx`
- `GoalTabControl.tsx`
- `GoalContributionRow.tsx`
- `GoalMilestoneRow.tsx`

For `management-service.ts`:

- `financial-account-billing.ts`
- `financial-account-opening-balance.ts`
- `financial-account-details.ts`
- keep `management-service.ts` as command/query shell

Exit criteria:

- each screen becomes primarily route integration plus composition
- the pure financial-account service becomes a small interface over domain helpers
- extracted pieces have stable domain names, not generic helper names
- visual behavior is unchanged

### Slice 3: Thin the oversized stores

Targets:

- [apps/mobile/features/email-capture/store.ts](../apps/mobile/features/email-capture/store.ts)
- [apps/mobile/features/transactions/store.ts](../apps/mobile/features/transactions/store.ts)
- [apps/mobile/features/budget/store.ts](../apps/mobile/features/budget/store.ts)
- [apps/mobile/features/goals/store.ts](../apps/mobile/features/goals/store.ts)
- [apps/mobile/features/ai-chat/store.ts](../apps/mobile/features/ai-chat/store.ts)

Strategy:

- keep store state and synchronous setters local
- move async workflows and stale-request guards into dedicated modules
- keep session/request tracking at the boundary where it is clearest

Candidate extractions:

- `*-session.ts`
- `*-loaders.ts`
- `*-mutations.ts`
- feature query services that already exist or should exist

Exit criteria:

- stores read as state containers, not feature god modules
- async orchestration can be tested below the Zustand boundary

### Slice 4: Refactor the remaining service/orchestration megafiles

Targets:

- [apps/mobile/features/email-capture/services/create-email-pipeline-service.ts](../apps/mobile/features/email-capture/services/create-email-pipeline-service.ts)
- [apps/mobile/features/capture-sources/services/notification-pipeline.ts](../apps/mobile/features/capture-sources/services/notification-pipeline.ts)
- [apps/mobile/mutations/index.ts](../apps/mobile/mutations/index.ts)

Recommended splits:

For `create-email-pipeline-service.ts`:

- `email-pipeline-runtime.ts`
- `email-pipeline-persistence.ts`
- `email-pipeline-incoming.ts`
- `email-pipeline-retries.ts`
- keep `create-email-pipeline-service.ts` as service composition shell

For `notification-pipeline.ts` and `mutations/index.ts`:

- extract stage/handler modules with domain names
- keep public entry points stable

Exit criteria:

- these files are meaningfully smaller or their residual size is justified and documented
- public wrappers remain stable:
  - [apps/mobile/features/email-capture/services/email-pipeline.ts](../apps/mobile/features/email-capture/services/email-pipeline.ts)
- tests continue to target boundary behavior rather than internal implementation details

### Slice 5: Turn on changed-file enforcement

Scope:

- fail CI/local tooling only when changed non-exempt files exceed `300` lines
- leave legacy untouched violations visible but non-blocking

Exit criteria:

- new code stops making the problem worse
- rollout friction stays low while backlog remains

Execution checklist:

- [ ] Add a `--changed-only` mode to the script.
- [ ] Decide whether changed-file enforcement belongs in `verify` or a separate presubmit command.
- [ ] Keep full-report mode available for cleanup tracking.

### Slice 6: Tighten to repo-wide non-exempt enforcement

Scope:

- once the hotspot backlog is reduced, fail on all non-exempt production files over `300`

Precondition:

- the current top mixed-responsibility files have been refactored
- remaining violations are mostly true exemptions or small cleanup work

Exit criteria:

- `300 LoC` is a real repo standard, not an aspirational rule

## First five implementation slices to execute

Recommended order:

1. Add the repo-level file-size script in report-only mode and keep it separate from the existing Lizard gate.
2. Split `management-service.ts` and `FinancialAccountFormScreen.tsx` as the first proof that file-size refactors improve cohesion.
3. Split `TransferFormScreen.tsx` and `GoalDetail.tsx` by UI/controller boundaries.
4. Move `transactions/store.ts`, `budget/store.ts`, and `email-capture/store.ts` async workflows into dedicated loader/mutation modules.
5. Tackle `create-email-pipeline-service.ts`, `notification-pipeline.ts`, and `mutations/index.ts` once the file-size signal is proven useful.

## Guardrails

- Do not split [apps/mobile/shared/db/schema.ts](../apps/mobile/shared/db/schema.ts) just to satisfy the policy.
- Do not treat [apps/mobile/app/_layout.tsx](../apps/mobile/app/_layout.tsx) as the same kind of problem as feature screens.
- Do not create generic dump files like `helpers.ts` or `utils.ts`.
- Do not extract UI pieces that remain private unless the split creates a clearer boundary.
- Do not add a hard failure before changed-file mode is in place.
- Do not exempt feature files unless there is a documented structural reason.

## Success metrics

- oversized non-exempt files trend down release over release
- no new non-exempt files over `300` lines land after changed-file enforcement
- the largest feature files become easier to test below UI/store boundaries
- PR review shifts from “this file is huge” to concrete behavior and design questions

## Recommended next action

Start with Slice 1 and the first half of Slice 2 together:

- add the reporting script first so the repo gets a current baseline
- then refactor [apps/mobile/features/financial-accounts/lib/management-service.ts](../apps/mobile/features/financial-accounts/lib/management-service.ts) and [apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx](../apps/mobile/features/financial-accounts/components/FinancialAccountFormScreen.tsx) as the first proof that the policy improves cohesion instead of duplicating the existing Lizard gate

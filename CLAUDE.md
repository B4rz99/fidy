## Agent Notes & Surprises

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in this CLAUDE.md file to help prevent future agents from having the same issue

## Committing Changes

Before committing, use the `committing-changes` skill.

## Tech Stack

This is a greenfield project called Fidy, so you are allowed to use any tool you think is best for solving the problem.

Tools already chosen:
- React Bits
- Zustand
- TanStack Query
- expo-sqlite + SQLCipher
- Drizzle ORM
- Zod
- date-fns
- expo-localization + i18n-js (i18n) — see `adding-i18n-strings` skill for conventions

## Code Style: Functional Programming

All code in the financial core (`lib/`, schemas, utils) MUST follow functional programming patterns. Infrastructure edges (stores, hooks, DB clients) are exempt where idiomatic React/Zustand patterns require it.

- No mutable variables (`let`, `var`) in pure logic — use `const` only
- No `.push()` accumulation — use `.map()`, `.filter()`, `.reduce()`, `Array.from()`
- No parameter reassignment — create new `const` bindings instead
- No `while`/`for` loops — use declarative alternatives or recursion
- Separate pure functions from side effects: pure logic in `lib/`, effects in stores/hooks
- Pure functions take all dependencies as parameters (no reaching into module state)

## Architectural Decisions

### Calendar-month budgets only
Budget periods are always calendar months (1st to last day). No custom periods. Reuse `deriveSpendingByCategory(month)` directly. Extend only if user research demands it.

### Non-nullable accountId with default account (Phase 3)
When multi-account (#9) ships, `accountId` on transactions must be NOT NULL with a default account. Do NOT add a nullable accountId column early. Phase 3 migration: (1) create `accounts` table with default account, (2) `ALTER TABLE transactions ADD COLUMN account_id TEXT NOT NULL DEFAULT '{default_id}'`, (3) backfill from source → bank mapping.

### Sync all new tables
Every new DB table that stores user data must integrate with the sync queue. Use the shared `enqueueSync(db, tableName, rowId, operation)` helper from `shared/db/enqueue-sync.ts`. Add ~S effort per feature for sync integration.

### On-device derivations for everything
All budget/goal/analytics computations run on-device using local SQLite. No new Edge Functions for derivations. Edge Functions are only for: (1) weekly digest scheduler (cron), (2) AI chat context extension.

### LIKE queries for search
Use `WHERE description LIKE '%term%'` for transaction search. No FTS5 unless profiling shows degradation beyond 50ms on 2K+ rows.

### SQL aggregation for analytics
Follow existing `getBalanceAggregate()` pattern in repository. Use SQL `GROUP BY` + `SUM` at the repository level. Never load all rows into JS for aggregation.

### Budget progress = pure derivation
`deriveBudgetProgress()` must be a pure function in `derive.ts`. Takes budget + transactions as params, returns progress. Memoize in store on transaction change. Consistent with FP mandate.

### Direct unit tests for pure functions
New derivation/pure functions get direct unit tests with fixture data. File-source reading pattern (`readFileSync` test pattern) stays for navigation/layout tests only.

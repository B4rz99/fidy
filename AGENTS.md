## Purpose

Keep this file lean. Add only repo-specific rules and surprises that save future agents real time. If something costs you time twice, add a short note here.

## Read First

## Workflow Surprises

- Vitest: do not use async `importOriginal` global mocks for heavy modules in `__tests__/setup.ts`; prefer sync or file-local mocks.
- Vitest: avoid heavy `await import(...)` inside `beforeEach`; prefer static imports or `beforeAll`.
- Bun workspace wrappers should use `bun run --cwd <dir> --shell=bun <script>`.
- Root single-file Bun tests should use `bun test ./path/to.test.ts`, not `bun test path/to.test.ts`.
- `bunx drizzle-kit generate` does not update `apps/mobile/drizzle/migrations.js`; add the new `m00xx` import/export manually.
- Run `bun run vault:doctor` before reading `.context/fidy-vault`; fresh workspaces may be missing the symlink.
- Shared Effect runners should use `Effect.runPromiseExit(...)` plus `Cause.squash(...)` so boundaries rethrow the original error.
- Tooling gap: lint prefers barrels, but some barrels such as `@/shared/db` and feature `index.ts` files can pull Expo/UI runtime into pure code. For pure modules, prefer narrow `*.public.ts` surfaces; for DB internals, use `shared/db/schema`, `shared/db/client`, or `shared/db/enqueue-sync` when needed.
- `apps/mobile/features/qa/index.ts` must lazy-load `start-local-qa-session`; eager re-exports pull Drizzle SQL into unrelated tests.
- Keep notification deep-link builders and route readers in sync; support both legacy params (`category`, `id`) and normalized params (`categoryId`, `goalId`) when needed.
- Lizard can overcount regex-heavy files and TypeScript overloads; verify hotspots manually before acting on the metric.

## External Vault

- Use `.context/fidy-vault` as the stable path to the external vault.
- Before vault ingest/query/lint work, run `bun run vault:doctor`.
- After that succeeds, read `.context/fidy-vault/AGENTS.md`.

## Testing

- Test the deepest module that owns the behavior; use boundary tests for orchestration.
- If coverage drops in a store or hook, extract a deeper seam before adding shallow tests.
- Async store tests using mutable refs such as `dbRef`, `userIdRef`, or selected ranges must cover stale completion, cross-user writes, and loading cleanup.
- Tests around `shared/mutations/write-through.ts` must prove transaction semantics; `AnyDb` doubles need `transaction()`.

## Code Style

- Financial-core `lib/`, schemas, and utils are pure/functional. Infrastructure edges may use idiomatic React or Zustand patterns.
- In pure logic: no `let`/`var`, no `.push()` accumulation, no parameter reassignment, no `for`/`while`; prefer `map`, `filter`, `reduce`, and explicit dependencies.
- Keep functions atomic: return results instead of mutating closure or module state. Stateful utilities belong outside `lib/`.
- Prefer inline derivation, keyed remounts, event handlers, `useMountEffect`, or TanStack Query before reaching for `useEffect`.
- Allowed `useEffect` cases: subscriptions with cleanup, Reanimated animations, and app bootstrap in `_layout.tsx`.
- Use branded IDs, dates, and money types from `shared/types/branded.ts`. New entities need a branded type, typed generator, and Drizzle `$type<>()`.
- Branded assertions stay at boundaries. UI code should not use direct `as UserId` / `as TransactionId` / `as IsoDate` assertions. `bun run lint:brands` enforces this.

## Architecture

- Budgets are calendar-month only.
- Multi-account: `transactions.accountId` becomes `NOT NULL` only in Phase 3, after creating accounts/default account and backfilling.
- Every new user-data table must enqueue sync via `enqueueSync(db, tableName, rowId, operation)`.
- Budget, goal, and analytics derivations run on-device in SQLite. New Edge Functions are only for weekly digest scheduling and AI chat context extension.
- Transaction search uses SQL `LIKE`; do not add FTS5 without profiling evidence.
- Analytics aggregation belongs in SQL, not JS.
- `deriveBudgetProgress()` stays pure.
- New pure derivations get direct unit tests; file-source tests are for navigation/layout cases only.

## Product Conventions

- Currency: COP, no decimals.
- All user-facing strings go through `useTranslation()`; see the `adding-i18n-strings` skill.
- Zustand stores live in `features/{feature}/stores/`.
- Navigation uses Expo Router; screens live in `app/`, modals are top-level routes.
- Use TanStack Query for server data and Zustand for local or derived state.

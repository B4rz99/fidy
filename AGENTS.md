## Workflow Surprises

- Vitest: do not use async `importOriginal` global mocks for heavy modules in `__tests__/setup.ts`; prefer sync or file-local mocks.
- Vitest: avoid heavy `await import(...)` inside `beforeEach`; prefer static imports or `beforeAll`.
- Bun workspace wrappers should use `bun run --cwd <dir> --shell=bun <script>`.
- Root single-file Bun tests should use `bun test ./path/to.test.ts`, not `bun test path/to.test.ts`.
- `bunx drizzle-kit generate` does not update `apps/mobile/drizzle/migrations.js`; add the new `m00xx` import/export manually.
- Shared Effect runners should use `Effect.runPromiseExit(...)` plus `Cause.squash(...)` so boundaries rethrow the original error.
- Tooling gap: lint prefers barrels, but some barrels such as `@/shared/db` and feature `index.ts` files can pull Expo/UI runtime into pure code. For pure modules, prefer narrow `*.public.ts` surfaces; for DB internals, use `shared/db/schema`, `shared/db/client`, or `shared/db/enqueue-sync` when needed.
- `apps/mobile/features/qa/index.ts` must lazy-load `start-local-qa-session`; eager re-exports pull Drizzle SQL into unrelated tests.
- Keep notification deep-link builders and route readers in sync; support both legacy params (`category`, `id`) and normalized params (`categoryId`, `goalId`) when needed.
- Lizard can overcount regex-heavy files and TypeScript overloads; verify hotspots manually before acting on the metric.
- Budgets are calendar-month only.

## Testing

- Test the deepest module that owns the behavior; use boundary tests for orchestration.
- If coverage drops in a store or hook, extract a deeper seam before adding shallow tests.
- Async store tests using mutable refs such as `dbRef`, `userIdRef`, or selected ranges must cover stale completion, cross-user writes, and loading cleanup.
- Tests around `shared/mutations/write-through.ts` must prove transaction semantics; `AnyDb` doubles need `transaction()`.

## Code Style

- Financial-core `lib/`, schemas, and utils are pure/functional. Pure logic lives in `lib/`; side effects stay in stores/hooks. Infrastructure edges may use idiomatic React or Zustand patterns.
- In pure logic: no `let`/`var`, no `.push()` accumulation, no parameter reassignment, no `for`/`while`; prefer `map`, `filter`, `reduce`, and explicit dependencies.
- Keep functions atomic: return results instead of mutating closure or module state. Stateful utilities belong outside `lib/`.
- Service exception: imperative loops are acceptable only for streaming or worker-pool I/O, and should include a comment explaining why.
- Prefer inline derivation, keyed remounts, event handlers, `useMountEffect`, or TanStack Query before reaching for `useEffect`.
- Allowed `useEffect` cases: subscriptions with cleanup, Reanimated animations, and app bootstrap in `_layout.tsx`.
- Use branded IDs, dates, and money types from `shared/types/branded.ts`. New entities need a branded type, typed generator, and Drizzle `$type<>()`.
- Branded assertions stay at boundaries. UI code should not use direct `as UserId` / `as TransactionId` / `as BillId` / `as CategoryId` / `as IsoDate` / `as IsoDateTime` assertions. If `bun run lint:brands` fails, move the proof into `shared/types/assertions.ts`, a trusted constructor such as `shared/lib/format-date.ts` or `shared/lib/generate-id.ts`, or a boundary module such as `schema.ts`, `data/`, `repository/`, or `features/auth/public.ts`.

## Architecture

- Financial source-of-truth architecture follows ADR-0007: Cloud Ledger records live behind the Remote API Boundary in the non-exposed `ledger` schema, while mobile keeps only local cache, projections, and encrypted pending outbox state.
- Transaction search uses SQL `LIKE`; do not add FTS5 without profiling evidence.
- `deriveBudgetProgress()` stays pure.
- New pure derivations get direct unit tests; file-source tests are for navigation/layout cases only.

## Product Conventions

- Currency: COP, no decimals.
- All user-facing strings go through `useTranslation()`; see the `adding-i18n-strings` skill.
- Zustand stores live in `features/{feature}/stores/`.
- Navigation uses Expo Router; screens live in `app/`, modals are top-level routes.
- Use TanStack Query for server data and Zustand for local or derived state.

## Feature Surface Conventions

- Cross-feature imports must go through explicit `*.public.ts` files. Do not import another feature’s `index.ts` or internal modules.
- Treat `public.ts` as non-UI by default: pure logic, schemas, repositories, services, and store-free APIs only.
- Put React components/screens in `ui.public.ts`, hooks in `hooks.public.ts`, and split mature features further by responsibility (`query.public.ts`, `store.public.ts`, `display.public.ts`, `write.public.ts`) when needed.
- Route files in `app/` should import feature screens/components from `ui.public.ts` or `routes.public.ts`, not from broad feature barrels.
- If multiple features depend on the same domain concept, move it to `shared/` instead of keeping one feature as the accidental owner.
- Feature startup belongs in `features/*/bootstrap.ts` and is composed through the bootstrap registry/authenticated shell, not added ad hoc in `_layout.tsx`.
- Keep broad public barrels narrow. If adding one export would pull UI or store code into pure consumers, create a new explicit surface instead.

## File Size Conventions

- Split by responsibility boundary, not by arbitrary chunks.
- Keep route files and public entrypoints thin. Screens in `app/` should usually re-export from `routes.public.ts`; large feature entry files should delegate to focused modules.
- For stores, keep the exported boundary thin and move pure Zustand state to `store/state.ts`; move async workflows, mappers, and side-effect orchestration into sibling modules or services.
- Avoid catch-all `utils.ts` buckets.

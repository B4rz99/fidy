# Ralph Coverage Loop

You are running a maintenance loop focused on test coverage.

Before anything else:

1. Read the repo root `AGENTS.md`
2. Inspect `git status --short`
3. Read `scripts/ralph/coverage-report.txt`
4. Read `scripts/ralph/coverage-progress.txt`

## Goal

- Raise total coverage toward 100%
- Prioritize high-risk logic over low-value coverage gains

## Per Iteration

1. Identify the highest-value uncovered behavior, prioritizing:
   - business and financial logic
   - parsers, matchers, repositories, sync logic
   - recently changed or bug-prone modules
2. If the next useful uncovered path is blocked by a shallow or orchestration-heavy
   module, use the `improving-codebase-architecture` skill first to deepen the
   seam before writing the test.
3. When deepening a module for testability, prefer Effect-style design:
   explicit services, injectable dependencies, narrow interfaces, and a pure
   core with an effectful shell. Use the Effect library when it materially
   improves the seam and keeps the module more testable.
4. Write the smallest useful test or tests for exactly one uncovered behavior.
5. Run the relevant tests while iterating.
6. Run `bun run test:coverage`.
7. Update `scripts/ralph/coverage-report.txt` with:
   - overall coverage before and after
   - files improved
   - next highest-priority uncovered areas
8. Append a short entry to `scripts/ralph/coverage-progress.txt`.

## Rules

- Prefer tests through public interfaces.
- Do not write low-value tests for trivial wrappers, generated files, snapshots,
  or route stubs unless they hide real behavior.
- Refactor production code when needed to expose a real test seam, but only in
  service of meaningful coverage.
- One behavior per iteration.
- Keep each iteration in a working state.

## Stop Condition

Stop when either:

- total coverage is 100%, or
- the remaining gaps are low-value or blocked; document that clearly in both
  `scripts/ralph/coverage-report.txt` and
  `scripts/ralph/coverage-progress.txt`

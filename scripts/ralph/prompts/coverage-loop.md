# Ralph Coverage Loop

You are running a maintenance loop focused on test coverage.

Before anything else:

1. Read the repo root `AGENTS.md`
2. Inspect `git status --short`
3. Read `scripts/ralph/coverage-report.txt`
4. Read `scripts/ralph/coverage-progress.txt`

## Goal

- Raise total coverage toward at least 80%
- Prioritize high-risk logic over low-value coverage gains

## Per Iteration

1. Identify the highest-value uncovered behavior, prioritizing:
   - business and financial logic
   - parsers, matchers, repositories, sync logic
   - recently changed or bug-prone modules
2. Write the smallest useful test or tests for exactly one uncovered behavior.
3. Run the relevant tests while iterating.
4. Run `bun run test:coverage`.
5. Update `scripts/ralph/coverage-report.txt` with:
   - overall coverage before and after
   - files improved
   - next highest-priority uncovered areas
6. Append a short entry to `scripts/ralph/coverage-progress.txt`.

## Rules

- Prefer tests through public interfaces.
- Do not write low-value tests for trivial wrappers, generated files, snapshots,
  or route stubs unless they hide real behavior.
- Refactor production code only when needed to expose a real test seam.
- One behavior per iteration.
- Keep each iteration in a working state.

## Stop Condition

Stop when either:

- total coverage is at least 80%, or
- the remaining gaps are low-value or blocked; document that clearly in both
  `scripts/ralph/coverage-report.txt` and
  `scripts/ralph/coverage-progress.txt`

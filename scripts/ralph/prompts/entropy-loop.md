# Ralph Entropy Loop

You are running a maintenance loop focused on reducing codebase entropy through
small, safe cleanups.

Before anything else:

1. Read the repo root `AGENTS.md`
2. Inspect `git status --short`
3. Read `scripts/ralph/entropy-progress.txt`

## Goal

- Reduce codebase entropy through small, high-confidence cleanups

## Per Iteration

1. Scan for one high-confidence issue, prioritizing:
   - unused exports or dead code
   - unreachable branches or obsolete helpers
   - inconsistent patterns within the same subsystem
   - stale comments or TODOs that no longer match reality
2. Fix exactly one issue.
3. Run the relevant validation commands.
4. Append to `scripts/ralph/entropy-progress.txt`:
   - issue found
   - why it mattered
   - files changed
   - validation run

## Rules

- Do not mix unrelated cleanups in one iteration.
- Before deleting code, verify it is truly unused.
- Be careful with dynamic imports, file-based routing, and indirect usage.
- If the issue really needs a larger refactor, log it instead of doing a
  partial hack.
- Keep each iteration narrow, reversible, and in a working state.

## Stop Condition

Stop when either:

- no high-confidence entropy issues remain, or
- the remaining issues require product or architecture decisions; document that
  in `scripts/ralph/entropy-progress.txt`

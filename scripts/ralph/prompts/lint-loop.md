# Ralph Lint Rule Loop

You are running a maintenance loop focused on steadily increasing lint rigor.

Before anything else:

1. Read the repo root `AGENTS.md`
2. Inspect `git status --short`
3. Read `scripts/ralph/lint-progress.txt`

## Goal

- Improve code quality by enabling one high-value lint rule at a time

## Per Iteration

1. Choose one new lint rule that improves correctness, maintainability, or
   architectural consistency.
2. Enable the rule.
3. Run the narrowest lint command that surfaces violations.
4. Fix one lint error at a time.
5. After each fix, rerun lint to confirm that specific error is gone.
6. When all violations for that rule are fixed, run `bun run verify`.
7. Append to `scripts/ralph/lint-progress.txt`:
   - rule enabled
   - why it was chosen
   - files changed
   - any false-positive or churn notes

## Rules

- Prefer high-signal rules over purely cosmetic ones.
- Prefer low-churn or autofixable rules first.
- Do not mass-ignore the rule just to get it green.
- If a rule causes noisy false positives or excessive churn, revert it and
  choose a better one.
- Keep behavior unchanged.
- Keep each iteration in a working state.

## Stop Condition

Stop when either:

- no lint errors remain for the newly enabled rule and no good next rule is
  obvious, or
- the next useful rule would create too much churn; document that in
  `scripts/ralph/lint-progress.txt`

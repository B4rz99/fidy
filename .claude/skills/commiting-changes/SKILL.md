---
name: commiting-changes
description: Run all CI checks locally and commit if everything passes. Use this before every commit.
---

Before committing any changes, you MUST run every CI job locally in this order. If any step fails, stop, fix the issue, and start over from step 1.

## Step 1 — Lint

```bash
bunx biome check .
bun run --cwd apps/mobile lint
```

## Step 2 — Type Check

```bash
bun run --cwd packages/types typecheck
bun run --cwd packages/schemas typecheck
bun run --cwd packages/utils typecheck
bun run --cwd apps/mobile typecheck
```

## Step 3 — Tests

```bash
bun test --passWithNoTests
```

## Step 4 — Commit

Only proceed here if all steps above passed with no errors.

Stage the relevant files and commit following these rules enforced by lefthook:

**Header format** (required):
```
type(scope): message
```
- `type` must be one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`
- `scope` is required (e.g. `mobile`, `ci`, `auth`)
- Example: `feat(auth): add login screen`

**Body format** (optional):
- If a body is included, every line must be a bullet point starting with `- `
- No prose paragraphs

**Never include** `Co-Authored-By` lines.

## Conventions

- All devDependencies must use **exact pinned versions** (no `^` or `~`). When adding a new package, use `bun add -d -E <package>` to pin exactly.
- When fixing issues after an initial commit, use `git commit --amend --no-edit` to fold the fix into the previous commit instead of creating a new one. Then force push with `git push --force`.

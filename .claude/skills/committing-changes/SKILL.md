---
name: committing-changes
description: Run all CI checks locally and commit if everything passes. Use this before every commit.
---

Before committing any changes, you MUST run every CI job locally in this order. If any step fails, stop, fix the issue, and start over from step 1.

## Step 0 — Pull Rebase

```bash
git pull --rebase --autostash origin main
```

Ensure your branch is up to date with the main branch before running checks or committing.

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
cd apps/mobile && npx vitest run
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
- **Keep the header short and high-level** (under 50 chars after the scope). No implementation details.
- Example: `ci(workflow): exclude main from CI triggers`

**Body format** (optional):
- If a body is included, every line must be a bullet point starting with `- `
- **Keep bullet points concise** — a few words each, no full sentences
- No prose paragraphs

**Never include** `Co-Authored-By` lines.

## Step 5 — Push

Always push after committing. Never create a pull request.

```bash
git push -u origin <branch-name>
```

## Conventions

- All devDependencies must use **exact pinned versions** (no `^` or `~`). When adding a new package, use `bun add -d -E <package>` to pin exactly.
- When fixing issues after a PR review, create a new commit (do not amend). This keeps the review history clear and avoids force pushes.

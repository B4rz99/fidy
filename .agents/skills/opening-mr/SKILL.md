---
name: opening-mr
description: Run all CI checks locally, commit, and open a PR. Use this before every commit.
---

Before committing any changes, you MUST run every step in this order. If any step fails, stop, fix the issue, and start over from step 1.

## Step 0 — Pull Rebase

```bash
git pull --rebase --autostash origin main
```

Ensure your branch is up to date with the main branch before running checks or committing.

## Step 1 — Code Review

Review the current changes against the plan and requirements before proceeding. If a dedicated review skill exists in the current environment, use it. Otherwise, perform the review directly and fix any Critical or Important issues before proceeding. Minor issues can be noted and skipped.

## Step 2 — Simplify

Use the `simplify` skill on all changed files when available. This reviews for code reuse, quality, and efficiency. Fix any issues it finds. If either step 1 or step 2 produced code changes, you must continue to step 3 to validate them.

## Step 3 — Security Review

Run a focused security review on all changed files. If a dedicated security-review skill exists in the current environment, use it. Otherwise, inspect the diff directly for secrets, trust-boundary mistakes, unsafe data handling, auth regressions, or risky side effects. Fix any Critical or Important issues found before proceeding.

## Step 4 — Lint

Run the project's lint command(s). Check `package.json` scripts, config files (biome, eslint, etc.), or CLAUDE.md for the correct commands.

## Step 5 — Type Check

Run the project's type-check command(s). Check `package.json` scripts or `tsconfig.json` for the correct commands. In monorepos, type-check all relevant packages.

## Step 6 — Tests

Run the project's test suite. Check `package.json` scripts or CLAUDE.md for the correct commands.

## Step 7 — Commit

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

## Step 8 — Push & PR

Push to the feature branch after committing. Main is protected — direct pushes are not allowed.

```bash
git push -u origin <branch-name>
```

Then create a pull request targeting `main`. The PR title and body **must match the commit message exactly** (header -> title, body -> description). Do NOT use `--fill` - it breaks with multiple commits.

PR body safety rules:
- Never pass PR body text directly inside shell quotes if it may contain backticks, command substitutions, or multi-line content
- Never paste raw terminal output into the PR body
- Never include absolute local paths like `/Users/...`, worktree paths, temp paths, or ANSI escape sequences
- Summarize verification results in plain language instead of dumping command output

Write the PR body to a temporary markdown file and pass it with `--body-file`:

```bash
TITLE=$(git log -1 --format=%s)
BODY=$(git log -1 --format=%b)
BODY_FILE=$(mktemp)
printf '%s\n' "$BODY" > "$BODY_FILE"
gh pr create --title "$TITLE" --body-file "$BODY_FILE"
rm -f "$BODY_FILE"
```

## Step 9 — Merge (only when the user explicitly asks)

**NEVER merge on your own.** Only run this step when the user tells you to merge.

Use squash merge so the merge commit on `main` matches the PR title and body:

```bash
PR_NUM=$(gh pr view --json number -q .number)
TITLE=$(gh pr view "$PR_NUM" --json title -q .title)
BODY=$(gh pr view "$PR_NUM" --json body -q .body)
gh pr merge "$PR_NUM" --squash --subject "$TITLE" --body "$BODY"
```

After merging, switch back to `main` and pull:

```bash
git checkout main && git pull
```

## Conventions

- All devDependencies must use **exact pinned versions** (no `^` or `~`).
- When fixing issues after a PR review, create a new commit (do not amend). This keeps the review history clear and avoids force pushes.

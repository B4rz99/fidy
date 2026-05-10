---
name: opening-pr
description: Sync with main, review the diff, commit, push, and open a PR. Use when the user asks to open a PR or when a task explicitly requires the repo's PR workflow.
---

Use this workflow when the user wants a PR opened. Keep it narrow: validate the current change, create the commit, push the branch, and open the PR. Do not merge unless the user asks in a separate step.

## Step 1 — Sync Branch

```bash
git pull --rebase --autostash origin main
```

Start from an up-to-date branch before verifying or committing.

## Step 2 — Review The Diff

Review the current diff before proceeding. Deploy multiple subagents in parallel, each focused on one review lens:

- perform a high-quality security review, including secrets, unsafe data handling, auth boundaries, privacy leaks, and injection risks
- perform a quality code review, including correctness, regressions, edge cases, error handling, naming, and missing tests
- simplify code by consolidating related logic where reuse would reduce duplication or clarify ownership
- check functional programming patterns, especially avoiding unnecessary mutation in pure modules
- check atomicity patterns, especially transaction boundaries, partial writes, stale completions, and cleanup on failure
- check purism patterns, especially side effects leaking into `lib/`, schemas, utilities, or other pure surfaces
- identify where Sentry logs or breadcrumbs are necessary for production diagnosability without adding noisy or sensitive logging

Synthesize the subagent findings before editing. Fix important issues before moving on, and do not defer findings that would make the PR unsafe, misleading, or difficult to review.

## Step 3 — Commit

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

## Step 4 — Push And Open The PR

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

---
name: opening-mr
description: Sync with main, run the required local checks, commit, push, and open a PR. Use when the user asks to open a PR or when a task explicitly requires the repo's PR workflow.
---

Use this workflow when the user wants a PR opened. Keep it narrow: validate the current change, create the commit, push the branch, and open the PR. Do not merge unless the user asks in a separate step.

If any verification step fails, fix the issue and rerun the relevant checks before committing.

## Step 1 — Sync Branch

```bash
git pull --rebase --autostash origin main
```

Start from an up-to-date branch before verifying or committing.

## Step 2 — Review The Diff

Review the current diff before proceeding. Focus on:

- correctness and regressions
- secrets or unsafe data handling
- whether the change matches the user request
- whether any required follow-up verification is missing

Fix important issues before moving on.

## Step 3 — Run Project Checks

Run the repo's required verification commands in the order the project expects. Determine the exact commands from `package.json`, lint/typecheck configs, and repo instructions such as `AGENTS.md` or `CLAUDE.md`.

- Run lint.
- Run typecheck.
- Run tests.
- Run any additional project-specific checks that are part of the normal local gate.

If a command fails because dependencies are missing, install or restore the expected local setup first, then rerun the sequence cleanly.

## Step 4 — Commit

Only commit after the required checks pass.

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

## Step 5 — Push And Open The PR

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

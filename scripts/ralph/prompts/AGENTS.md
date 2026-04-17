# Ralph Maintenance Instructions

You are running a Ralph maintenance loop, not a feature-story loop.

## Bootstrap

Before anything else:

1. Read the repo root `AGENTS.md`
2. Inspect `git status --short`
3. Read the maintenance prompt file passed to this run
4. Read the maintenance progress file passed to this run

## Scope

- Do not read or require `scripts/ralph/prd.json`
- Do not read or require `scripts/ralph/progress.txt`
- Do not expect a feature branch from PRD metadata
- Work only from the maintenance prompt and maintenance progress file for this run

## Workflow

1. Follow the maintenance prompt exactly
2. Keep each iteration scoped to one meaningful improvement
3. Run the narrowest useful validation while iterating
4. Leave the worktree in a working state
5. Append progress only to the maintenance progress file for this run

## Committing

After checks pass, create a local iteration commit only.

- Use a scoped header such as `chore(ralph): maintenance [topic]`
- Do not push
- Do not open or update a PR during the loop

## AGENTS Updates

If you discover durable, reusable knowledge, update the repo or nearby `AGENTS.md` files.
Do not add story-specific details or temporary debugging notes.

## Important

- Treat this as maintenance, not feature delivery
- Do not invent PRD work when none exists
- The maintenance prompt and its progress file are the source of truth for the run

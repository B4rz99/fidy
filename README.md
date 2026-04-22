# Fidy

Monorepo for the Fidy mobile app, landing site, shared packages, and Supabase functions.

## Codex Quickstart

1. Install dependencies with `bun install`.
2. Copy `.env.local.template` to `.env.local` and fill the Expo public values you need.
3. Run `bun run verify` before pushing changes.

Primary commands:

- `bun run mobile` starts the Expo app.
- `bun run landing` serves the static landing site.
- `bun run lint` runs root Biome checks.
- `bun run lint:complexity` runs the enforced Lizard gate (`CCN <= 5`, `NLOC <= 30`, `parameter_count <= 3`) against the checked-in zero-baseline ledger.
- `bun run lint:mobile` runs Expo ESLint for the mobile app.
- `bun run analyze:complexity:strict` runs the strict Lizard scan, writes reports to `.context/reports/lizard/strict/`, and checks them against the checked-in baseline.
- `bun run analyze:complexity:strict:update-ledger` rewrites the checked-in baseline ledger. In steady state this should remain zero and is maintenance-only.
- `bun run typecheck` builds shared packages and typechecks the workspace.
- `bun run test` runs the mobile Vitest suite.
- `bun run test:coverage` runs the mobile tests with coverage.
- `bun run verify` runs lint, mobile lint, typecheck, and tests in the same order used locally.

## Complexity Policy

This repo treats function complexity as a design constraint, not just a lint metric. The target is `CCN <= 5`, `NLOC <= 30`, and `parameter_count <= 3` because smaller branching surfaces, shorter functions, and narrower interfaces reduce cognitive load, improve testability, and force orchestration code into deeper modules instead of growing monolithic workflow functions. The guardrail is architectural: do not "fix" the metric with shallow wrapper extraction or generic option bags. Refactors should reduce responsibility per function and improve boundary design. The checked-in ledger is now a zero baseline, so rewriting it is a rare maintenance operation rather than part of normal development.

## Repo Layout

- `apps/mobile`: Expo / React Native app.
- `apps/landing`: Static landing site deployed to Vercel.
- `packages/*`: Shared workspace packages consumed by the app.
- `supabase/functions`: Edge Functions.

## Agent Guidance

- Architecture and code-style constraints live in [CLAUDE.md](./CLAUDE.md).
- Codex-specific assistant hooks live in `.codex/settings.json` and `.ai-hooks/`.
- Local knowledge stores and editor-specific agent folders are intentionally git-ignored.

## External Vault

Fidy's persistent knowledge vault lives outside this repo on the local machine.

- Stable workspace link: `.context/fidy-vault`
- Health check: `bun run vault:doctor`
- Print path: `bun run vault:path`
- Open in Finder: `bun run vault:open`

Agents doing research, ingest, or long-lived product documentation work should run `bun run vault:doctor` first, then read `.context/fidy-vault/AGENTS.md` and update the vault there instead of adding that material to the repo.

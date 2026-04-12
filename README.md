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
- `bun run lint:mobile` runs Expo ESLint for the mobile app.
- `bun run typecheck` builds shared packages and typechecks the workspace.
- `bun run test` runs the mobile Vitest suite.
- `bun run test:coverage` runs the mobile tests with coverage.
- `bun run verify` runs lint, mobile lint, typecheck, and tests in the same order used locally.

## Repo Layout

- `apps/mobile`: Expo / React Native app.
- `apps/landing`: Static landing site deployed to Vercel.
- `packages/*`: Shared workspace packages consumed by the app.
- `supabase/functions`: Edge Functions.

## Agent Guidance

- Architecture and code-style constraints live in [CLAUDE.md](./CLAUDE.md).
- Codex-specific security hooks live in `.codex/settings.json` and `.ai-security/`.
- Local knowledge stores and editor-specific agent folders are intentionally git-ignored.

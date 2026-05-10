# Fidy

Fidy is a fintech app for improving personal finances by reducing manual transaction tracking and making everyday financial decisions easier to understand.

The app is built around two product bets:

- **Automated transaction capture**: Fidy interprets digital transaction signals from sources such as emails, notifications, wallets, and payment surfaces so users do not have to record every expense by hand.
- **AI-assisted financial guidance**: Fidy can use task-scoped financial context to help users understand spending, budgets, goals, and next steps without turning their full financial history into a permanent cloud ledger.

## Why Fidy Exists

Most personal finance tools fail when recording transactions becomes a chore. Fidy aims to keep the user's financial record useful by making capture feel automatic, then turning that record into practical guidance.

Fidy is designed for people who want to:

- Keep a clearer record of their income, spending, accounts, budgets, and goals.
- Reduce the time spent manually entering digital transactions.
- Get help interpreting financial patterns and tradeoffs.
- Keep sensitive financial data local-first, with cloud processing used only for explicit tasks.

## Product Principles

- **The phone is the source of truth.** Financial records live in the on-device Local Ledger.
- **Capture should be explainable.** Transaction interpretation is based on Capture Evidence, not opaque guesses.
- **AI should assist, not silently decide.** AI can propose interpretations or guidance, while deterministic validation owns final saves.
- **Recovery should not require plaintext sync.** Remote recovery uses Encrypted Backups instead of storing readable financial records on Fidy servers.
- **Cloud AI is task-scoped.** When remote AI processing is needed, Fidy sends the minimum financial context needed for that task.

## Features

- Digital transaction capture from supported payment and notification surfaces.
- Local-first ledger for transactions, transfers, accounts, budgets, goals, and financial derivations.
- Capture evidence interpretation for turning raw signals into reviewable financial records.
- AI-assisted transaction interpretation and personal finance guidance.
- Private recovery through encrypted backups instead of plaintext financial sync.
- Mobile-first flows for everyday budgeting, goal tracking, and financial review.

## Stack

- **Mobile app**: Expo, React Native, Expo Router, React 19.
- **Local data**: Expo SQLite, Drizzle ORM, branded TypeScript domain types.
- **State and data fetching**: Zustand, TanStack Query, Effect.
- **Backend services**: Supabase Auth, Supabase Edge Functions, scoped remote APIs.
- **Styling and UI**: NativeWind, Tailwind CSS, Expo UI, React Native vector icons.
- **Observability and analytics**: Sentry and PostHog.
- **Tooling**: Bun workspaces, TypeScript, Vitest, Oxlint, Oxfmt, dependency-cruiser.

## What Is In This Repo

This is the Fidy monorepo. It contains the mobile app, landing site, shared packages, Supabase functions, and project automation.

- `apps/mobile`: Expo / React Native app.
- `apps/landing`: Static landing site deployed to Vercel.
- `packages/*`: Shared workspace packages consumed by the app.
- `supabase/functions`: Edge Functions.
- `docs/adr`: Architecture decisions for data privacy, capture evidence, recovery, and related product boundaries.

## Development Quickstart

1. Install dependencies with `bun install`.
2. Copy `.env.local.template` to `.env.local` and fill the Expo public values you need.
3. Run `bun run verify` before pushing changes.

Primary commands:

- `bun run mobile` starts the Expo app.
- `bun run mobile:ios` starts the Expo app on iOS.
- `bun run mobile:android` starts the Expo app on Android.
- `bun run landing` serves the static landing site.
- `bun run lint` runs root Oxlint checks.
- `bun run lint:mobile` runs Expo ESLint for the mobile app.
- `bun run lint:complexity` runs the enforced Lizard gate.
- `bun run typecheck` builds shared packages and typechecks the workspace.
- `bun run test` runs script and mobile test suites.
- `bun run test:coverage` runs the mobile tests with coverage.
- `bun run verify` runs the full local verification pipeline.

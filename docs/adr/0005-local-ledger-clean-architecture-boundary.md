# Local Ledger Clean Architecture boundary

Fidy will make `apps/mobile/local-ledger/**` the pure TypeScript application boundary for Local Ledger policy, with domain types, use cases, ports, and public surfaces for committed transactions, committed transfers, review candidates, processed source events, capture evidence linkage, and ledger snapshots. Infrastructure implementations live outside that boundary under `apps/mobile/infrastructure/local-ledger/**`; features such as manual transaction UI, email capture, notification capture, review queues, backup UX, budgets, goals, search, and activity feed depend inward on Local Ledger public surfaces instead of owning canonical ledger writes.

**Considered Options**

- Keep write policy inside feature repositories and expose more `*.public.ts` surfaces: lowest churn, but preserves accidental ownership where email, notifications, calendar, and transaction screens can bypass shared ledger invariants.
- Add interfaces inside each feature: improves testability locally, but does not create a single Local Ledger policy boundary and risks duplicating transaction/transfer rules.
- Create a top-level pure Local Ledger boundary with external infrastructure adapters: highest upfront refactor cost, but best matches Clean Architecture's dependency rule and protects business rules from UI, Zustand, Drizzle, Supabase, Expo, write-through, and capture-source details.

**Consequences**

`local-ledger/**` must not import `features/**`, `app/**`, `modules/**`, `shared/db`, Drizzle, React, React Native, Expo, Zustand, Supabase clients, analytics, logging, or broad runtime barrels. It may depend on shared branded primitives and narrow pure helpers. Local Ledger use cases use factory-created async ports for commits, policies, clock, and ID generation; they return typed results and domain events instead of UI strings, logs, store refreshes, or analytics calls. Dependency Cruiser enforces the architecture first; ESLint boundaries can be added later if deep imports become a problem.

The command side moves first. Canonical writes for transactions, transfers, transfer reclassification, review candidate creation/confirmation/dismissal, account attribution resolution, void/amend operations, and snapshot restore belong to Local Ledger use cases. Feature repositories may remain as read-model helpers temporarily, but canonical ledger writes move to Local Ledger infrastructure adapters. Because the app has not launched, SQLite schema and local migrations should be changed to match the clean domain model instead of carrying backward-compatibility shims; plaintext remote Supabase financial tables must not be reintroduced.

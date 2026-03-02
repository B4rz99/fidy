# 💸 Fintech App — Technical Specifications v5.0

> **Status:** Planning complete — ready for development
> **Last updated:** March 2026
> **Version:** 5.0

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [MVP Scope](#2-mvp-scope)
3. [Transaction Automation Architecture](#3-transaction-automation-architecture)
4. [Privacy Architecture](#4-privacy-architecture)
5. [Tech Stack](#5-tech-stack)
6. [Architectural Decisions](#6-architectural-decisions)
7. [Repository Architecture](#7-repository-architecture)
8. [Data Schema](#8-data-schema)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Monetization Model](#10-monetization-model)
11. [Development Roadmap](#11-development-roadmap)
12. [Critical Risks](#12-critical-risks)
13. [Open Source Strategy](#13-open-source-strategy)
14. [Pending Decisions](#14-pending-decisions)

---

## 1. Product Vision

Cross-platform mobile app (Android and iOS) that automates the tracking of financial transactions for Colombian users. Automatically captures income and expenses from bank emails (both platforms), bank push notifications (Android), and Apple Shortcuts + Apple Pay (iOS). Supplements with manual entry for cash transactions.

### Problem

- People have no real visibility into their daily financial behavior.
- Manual tracking is tedious — users abandon it.
- No affordable personal finance tracking tool exists in Colombia.
- 79% of transactions in Colombia are in cash — no tool consolidates them automatically.

### Value Proposition

- Full automation of transaction capture and categorization.
- Categories that learn from user behavior — no model retraining needed.
- Total privacy: the LLM runs 100% on the user's device.
- Future versions: budget tracking, debt management, credit scoring, and an AI financial advisor.

---

## 2. MVP Scope

The MVP has one single objective: **capture, categorize, and record the user's financial transactions automatically.** Nothing else. Every other feature goes to future versions.

**Success criterion:** the user installs the app, connects their Gmail, and within 5 minutes sees their latest bank transactions captured and categorized automatically — without doing anything else.

### What the MVP includes

| Feature | Description | Platform |
|---------|-------------|----------|
| Basic auth | Sign up / sign in via Supabase Auth (Google/Apple) | iOS + Android |
| Gmail + Outlook OAuth | Connect bank email for automatic capture | iOS + Android |
| Local LLM parsing | Qwen2.5 0.5B interprets each bank email and extracts structured JSON | iOS + Android |
| Automatic categorization | LLM categorizes in the same parsing pass. If confidence < 0.7, flagged for review. | iOS + Android |
| Manual category correction | Non-intrusive banner when opening the app with uncategorized transactions. One-tap correction. | iOS + Android |
| Merchant rules | When the user corrects a merchant, the rule is saved. Future transactions from that merchant are categorized without calling the LLM. | iOS + Android |
| Bank push notifications | NotificationListenerService captures push notifications in real time | Android |
| Apple Shortcuts + Pay | Native automation to capture Apple Pay payments | iOS |
| Deduplication | Same amount + date + merchant = duplicate, ignored | iOS + Android |
| Local storage | Encrypted SQLite via Drizzle ORM, validated with Zod | iOS + Android |
| Offline sync → Supabase | Sync queue that syncs when connection is available | iOS + Android |
| Transaction list | Minimal screen showing transactions with amount, date, and category icon | iOS + Android |

### What the MVP does NOT include

| Feature | Version |
|---------|---------|
| Dashboard with charts and analysis | V2 |
| Budget module and alerts | V2 |
| Debt tracking | V2 |
| AI personal advisor | V2 |
| Financial marketplace | V2 |
| Credit risk scoring | V3 |
| Statement PDFs (Nequi, Daviplata) | V2 |
| Active monetization (subscriptions) | V2 |

---

## 3. Transaction Automation Architecture

### Sources by platform

| Source | Android | iOS | Real-time | Coverage |
|--------|---------|-----|-----------|----------|
| Email OAuth (Gmail + Outlook) | ✅ Core | ✅ Core | Near real-time | Banks that send email per transaction |
| Bank push notifications | ✅ Primary | ❌ | ✅ Immediate | Any bank with installed app |
| Apple Shortcuts + Apple Pay | ❌ | ✅ Primary | ✅ Immediate | Payments via Apple Pay |
| Manual entry | ✅ Fallback | ✅ Fallback | ✅ Immediate | Cash and uncovered gaps |

### Full technical flow

| Step | Action | Where |
|------|--------|-------|
| 1 | User connects Gmail/Outlook via OAuth (once, during onboarding) | Device → Google/Microsoft |
| 2 | Gmail API filters only emails from known bank senders | Gmail API → Device |
| 3A | NotificationListenerService captures bank app notifications (Android) | Device |
| 3B | Apple Shortcuts triggers action when user pays with Apple Pay (iOS) | iOS Device |
| 4 | Check if merchant already has a saved merchant rule | Local SQLite |
| 5 | If no rule: Qwen2.5 0.5B parses and categorizes text locally | 100% on device |
| 6 | Zod validates the JSON — if LLM hallucinated a field, rejected before saving | Device |
| 7 | Valid transaction saved to SQLite (encrypted with SQLCipher) | Device |
| 8 | Deduplication: same amount + date + merchant → ignore | Device |
| 9 | If internet: immediate sync to Supabase via sync_queue | Device → Supabase |
| 10 | If no internet: stays in sync_queue until connection is restored | Device |

### LLM prompt — parsing + categorization in one pass

```
Analyze this bank message. Respond ONLY in JSON:
{
  "tipo": "gasto | ingreso | irrelevante",
  "monto": number,
  "comercio": string,
  "fecha": "YYYY-MM-DD",
  "medio": "credito | debito | transferencia | pse",
  "categoria": "comida | transporte | entretenimiento | salud |
                educacion | hogar | ropa | servicios | transferencia | otro",
  "confianza": number  // 0.0 to 1.0 — how confident you are about the category
}
If it is not a real transaction → { "tipo": "irrelevante" }
```

- **confidence >= 0.7** → categorized silently, user sees nothing.
- **confidence < 0.7** → saved with `necesita_revision: true`, appears in the review banner.

### Automatic categorization — merchant rules

Before calling the LLM, the app checks if the merchant already has a rule saved by the user. If it exists, it's applied directly and the LLM is not called for categorization. The app gets smarter with use at zero infrastructure cost.

```typescript
const categorizar = async (comercio: string): Promise<Categoria> => {
  // 1. Check local rule first (previous user correction)
  const regla = await db.select()
    .from(merchantRules)
    .where(eq(merchantRules.comercio, comercio))
    .get()

  if (regla) return regla.categoria  // LLM not called

  // 2. If no rule, LLM categorizes
  return await parsearConLLM(comercio)
}

// When saving a user correction:
await db.insert(merchantRules)
  .values({ comercio, categoria_id, origen: 'usuario' })
  .onConflictDoUpdate({ set: { categoria_id } })
```

### Manual correction flow — UX

| Step | What the user sees | What happens technically |
|------|-------------------|--------------------------|
| Transaction captured | Nothing — app does not interrupt | Saved with `necesita_revision: true` if confidence < 0.7 |
| Opens the app | Discreet banner at the top: *"3 transactions uncategorized — tap to review"* | SQLite query: transactions with `necesita_revision: true` |
| Taps the banner | Pending transactions one by one, merchant name visible, 8 category buttons | Review screen with only pending transactions |
| Selects a category | Card disappears with animation. Next one appears. | Saves to `transactions` + creates rule in `merchant_rules` |
| Finishes reviewing | Banner disappears from main screen | All transactions have `necesita_revision: false` |

**What the flow does NOT do:** push notifications (spam), modal that blocks the app on open (friction), free text to write the category (too much effort).

### Verified bank senders

| Bank / Wallet | Sender | Per-transaction email |
|--------------|--------|----------------------|
| Bancolombia | notificaciones@bancolombia.com.co | ⚠️ Verify |
| Nequi | nequi@bancolombia.com.co | ❌ Monthly statement only |
| Davivienda | alertas@davivienda.com | ⚠️ Verify |
| Daviplata | notificaciones@daviplata.com | ❌ Monthly statement only |
| BBVA | notificaciones@bbva.com.co | ⚠️ Verify |
| Banco de Bogotá | alertas@bancodebogota.com.co | ⚠️ Verify |
| Scotiabank Colpatria | alertas@colpatria.com | ⚠️ Verify |

> ⚠️ **CRITICAL PRE-DEVELOPMENT TASK:** Empirically verify that each bank sends an email per individual transaction before building the parser. This is the foundation of the entire MVP.

### Known MVP gaps

| Case | MVP solution | Future solution |
|------|-------------|-----------------|
| Cash payments (79% of the market) | Manual entry (3 taps max) | No technological solution — always manual |
| Nequi / Daviplata without per-transaction email | Manual entry | Monthly PDF statement in V2 |
| iOS transactions without Apple Pay | Email OAuth as fallback | Covers ~80% of the rest |
| Merchants with ambiguous names | Review banner + manual correction | Accumulated merchant rules |

---

## 4. Privacy Architecture

| Data | Leaves the device? | Goes to Supabase? |
|------|-------------------|-------------------|
| Full original email | ❌ Never | ❌ Never |
| Original notification text | ❌ Never | ❌ Never |
| Bank credentials | ❌ Never | ❌ Never |
| Gmail/Outlook OAuth token | Encrypted in expo-secure-store | ❌ Never |
| Transaction amount | Processed JSON only | ✅ Encrypted |
| Merchant / description | Processed JSON only | ✅ Encrypted |
| Assigned category | Processed JSON only | ✅ Yes |
| User merchant rules | Local | ✅ Synced |

**Core principle:** the LLM processes everything on the device. Only the resulting JSON — never the original content — leaves the device. The SQLite database is fully encrypted with SQLCipher.

---

## 5. Tech Stack

### Mobile and UI

| Tool | Role |
|------|------|
| Expo (React Native) | Cross-platform base framework (iOS + Android) |
| Expo Router | File-based navigation + deep linking for OAuth callbacks |
| TypeScript (strict) | Strict typing — mandatory in fintech |
| NativeWind | Tailwind CSS for React Native |
| React Bits | UI component library on top of NativeWind |

### State and data

| Tool | Role |
|------|------|
| Zustand | Local UI state |
| TanStack Query | HTTP requests, cache, and Supabase sync |
| expo-sqlite + SQLCipher | Encrypted local database on device |
| Drizzle ORM | Type-safe queries and automatic migrations for expo-sqlite |
| Zod | Validates LLM JSON output before saving to SQLite |
| date-fns | Date handling: ranges, groupings, deadlines |

### Backend and auth

| Tool | Role |
|------|------|
| Supabase | Auth + remote PostgreSQL + Realtime |
| Supabase CLI | Local instance for development |

### Local AI

| Tool | Role |
|------|------|
| Qwen2.5 0.5B (quantized) | Parsing + categorization model (~400MB, runs on mid-range devices) |
| react-native-llama.cpp | Runs GGUF models directly on the device, no internet required |

### Transaction automation

| Tool | Platform | Role |
|------|----------|------|
| Gmail OAuth | iOS + Android | Bank emails (readonly scope) |
| Outlook OAuth | iOS + Android | Alternative for Microsoft users |
| NotificationListenerService | Android | Bank push notifications in background |
| Apple Shortcuts + PassKit | iOS | Native automation for Apple Pay |
| expo-network | iOS + Android | Detects connectivity for sync |
| expo-task-manager + expo-background-fetch | Android | Capture with app closed in background |

### Security

| Tool | Role |
|------|------|
| expo-secure-store | OAuth tokens encrypted in device keychain |
| react-native-encrypted-storage | Additional sensitive data encryption |
| SQLCipher (via expo-sqlite) | Full SQLite database encryption |
| Snyk | Dependency vulnerability scanning on every PR |
| GitHub Secret Scanning | Detects accidentally exposed keys in the repo |

### Code quality and tooling

| Tool | Role |
|------|------|
| Biome | Linting + formatting. Replaces ESLint + Prettier. 25x faster. |
| Lefthook | Pre-commit git hooks |
| Bun | Runtime + package manager |
| Vitest | Unit tests: parser, deduplication, categorization, merchant rules, Zod |
| Sentry | Production error monitoring: crashes, LLM failures, sync failures |
| Cubic | AI code review on every PR + AI Wiki via MCP |

### CI/CD

| Tool | Role |
|------|------|
| GitHub Actions | Full pipeline |
| EAS Build | iOS + Android cloud compilation |
| EAS Submit | Automated deploy to stores |
| EAS Update | OTA updates without store review |

### MCPs — Claude Code (Tier 1 only)

| MCP | Role |
|-----|------|
| GitHub MCP | Manages repos, branches, commits, and PRs from Claude Code |
| Context7 | Injects up-to-date library documentation into the agent context |
| Supabase MCP | Creates tables, modifies schemas, runs queries in Supabase |
| Cubic AI Wiki MCP | Continuous codebase context between agentic development sessions |

> Additional MCPs will be evaluated and added as needed in future versions.

---

## 6. Architectural Decisions

### 6.1 Paradigm: Functional Programming

The entire codebase follows functional programming. This is not aesthetic preference — it is a direct consequence of the stack (React Native, hooks, Zustand, TanStack Query) and a quality requirement for a financial app where determinism and testability are critical.

| Principle | In practice |
|-----------|------------|
| Pure functions | Same input → always same output. No side effects. Parser, deduplication, categorization, and merchant rule lookup must all be pure. |
| Immutability | State is never mutated directly — it is replaced. Zustand and Drizzle already follow this pattern. |
| noParameterAssign | Mutating function parameters is forbidden. Enforced by Biome. |
| Isolated side effects | Supabase calls, SQLite writes, and LLM calls live exclusively in `services/`. The rest of the code is pure functions. |
| Composability | Small functions chained together: email → extractText → merchantRuleLookup → parseLLM → validateZod → deduplicate → save |

```typescript
// Correct — pure functions chained, side effects at the end
const procesarEmail = (raw: string): Result<Transaction> =>
  pipe(
    raw,
    extraerTexto,       // pure
    merchantRuleLookup, // side effect
    parsearConLLM,      // side effect
    validarConZod,      // pure
    deduplicar,         // pure
  )

// Side effect only at the end, when result is validated
const guardar = (t: Transaction): Promise<void> =>
  db.insert(transactions).values(t)
```

### 6.2 TypeScript — maximum configuration

`strict: true` is the starting point, not the destination. Additional flags are enabled beyond what `strict` includes — especially critical for a financial app where a silent `undefined` on an amount can have real consequences.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

| Flag | Why it matters in fintech |
|------|--------------------------|
| `noUncheckedIndexedAccess` | Without this, `transactions[0].monto` doesn't warn that it can be `undefined` if the array is empty. That silent crash on a financial calculation is unacceptable. |
| `noImplicitReturns` | A function that doesn't return in all code paths is a bug. TypeScript makes it a compilation error. |
| `exactOptionalPropertyTypes` | Differentiates between an absent field and a field set to `undefined`. In financial data, these are different cases. |
| `noUnusedLocals` / `Parameters` | Dead code confuses the AI agent. Eliminated at compile time. |

**Absolute rule — `any` is forbidden:**

```typescript
// Forbidden — turns TypeScript off completely
const parsear = (data: any) => data.monto

// Correct — unknown forces validation before use
const parsear = (data: unknown): Transaction =>
  TransactionSchema.parse(data)
```

When the type is genuinely unknown — like LLM output — use `unknown`, not `any`. Zod converts that `unknown` into a concrete, validated type before it reaches any other function.

### 6.3 Biome — strict functional rules

```json
{
  "linter": {
    "rules": {
      "correctness": { "recommended": true },
      "suspicious": { "recommended": true },
      "style": {
        "noVar": "error",
        "useConst": "error",
        "noParameterAssign": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      }
    }
  }
}
```

| Rule | What it enforces |
|------|-----------------|
| `noVar` | Eliminates `var` from the language. Only `const` and `let` with predictable scope. |
| `useConst` | Forces `const` as default. A variable that doesn't change reference must be `const`. |
| `noParameterAssign` | Forbids mutating function parameters — the most common and hardest-to-trace side effect. This is the rule that directly enforces functional programming. |
| `noExcessiveCognitiveComplexity` | An overly complex function is a signal it should be split. Keeps functions small, pure, and testable. |

### 6.4 Quality system in layers

Each layer catches what the previous one cannot see. The goal is that no bug reaches production because it was stopped at the earliest possible layer.

| Layer | Tool | What it catches | When it acts |
|-------|------|----------------|--------------|
| 1 — Typing | TypeScript strict + flags | Wrong types, unhandled `undefined`, dead code | While writing in the editor |
| 2 — Linting | Biome | Mutations, `var`, impure functions, excessive complexity | Pre-commit (Lefthook) |
| 3 — Runtime validation | Zod | Malformed external data: LLM output, API responses | At runtime, before saving to SQLite |
| 4 — Tests | Vitest | Incorrect behavior: parser, deduplication, categorization, merchant rules | Pre-commit and in CI/CD |
| 5 — Review | Cubic | Architecture issues, Vertical Slice violations | On every PR |
| 6 — Monitoring | Sentry | Errors that escaped all previous layers | In production, in real time |

---

## 7. Repository Architecture

### Monorepo with Bun Workspaces

```
/
├── apps/
│   ├── mobile/                   # Expo (React Native) app
│   └── landing/                  # Landing page (Astro or Next.js)
├── packages/
│   ├── types/                    # Shared TypeScript types
│   ├── schemas/                  # Shared Zod schemas
│   └── utils/                    # Shared utilities
├── biome.json                    # Linting config for the entire monorepo
├── lefthook.yml                  # Global git hooks
├── .github/workflows/            # CI/CD pipelines
└── package.json                  # Bun workspaces root
```

A single repo for all apps. Biome, Lefthook, TypeScript, and CI/CD are configured once for everything. When a web app is needed, it's added as a new workspace without touching anything else.

### Mobile App: Vertical Slice Architecture

Code is organized by feature — not by file type. Everything related to a feature lives in a single folder. Deleting a feature folder leaves nothing orphaned in the rest of the project.

**Golden rule:** a feature never imports directly from another feature. Cross-feature communication happens exclusively through `shared/` or Zustand.

```
apps/mobile/
│
├── app/                              # Expo Router — routes only, zero logic
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/
│   │   └── transactions.tsx          # MVP: only this screen
│   └── _layout.tsx
│
├── features/
│   │
│   ├── transactions/                 # Core MVP feature
│   │   ├── components/
│   │   │   ├── TransactionCard.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   ├── ManualEntryForm.tsx
│   │   │   └── UncategorizedBanner.tsx   # Review banner
│   │   ├── hooks/
│   │   │   ├── useTransactions.ts
│   │   │   ├── useDeduplication.ts
│   │   │   └── useMerchantRules.ts
│   │   ├── services/
│   │   │   ├── emailParser.ts            # Local LLM (Qwen2.5)
│   │   │   ├── categorizer.ts            # Merchant rule lookup + LLM
│   │   │   ├── notificationCapture.ts    # Android
│   │   │   └── appleShortcuts.ts         # iOS
│   │   ├── store.ts                      # Zustand slice
│   │   ├── schema.ts                     # Drizzle table + Zod validator
│   │   └── index.ts                      # Public exports
│   │
│   ├── sync/                         # Offline → Supabase sync
│   │   ├── hooks/
│   │   │   └── useSync.ts
│   │   ├── services/
│   │   │   ├── syncQueue.ts              # Processes sync_queue from SQLite
│   │   │   └── networkMonitor.ts         # expo-network
│   │   ├── schema.ts                     # Drizzle sync_queue table
│   │   └── index.ts
│   │
│   ├── auth/
│   │   ├── components/
│   │   │   └── OAuthButton.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   ├── gmailOAuth.ts
│   │   │   └── outlookOAuth.ts
│   │   ├── store.ts
│   │   └── index.ts
│   │
│   ├── dashboard/                    # V2 — empty placeholder
│   ├── budget/                       # V2 — empty placeholder
│   ├── debts/                        # V2 — empty placeholder
│   ├── advisor/                      # V2 — empty placeholder
│   └── marketplace/                  # V2 — empty placeholder
│
├── shared/                           # Only what is truly shared across features
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── LoadingSpinner.tsx
│   ├── hooks/
│   │   └── useSecureStorage.ts       # expo-secure-store
│   ├── db/
│   │   ├── client.ts                 # Drizzle + SQLCipher instance
│   │   └── migrations/               # Generated by Drizzle Kit
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── sentry.ts
│   │   └── llm.ts                    # Qwen2.5 / llama.cpp instance
│   └── constants/
│       ├── banks.ts                  # Verified bank email senders
│       └── categories.ts             # Categories with name, color, and icon
│
└── assets/
    ├── fonts/
    └── images/
```

V2 feature folders (`dashboard`, `budget`, `debts`, `advisor`, `marketplace`) are created empty from day one. This documents the future architecture and gives Claude Code context of the full roadmap from the first session.

---

## 8. Data Schema

### Local SQLite — primary source of truth

| Table | Key fields |
|-------|-----------|
| `transactions` | id, tipo, monto, comercio, fecha, medio, categoria_id, confianza_categoria, necesita_revision, fuente (email/notificacion/shortcuts/manual), sincronizado, created_at |
| `sync_queue` | id, operacion (insert/update/delete), payload (JSON), sincronizado, created_at |
| `categories` | id, nombre, color, icono |
| `merchant_rules` | comercio, categoria_id, origen (llm \| usuario), created_at |
| `email_sources` | id, proveedor (gmail/outlook), token_cifrado, ultimo_sync |

### Remote Supabase — anonymized data only

| Table | Fields |
|-------|--------|
| `transactions_sync` | id, user_id (uuid), tipo, monto, categoria, fecha, medio |
| `merchant_rules_sync` | user_id, comercio, categoria_id, origen |

### Offline sync strategy

- Local SQLite is always the primary source of truth.
- Every write to SQLite adds a record to `sync_queue` (sincronizado: false).
- `expo-network` detects internet connectivity.
- When connection is restored: processes `sync_queue` in FIFO order.
- Supabase confirms → marks sincronizado: true → cleans records older than 7 days.
- Conflicts: last write wins. No complex resolution in MVP.

---

## 9. CI/CD Pipeline

```
Push / PR
    ↓
Lefthook (pre-commit local) → Biome + TypeScript check
    ↓
GitHub Actions (trigger: push/PR)
    ↓
Biome → linting and formatting (fails fast in < 1 second)
    ↓
TypeScript strict → bun tsc --noEmit
    ↓
Vitest → parser, deduplication, categorization, merchant rules, Zod
    ↓
Snyk → dependency vulnerability scanning
    ↓
Cubic → AI review on every PR + updates codebase AI Wiki
    ↓
EAS Build → iOS + Android compilation (only on merge to main)
    ↓
EAS Submit → store deploy (only on release tags)
```

---

## 10. Monetization Model

| Phase | Users | Revenue streams |
|-------|-------|----------------|
| MVP (V1) | 0 – 10,000 | No monetization. Goal: validate retention. |
| V2 | 10,000 – 50,000 | AI advisor (~$15,900 COP/month) + Financial marketplace + Smart alerts + Credit scoring API (B2B) |
| V3 | +50,000 | Anonymized data B2B + Accountant API + Debt renegotiation + Parametric insurance |

### AI Personal Advisor — core differentiator (V2)

No bank or competitor has access to the user's real, consolidated spending history. The AI advisor has full financial context (multiple banks, wallets, and cash) and gives personalized recommendations in natural language. Price: ~$15,900 COP/month with 3 free queries/month.

### Financial Marketplace (V2)

Not a static catalog. The AI advisor detects the exact moment the user needs a financial product and recommends it with their real profile.

| Product | When recommended | Commission |
|---------|-----------------|------------|
| Consumer loans | Positive cash flow with a detected one-time need | 1–3% of approved amount |
| Credit cards | User pays in debit without using points/miles | ~$50–150k COP per activated card |
| CDs / investment funds | Idle balance in account for 30+ days | Commission per opening |
| Insurance | User with dependents and no detected life insurance | Monthly commission while active |
| Debt refinancing | Debt at >24% EA with profile for better rate | 1–2% of refinanced amount |

**What is NEVER for sale:** individually identifiable data, non-anonymized transactions, any data without explicit consent. Compliance with Ley 1581/2012 (Habeas Data) and Ley 1266/2008. Fines up to 2,000 SMMLV (~$2,500M COP) for violations.

---

## 11. Development Roadmap

| Sprint | Weeks | Deliverables |
|--------|-------|-------------|
| Sprint 1 | 1 – 2 | Monorepo setup + Expo + Supabase. Google/Apple auth. Base navigation. MCPs configured. Environment variables per environment. |
| Sprint 2 | 3 – 4 | Gmail + Outlook OAuth. Filter by known bank senders. Deep linking for OAuth callbacks. |
| Sprint 3 | 5 – 6 | Qwen2.5 + llama.cpp. Parsing + categorization prompt. Zod validation. JSON → SQLite via Drizzle. Define categories with color and icon. |
| Sprint 4 | 7 – 8 | Merchant rules: lookup + manual correction + review banner. NotificationListenerService + expo-task-manager (Android). Apple Shortcuts + PassKit (iOS). Deduplication. |
| Sprint 5 | 9 – 10 | Offline sync: sync_queue + expo-network. SQLCipher enabled. Sentry integrated. |
| Sprint 6 | 11 – 12 | Transaction list with category icons. Manual entry (3 taps). |
| Sprint 7 | 13 – 14 | QA on physical Android and iOS devices. Beta TestFlight + internal APK. |
| Sprint 8 | 15 – 16 | App Store and Google Play submission. Privacy Policy URL published. |

---

## 12. Critical Risks

| Risk | Prob. | Impact | Mitigation |
|------|-------|--------|------------|
| Banks don't send per-transaction emails | Medium | High | Verify empirically before Sprint 2. Fallback: Android push notifications. |
| Qwen2.5 miscategorizes ambiguous Colombian merchants | High | Low | Review banner + merchant rules correct the error. Low impact. |
| Qwen2.5 performance on low-end devices | Medium | Medium | Benchmark on real devices before Sprint 3. Fallback: Gemini Flash API. |
| Gmail API changes scope policy | Low | High | Outlook always active as alternative. |
| LLM hallucinates transaction data | Medium | High | Zod validates every JSON before saving. |
| NotificationListenerService blocked by Android manufacturer | Medium | Medium | Fallback to email OAuth. |
| Apple rejects app for missing privacy policy | High | High | Publish Privacy Policy URL before Sprint 8. |
| Cash not automatable (79% of market) | Certain | Medium | Permanent limitation. Streamlined manual entry: 3 taps max. |
| Nequi/Daviplata without per-transaction email | Certain | Medium | Manual in MVP. PDF statement in V2. |

---

## 13. Open Source Strategy

### What goes in the public repository

- All source code of the monorepo (mobile app + landing page).
- LLM prompts (parsing + categorization).
- SQLite and Supabase schema.
- CI/CD configuration (GitHub Actions) and MCPs.

### What NEVER goes in the repository

- `.env` with Supabase, Gmail OAuth, and Outlook OAuth keys.
- User tokens or session data.
- Any real transaction data.

### Mandatory configuration from day 1

- `.env` in `.gitignore` before the first commit.
- Supabase RLS (Row Level Security) enabled from the start.
- GitHub Secret Scanning enabled on the repository.
- Snyk in GitHub Actions from the first PR.

---

## 14. Pending Decisions

Items that must be resolved during development — not before.

| Item | Why it's critical | Sprint |
|------|-------------------|--------|
| Empirically verify bank emails | The entire MVP depends on this. If banks don't send individual emails, the strategy changes. | Before Sprint 2 |
| Deep Linking for OAuth callbacks | Without this, Gmail OAuth cannot complete the authorization flow. | Sprint 2 |
| Environment variables per environment | Separates local, staging, and production in EAS profiles. Without this, production is connected from development. | Sprint 1 |
| SQLCipher in app.json | Full SQLite encryption. One line of configuration that must be set from the start. | Sprint 1 |
| expo-task-manager configured | Without this, Android cannot capture notifications with the app closed in background. | Sprint 4 |
| Define initial categories with color and icon | The review screen needs them from Sprint 4. | Sprint 3 |
| Public Privacy Policy URL | Apple rejects financial apps without this URL. Blocks the entire deploy. | Before Sprint 8 |

---

*Living document — update on every product iteration.*

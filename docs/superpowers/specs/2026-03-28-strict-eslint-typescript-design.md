# Strict ESLint & TypeScript Configuration

## Goal

Make the ESLint and TypeScript configuration as strict as possible to build a bullet-proof, error-free app. Ban `useEffect` and `useLayoutEffect` from feature code entirely, forcing all effect patterns through approved shared hooks.

## TypeScript — Additional Strict Flags

Add to root `tsconfig.json` (inherited by all packages and `apps/mobile`):

| Flag | Purpose |
|---|---|
| `noUncheckedIndexedAccess` | Array/object index access returns `T \| undefined`, forcing null checks |
| `noFallthroughCasesInSwitch` | Prevents accidental switch case fallthrough |
| `forceConsistentCasingInFileNames` | Prevents import casing mismatches across platforms |
| `noImplicitReturns` | Errors when a code path doesn't return a value |

These are not included in `strict: true` and must be added explicitly.

## ESLint — Structure

### Dependencies

Install `typescript-eslint` (the unified ESLint 9 flat config package).

### Config layers (in order)

1. **Expo base** — existing `eslint-config-expo/flat`
2. **Type-aware parser** — `parserOptions.projectService: true` on all `.ts`/`.tsx`
3. **Strict rules** — all new rules at `"error"` level
4. **useEffect ban** — `no-restricted-imports` banning `useEffect`/`useLayoutEffect` from `react`, applied to all files except `shared/hooks/**` and `__tests__/**`
5. **Barrel import restrictions** — existing patterns, kept as-is
6. **Test overrides** — relax `any`-related rules in `__tests__/**`

### Type-aware rules

These require the TypeScript compiler and catch the most dangerous production bugs:

- `@typescript-eslint/no-floating-promises` — unawaited promises that silently fail
- `@typescript-eslint/no-misused-promises` — async functions passed where void is expected
- `@typescript-eslint/await-thenable` — `await` on a non-Promise
- `@typescript-eslint/no-unnecessary-condition` — dead code from always-truthy checks
- `@typescript-eslint/switch-exhaustiveness-check` — missing union variants in switch
- `@typescript-eslint/no-unsafe-assignment` — `any` silently assigned to typed variable
- `@typescript-eslint/no-unsafe-call` — calling an `any`-typed value
- `@typescript-eslint/no-unsafe-member-access` — property access on `any`
- `@typescript-eslint/no-unsafe-return` — returning `any` from typed function
- `@typescript-eslint/no-unsafe-argument` — passing `any` into typed parameter
- `@typescript-eslint/restrict-template-expressions` — `${anyValue}` in templates
- `@typescript-eslint/prefer-nullish-coalescing` — `||` fallback should be `??`
- `@typescript-eslint/no-unnecessary-type-assertion` — redundant `as Type` casts

### Syntax-only rules

- `@typescript-eslint/no-explicit-any` — ban typed `any` annotations
- `@typescript-eslint/no-non-null-assertion` — ban `value!` assertions
- `@typescript-eslint/prefer-optional-chain` — `a && a.b` should be `a?.b`
- `@typescript-eslint/consistent-type-imports` — force `import type` for type-only imports

### FP-mandate rules (align ESLint with CLAUDE.md)

- `no-param-reassign` — ban mutating function parameters
- `prefer-const` — ban `let` that's never reassigned
- `no-var` — ban `var` declarations (upgrade existing warn to error)

### React rules

- `react-hooks/exhaustive-deps` — upgrade from warn to error

## useEffect / useLayoutEffect Ban

### Mechanism

Use `no-restricted-imports` with `paths` to ban importing `useEffect` and `useLayoutEffect` from `react`. Applied to all `.ts`/`.tsx` files except `shared/hooks/**` and `__tests__/**`.

Error message: *"Use approved hooks from @/shared/hooks instead (useSubscription, useMountEffect, useBlinkingCursor, useAnimatedProgress)"*

### Shared hooks to create

These live in `shared/hooks/` and are the only files allowed to use `useEffect` internally:

1. **`useBlinkingCursor`** — Reanimated cursor blink animation. Replaces 5 duplicate `useEffect` + `withRepeat`/`withSequence` patterns in GoalEditSheet, GoalCreateSheet, AddPaymentSheet, add.tsx, create-budget.tsx.

2. **`useAnimatedProgress`** — Reanimated progress bar animation. Replaces 3 duplicate `useEffect` + `withTiming` patterns in ProgressBar, EmailProgressCard.

3. **`useSubscription`** — Generic subscription wrapper with cleanup. Takes a subscribe function that returns an unsubscribe function. Replaces patterns in useSync, useEmailCapture, useSmsDetection, useNotificationCapture, useApplePayCapture, ChatInput keyboard listeners, and _layout.tsx notification listeners.

### Migration of existing useEffect usages (24 total)

| Category | Count | Replacement |
|---|---|---|
| Animation (Reanimated) | 10 | `useBlinkingCursor`, `useAnimatedProgress` |
| Subscription/Listener | 7 | `useSubscription` |
| Mount-only init | 5 | `useMountEffect` (already exists) |
| State sync / derived | 3 | Derive inline, `useMemo`, or store selector |
| Navigation side effect | 1 | Move to store middleware |

**Specific migration plan:**

- **GoalEditSheet, GoalCreateSheet, AddPaymentSheet, add.tsx, create-budget.tsx** — Replace cursor blink `useEffect` with `useBlinkingCursor()`
- **ProgressBar, EmailProgressCard** — Replace progress animation `useEffect` with `useAnimatedProgress(value)`
- **EmailProgressCard completion** — Extract to `useCompletionAnimation` in shared/hooks
- **connected-accounts.tsx** — Extract syncing dot animation to `useAnimatedOpacity` or inline in `useAnimatedProgress`
- **useSync, useEmailCapture, useSmsDetection, useNotificationCapture, useApplePayCapture** — Refactor to use `useSubscription` for AppState/platform listeners
- **ChatInput** — Extract keyboard listeners to `useKeyboardVisibility` using `useSubscription`
- **_layout.tsx notifications** — Extract to `useNotificationSetup` using `useSubscription`
- **_layout.tsx store init** — Replace with `useMountEffect` with guard
- **_layout.tsx splash screen** — Replace with `useMountEffect`
- **_layout.tsx onboarding check** — Derive from session selector, remove state duplication
- **_layout.tsx routing** — Keep as `useMountEffect` with guard (Expo Router layout bootstrap)
- **onboarding.tsx (2 effects)** — Replace with `useMountEffect`
- **SearchScreen (2 effects)** — Replace with `useMountEffect` + cleanup return
- **SyncProgressStep** — Replace with `useMountEffect` with guard
- **GoalDetail milestone** — Move milestone-crossing logic to derived selector in store
- **BudgetListScreen** — Move permission navigation to store middleware or `useMountEffect`

## Test file overrides

Tests get relaxed rules for mock-heavy patterns:

- `@typescript-eslint/no-explicit-any` → `warn`
- `@typescript-eslint/no-unsafe-*` family → `off`
- `@typescript-eslint/no-non-null-assertion` → `off`
- `useEffect`/`useLayoutEffect` ban → `off`

All other strict rules remain `error` in tests (floating promises, exhaustive switches, etc.).

## Biome

No changes. Biome handles formatting and its own lint rules; ESLint handles type-aware and React-specific linting. No overlap to resolve.

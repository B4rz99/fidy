# Strict ESLint & TypeScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ESLint and TypeScript as strict as possible, ban useEffect/useLayoutEffect from feature code, and fix all existing violations.

**Architecture:** Add strict TS compiler flags to root tsconfig. Install `typescript-eslint` for type-aware linting. Add strict rules to ESLint flat config. Create shared hooks (`useBlinkingCursor`, `useAnimatedProgress`, `useSubscription`) in `shared/hooks/`. Migrate all 24 `useEffect` usages to approved hooks. Fix all remaining lint violations.

**Tech Stack:** TypeScript 5.x, ESLint 9 (flat config), typescript-eslint, react-native-reanimated

---

### Task 1: Add strict TypeScript compiler flags

**Files:**
- Modify: `tsconfig.json`
- Modify: `apps/mobile/tsconfig.json`

- [ ] **Step 1: Add strict flags to root tsconfig**

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "target": "ESNext",
    "module": "ESNext",
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitReturns": true
  },
  "references": [
    { "path": "./packages/assets" },
    { "path": "./packages/types" },
    { "path": "./packages/schemas" },
    { "path": "./packages/utils" }
  ]
}
```

- [ ] **Step 2: Add strict flags to mobile tsconfig**

The mobile tsconfig extends `expo/tsconfig.base` which doesn't include these flags. Add them explicitly:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": [],
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitReturns": true,
    "paths": {
      "@/*": ["./*"],
      "@fidy/types": ["../../packages/types/src/index.ts"],
      "@fidy/schemas": ["../../packages/schemas/src/index.ts"],
      "@fidy/utils": ["../../packages/utils/src/index.ts"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts",
    "modules/**/*.ts"
  ]
}
```

- [ ] **Step 3: Run typecheck to find violations**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | head -100`

Fix all type errors caused by the new flags. The most common will be `noUncheckedIndexedAccess` requiring null checks on array/object index access (e.g., `arr[0]` → `arr[0] ?? defaultValue` or `if (arr[0] != null)`).

- [ ] **Step 4: Run typecheck to verify clean**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json apps/mobile/tsconfig.json
# Also add any source files fixed for type errors
git commit -m "build(typescript): add strict compiler flags beyond strict:true"
```

---

### Task 2: Install typescript-eslint and configure type-aware ESLint

**Files:**
- Modify: `apps/mobile/package.json` (install dep)
- Modify: `apps/mobile/eslint.config.js`

- [ ] **Step 1: Install typescript-eslint**

Run: `cd apps/mobile && npm install --save-dev typescript-eslint`

- [ ] **Step 2: Rewrite eslint.config.js with strict rules and useEffect ban**

Replace `apps/mobile/eslint.config.js` with this full config:

```javascript
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tseslint = require("typescript-eslint");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },

  // ── Type-aware parser setup ──────────────────────────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  },

  // ── Strict rules (all TS files) ─────────────────────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // — Type-aware rules (highest value) —
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",

      // — Syntax-only rules —
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // — FP-mandate rules (align with CLAUDE.md) —
      "no-param-reassign": "error",
      "prefer-const": "error",
      "no-var": "error",

      // — React rules —
      "react-hooks/exhaustive-deps": "error",
    },
  },

  // ── useEffect / useLayoutEffect ban (feature code only) ─────────────
  // Allowed ONLY in shared/hooks/** (where approved wrappers live)
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["shared/hooks/**", "__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useEffect", "useLayoutEffect"],
              message:
                "useEffect/useLayoutEffect are banned. Use approved hooks from @/shared/hooks instead (useMountEffect, useSubscription, useBlinkingCursor, useAnimatedProgress).",
            },
          ],
          patterns: [
            {
              group: ["@/features/*/lib/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/components/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/hooks/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/store"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/schema"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/services/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/shared/lib/*"],
              message: "Import from @/shared/lib barrel instead",
            },
            {
              group: ["@/shared/hooks/*"],
              message: "Import from @/shared/hooks barrel instead",
            },
            {
              group: ["@/shared/db/*"],
              message: "Import from @/shared/db barrel instead",
            },
            {
              group: [
                "@/shared/components/*",
                "!@/shared/components/rn",
                "!@/shared/components/icons",
              ],
              message:
                "Import from @/shared/components barrel, @/shared/components/rn, or @/shared/components/icons instead",
            },
            {
              // "react-native" pattern also matches @sentry/react-native — exclude it
              group: ["react-native", "!@sentry/*"],
              message: "Import from @/shared/components/rn instead",
            },
            {
              group: ["lucide-react-native"],
              message: "Import from @/shared/components/icons instead",
            },
          ],
        },
      ],
    },
  },

  // ── Barrel import restrictions for shared/hooks/** and modules/** ───
  // These files are exempt from the useEffect ban but still need barrel restrictions
  {
    files: ["shared/hooks/**/*.ts", "shared/hooks/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/lib/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/components/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/hooks/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/store"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/schema"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/features/*/services/*"],
              message: "Import from @/features/<name> barrel instead",
            },
            {
              group: ["@/shared/lib/*"],
              message: "Import from @/shared/lib barrel instead",
            },
            {
              group: ["@/shared/db/*"],
              message: "Import from @/shared/db barrel instead",
            },
            {
              group: [
                "@/shared/components/*",
                "!@/shared/components/rn",
                "!@/shared/components/icons",
              ],
              message:
                "Import from @/shared/components barrel, @/shared/components/rn, or @/shared/components/icons instead",
            },
            {
              group: ["react-native", "!@sentry/*"],
              message: "Import from @/shared/components/rn instead",
            },
            {
              group: ["lucide-react-native"],
              message: "Import from @/shared/components/icons instead",
            },
          ],
        },
      ],
    },
  },

  // ── Exemptions for rn.ts, icons.ts, and native modules ──────────────
  {
    files: [
      "shared/components/rn.ts",
      "shared/components/icons.ts",
      "modules/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // ── Test file overrides ─────────────────────────────────────────────
  {
    files: ["__tests__/**/*.ts", "__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "no-restricted-imports": "off",
    },
  },
]);
```

- [ ] **Step 3: Verify the config loads without errors**

Run: `cd apps/mobile && npx eslint --print-config app/_layout.tsx | head -20`
Expected: Config object printed without parse errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/eslint.config.js apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "build(eslint): add type-aware strict rules and useEffect ban"
```

---

### Task 3: Create useBlinkingCursor shared hook

**Files:**
- Create: `apps/mobile/shared/hooks/use-blinking-cursor.ts`
- Modify: `apps/mobile/shared/hooks/index.ts`

- [ ] **Step 1: Create the hook**

Create `apps/mobile/shared/hooks/use-blinking-cursor.ts`:

```typescript
import { useEffect } from "react";
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Returns a Reanimated animated style that blinks opacity on/off at ~1Hz.
 * Use for text-cursor indicators in amount-input screens.
 */
export function useBlinkingCursor(): {
  cursorOpacity: SharedValue<number>;
  cursorStyle: { opacity: number };
} {
  const cursorOpacity = useSharedValue(1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: animation runs once on mount
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: 530 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 530 })
      ),
      -1
    );
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return { cursorOpacity, cursorStyle };
}
```

- [ ] **Step 2: Export from barrel**

Add to `apps/mobile/shared/hooks/index.ts`:

```typescript
export { useBlinkingCursor } from "./use-blinking-cursor";
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/shared/hooks/use-blinking-cursor.ts apps/mobile/shared/hooks/index.ts
git commit -m "feat(hooks): add useBlinkingCursor shared hook"
```

---

### Task 4: Create useAnimatedProgress shared hook

**Files:**
- Create: `apps/mobile/shared/hooks/use-animated-progress.ts`
- Modify: `apps/mobile/shared/hooks/index.ts`

- [ ] **Step 1: Create the hook**

Create `apps/mobile/shared/hooks/use-animated-progress.ts`:

```typescript
import { useEffect } from "react";
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * Returns an animated style with a width percentage driven by `value` (0–1).
 * Use for progress bars that animate smoothly on value change.
 */
export function useAnimatedProgress(
  value: number,
  duration = 600
): {
  progress: SharedValue<number>;
  animatedStyle: { width: string };
} {
  const progress = useSharedValue(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: value drives the animation
  useEffect(() => {
    progress.value = withTiming(value, { duration });
  }, [value, progress, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return { progress, animatedStyle };
}
```

- [ ] **Step 2: Export from barrel**

Add to `apps/mobile/shared/hooks/index.ts`:

```typescript
export { useAnimatedProgress } from "./use-animated-progress";
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/shared/hooks/use-animated-progress.ts apps/mobile/shared/hooks/index.ts
git commit -m "feat(hooks): add useAnimatedProgress shared hook"
```

---

### Task 5: Create useSubscription shared hook

**Files:**
- Create: `apps/mobile/shared/hooks/use-subscription.ts`
- Modify: `apps/mobile/shared/hooks/index.ts`

- [ ] **Step 1: Create the hook**

Create `apps/mobile/shared/hooks/use-subscription.ts`:

```typescript
import { useEffect } from "react";

/**
 * Manages a subscription lifecycle — calls `subscribe` when deps are met,
 * and runs the returned cleanup function on unmount or dep change.
 *
 * Handles the common async-setup pattern where setup returns a teardown
 * function, but the component may unmount before setup completes.
 *
 * @param subscribe — Called when `enabled` is true. Return a cleanup function or void.
 *   May return a Promise<cleanup> for async setup patterns.
 * @param deps — React dependency array for re-subscribing.
 * @param enabled — Guard condition; subscription only runs when true. Defaults to true.
 */
export function useSubscription(
  subscribe: () => void | (() => void) | Promise<() => void>,
  deps: ReadonlyArray<unknown>,
  enabled = true
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: caller controls deps
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let syncCleanup: (() => void) | undefined;

    const result = subscribe();

    if (result instanceof Promise) {
      result
        .then((teardown) => {
          if (cancelled) {
            teardown();
          } else {
            syncCleanup = teardown;
          }
        })
        .catch(() => {
          // Subscriber is responsible for its own error handling.
          // Swallow here to prevent unhandled rejection.
        });
    } else if (typeof result === "function") {
      syncCleanup = result;
    }

    return () => {
      cancelled = true;
      syncCleanup?.();
    };
  }, [enabled, ...deps]);
}
```

- [ ] **Step 2: Export from barrel**

Add to `apps/mobile/shared/hooks/index.ts`:

```typescript
export { useSubscription } from "./use-subscription";
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/shared/hooks/use-subscription.ts apps/mobile/shared/hooks/index.ts
git commit -m "feat(hooks): add useSubscription shared hook"
```

---

### Task 6: Migrate cursor blink useEffects (5 files)

**Files:**
- Modify: `apps/mobile/features/goals/components/GoalEditSheet.tsx`
- Modify: `apps/mobile/features/goals/components/GoalCreateSheet.tsx`
- Modify: `apps/mobile/features/goals/components/AddPaymentSheet.tsx`
- Modify: `apps/mobile/app/(tabs)/add.tsx`
- Modify: `apps/mobile/app/create-budget.tsx`

All five files have the identical pattern. For each file:

- [ ] **Step 1: Replace useEffect import and cursor code in GoalEditSheet.tsx**

Remove `useEffect` from the react import. Remove `useSharedValue`, `withRepeat`, `withSequence`, `withTiming` from the reanimated import if they're only used for the cursor. Add `useBlinkingCursor` import.

Replace:
```typescript
const cursorOpacity = useSharedValue(1);
useEffect(() => {
  cursorOpacity.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(1, { duration: 530 }),
      withTiming(0, { duration: 0 }),
      withTiming(0, { duration: 530 })
    ),
    -1
  );
}, [cursorOpacity]);
const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOpacity.value }));
```

With:
```typescript
const { cursorStyle } = useBlinkingCursor();
```

Import: `import { useBlinkingCursor } from "@/shared/hooks";`

- [ ] **Step 2: Apply same replacement in GoalCreateSheet.tsx**

Same pattern as Step 1. Remove `useEffect` from react import, remove unused reanimated imports, replace cursor block with `const { cursorStyle } = useBlinkingCursor();`.

- [ ] **Step 3: Apply same replacement in AddPaymentSheet.tsx**

Same pattern as Steps 1-2.

- [ ] **Step 4: Apply same replacement in app/(tabs)/add.tsx**

Same pattern. Note: this file may use `cursorOpacity` elsewhere — check before removing it from the destructured return. If only `cursorStyle` is used in JSX, use `const { cursorStyle } = useBlinkingCursor();`.

- [ ] **Step 5: Apply same replacement in app/create-budget.tsx**

Same pattern as Steps 1-4.

- [ ] **Step 6: Verify lint passes for all 5 files**

Run: `cd apps/mobile && npx eslint features/goals/components/GoalEditSheet.tsx features/goals/components/GoalCreateSheet.tsx features/goals/components/AddPaymentSheet.tsx app/\(tabs\)/add.tsx app/create-budget.tsx`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/features/goals/components/GoalEditSheet.tsx \
       apps/mobile/features/goals/components/GoalCreateSheet.tsx \
       apps/mobile/features/goals/components/AddPaymentSheet.tsx \
       apps/mobile/app/\(tabs\)/add.tsx \
       apps/mobile/app/create-budget.tsx
git commit -m "refactor(hooks): migrate cursor blink useEffects to useBlinkingCursor"
```

---

### Task 7: Migrate progress bar useEffects (2 files)

**Files:**
- Modify: `apps/mobile/features/budget/components/ProgressBar.tsx`
- Modify: `apps/mobile/features/email-capture/components/EmailProgressCard.tsx`

- [ ] **Step 1: Rewrite ProgressBar.tsx**

Replace the entire file with:

```typescript
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, View } from "@/shared/components/rn";
import { useAnimatedProgress, useThemeColor } from "@/shared/hooks";

type Props = {
  readonly percent: number; // 0-100+
  readonly height?: number;
};

export function ProgressBar({ percent, height = 8 }: Props) {
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");

  const { animatedStyle } = useAnimatedProgress(Math.min(percent, 100) / 100, 600);

  const barColor = percent >= 100 ? accentRed : accentGreen;

  return (
    <View style={[styles.track, { height, backgroundColor: borderColor }]}>
      <Animated.View style={[styles.fill, { height, backgroundColor: barColor }, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 4, overflow: "hidden" },
  fill: { borderRadius: 4 },
});
```

- [ ] **Step 2: Migrate EmailProgressCard.tsx progress bar useEffect**

In `EmailProgressCard.tsx`, replace the progress bar `useEffect`:

```typescript
useEffect(() => {
  barWidth.value = withTiming(display.fractionComplete, { duration: 300 });
}, [display.fractionComplete, barWidth]);
```

With `useAnimatedProgress`:
```typescript
const { animatedStyle: barAnimatedStyle } = useAnimatedProgress(display.fractionComplete, 300);
```

Then use `barAnimatedStyle` instead of manually creating the animated style from `barWidth`. Remove `useEffect` from the react import. The completion phase `useEffect` will be handled in Task 9 (it uses `useMountEffect` with guard).

- [ ] **Step 3: Verify lint passes**

Run: `cd apps/mobile && npx eslint features/budget/components/ProgressBar.tsx features/email-capture/components/EmailProgressCard.tsx`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/features/budget/components/ProgressBar.tsx \
       apps/mobile/features/email-capture/components/EmailProgressCard.tsx
git commit -m "refactor(hooks): migrate progress bar useEffects to useAnimatedProgress"
```

---

### Task 8: Migrate subscription/listener useEffects (5 hook files)

**Files:**
- Modify: `apps/mobile/features/sync/hooks/useSync.ts`
- Modify: `apps/mobile/features/email-capture/hooks/useEmailCapture.ts`
- Modify: `apps/mobile/features/capture-sources/hooks/useSmsDetection.ts`
- Modify: `apps/mobile/features/capture-sources/hooks/useNotificationCapture.ts`
- Modify: `apps/mobile/features/capture-sources/hooks/useApplePayCapture.ts`

These feature hooks live inside `features/*/hooks/` which is NOT in the `shared/hooks/` allowlist. They need to import `useSubscription` from `@/shared/hooks` instead of `useEffect` from `react`.

- [ ] **Step 1: Rewrite useSync.ts**

Replace `apps/mobile/features/sync/hooks/useSync.ts`:

```typescript
import { useRef, useState } from "react";
import { useTransactionStore } from "@/features/transactions";
import { AppState } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";
import { useSubscription } from "@/shared/hooks";
import { isOnline, onConnectivityChange } from "../services/networkMonitor";
import { fullSync } from "../services/syncEngine";
import { useSyncConflictStore } from "../store";

export function useSync(db: AnyDb | null, userId: string | null): boolean {
  const isSyncing = useRef(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  useSubscription(
    () => {
      if (!db || !userId) return;

      setInitialSyncDone(false);
      const supabase = getSupabase();
      const hasCompletedInitialRun = { current: false };

      const markInitialDone = () => {
        if (!hasCompletedInitialRun.current) {
          hasCompletedInitialRun.current = true;
          setInitialSyncDone(true);
        }
      };

      const runSync = async () => {
        if (isSyncing.current) return;
        const online = await isOnline();
        if (!online) return;
        isSyncing.current = true;
        try {
          const pullOk = await fullSync(db, supabase, userId);
          await useTransactionStore.getState().refresh();
          useSyncConflictStore.getState().loadConflicts();
          if (pullOk) markInitialDone();
        } catch (error) {
          captureWarning("background_sync_failed", {
            errorType: error instanceof Error ? error.message : "unknown",
          });
        } finally {
          isSyncing.current = false;
        }
      };

      void runSync();

      const appStateSubscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void runSync();
      });

      const unsubscribeNet = onConnectivityChange((connected) => {
        if (connected) void runSync();
      });

      return () => {
        appStateSubscription.remove();
        unsubscribeNet();
      };
    },
    [db, userId],
    db != null && userId != null
  );

  return initialSyncDone;
}
```

Note: The `void` keyword before `runSync()` satisfies `no-floating-promises`.

- [ ] **Step 2: Rewrite useEmailCapture.ts**

Replace `apps/mobile/features/email-capture/hooks/useEmailCapture.ts`:

```typescript
import { AppState } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { handleRecoverableError } from "@/shared/lib";
import { useSubscription } from "@/shared/hooks";
import { getGmailClientId, getOutlookClientId } from "../schema";
import { useEmailCaptureStore } from "../store";

export function useEmailCapture(db: AnyDb | null, userId: string | null) {
  useSubscription(
    () => {
      if (!db || !userId) return;

      useEmailCaptureStore.getState().initStore(db, userId);

      const runFetch = () => {
        useEmailCaptureStore
          .getState()
          .fetchAndProcess(getGmailClientId(), getOutlookClientId())
          .catch(handleRecoverableError("Email sync failed"));
      };

      useEmailCaptureStore
        .getState()
        .loadAccounts()
        .then(() => runFetch())
        .catch(handleRecoverableError("Email sync failed"));

      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") runFetch();
      });

      return () => {
        subscription.remove();
      };
    },
    [db, userId],
    db != null && userId != null
  );
}
```

- [ ] **Step 3: Rewrite useSmsDetection.ts**

Replace `apps/mobile/features/capture-sources/hooks/useSmsDetection.ts`:

```typescript
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import { useSubscription } from "@/shared/hooks";
import { useCaptureSourcesStore } from "../store";
import { setupSmsDetection } from "./setup";

export function useSmsDetection(db: AnyDb | null, userId: string | null) {
  const refreshDetectedSms = useCaptureSourcesStore((s) => s.refreshDetectedSms);

  useSubscription(
    () => {
      if (!db || !userId) return;
      return setupSmsDetection(db, userId, refreshDetectedSms).catch((error) => {
        captureError(error);
        return () => {}; // no-op teardown on error
      });
    },
    [db, userId, refreshDetectedSms],
    Platform.OS === "ios" && db != null && userId != null
  );
}
```

Note: `setupSmsDetection` returns `Promise<() => void>` — `useSubscription` handles the async teardown pattern natively.

- [ ] **Step 4: Rewrite useNotificationCapture.ts**

Replace `apps/mobile/features/capture-sources/hooks/useNotificationCapture.ts`:

```typescript
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import { useSubscription } from "@/shared/hooks";
import { useCaptureSourcesStore } from "../store";
import { setupNotificationCapture } from "./setup";

export function useNotificationCapture(db: AnyDb | null, userId: string | null) {
  const enabledPackages = useCaptureSourcesStore((s) => s.enabledPackages);

  useSubscription(
    () => {
      if (!db || !userId) return;
      return setupNotificationCapture(db, userId, enabledPackages).catch((error) => {
        captureError(error);
        return () => {}; // no-op teardown on error
      });
    },
    [db, userId, enabledPackages],
    Platform.OS === "android" && db != null && userId != null && enabledPackages.length > 0
  );
}
```

- [ ] **Step 5: Rewrite useApplePayCapture.ts**

Replace `apps/mobile/features/capture-sources/hooks/useApplePayCapture.ts`:

```typescript
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { setupApplePayCapture } from "./setup";

export function useApplePayCapture(db: AnyDb | null, userId: string | null) {
  useSubscription(
    () => {
      if (!db || !userId) return;
      return setupApplePayCapture(db, userId);
    },
    [db, userId],
    Platform.OS === "ios" && db != null && userId != null
  );
}
```

- [ ] **Step 6: Verify lint passes for all 5 files**

Run: `cd apps/mobile && npx eslint features/sync/hooks/useSync.ts features/email-capture/hooks/useEmailCapture.ts features/capture-sources/hooks/useSmsDetection.ts features/capture-sources/hooks/useNotificationCapture.ts features/capture-sources/hooks/useApplePayCapture.ts`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/features/sync/hooks/useSync.ts \
       apps/mobile/features/email-capture/hooks/useEmailCapture.ts \
       apps/mobile/features/capture-sources/hooks/useSmsDetection.ts \
       apps/mobile/features/capture-sources/hooks/useNotificationCapture.ts \
       apps/mobile/features/capture-sources/hooks/useApplePayCapture.ts
git commit -m "refactor(hooks): migrate subscription hooks to useSubscription"
```

---

### Task 9: Migrate remaining useEffects (app screens and components)

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/(auth)/onboarding.tsx`
- Modify: `apps/mobile/app/connected-accounts.tsx`
- Modify: `apps/mobile/features/search/components/SearchScreen.tsx`
- Modify: `apps/mobile/features/goals/components/GoalDetail.tsx`
- Modify: `apps/mobile/features/budget/components/BudgetListScreen.tsx`
- Modify: `apps/mobile/features/ai-chat/components/ChatInput.tsx`
- Modify: `apps/mobile/features/email-capture/components/EmailProgressCard.tsx`

- [ ] **Step 1: Migrate _layout.tsx — AuthenticatedShell**

In `AuthenticatedShell`, there are 3 `useEffect` calls:

**Effect 1 (store init, line 76):** Replace with `useMountEffect`-style guard. Since it depends on `migrationsReady`, use `useSubscription` with `enabled`:

```typescript
useSubscription(
  () => {
    useTransactionStore.getState().initStore(db, userId);
    useSearchStore.getState().initStore(db, userId);
    // ... all the store inits and loads (same code as current)
    registerBackgroundTask().catch(captureError);
  },
  [db, userId],
  migrationsReady
);
```

**Effect 2 (notifications, line 137):** Replace with `useSubscription`:

```typescript
useSubscription(
  () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    void registerPushToken(userId).catch(captureError);

    const tokenSub = Notifications.addPushTokenListener(() => {
      void registerPushToken(userId).catch(captureError);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const route = data?.route;
      if (typeof route === "string" && route.startsWith("/")) {
        router.push(route as Href);
      }
    });

    return () => {
      tokenSub.remove();
      responseSub.remove();
    };
  },
  [userId, router]
);
```

**Effect 3 (splash/migration error, line 167):** Replace with `useMountEffect`-style. Since it depends on `migrationsReady` and `migrationsError`, use `useSubscription` with enabled:

```typescript
useSubscription(
  () => {
    if (migrationsError) {
      captureError(migrationsError);
    }
    void SplashScreen.hideAsync();
  },
  [migrationsReady, migrationsError],
  migrationsReady || migrationsError != null
);
```

Remove `useEffect` from the react import in the file. Add `useSubscription` to the `@/shared/hooks` import.

- [ ] **Step 2: Migrate _layout.tsx — RootLayout**

In `RootLayout`, there are 3 `useEffect` calls:

**Effect 1 (onboarding re-check, line 205):** This is state sync that should be derived. Replace with a `useMemo` or inline derivation. The `setSentryUser` call is a side effect that belongs in an event handler. Move it:

```typescript
// Replace the useEffect with derived state
const onboardingComplete = useMemo(() => {
  if (session) {
    return getOnboardingCompleteFromStore() || isOnboardingComplete(session);
  }
  return false;
}, [session]);
```

Remove the `useState` for `onboardingComplete`. For `setSentryUser` and `clearOnboardingFromStore`, call them in a `useSubscription`:

```typescript
useSubscription(
  () => {
    setSentryUser(userId);
    if (!session) {
      clearOnboardingFromStore();
    }
  },
  [session, userId]
);
```

**Effect 2 (splash screen hide, line 218):** Replace with `useSubscription`:

```typescript
useSubscription(
  () => {
    if (!userId) {
      void SplashScreen.hideAsync();
    }
  },
  [fontsLoaded, fontsError, isAuthLoading, userId],
  (fontsLoaded || fontsError != null) && !isAuthLoading
);
```

**Effect 3 (routing, line 227):** Replace with `useSubscription`:

```typescript
useSubscription(
  () => {
    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = (segments as string[])[1] === "onboarding";

    if (!userId && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (userId && !onboardingComplete && !inOnboarding) {
      router.replace("/(auth)/onboarding");
    } else if (userId && onboardingComplete && inAuthGroup) {
      router.replace("/(tabs)/(index)" as never);
    }
  },
  [userId, segments, router, onboardingComplete],
  !isAuthLoading && (fontsLoaded || fontsError != null)
);
```

- [ ] **Step 3: Migrate onboarding.tsx**

Replace the two `useEffect` calls with `useMountEffect` or `useSubscription`:

**Effect 1 (store init, line 40):**
```typescript
useSubscription(
  () => {
    if (!db || !userId) return;
    useEmailCaptureStore.getState().initStore(db, userId);
    useTransactionStore.getState().initStore(db, userId as UserId);
    useBudgetStore.getState().initStore(db, userId as UserId);
    Promise.all([
      useEmailCaptureStore.getState().loadAccounts(),
      useTransactionStore.getState().loadInitialPage(),
    ])
      .catch(() => {})
      .finally(() => {
        setStoresReady(true);
      });
  },
  [db, userId],
  migrationsReady && db != null && userId != null && !storesReady
);
```

**Effect 2 (splash hide, line 57):**
```typescript
useSubscription(
  () => {
    void SplashScreen.hideAsync();
  },
  [],
  storesReady
);
```

Remove `useEffect` from the react import. Add `import { useSubscription } from "@/shared/hooks";`.

- [ ] **Step 4: Migrate connected-accounts.tsx**

Replace the syncing dot animation `useEffect` with a shared hook. Create `apps/mobile/shared/hooks/use-pulsing-opacity.ts`:

```typescript
import { useEffect } from "react";
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Returns an animated style that pulses opacity between `min` and 1 when `active`,
 * and animates back to 1 when inactive.
 */
export function usePulsingOpacity(
  active: boolean,
  min = 0.3,
  duration = 600
): {
  opacity: SharedValue<number>;
  pulsingStyle: { opacity: number };
} {
  const opacity = useSharedValue(1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: drives animation from active flag
  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(min, { duration }),
          withTiming(1, { duration })
        ),
        -1
      );
    } else {
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [active, opacity, min, duration]);

  const pulsingStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return { opacity, pulsingStyle };
}
```

Export from barrel: add `export { usePulsingOpacity } from "./use-pulsing-opacity";` to `shared/hooks/index.ts`.

In `connected-accounts.tsx`, replace:
```typescript
useEffect(() => {
  if (isSyncing) {
    dotOpacity.value = withRepeat(...);
  } else {
    dotOpacity.value = withTiming(1, { duration: 300 });
  }
}, [isSyncing, dotOpacity]);
```

With:
```typescript
const { pulsingStyle: dotStyle } = usePulsingOpacity(isSyncing);
```

Remove `useEffect` from react import, remove unused reanimated imports.

- [ ] **Step 5: Migrate SearchScreen.tsx**

Replace both `useEffect` calls with `useMountEffect`:

```typescript
import { useMountEffect } from "@/shared/hooks";

// Effect 1: defer until transition finishes
useMountEffect(() => {
  const handle = InteractionManager.runAfterInteractions(() => {
    setReady(true);
    executeSearch();
    inputRef.current?.focus();
  });
  return () => handle.cancel();
});

// Effect 2: cleanup on unmount
useMountEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    reset();
  };
});
```

Remove `useEffect` from the react import.

- [ ] **Step 6: Migrate GoalDetail.tsx milestone tracking**

The milestone-crossing `useEffect` watches `goalData` to detect percent changes. This is a legitimate subscription to derived store state. Replace with `useSubscription`:

```typescript
import { useSubscription } from "@/shared/hooks";

const prevPercentRef = useRef<number | null>(null);
useSubscription(
  () => {
    if (goalData == null) return;
    const currentPercent = goalData.progress.percentComplete;
    const prevPercent = prevPercentRef.current;
    if (prevPercent !== null && prevPercent !== currentPercent) {
      const crossed = checkMilestoneCrossed(prevPercent, currentPercent);
      if (crossed !== null) {
        setCelebrationMilestone(crossed);
      }
    }
    prevPercentRef.current = currentPercent;
  },
  [goalData],
  goalData != null
);
```

Remove `useEffect` from the react import.

- [ ] **Step 7: Migrate BudgetListScreen.tsx**

Replace with `useSubscription`:

```typescript
import { useSubscription } from "@/shared/hooks";

useSubscription(
  () => {
    clearPendingPermissionRequest();
    router.push("/enable-notifications");
  },
  [pendingPermissionRequest, clearPendingPermissionRequest, router],
  pendingPermissionRequest
);
```

Remove `useEffect` from the react import.

- [ ] **Step 8: Migrate ChatInput.tsx keyboard listeners**

Replace with `useSubscription`:

```typescript
import { useSubscription } from "@/shared/hooks";

useSubscription(
  () => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  },
  []
);
```

Remove `useEffect` from the react import.

- [ ] **Step 9: Migrate EmailProgressCard.tsx completion phase useEffect**

The completion phase `useEffect` (after the progress bar one was handled in Task 7) uses a timer. Replace with `useSubscription`:

```typescript
useSubscription(
  () => {
    const delay = shouldMorphToBanner(display.needsReview) ? MORPH_DELAY_MS : FADE_DELAY_MS;

    if (shouldMorphToBanner(display.needsReview)) {
      morphProgress.value = withTiming(1, { duration: 400 });
    }

    timerRef.current = setTimeout(onComplete, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  },
  [display.needsReview, onComplete, morphProgress],
  phase === "complete"
);
```

Remove `useEffect` from the react import.

- [ ] **Step 10: Verify lint passes for all modified files**

Run: `cd apps/mobile && npx eslint app/_layout.tsx app/\(auth\)/onboarding.tsx app/connected-accounts.tsx features/search/components/SearchScreen.tsx features/goals/components/GoalDetail.tsx features/budget/components/BudgetListScreen.tsx features/ai-chat/components/ChatInput.tsx features/email-capture/components/EmailProgressCard.tsx`
Expected: No errors.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/app/_layout.tsx \
       apps/mobile/app/\(auth\)/onboarding.tsx \
       apps/mobile/app/connected-accounts.tsx \
       apps/mobile/shared/hooks/use-pulsing-opacity.ts \
       apps/mobile/shared/hooks/index.ts \
       apps/mobile/features/search/components/SearchScreen.tsx \
       apps/mobile/features/goals/components/GoalDetail.tsx \
       apps/mobile/features/budget/components/BudgetListScreen.tsx \
       apps/mobile/features/ai-chat/components/ChatInput.tsx \
       apps/mobile/features/email-capture/components/EmailProgressCard.tsx
git commit -m "refactor(hooks): migrate remaining useEffects to approved hooks"
```

---

### Task 10: Fix all remaining ESLint violations

**Files:** Various — determined by running `npx eslint .`

- [ ] **Step 1: Run full lint to find all violations**

Run: `cd apps/mobile && npx eslint . --ext .ts,.tsx 2>&1 | head -200`

This will surface violations from the new rules: `no-floating-promises`, `no-explicit-any`, `prefer-const`, `no-param-reassign`, `consistent-type-imports`, `prefer-nullish-coalescing`, `prefer-optional-chain`, `no-unnecessary-condition`, etc.

- [ ] **Step 2: Auto-fix what can be auto-fixed**

Run: `cd apps/mobile && npx eslint . --ext .ts,.tsx --fix`

Many rules have auto-fixers: `consistent-type-imports`, `prefer-const`, `prefer-optional-chain`, `prefer-nullish-coalescing`, `no-unnecessary-type-assertion`.

- [ ] **Step 3: Manually fix remaining violations**

Common fixes:
- `no-floating-promises`: Add `void` before fire-and-forget promises, or `await` them
- `no-explicit-any`: Replace with proper types or `unknown`
- `no-param-reassign`: Create new `const` bindings instead of reassigning params
- `no-unnecessary-condition`: Remove dead checks or adjust types
- `restrict-template-expressions`: Add `.toString()` or type narrowing

- [ ] **Step 4: Run full lint to verify clean**

Run: `cd apps/mobile && npx eslint . --ext .ts,.tsx`
Expected: No errors.

- [ ] **Step 5: Run typecheck to verify nothing broke**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run tests to verify nothing broke**

Run: `cd apps/mobile && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix(lint): resolve all strict ESLint violations"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run full lint**

Run: `cd apps/mobile && npx eslint . --ext .ts,.tsx`
Expected: Clean — zero errors, zero warnings from new rules.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Run tests**

Run: `cd apps/mobile && npx vitest run`
Expected: All pass.

- [ ] **Step 4: Verify no useEffect imports remain outside shared/hooks**

Run: `cd apps/mobile && grep -rn "useEffect\|useLayoutEffect" --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v __tests__ | grep -v shared/hooks/`
Expected: No results (zero useEffect/useLayoutEffect imports outside allowed dirs).

- [ ] **Step 5: Commit any final fixes**

If any fixes were needed, commit them:
```bash
git add -A
git commit -m "fix(lint): final strict lint cleanup"
```

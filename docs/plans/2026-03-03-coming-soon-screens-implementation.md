# Coming Soon Screens Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add feature-specific "Coming Soon" screens to the AI and Goals tabs, replacing the current placeholder text.

**Architecture:** A single reusable `ComingSoonScreen` component in `shared/components/` accepts icon, title, headline, and description props. The current `wallet` tab gets renamed to `goals` (matching the Pencil design). Both `ai.tsx` and the new `goals.tsx` use the component with feature-specific content.

**Tech Stack:** React Native, NativeWind (Tailwind), lucide-react-native, Vitest (file-source testing pattern)

**Design Reference:** `docs/plans/2026-03-03-coming-soon-screens-design.md`

---

### Task 1: Add `title` font size and `Target` icon mock

The design calls for 18px headline text, but the current Tailwind scale jumps from `section` (16px) to `logo` (22px). Add the missing step. Also add the `Target` lucide icon to the test mock since it'll be needed for the Goals tab.

**Files:**
- Modify: `apps/mobile/tailwind.config.ts:30` (fontSize section)
- Modify: `apps/mobile/__tests__/setup.ts:21-46` (lucide mock)

**Step 1: Add `title` font size to tailwind config**

In `apps/mobile/tailwind.config.ts`, add `title` between `section` and `logo` in the `fontSize` object:

```typescript
section: ["16px", { lineHeight: "22px" }],
title: ["18px", { lineHeight: "24px" }],
logo: ["22px", { lineHeight: "28px" }],
```

**Step 2: Add `Target` to lucide mock**

In `apps/mobile/__tests__/setup.ts`, add `Target` to the lucide-react-native mock object (alphabetical order, after `Sparkles`):

```typescript
Sparkles: "Sparkles",
Target: "Target",
TrendingUp: "TrendingUp",
```

**Step 3: Run tests to verify nothing broke**

Run: `cd apps/mobile && npx vitest run`
Expected: All existing tests PASS

**Step 4: Commit**

```
feat(ui): add title font size and Target icon mock
```

---

### Task 2: Rename wallet tab to goals

The Pencil design shows "GOALS" with a target icon as the 4th tab. The code currently has "wallet". Rename everything to match.

**Files:**
- Rename: `apps/mobile/app/(tabs)/wallet.tsx` → `apps/mobile/app/(tabs)/goals.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx:22` (tab screen name)
- Modify: `apps/mobile/shared/components/navigation/tab-config.ts` (full rewrite)
- Modify: `apps/mobile/__tests__/navigation/tab-config.test.ts` (update wallet → goals)
- Modify: `apps/mobile/__tests__/navigation/tab-layout.test.ts:16-18` (update tab order)

**Step 1: Update tab-config tests first (TDD)**

Rewrite `apps/mobile/__tests__/navigation/tab-config.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { TAB_CONFIG } from "@/shared/components/navigation/tab-config";

describe("TAB_CONFIG", () => {
  test("includes index, ai, goals, and menu routes", () => {
    expect(TAB_CONFIG).toHaveProperty("index");
    expect(TAB_CONFIG).toHaveProperty("ai");
    expect(TAB_CONFIG).toHaveProperty("goals");
    expect(TAB_CONFIG).toHaveProperty("menu");
  });

  test("has exactly 4 routes", () => {
    expect(Object.keys(TAB_CONFIG)).toHaveLength(4);
  });

  test("does not include history route", () => {
    expect(TAB_CONFIG).not.toHaveProperty("history");
  });

  test("does not include wallet route", () => {
    expect(TAB_CONFIG).not.toHaveProperty("wallet");
  });

  test("has correct labels", () => {
    expect(TAB_CONFIG.index.label).toBe("HOME");
    expect(TAB_CONFIG.ai.label).toBe("AI");
    expect(TAB_CONFIG.goals.label).toBe("GOALS");
    expect(TAB_CONFIG.menu.label).toBe("MENU");
  });

  test("every entry has icon property", () => {
    for (const entry of Object.values(TAB_CONFIG)) {
      expect(entry).toHaveProperty("icon");
    }
  });
});
```

**Step 2: Update tab-layout test**

In `apps/mobile/__tests__/navigation/tab-layout.test.ts`, update line 16-18:

```typescript
  test("has correct tab order: index, ai, add, goals, menu", () => {
    const screens = Array.from(layoutSource.matchAll(/name="(\w+)"/g), (m) => m[1]);
    expect(screens).toEqual(["index", "ai", "add", "goals", "menu"]);
  });
```

**Step 3: Run tests to verify they fail**

Run: `cd apps/mobile && npx vitest run __tests__/navigation/`
Expected: FAIL — tab-config tests fail (wallet still exists), tab-layout test fails (wallet in order)

**Step 4: Rename wallet.tsx to goals.tsx**

```bash
cd apps/mobile && mv app/\(tabs\)/wallet.tsx app/\(tabs\)/goals.tsx
```

Then update `apps/mobile/app/(tabs)/goals.tsx`:

```typescript
import { Text, View } from "react-native";

export default function GoalsTab() {
  return (
    <View className="flex-1 items-center justify-center bg-page dark:bg-page-dark">
      <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
        Goals
      </Text>
    </View>
  );
}
```

**Step 5: Update tab-config.ts**

Rewrite `apps/mobile/shared/components/navigation/tab-config.ts`:

```typescript
import type { LucideIcon } from "lucide-react-native";
import { Home, Menu, Sparkles, Target } from "lucide-react-native";

export const TAB_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: Home, label: "HOME" },
  ai: { icon: Sparkles, label: "AI" },
  goals: { icon: Target, label: "GOALS" },
  menu: { icon: Menu, label: "MENU" },
};
```

**Step 6: Update _layout.tsx**

In `apps/mobile/app/(tabs)/_layout.tsx`, change line 22:

```typescript
        <Tabs.Screen name="goals" options={{ title: "Goals" }} />
```

(Replace the line with `name="wallet"`.)

**Step 7: Run tests to verify they pass**

Run: `cd apps/mobile && npx vitest run __tests__/navigation/`
Expected: All PASS

**Step 8: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors

**Step 9: Commit**

```
feat(nav): rename wallet tab to goals
```

---

### Task 3: Create ComingSoonScreen component

A reusable component that displays a feature-specific "coming soon" experience. Follows the existing empty state pattern from the Pencil designs.

**Files:**
- Create: `apps/mobile/shared/components/ComingSoonScreen.tsx`
- Create: `apps/mobile/__tests__/coming-soon/coming-soon-screen.test.ts`

**Step 1: Write the failing test**

Create `apps/mobile/__tests__/coming-soon/coming-soon-screen.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("ComingSoonScreen", () => {
  const source = readFileSync(
    resolve(__dirname, "../../shared/components/ComingSoonScreen.tsx"),
    "utf-8",
  );

  test("exports ComingSoonScreen as named export", () => {
    expect(source).toContain("export function ComingSoonScreen");
  });

  test("accepts Icon prop of type LucideIcon", () => {
    expect(source).toContain("Icon: LucideIcon");
  });

  test("accepts headerTitle, headline, and description string props", () => {
    expect(source).toContain("headerTitle: string");
    expect(source).toContain("headline: string");
    expect(source).toContain("description: string");
  });

  test("renders the headerTitle text", () => {
    expect(source).toContain("{headerTitle}");
  });

  test("renders the headline text", () => {
    expect(source).toContain("{headline}");
  });

  test("renders the description text", () => {
    expect(source).toContain("{description}");
  });

  test("renders COMING SOON pill text", () => {
    expect(source).toContain("COMING SOON");
  });

  test("uses Icon prop to render the icon", () => {
    expect(source).toContain("<Icon");
  });

  test("uses useThemeColor for icon color", () => {
    expect(source).toContain('useThemeColor("accentGreen")');
  });

  test("uses safe area insets for top padding", () => {
    expect(source).toContain("useSafeAreaInsets");
  });

  test("uses title font size for headline", () => {
    expect(source).toContain("text-title");
  });

  test("supports dark mode", () => {
    expect(source).toContain("dark:bg-page-dark");
    expect(source).toContain("dark:text-primary-dark");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx vitest run __tests__/coming-soon/`
Expected: FAIL — file not found

**Step 3: Implement the component**

Create `apps/mobile/shared/components/ComingSoonScreen.tsx`:

```tsx
import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

type ComingSoonScreenProps = {
  Icon: LucideIcon;
  headerTitle: string;
  headline: string;
  description: string;
};

export function ComingSoonScreen({
  Icon,
  headerTitle,
  headline,
  description,
}: ComingSoonScreenProps) {
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor("accentGreen");

  return (
    <View className="flex-1 bg-page dark:bg-page-dark" style={{ paddingTop: insets.top }}>
      <View className="px-5 pb-2">
        <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
          {headerTitle}
        </Text>
      </View>

      <View className="flex-1 items-center justify-center gap-4 px-5">
        <View style={{ opacity: 0.4 }}>
          <Icon size={64} color={iconColor} />
        </View>

        <Text className="text-center font-poppins-semibold text-title text-primary dark:text-primary-dark">
          {headline}
        </Text>

        <Text className="w-[280px] text-center font-poppins-medium text-body text-secondary dark:text-secondary-dark">
          {description}
        </Text>

        <View className="h-8 items-center justify-center rounded-full bg-accent-green px-4 dark:bg-accent-green-dark">
          <Text className="font-poppins-semibold text-caption tracking-wider text-white">
            COMING SOON
          </Text>
        </View>
      </View>
    </View>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx vitest run __tests__/coming-soon/`
Expected: All PASS

**Step 5: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```
feat(ui): add ComingSoonScreen component
```

---

### Task 4: Wire up AI tab with ComingSoonScreen

Replace the placeholder text in ai.tsx with the ComingSoonScreen component using AI-specific content.

**Files:**
- Modify: `apps/mobile/app/(tabs)/ai.tsx` (full rewrite)
- Create: `apps/mobile/__tests__/coming-soon/ai-tab.test.ts`

**Step 1: Write the failing test**

Create `apps/mobile/__tests__/coming-soon/ai-tab.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("AI tab", () => {
  const source = readFileSync(resolve(__dirname, "../../app/(tabs)/ai.tsx"), "utf-8");

  test("imports ComingSoonScreen", () => {
    expect(source).toContain("ComingSoonScreen");
  });

  test("imports Sparkles icon from lucide", () => {
    expect(source).toContain("Sparkles");
  });

  test("passes AI Advisor as headerTitle", () => {
    expect(source).toContain('headerTitle="AI Advisor"');
  });

  test("passes teaser headline", () => {
    expect(source).toContain('headline="Your AI Advisor is on its way"');
  });

  test("passes feature description", () => {
    expect(source).toContain("Smart insights about your spending");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx vitest run __tests__/coming-soon/ai-tab.test.ts`
Expected: FAIL — source doesn't contain ComingSoonScreen

**Step 3: Update ai.tsx**

Rewrite `apps/mobile/app/(tabs)/ai.tsx`:

```tsx
import { Sparkles } from "lucide-react-native";
import { ComingSoonScreen } from "@/shared/components/ComingSoonScreen";

export default function AiTab() {
  return (
    <ComingSoonScreen
      Icon={Sparkles}
      headerTitle="AI Advisor"
      headline="Your AI Advisor is on its way"
      description="Smart insights about your spending, budgets, and savings — powered by AI"
    />
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx vitest run __tests__/coming-soon/ai-tab.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat(ai): add coming soon screen to AI tab
```

---

### Task 5: Wire up Goals tab with ComingSoonScreen

Replace the placeholder text in goals.tsx with the ComingSoonScreen component using Goals-specific content.

**Files:**
- Modify: `apps/mobile/app/(tabs)/goals.tsx` (full rewrite)
- Create: `apps/mobile/__tests__/coming-soon/goals-tab.test.ts`

**Step 1: Write the failing test**

Create `apps/mobile/__tests__/coming-soon/goals-tab.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Goals tab", () => {
  const source = readFileSync(resolve(__dirname, "../../app/(tabs)/goals.tsx"), "utf-8");

  test("imports ComingSoonScreen", () => {
    expect(source).toContain("ComingSoonScreen");
  });

  test("imports Target icon from lucide", () => {
    expect(source).toContain("Target");
  });

  test("passes Goals as headerTitle", () => {
    expect(source).toContain('headerTitle="Goals"');
  });

  test("passes teaser headline", () => {
    expect(source).toContain('headline="Goals are on their way"');
  });

  test("passes feature description", () => {
    expect(source).toContain("Set savings targets");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx vitest run __tests__/coming-soon/goals-tab.test.ts`
Expected: FAIL — source doesn't contain ComingSoonScreen

**Step 3: Update goals.tsx**

Rewrite `apps/mobile/app/(tabs)/goals.tsx`:

```tsx
import { Target } from "lucide-react-native";
import { ComingSoonScreen } from "@/shared/components/ComingSoonScreen";

export default function GoalsTab() {
  return (
    <ComingSoonScreen
      Icon={Target}
      headerTitle="Goals"
      headline="Goals are on their way"
      description="Set savings targets, track your progress, and reach your financial goals"
    />
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npx vitest run __tests__/coming-soon/goals-tab.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat(goals): add coming soon screen to Goals tab
```

---

### Task 6: Final verification

Run the full test suite, typecheck, and lint to make sure nothing is broken.

**Step 1: Run all tests**

Run: `cd apps/mobile && npx vitest run`
Expected: All PASS

**Step 2: Run tests with coverage**

Run: `cd apps/mobile && npx vitest run --coverage`
Expected: Coverage thresholds met (80%+ on all metrics)

**Step 3: Run typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors

**Step 4: Run lint**

Run: `cd apps/mobile && npx expo lint`
Expected: No errors

**Step 5: Squash commit (if needed)**

If all checks pass, use the `committing-changes` skill for the final commit that combines all work:

```
feat(mobile): add coming soon screens for AI and Goals tabs (#7)
```

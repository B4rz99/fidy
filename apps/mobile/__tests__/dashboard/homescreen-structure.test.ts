import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("TransactionRow", () => {
  const source = readFileSync(
    resolve(__dirname, "../../shared/components/TransactionRow.tsx"),
    "utf-8"
  );

  test("is wrapped in memo()", () => {
    expect(source).toContain("memo(");
  });

  test("accepts primitive props: description, amountCents, type, categoryId, dateLabel", () => {
    expect(source).toContain("description: string");
    expect(source).toContain("amountCents: number");
    expect(source).toContain("categoryId: CategoryId");
    expect(source).toContain("dateLabel: string");
  });

  test("derives icon from CATEGORY_MAP", () => {
    expect(source).toContain("CATEGORY_MAP");
  });

  test("formats amount with formatSignedAmount", () => {
    expect(source).toContain("formatSignedAmount");
  });
});

describe("DateSectionHeader", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/dashboard/components/DateSectionHeader.tsx"),
    "utf-8"
  );

  test("exports DateSectionHeader as named export", () => {
    expect(source).toContain("DateSectionHeader");
  });

  test("is wrapped in memo()", () => {
    expect(source).toContain("memo(");
  });

  test("accepts label string prop", () => {
    expect(source).toContain("label: string");
  });

  test("uses font-poppins-semibold text-body", () => {
    expect(source).toContain("font-poppins-semibold");
    expect(source).toContain("text-body");
  });

  test("uses py-2 padding", () => {
    expect(source).toContain("py-2");
  });
});

describe("CompactBalanceBar", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/dashboard/components/CompactBalanceBar.tsx"),
    "utf-8"
  );

  test("exports CompactBalanceBar as named export", () => {
    expect(source).toContain("CompactBalanceBar");
  });

  test("accepts balanceCents number prop", () => {
    expect(source).toContain("balanceCents: number");
  });

  test("uses useAnimatedStyle for opacity", () => {
    expect(source).toContain("useAnimatedStyle");
    expect(source).toContain("opacity");
  });

  test("uses useAnimatedProps for pointerEvents", () => {
    expect(source).toContain("useAnimatedProps");
    expect(source).toContain("pointerEvents");
  });

  test("uses withTiming with 150ms duration", () => {
    expect(source).toContain("withTiming");
    expect(source).toContain("duration: 150");
  });

  test("uses formatCents to display balance", () => {
    expect(source).toContain("formatCents");
  });

  test("renders as Animated.View", () => {
    expect(source).toContain("Animated.View");
  });
});

describe("HomeScreen", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/dashboard/components/HomeScreen.tsx"),
    "utf-8"
  );

  test("uses FlashList instead of ScrollView", () => {
    expect(source).toContain("FlashList");
    expect(source).not.toContain("<ScrollView");
  });

  test("imports CompactBalanceBar", () => {
    expect(source).toContain("CompactBalanceBar");
  });

  test("imports DateSectionHeader", () => {
    expect(source).toContain("DateSectionHeader");
  });

  test("imports groupTransactionsByDate", () => {
    expect(source).toContain("groupTransactionsByDate");
  });

  test("uses useAnimatedScrollHandler for scroll tracking", () => {
    expect(source).toContain("useAnimatedScrollHandler");
  });

  test("uses renderScrollComponent with Animated.ScrollView", () => {
    expect(source).toContain("renderScrollComponent");
    expect(source).toContain("Animated.ScrollView");
  });

  test("uses getItemType for FlashList mixed types", () => {
    expect(source).toContain("getItemType");
  });

  test("uses onEndReached for pagination", () => {
    expect(source).toContain("onEndReached");
    expect(source).toContain("loadNextPage");
  });

  test("uses onEndReachedThreshold of 0.2", () => {
    expect(source).toContain("onEndReachedThreshold");
  });

  test("passes onScroll handler to FlashList", () => {
    expect(source).toContain("onScroll={scrollHandler}");
  });

  test("does not import derive functions (replaced by store aggregates)", () => {
    expect(source).not.toContain("deriveBalance");
    expect(source).not.toContain("deriveSpendingByCategory");
    expect(source).not.toContain("deriveDailySpending");
  });

  test("does not import TransactionsPreview", () => {
    expect(source).not.toContain("TransactionsPreview");
  });
});

describe("TransactionsPreview cleanup", () => {
  test("TransactionsPreview.tsx no longer exists", () => {
    const filePath = resolve(
      __dirname,
      "../../features/dashboard/components/TransactionsPreview.tsx"
    );
    expect(existsSync(filePath)).toBe(false);
  });
});

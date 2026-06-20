import { describe, expect, test } from "vitest";
import { deriveHomeSpendingCardModel } from "../../features/dashboard/components/home-screen/HomeSpendingCard.model";
import { CATEGORIES } from "../../shared/categories";
import type { CategoryId, CopAmount } from "../../shared/types/branded";

describe("home spending card model", () => {
  test("summarizes monthly spend with budget-based daily allowance guidance", () => {
    const model = deriveHomeSpendingCardModel({
      balance: 2_480_000,
      categories: CATEGORIES,
      monthlyBudget: 10_000_000,
      categorySpending: [
        { categoryId: "food" as CategoryId, total: 86_400 },
        { categoryId: "health" as CategoryId, total: 58_200 },
        { categoryId: "transfer" as CategoryId, total: 250_000 },
        { categoryId: "entertainment" as CategoryId, total: 105_300 },
      ],
      locale: "es",
      now: new Date(2026, 4, 19),
      t: (key, params) => {
        if (key === "dashboard.dailyPaceGuidance") {
          return `Puedes gastar hasta ${params?.amount} al día para mantenerte dentro de tu presupuesto.`;
        }
        throw new Error(`Unexpected key: ${key}`);
      },
    });

    expect(model.dateLabel).toBe("martes, 19 de mayo");
    expect(model.amountLabel).toBe("$2.480.000");
    expect(model.guidance).toBe(
      "Puedes gastar hasta $578.461 al día para mantenerte dentro de tu presupuesto."
    );
    expect(model.dailyPaceLabel).toBe("$578.461");
    expect(model.averageLabel).toBe("$130.526");
    expect(model.bars.map((bar) => bar.categoryId)).toEqual(["entertainment", "food", "health"]);
  });

  test("formats English dates without Spanish date glue", () => {
    const model = deriveHomeSpendingCardModel({
      balance: 930_000,
      categories: CATEGORIES,
      monthlyBudget: 2_000_000,
      categorySpending: [],
      locale: "en",
      now: new Date(2026, 4, 19),
      t: (_key, params) => `Spend up to ${params?.amount} per day to stay within budget.`,
    });

    expect(model.dateLabel).toBe("Tuesday, May 19");
    expect(model.guidance).toBe("Spend up to $82.307 per day to stay within budget.");
  });

  test("falls back to current spend average when the user has no monthly budget", () => {
    const model = deriveHomeSpendingCardModel({
      balance: 930_000,
      categories: CATEGORIES,
      monthlyBudget: 0,
      categorySpending: [],
      locale: "en",
      now: new Date(2026, 4, 19),
      t: (key, params) => {
        if (key === "dashboard.dailyPaceGuidance") {
          return `Spend up to ${params?.amount} per day to stay within budget.`;
        }
        if (key === "dashboard.noBudgetGuidance") {
          return `Set a monthly budget to see your daily spending limit. Current average: ${params?.amount}.`;
        }
        throw new Error(`Unexpected key: ${key}`);
      },
    });

    expect(model.guidance).toBe(
      "Set a monthly budget to see your daily spending limit. Current average: $48.947."
    );
    expect(model.dailyPaceLabel).toBe("$48.947");
  });

  test("shows custom categories with their emoji and color", () => {
    const customCategory = {
      id: "ucat-desserts" as CategoryId,
      label: { en: "Desserts", es: "Postres" },
      icon: "🧁",
      color: "#FF8BA7",
    };
    const model = deriveHomeSpendingCardModel({
      balance: 120_000,
      categories: [...CATEGORIES, customCategory],
      monthlyBudget: 0,
      categorySpending: [{ categoryId: "ucat-desserts" as CategoryId, total: 120_000 }],
      locale: "es",
      now: new Date(2026, 4, 19),
      t: (_key, params) => `Promedio: ${params?.amount}.`,
    });

    expect(model.bars).toEqual([
      expect.objectContaining({
        categoryId: "ucat-desserts",
        color: "#FF8BA7",
        icon: "🧁",
        label: "Postres",
      }),
    ]);
  });

  test("keeps every visible category sorted by highest spend", () => {
    const extraCategories = Array.from({ length: 9 }, (_, index) => ({
      id: `ucat-${index}` as CategoryId,
      label: { en: `Custom ${index}`, es: `Personalizada ${index}` },
      icon: "✨",
      color: "#A6D6F5",
    }));
    const model = deriveHomeSpendingCardModel({
      balance: 450_000,
      categories: [...CATEGORIES, ...extraCategories],
      monthlyBudget: 0,
      categorySpending: extraCategories.map((category, index) => ({
        categoryId: category.id,
        total: (10_000 * (index + 1)) as CopAmount,
      })),
      locale: "es",
      now: new Date(2026, 4, 19),
      t: (_key, params) => `Promedio: ${params?.amount}.`,
    });

    expect(model.bars).toHaveLength(9);
    expect(model.bars.map((bar) => bar.categoryId)).toEqual([
      "ucat-8",
      "ucat-7",
      "ucat-6",
      "ucat-5",
      "ucat-4",
      "ucat-3",
      "ucat-2",
      "ucat-1",
      "ucat-0",
    ]);
  });
});

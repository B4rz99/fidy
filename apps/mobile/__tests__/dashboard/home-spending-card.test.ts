import { describe, expect, test } from "vitest";
import { deriveHomeSpendingCardModel } from "../../features/dashboard/components/home-screen/HomeSpendingCard.model";

describe("home spending card model", () => {
  test("summarizes monthly spend with budget-based daily allowance guidance", () => {
    const model = deriveHomeSpendingCardModel({
      balance: 2_480_000,
      monthlyBudget: 10_000_000,
      categorySpending: [
        { categoryId: "food", total: 86_400 },
        { categoryId: "health", total: 58_200 },
        { categoryId: "transfer", total: 250_000 },
        { categoryId: "entertainment", total: 105_300 },
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
});

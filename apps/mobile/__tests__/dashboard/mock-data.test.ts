import { describe, expect, test } from "vitest";
import {
  balanceData,
  chartCategories,
  chartTotal,
  recentTransactions,
} from "@/features/dashboard/data/mock-data";
import { HEX_REGEX } from "../helpers/regex";

describe("chartCategories", () => {
  test("has 5 categories", () => {
    expect(chartCategories).toHaveLength(5);
  });

  test("percentages sum to 100", () => {
    const total = chartCategories.reduce((sum, c) => sum + c.percentage, 0);
    expect(total).toBe(100);
  });

  test("every category has required fields", () => {
    for (const cat of chartCategories) {
      expect(cat).toHaveProperty("name");
      expect(cat).toHaveProperty("amount");
      expect(cat).toHaveProperty("percentage");
      expect(cat).toHaveProperty("color");
    }
  });

  test("all colors are valid hex", () => {
    for (const cat of chartCategories) {
      expect(cat.color).toMatch(HEX_REGEX);
    }
  });
});

describe("balanceData", () => {
  test("has total, trend, and trendLabel", () => {
    expect(balanceData).toHaveProperty("total");
    expect(balanceData).toHaveProperty("trend");
    expect(balanceData).toHaveProperty("trendLabel");
  });

  test("total is a dollar string", () => {
    expect(balanceData.total).toMatch(/^\$/);
  });
});

describe("chartTotal", () => {
  test("is a dollar string", () => {
    expect(chartTotal).toMatch(/^\$/);
  });
});

describe("recentTransactions", () => {
  test("every transaction has required fields", () => {
    for (const tx of recentTransactions) {
      expect(tx).toHaveProperty("icon");
      expect(tx).toHaveProperty("name");
      expect(tx).toHaveProperty("date");
      expect(tx).toHaveProperty("amount");
      expect(tx).toHaveProperty("category");
      expect(typeof tx.isPositive).toBe("boolean");
    }
  });

  test("positive transactions have + amounts, negative have -", () => {
    for (const tx of recentTransactions) {
      if (tx.isPositive) {
        expect(tx.amount.startsWith("+")).toBe(true);
      } else {
        expect(tx.amount.startsWith("-")).toBe(true);
      }
    }
  });

  test("positive transactions have iconBgColor with light and dark", () => {
    const positive = recentTransactions.filter((tx) => tx.isPositive);
    for (const tx of positive) {
      expect(tx.iconBgColor).toBeDefined();
      expect(tx.iconBgColor).toHaveProperty("light");
      expect(tx.iconBgColor).toHaveProperty("dark");
    }
  });
});

import { describe, expect, it } from "vitest";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/lib/default-account";
import { buildLocalQaSeed } from "@/features/qa/lib/build-local-qa-seed";

describe("buildLocalQaSeed", () => {
  const now = new Date("2026-04-19T15:00:00.000Z");

  it("builds a default scenario with prior-month spending for budget suggestion QA", () => {
    const seed = buildLocalQaSeed("default", now);

    expect(seed.session.profile).toBe("default");
    expect(seed.session.userId).toBe("qa-local-default");
    expect(seed.financialAccounts).toEqual([
      expect.objectContaining({
        id: buildDefaultFinancialAccountId(seed.session.userId),
        isDefault: true,
        name: "Cash",
      }),
    ]);
    expect(seed.transactions).toHaveLength(2);
    expect(seed.transactions).toEqual([
      expect.objectContaining({
        amount: 280_000,
        categoryId: "food",
        date: "2026-03-12",
        description: "Prior month groceries",
        type: "expense",
      }),
      expect.objectContaining({
        amount: 96_000,
        categoryId: "transport",
        date: "2026-03-12",
        description: "Prior month rides",
        type: "expense",
      }),
    ]);
    expect(seed.transfers).toEqual([]);
  });

  it("builds an empty scenario with no local financial data and onboarding incomplete", () => {
    const seed = buildLocalQaSeed("empty", now);

    expect(seed.session.profile).toBe("empty");
    expect(seed.session.userId).toBe("qa-local-empty");
    expect(seed.session.onboardingComplete).toBe(false);
    expect(seed.financialAccounts).toEqual([]);
    expect(seed.transactions).toEqual([]);
    expect(seed.transfers).toEqual([]);
  });

  it("builds a two-account scenario without seeded activity", () => {
    const seed = buildLocalQaSeed("two-accounts", now);

    expect(seed.session.profile).toBe("two-accounts");
    expect(seed.financialAccounts).toHaveLength(2);
    expect(seed.financialAccounts.map((account) => account.name)).toEqual(["Cash", "Bancolombia"]);
    expect(seed.transactions).toEqual([]);
    expect(seed.transfers).toEqual([]);
  });

  it("builds a transfer-conflict scenario with two tracked accounts and no prior activity", () => {
    const seed = buildLocalQaSeed("transfer-conflict", now);

    expect(seed.session.profile).toBe("transfer-conflict");
    expect(seed.session.userId).toBe("qa-local-transfer-conflict");
    expect(seed.financialAccounts).toHaveLength(2);
    expect(seed.transactions).toEqual([]);
    expect(seed.transfers).toEqual([]);
  });

  it("builds a transfer-ready scenario with tracked accounts and seeded activity", () => {
    const seed = buildLocalQaSeed("transfer-ready", now);

    expect(seed.session.profile).toBe("transfer-ready");
    expect(seed.session.userId).toBe("qa-local-transfer-ready");
    expect(seed.financialAccounts).toHaveLength(2);
    expect(seed.financialAccounts.map((account) => account.name)).toEqual(["Cash", "Bancolombia"]);
    expect(seed.transactions).toHaveLength(3);
    expect(seed.transfers).toEqual([
      expect.objectContaining({
        fromAccountId: buildDefaultFinancialAccountId(seed.session.userId),
        toAccountId: seed.financialAccounts[1]?.id,
      }),
    ]);
  });

  it("builds a home-activity scenario with recent activity for dashboard QA", () => {
    const seed = buildLocalQaSeed("home-activity", now);

    expect(seed.session.profile).toBe("home-activity");
    expect(seed.session.userId).toBe("qa-local-home-activity");
    expect(seed.financialAccounts.map((account) => account.name)).toEqual(["Cash", "Bancolombia"]);
    expect(seed.budgets.reduce((total, budget) => total + budget.amount, 0)).toBe(10_000_000);
    expect(seed.budgets.find((budget) => budget.categoryId === "food")?.amount).toBe(100_000);
    expect(seed.transactions).toHaveLength(8);
    expect(seed.transactions.map((transaction) => transaction.categoryId)).toEqual([
      "food",
      "health",
      "entertainment",
      "home",
      "clothing",
      "transport",
      "education",
      "food",
    ]);
    expect(seed.transactions.at(-1)).toEqual(
      expect.objectContaining({
        accountAttributionState: "unresolved",
        description: "Bancolombia pending owner",
      })
    );
    expect(seed.transfers).toHaveLength(1);
  });
});

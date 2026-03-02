import { describe, expect, it } from "vitest";

describe("AddTransactionSheet component", () => {
  it("exports AddTransactionSheet", async () => {
    const mod = await import("@/features/transactions/components/AddTransactionSheet");
    expect(mod.AddTransactionSheet).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";

describe("AmountEntry component", () => {
  it("exports AmountEntry", async () => {
    const mod = await import("@/features/transactions/components/AmountEntry");
    expect(mod.AmountEntry).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";

describe("CategoryPill component", () => {
  it("exports CategoryPill", async () => {
    const mod = await import("@/features/transactions/components/CategoryPill");
    expect(mod.CategoryPill).toBeDefined();
  });

  it("CategoryPill is a function component", async () => {
    const mod = await import("@/features/transactions/components/CategoryPill");
    expect(typeof mod.CategoryPill).toBe("function");
  });
});

import { describe, expect, it } from "vitest";

describe("TypeToggle component", () => {
  it("exports TypeToggle", async () => {
    const mod = await import("@/features/transactions/components/TypeToggle");
    expect(mod.TypeToggle).toBeDefined();
  });

  it("TypeToggle is a function component", async () => {
    const mod = await import("@/features/transactions/components/TypeToggle");
    expect(typeof mod.TypeToggle).toBe("function");
  });
});

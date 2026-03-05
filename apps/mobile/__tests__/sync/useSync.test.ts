import { describe, expect, it } from "vitest";

describe("useSync", () => {
  it("exports useSync as a function", async () => {
    const mod = await import("@/features/sync/hooks/useSync");
    expect(typeof mod.useSync).toBe("function");
  });
});

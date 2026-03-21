import { beforeAll, describe, expect, it } from "vitest";
import type { useSync } from "@/features/sync/hooks/useSync";

let _useSync: typeof useSync;

describe("useSync", () => {
  beforeAll(async () => {
    const mod = await import("@/features/sync/hooks/useSync");
    _useSync = mod.useSync;
  }, 30000);

  it("exports useSync as a function", () => {
    expect(typeof _useSync).toBe("function");
  });
});

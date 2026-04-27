import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../../../supabase/functions/_shared/rate-limit.ts"),
  "utf8"
);

describe("Edge Function rate limiting", () => {
  it("fails closed when the backing RPC is unavailable", () => {
    expect(source).toContain("failing closed");
    expect(source).toContain("unavailable: true");
    expect(source).not.toContain("failing open");
    expect(source).not.toContain("allowed: true, count: 0");
  });
});

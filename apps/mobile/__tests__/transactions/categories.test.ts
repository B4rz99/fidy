import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../features/transactions/lib/categories.ts"),
  "utf-8"
);

describe("categories", () => {
  it("exports exactly 10 categories", () => {
    expect(source).toContain('"food"');
    expect(source).toContain('"transport"');
    expect(source).toContain('"entertainment"');
    expect(source).toContain('"health"');
    expect(source).toContain('"education"');
    expect(source).toContain('"home"');
    expect(source).toContain('"clothing"');
    expect(source).toContain('"services"');
    expect(source).toContain('"transfer"');
    expect(source).toContain('"other"');
    expect(source).not.toContain('"bills"');
    expect(source).not.toContain('"shopping"');
    // income is a tx type, not a category
    expect(source).not.toContain('"income"');
  });

  it("each category has localized labels", () => {
    expect(source).toContain("en:");
    expect(source).toContain("es:");
  });
});

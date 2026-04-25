import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("weekly-digest Edge Function privacy boundary", () => {
  it("does not read plaintext financial tables by default", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../../supabase/functions/weekly-digest/index.ts"),
      "utf8"
    );

    expect(source).not.toContain('.from("transactions")');
    expect(source).not.toContain('.from("budgets")');
    expect(source).not.toContain('.from("goal_contributions")');
  });
});

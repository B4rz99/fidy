import { describe, expect, it } from "vitest";

import { getTransactionDisplayName } from "@/features/transactions/display.public";

describe("getTransactionDisplayName", () => {
  it("prefers user-authored description", () => {
    expect(
      getTransactionDisplayName(
        { description: "Coffee after lunch", counterpartyName: "Juan Valdez" },
        "Unknown"
      )
    ).toBe("Coffee after lunch");
  });

  it("falls back to counterparty when description is empty", () => {
    expect(
      getTransactionDisplayName({ description: "", counterpartyName: "Farmatodo" }, "Unknown")
    ).toBe("Farmatodo");
  });

  it("uses fallback when neither display field is present", () => {
    expect(getTransactionDisplayName({ description: "  ", counterpartyName: " " }, "Unknown")).toBe(
      "Unknown"
    );
  });
});

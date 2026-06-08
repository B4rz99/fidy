import { describe, expect, it } from "vitest";
import { buildTransferQaPreset } from "@/features/transfers/lib/qa-preset";

describe("transfer QA presets", () => {
  const accounts = [
    { id: "cash-account", isDefault: true, kind: "cash", name: "Cash" },
    { id: "bank-account", isDefault: false, kind: "checking", name: "Bancolombia" },
  ] as const;

  it("builds a same-account conflict draft around the default tracked account", () => {
    expect(buildTransferQaPreset("transfer-conflict", accounts)).toEqual({
      digits: "125000",
      fromSide: { kind: "account", accountId: "cash-account" },
      toSide: { kind: "account", accountId: "cash-account" },
      lastEditedSide: "to",
    });
  });

  it("returns null when no tracked accounts are available", () => {
    expect(buildTransferQaPreset("transfer-conflict", [])).toBeNull();
  });
});

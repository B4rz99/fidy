import { describe, expect, it } from "vitest";
import {
  getDefaultQaTarget,
  isLocalQaProfile,
  isQaTarget,
  QA_TARGETS,
} from "@/features/qa/lib/entry-points";

describe("QA entry points", () => {
  it("accepts the supported local QA profiles", () => {
    expect(isLocalQaProfile("default")).toBe(true);
    expect(isLocalQaProfile("empty")).toBe(true);
    expect(isLocalQaProfile("two-accounts")).toBe(true);
    expect(isLocalQaProfile("transfer-ready")).toBe(true);
    expect(isLocalQaProfile("transfer-conflict")).toBe(true);
    expect(isLocalQaProfile("unknown")).toBe(false);
  });

  it("accepts the supported QA targets", () => {
    expect(isQaTarget(QA_TARGETS.home)).toBe(true);
    expect(isQaTarget(QA_TARGETS.addTransfer)).toBe(true);
    expect(isQaTarget(QA_TARGETS.transferConflict)).toBe(true);
    expect(isQaTarget("/does-not-exist")).toBe(false);
  });

  it("maps each seeded profile to its default target", () => {
    expect(getDefaultQaTarget("default")).toBe(QA_TARGETS.home);
    expect(getDefaultQaTarget("empty")).toBe(QA_TARGETS.onboarding);
    expect(getDefaultQaTarget("two-accounts")).toBe(QA_TARGETS.financialAccounts);
    expect(getDefaultQaTarget("transfer-ready")).toBe(QA_TARGETS.addTransfer);
    expect(getDefaultQaTarget("transfer-conflict")).toBe(QA_TARGETS.transferConflict);
  });
});

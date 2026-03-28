import { describe, expect, it } from "vitest";
import {
  getBankDefaults,
  isSingleAccountBank,
  resolveBankKeyFromDomain,
  resolveBankKeyFromPackage,
} from "@/features/accounts/lib/bank-registry";

describe("resolveBankKeyFromPackage", () => {
  it("resolves Nequi package", () => {
    expect(resolveBankKeyFromPackage("com.nequi.MobileApp")).toBe("nequi");
  });

  it("resolves RappiCard package", () => {
    expect(resolveBankKeyFromPackage("com.rappi.card")).toBe("rappicard");
  });

  it("resolves Bancolombia package", () => {
    expect(resolveBankKeyFromPackage("com.todo1.mobile.co.bancolombia")).toBe("bancolombia");
  });

  it("returns null for unknown package", () => {
    expect(resolveBankKeyFromPackage("com.unknown.app")).toBeNull();
  });
});

describe("resolveBankKeyFromDomain", () => {
  it("resolves davibank.com", () => {
    expect(resolveBankKeyFromDomain("davibank.com")).toBe("davibank");
  });

  it("resolves rappicard.co", () => {
    expect(resolveBankKeyFromDomain("rappicard.co")).toBe("rappicard");
  });

  it("returns null for unknown domain", () => {
    expect(resolveBankKeyFromDomain("gmail.com")).toBeNull();
  });
});

describe("getBankDefaults", () => {
  it("returns debit for davibank", () => {
    expect(getBankDefaults("davibank").defaultType).toBe("debit");
  });

  it("returns credit for rappicard", () => {
    expect(getBankDefaults("rappicard").defaultType).toBe("credit");
  });

  it("returns wallet for nequi", () => {
    expect(getBankDefaults("nequi").defaultType).toBe("wallet");
  });
});

describe("isSingleAccountBank", () => {
  it("nequi is single-account", () => {
    expect(isSingleAccountBank("nequi")).toBe(true);
  });

  it("daviplata is single-account", () => {
    expect(isSingleAccountBank("daviplata")).toBe(true);
  });

  it("davibank is NOT single-account", () => {
    expect(isSingleAccountBank("davibank")).toBe(false);
  });
});

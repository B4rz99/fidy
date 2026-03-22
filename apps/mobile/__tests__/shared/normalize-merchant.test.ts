import { describe, expect, test } from "vitest";
import { merchantsMatch, normalizeMerchant } from "@/shared/lib/normalize-merchant";

describe("normalizeMerchant", () => {
  test("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeMerchant("  UBER   EATS  ")).toBe("uber eats");
  });
});

describe("merchantsMatch", () => {
  test("exact match returns true", () => {
    expect(merchantsMatch("uber eats", "uber eats")).toBe(true);
  });

  test("both empty strings match (exact)", () => {
    expect(merchantsMatch("", "")).toBe(true);
  });

  test("substring: DB has longer name containing incoming", () => {
    expect(merchantsMatch("bold natural medical", "natural medical")).toBe(true);
  });

  test("substring: incoming has longer name containing DB", () => {
    expect(merchantsMatch("harissa", "harissa hf2")).toBe(true);
  });

  test("real case: BOLD CHERNIKA SAS vs CHERNIKA SAS", () => {
    expect(merchantsMatch("bold chernika sas", "chernika sas")).toBe(true);
  });

  test("real case: Comercio Barranquilla vs Barranquilla", () => {
    expect(merchantsMatch("comercio barranquilla", "barranquilla")).toBe(true);
  });

  test("completely different merchants do not match", () => {
    expect(merchantsMatch("uber eats", "starbucks")).toBe(false);
  });

  test("short string (< 3 chars) does not substring-match", () => {
    expect(merchantsMatch("a", "apple store")).toBe(false);
  });

  test("short string (< 3 chars) still exact-matches", () => {
    expect(merchantsMatch("ab", "ab")).toBe(true);
  });

  test("one empty, one non-empty do not match", () => {
    expect(merchantsMatch("", "starbucks")).toBe(false);
  });

  test("2-char string does not substring-match longer string", () => {
    expect(merchantsMatch("el", "el corte ingles")).toBe(false);
  });

  test("3-char string does substring-match longer string", () => {
    expect(merchantsMatch("bar", "barranquilla")).toBe(true);
  });
});

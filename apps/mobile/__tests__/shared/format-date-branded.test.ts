import { describe, expect, expectTypeOf, test } from "vitest";
import { toIsoDate, toIsoDateTime, toMonth } from "@/shared/lib";
import type { IsoDate, IsoDateTime, Month } from "@/shared/types/branded";

describe("branded temporal constructors", () => {
  const date = new Date(2026, 2, 20); // March 20, 2026

  test("toIsoDate returns IsoDate", () => {
    const result = toIsoDate(date);
    expectTypeOf(result).toEqualTypeOf<IsoDate>();
    expect(result).toBe("2026-03-20");
  });

  test("toMonth returns Month", () => {
    const result = toMonth(date);
    expectTypeOf(result).toEqualTypeOf<Month>();
    expect(result).toBe("2026-03");
  });

  test("toIsoDateTime returns IsoDateTime", () => {
    const result = toIsoDateTime(date);
    expectTypeOf(result).toEqualTypeOf<IsoDateTime>();
    expect(result).toMatch(/^2026-03-20T/);
  });

  test("Month is not assignable to IsoDate", () => {
    expectTypeOf<Month>().not.toEqualTypeOf<IsoDate>();
  });
});

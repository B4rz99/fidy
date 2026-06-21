import { describe, expect, it } from "vitest";
import { es } from "date-fns/locale";
import { makeDateLabel } from "@/features/transactions/lib/group-by-date";

describe("makeDateLabel", () => {
  it("uses the provided today label", () => {
    expect(makeDateLabel({ date: new Date(), todayLabel: "Hoy" })).toBe("Hoy");
  });

  it("uses the provided yesterday label", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    expect(makeDateLabel({ date: yesterday, yesterdayLabel: "Ayer" })).toBe("Ayer");
  });

  it("formats older dates with the provided locale", () => {
    expect(makeDateLabel({ date: new Date(2026, 0, 15), dateFnsLocale: es })).toBe("enero 15");
  });
});

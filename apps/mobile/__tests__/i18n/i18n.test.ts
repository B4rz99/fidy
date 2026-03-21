import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryId } from "@/shared/types/branded";

vi.unmock("date-fns");
vi.unmock("date-fns/locale");

describe("i18n core", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("t('common.save') returns 'Guardar' when locale is 'es'", async () => {
    const { default: i18n } = await import("@/shared/i18n/i18n");
    i18n.locale = "es";
    expect(i18n.t("common.save")).toBe("Guardar");
  });

  it("t('common.save') returns 'Save' when locale is 'en'", async () => {
    const { default: i18n } = await import("@/shared/i18n/i18n");
    i18n.locale = "en";
    expect(i18n.t("common.save")).toBe("Save");
  });

  it("missing key in 'en' falls back to 'es' value", async () => {
    const { default: i18n } = await import("@/shared/i18n/i18n");
    // i18n-js falls back to default locale (es) for missing keys
    i18n.locale = "fr"; // unknown locale
    expect(i18n.t("common.save")).toBe("Guardar");
  });

  it("pluralization: count=1 uses 'one', count=3 uses 'other' (es)", async () => {
    const { default: i18n } = await import("@/shared/i18n/i18n");
    i18n.locale = "es";
    expect(i18n.t("needsReview.count", { count: 1 })).toBe("1 transacción necesita revisión");
    expect(i18n.t("needsReview.count", { count: 3 })).toBe("3 transacciones necesitan revisión");
  });

  it("pluralization works in 'en'", async () => {
    const { default: i18n } = await import("@/shared/i18n/i18n");
    i18n.locale = "en";
    expect(i18n.t("needsReview.count", { count: 1 })).toBe("1 transaction needs review");
    expect(i18n.t("needsReview.count", { count: 3 })).toBe("3 transactions need review");
  });

  it("interpolation replaces %{var} placeholders", async () => {
    const { default: i18n } = await import("@/shared/i18n/i18n");
    i18n.locale = "es";
    expect(i18n.t("bills.deleteBillConfirm", { billName: "Netflix" })).toBe(
      '¿Estás seguro de que quieres eliminar "Netflix"?'
    );
  });
});

describe("getCategoryLabel", () => {
  it("returns Spanish label when locale is 'es'", async () => {
    const { getCategoryLabel } = await import("@/shared/i18n/locale-helpers");
    const foodCategory = {
      id: "food" as CategoryId,
      label: { en: "Food", es: "Comida" },
      icon: {} as never,
      color: "#000",
    };
    expect(getCategoryLabel(foodCategory, "es")).toBe("Comida");
  });

  it("returns English label when locale is 'en'", async () => {
    const { getCategoryLabel } = await import("@/shared/i18n/locale-helpers");
    const foodCategory = {
      id: "food" as CategoryId,
      label: { en: "Food", es: "Comida" },
      icon: {} as never,
      color: "#000",
    };
    expect(getCategoryLabel(foodCategory, "en")).toBe("Food");
  });

  it("defaults to Spanish for unknown locale", async () => {
    const { getCategoryLabel } = await import("@/shared/i18n/locale-helpers");
    const cat = {
      id: "food" as CategoryId,
      label: { en: "Food", es: "Comida" },
      icon: {} as never,
      color: "#000",
    };
    expect(getCategoryLabel(cat, "fr")).toBe("Comida");
  });
});

describe("getDateFnsLocale", () => {
  it("returns date-fns es locale for 'es'", async () => {
    const { getDateFnsLocale } = await import("@/shared/i18n/date-locale");
    const locale = getDateFnsLocale("es");
    expect(locale.code).toBe("es");
  });

  it("returns date-fns enUS locale for 'en'", async () => {
    const { getDateFnsLocale } = await import("@/shared/i18n/date-locale");
    const locale = getDateFnsLocale("en");
    expect(locale.code).toBe("en-US");
  });

  it("defaults to es for unknown locale", async () => {
    const { getDateFnsLocale } = await import("@/shared/i18n/date-locale");
    const locale = getDateFnsLocale("fr");
    expect(locale.code).toBe("es");
  });
});

describe("key parity", () => {
  it("every key in es.ts exists in en.ts and vice versa", async () => {
    const { default: esLocale } = await import("@/shared/i18n/locales/es");
    const { default: enLocale } = await import("@/shared/i18n/locales/en");

    const flattenKeys = (obj: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(obj).flatMap(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          return flattenKeys(value as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });

    const esKeys = flattenKeys(esLocale as unknown as Record<string, unknown>).sort();
    const enKeys = flattenKeys(enLocale as unknown as Record<string, unknown>).sort();

    const missingInEn = esKeys.filter((k) => !enKeys.includes(k));
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInEs).toEqual([]);
  });
});

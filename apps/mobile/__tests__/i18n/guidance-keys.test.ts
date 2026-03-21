import { describe, expect, it } from "vitest";
import en from "@/shared/i18n/locales/en";
import es from "@/shared/i18n/locales/es";

type GuidanceLocale = {
  budgetAlert80?: Record<string, string>;
  budgetAlert100?: Record<string, string>;
};

const enGuidance = (en as unknown as { guidance?: GuidanceLocale }).guidance;
const esGuidance = (es as unknown as { guidance?: GuidanceLocale }).guidance;

const CATEGORIES = [
  "food",
  "transport",
  "entertainment",
  "health",
  "education",
  "home",
  "clothing",
  "services",
  "transfer",
  "other",
];

describe("guidance i18n keys", () => {
  it.each(CATEGORIES)("en has budgetAlert80.%s with required placeholders", (cat) => {
    const key = enGuidance?.budgetAlert80?.[cat];
    expect(key).toBeDefined();
    expect(key).toContain("%{remaining}");
    expect(key).toContain("%{daysLeft}");
  });

  it.each(CATEGORIES)("en has budgetAlert100.%s with required placeholder", (cat) => {
    const key = enGuidance?.budgetAlert100?.[cat];
    expect(key).toBeDefined();
    expect(key).toContain("%{overAmount}");
  });

  it.each(CATEGORIES)("es has budgetAlert80.%s with required placeholders", (cat) => {
    const key = esGuidance?.budgetAlert80?.[cat];
    expect(key).toBeDefined();
    expect(key).toContain("%{remaining}");
    expect(key).toContain("%{daysLeft}");
  });

  it.each(CATEGORIES)("es has budgetAlert100.%s with required placeholder", (cat) => {
    const key = esGuidance?.budgetAlert100?.[cat];
    expect(key).toBeDefined();
    expect(key).toContain("%{overAmount}");
  });
});

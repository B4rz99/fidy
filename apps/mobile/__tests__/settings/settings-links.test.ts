import { describe, expect, test } from "vitest";
import {
  buildPrivacyUrl,
  buildTermsUrl,
  buildWhatsAppUrl,
  getUserInitials,
} from "@/features/settings/lib/settings-links";

describe("buildPrivacyUrl", () => {
  test("returns English privacy URL", () => {
    expect(buildPrivacyUrl("en")).toBe("https://fidy-landing.vercel.app/en/privacy");
  });

  test("returns Spanish privacy URL", () => {
    expect(buildPrivacyUrl("es")).toBe("https://fidy-landing.vercel.app/es/privacy");
  });
});

describe("buildTermsUrl", () => {
  test("returns English terms URL", () => {
    expect(buildTermsUrl("en")).toBe("https://fidy-landing.vercel.app/en/terms");
  });

  test("returns Spanish terms URL", () => {
    expect(buildTermsUrl("es")).toBe("https://fidy-landing.vercel.app/es/terms");
  });
});

describe("buildWhatsAppUrl", () => {
  test("returns WhatsApp URL with phone number", () => {
    expect(buildWhatsAppUrl("573003632142")).toBe("https://wa.me/573003632142");
  });
});

describe("getUserInitials", () => {
  test("returns initials from full name", () => {
    expect(getUserInitials("Oscar Barboza", "oscar@fidy.app")).toBe("OB");
  });

  test("returns first letter of email when name is null", () => {
    expect(getUserInitials(null, "oscar@fidy.app")).toBe("O");
  });

  test("returns first letter of email when name is undefined", () => {
    expect(getUserInitials(undefined, "a@b.com")).toBe("A");
  });

  test("returns single initial for single-word name", () => {
    expect(getUserInitials("Oscar", "oscar@fidy.app")).toBe("O");
  });

  test("returns first and last initials for multi-word name", () => {
    expect(getUserInitials("Oscar Alberto Barboza Alfaro", "oscar@fidy.app")).toBe("OA");
  });
});

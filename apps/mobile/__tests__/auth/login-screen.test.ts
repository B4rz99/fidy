import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Login screen", () => {
  const loginSource = readFileSync(resolve(__dirname, "../../app/(auth)/login.tsx"), "utf-8");
  const localQaButtonSource = readFileSync(
    resolve(__dirname, "../../features/qa/components/LocalQaLoginButton.tsx"),
    "utf-8"
  );

  test("imports OAuth provider icons", () => {
    expect(loginSource).toContain("GoogleIcon");
    expect(loginSource).toContain("MicrosoftIcon");
  });

  test("renders tagline via i18n", () => {
    expect(loginSource).toContain('t("login.tagline")');
  });

  test("renders legal text via i18n", () => {
    expect(loginSource).toContain('t("login.legalText")');
  });

  test("renders a dev-only local QA mode entry point", () => {
    expect(loginSource).toContain("LocalQaLoginButton");
    expect(localQaButtonSource).toContain('t("login.continueInLocalQaMode")');
    expect(localQaButtonSource).toContain("startLocalQaSession");
  });

  test("uses FidyLogo component", () => {
    expect(loginSource).toContain("FidyLogo");
  });
});

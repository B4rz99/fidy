import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Login screen", () => {
  const loginSource = readFileSync(resolve(__dirname, "../../app/(auth)/login.tsx"), "utf-8");

  test("imports all three OAuth provider icons", () => {
    expect(loginSource).toContain("GoogleIcon");
    expect(loginSource).toContain("AppleIcon");
    expect(loginSource).toContain("MicrosoftIcon");
  });

  test("renders tagline text", () => {
    expect(loginSource).toContain("your finances, simplified.");
  });

  test("renders legal text", () => {
    expect(loginSource).toContain("Terms of Service");
    expect(loginSource).toContain("Privacy Policy");
  });

  test("uses FidyLogo component", () => {
    expect(loginSource).toContain("FidyLogo");
  });
});

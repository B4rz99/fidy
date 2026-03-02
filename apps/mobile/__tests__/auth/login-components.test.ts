import { describe, expect, it } from "vitest";

describe("Login screen components", () => {
  it("exports FidyLogo", async () => {
    const mod = await import("@/shared/components/FidyLogo");
    expect(mod.FidyLogo).toBeDefined();
  });

  it("FidyLogo is a function component", async () => {
    const mod = await import("@/shared/components/FidyLogo");
    expect(typeof mod.FidyLogo).toBe("function");
  });

  it("exports OAuthButton", async () => {
    const mod = await import("@/features/auth/components/OAuthButton");
    expect(mod.OAuthButton).toBeDefined();
  });

  it("OAuthButton is a function component", async () => {
    const mod = await import("@/features/auth/components/OAuthButton");
    expect(typeof mod.OAuthButton).toBe("function");
  });

  it("exports GoogleIcon", async () => {
    const mod = await import("@/features/auth/components/icons/GoogleIcon");
    expect(mod.GoogleIcon).toBeDefined();
  });

  it("exports AppleIcon", async () => {
    const mod = await import("@/features/auth/components/icons/AppleIcon");
    expect(mod.AppleIcon).toBeDefined();
  });

  it("exports MicrosoftIcon", async () => {
    const mod = await import("@/features/auth/components/icons/MicrosoftIcon");
    expect(mod.MicrosoftIcon).toBeDefined();
  });
});

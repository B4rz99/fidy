import { describe, expect, it } from "vitest";

describe("Auth barrel exports", () => {
  it("exports OAuthButton", async () => {
    const mod = await import("@/features/auth");
    expect(mod.OAuthButton).toBeDefined();
  });

  it("exports GoogleIcon", async () => {
    const mod = await import("@/features/auth");
    expect(mod.GoogleIcon).toBeDefined();
  });

  it("exports AppleIcon", async () => {
    const mod = await import("@/features/auth");
    expect(mod.AppleIcon).toBeDefined();
  });

  it("exports MicrosoftIcon", async () => {
    const mod = await import("@/features/auth");
    expect(mod.MicrosoftIcon).toBeDefined();
  });
});

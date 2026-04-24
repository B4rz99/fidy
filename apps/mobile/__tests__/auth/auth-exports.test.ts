import { describe, expect, it } from "vitest";

describe("Auth UI public surface", () => {
  it("exports OAuthButton", async () => {
    const mod = await import("@/features/auth/ui.public");
    expect(mod.OAuthButton).toBeDefined();
  });

  it("exports GoogleIcon", async () => {
    const mod = await import("@/features/auth/ui.public");
    expect(mod.GoogleIcon).toBeDefined();
  });

  it("exports AppleIcon", async () => {
    const mod = await import("@/features/auth/ui.public");
    expect(mod.AppleIcon).toBeDefined();
  });

  it("exports MicrosoftIcon", async () => {
    const mod = await import("@/features/auth/ui.public");
    expect(mod.MicrosoftIcon).toBeDefined();
  });
});

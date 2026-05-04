import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateParseEmailService } = vi.hoisted(() => ({
  mockCreateParseEmailService: vi.fn((config: unknown) => ({ config })),
}));

vi.mock("@/shared/categories", () => ({
  CATEGORY_IDS: ["food", "transport"],
}));

vi.mock("@/features/email-capture/services/create-parse-email-service", () => ({
  createParseEmailService: (config: unknown) => mockCreateParseEmailService(config),
}));

describe("parse-email service wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateParseEmailService.mockClear();
  });

  it("creates live and retryable services with the shared category allow-list", async () => {
    const { liveParseEmailService, retryableParseEmailService } = await import(
      "@/features/email-capture/services/parse-email-service"
    );

    expect(mockCreateParseEmailService).toHaveBeenNthCalledWith(1, {
      validCategoryIds: ["food", "transport"],
    });
    expect(mockCreateParseEmailService).toHaveBeenNthCalledWith(2, {
      validCategoryIds: ["food", "transport"],
      throwOnApiFailure: true,
    });
    expect(liveParseEmailService).toEqual({
      config: { validCategoryIds: ["food", "transport"] },
    });
    expect(retryableParseEmailService).toEqual({
      config: { validCategoryIds: ["food", "transport"], throwOnApiFailure: true },
    });
  });
});

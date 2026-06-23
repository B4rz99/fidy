import { describe, expect, it, vi } from "vitest";
import { createParseEmailService } from "@/features/email-capture/services/create-parse-email-service";

const ACCESS_TOKEN_KEY = "access_token";
const AUTHORIZATION_HEADER = "Authorization";

describe("createParseEmailService", () => {
  it("classifies merchants through the parse-email edge function", async () => {
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: { success: true, data: { categoryId: "food" } },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food", "transport"],
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.classifyMerchant("EXITO")).resolves.toBe("food");
    expect(mockInvoke).toHaveBeenCalledWith("parse-email", {
      body: { body: "EXITO", mode: "classify" },
    });
  });

  it("returns a validated transaction for full_parse mode", async () => {
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: {
        success: true,
        data: {
          kind: "transaction",
          type: "expense",
          amount: 50000,
          categoryId: "food",
          description: "Exito",
          date: "2026-03-05",
          confidence: 0.9,
          cardProductHint: "Tarjeta credito Bancolombia",
          counterpartyHint: "Exito",
        },
      },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).resolves.toEqual(
      expect.objectContaining({
        amount: 50000,
        categoryId: "food",
        description: "Exito",
        cardProductHint: "Tarjeta credito Bancolombia",
        counterpartyHint: "Exito",
      })
    );
  });

  it("passes the current user access token to the parse-email function", async () => {
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: {
        success: true,
        data: {
          kind: "transaction",
          type: "expense",
          amount: 50000,
          categoryId: "food",
          description: "Exito",
          date: "2026-03-05",
          confidence: 0.9,
        },
      },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: () =>
                Promise.resolve({
                  data: { session: { [ACCESS_TOKEN_KEY]: "user-access-token" } },
                  error: null,
                }),
            },
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await service.parseEmail("Compra por $50,000");

    expect(mockInvoke).toHaveBeenCalledWith("parse-email", {
      body: { body: "Compra por $50,000", mode: "full_parse" },
      headers: { [AUTHORIZATION_HEADER]: "Bearer user-access-token" },
    });
  });

  it("returns null when the parse-email function rejects the authenticated request", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: { success: false, error: "invalid_auth" },
      error: { message: "Invalid JWT" },
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("parse_email_api_failed", {
      errorMessage: "Invalid JWT",
      hasData: true,
    });
  });

  it("throws on parse-email failure when configured for retryable pipeline parsing", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: { success: false, error: "invalid_auth" },
      error: { message: "Invalid JWT" },
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      throwOnApiFailure: true,
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).rejects.toThrow("Invalid JWT");
    expect(captureWarning).toHaveBeenCalledWith("parse_email_api_failed", {
      errorMessage: "Invalid JWT",
      hasData: true,
    });
  });

  it("returns null for ambiguous needs-review candidates when configured for retryable parsing", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: {
        success: true,
        data: {
          kind: "needs_review",
          reason: "amount and merchant conflict",
          confidence: 0.4,
        },
      },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      throwOnApiFailure: true,
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseEmail("ambiguous capture")).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("parse_email_needs_review", {
      reason: "amount and merchant conflict",
    });
  });

  it("throws only on ambiguous needs-review candidates when configured for reviewable parsing", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          kind: "needs_review",
          reason: "amount and merchant conflict",
          confidence: 0.4,
        },
      },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      throwOnNeedsReview: true,
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseNotification("ambiguous notification")).rejects.toMatchObject({
      message: "capture_needs_review",
      reason: "amount and merchant conflict",
      confidence: 0.4,
    });
    expect(captureWarning).toHaveBeenCalledWith("parse_notification_needs_review", {
      reason: "amount and merchant conflict",
    });
  });

  it("surfaces sanitized parse-email function data errors for diagnostics", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: {
        success: false,
        error: "openai_error:400:unsupported_value:temperature:invalid_request_error",
      },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      throwOnApiFailure: true,
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).rejects.toThrow(
      "openai_error:400:unsupported_value:temperature:invalid_request_error"
    );
    expect(captureWarning).toHaveBeenCalledWith("parse_email_api_failed", {
      errorMessage: "openai_error:400:unsupported_value:temperature:invalid_request_error",
      hasData: true,
    });
  });

  it("surfaces parse-email rate limits from the Edge Function response", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 429,
          headers: { get: (header: string) => (header === "Retry-After" ? "41" : null) },
        },
      },
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      throwOnApiFailure: true,
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).rejects.toThrow("rate_limited");
    expect(captureWarning).toHaveBeenCalledWith("parse_email_api_failed", {
      errorMessage: "rate_limited",
      hasData: false,
      httpStatus: 429,
      retryAfterSeconds: 41,
    });
  });

  it("returns null and captures a warning when local notification validation rejects a candidate", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: {
        success: true,
        data: {
          kind: "transaction",
          type: "expense",
          amount: -100,
          categoryId: "food",
          description: "Bad",
          date: "2026-03-05",
          confidence: 0.9,
        },
      },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseNotification("sanitized body")).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("parse_notification_rejected", {
      reason: "amount must be a non-negative integer",
    });
  });

  it("returns null instead of throwing when a transaction candidate has zero amount", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const mockInvoke = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      data: {
        success: true,
        data: {
          kind: "transaction",
          type: "expense",
          amount: 0,
          categoryId: "food",
          description: "Bad",
          date: "2026-03-05",
          confidence: 0.9,
        },
      },
      error: null,
    });

    const service = createParseEmailService({
      validCategoryIds: ["food"],
      supabase: {
        getSupabase: () =>
          ({
            functions: { invoke: mockInvoke },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await expect(service.parseEmail("Compra por $0")).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("parse_email_rejected", {
      reason: "amount must be greater than zero",
    });
  });
});

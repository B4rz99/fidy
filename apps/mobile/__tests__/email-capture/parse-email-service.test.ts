import { describe, expect, it, vi } from "vitest";
import { createParseEmailService } from "@/features/email-capture/services/create-parse-email-service";

const ACCESS_TOKEN_KEY = "access_token";
const AUTHORIZATION_HEADER = "Authorization";

describe("createParseEmailService", () => {
  it("classifies merchants through the parse-email edge function", async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
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
        captureError: vi.fn(),
        captureWarning: vi.fn(),
        capturePipelineEvent: vi.fn(),
      },
    });

    await expect(service.classifyMerchant("EXITO")).resolves.toBe("food");
    expect(mockInvoke).toHaveBeenCalledWith("parse-email", {
      body: { body: "EXITO", mode: "classify" },
    });
  });

  it("returns a validated transaction for full_parse mode", async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
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
          fromAccountHint: "Tarjeta credito Bancolombia",
          toAccountHint: null,
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
        captureError: vi.fn(),
        captureWarning: vi.fn(),
        capturePipelineEvent: vi.fn(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).resolves.toEqual(
      expect.objectContaining({
        amount: 50000,
        categoryId: "food",
        description: "Exito",
        fromAccountHint: "Tarjeta credito Bancolombia",
      })
    );
  });

  it("passes the current user access token to the parse-email function", async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
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
          fromAccountHint: null,
          toAccountHint: null,
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
        captureError: vi.fn(),
        captureWarning: vi.fn(),
        capturePipelineEvent: vi.fn(),
      },
    });

    await service.parseEmail("Compra por $50,000");

    expect(mockInvoke).toHaveBeenCalledWith("parse-email", {
      body: { body: "Compra por $50,000", mode: "full_parse" },
      headers: { [AUTHORIZATION_HEADER]: "Bearer user-access-token" },
    });
  });

  it("returns null when the parse-email function rejects the authenticated request", async () => {
    const captureWarning = vi.fn();
    const mockInvoke = vi.fn().mockResolvedValue({
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
        captureError: vi.fn(),
        captureWarning,
        capturePipelineEvent: vi.fn(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("parse_email_api_failed", {
      errorMessage: "Invalid JWT",
      hasData: true,
    });
  });

  it("throws on parse-email failure when configured for retryable pipeline parsing", async () => {
    const captureWarning = vi.fn();
    const mockInvoke = vi.fn().mockResolvedValue({
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
        captureError: vi.fn(),
        captureWarning,
        capturePipelineEvent: vi.fn(),
      },
    });

    await expect(service.parseEmail("Compra por $50,000")).rejects.toThrow("Invalid JWT");
    expect(captureWarning).toHaveBeenCalledWith("parse_email_api_failed", {
      errorMessage: "Invalid JWT",
      hasData: true,
    });
  });

  it("returns null and captures a warning when local notification validation rejects a candidate", async () => {
    const captureWarning = vi.fn();
    const mockInvoke = vi.fn().mockResolvedValue({
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
        captureError: vi.fn(),
        captureWarning,
        capturePipelineEvent: vi.fn(),
      },
    });

    await expect(service.parseNotification("sanitized body")).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("parse_notification_rejected", {
      reason: "amount must be a non-negative integer",
    });
  });

  it("returns null instead of throwing when a transaction candidate has zero amount", async () => {
    const captureWarning = vi.fn();
    const mockInvoke = vi.fn().mockResolvedValue({
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
        captureError: vi.fn(),
        captureWarning,
        capturePipelineEvent: vi.fn(),
      },
    });

    await expect(service.parseEmail("Compra por $0")).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("parse_email_rejected", {
      reason: "amount must be greater than zero",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { createParseEmailService } from "@/features/email-capture/services/create-parse-email-service";

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
      })
    );
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

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.fn();

vi.mock("@/shared/lib/supabase", () => ({
  getSupabase: () => ({
    functions: { invoke: mockInvoke },
  }),
}));

import {
  classifyMerchantApi,
  parseEmailApi,
  stripPii,
} from "@/features/email-capture/services/parse-email-api";

describe("stripPii", () => {
  it("removes email addresses", () => {
    expect(stripPii("Contact user@example.com for info")).toBe("Contact [EMAIL] for info");
  });

  it("removes phone numbers", () => {
    expect(stripPii("Call +57 300 123 4567")).toBe("Call [PHONE]");
    expect(stripPii("Tel: 3001234567")).toBe("Tel: [PHONE]");
  });

  it("removes masked card numbers", () => {
    expect(stripPii("Card *1234")).toBe("Card [CARD]");
    expect(stripPii("Tarjeta ****5678")).toBe("Tarjeta [CARD]");
  });

  it("preserves amounts and merchant names", () => {
    const input = "Compra en EXITO por $50,000";
    expect(stripPii(input)).toBe("Compra en EXITO por $50,000");
  });
});

describe("classifyMerchantApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns categoryId from edge function", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, data: { categoryId: "food" } },
      error: null,
    });

    const result = await classifyMerchantApi("EXITO COLOMBI");
    expect(result).toBe("food");
    expect(mockInvoke).toHaveBeenCalledWith("parse-email", {
      body: { body: "EXITO COLOMBI", mode: "classify" },
    });
  });

  it("returns 'other' on error", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "timeout" },
    });

    const result = await classifyMerchantApi("UNKNOWN");
    expect(result).toBe("other");
  });

  it("returns 'other' when edge function returns invalid categoryId", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, data: { categoryId: "invalid_cat" } },
      error: null,
    });

    const result = await classifyMerchantApi("MERCHANT");
    expect(result).toBe("other");
  });
});

describe("parseEmailApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("strips PII and returns validated transaction", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          type: "expense",
          amountCents: 5000000,
          categoryId: "food",
          description: "Exito",
          date: "2026-03-05",
          confidence: 0.9,
        },
      },
      error: null,
    });

    const result = await parseEmailApi("Compra user@email.com por $50,000");
    expect(result).not.toBeNull();
    expect(result?.amountCents).toBe(5000000);
    expect(mockInvoke).toHaveBeenCalledWith("parse-email", {
      body: { body: "Compra [EMAIL] por $50,000", mode: "full_parse" },
    });
  });

  it("returns null on edge function error", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "timeout" },
    });

    const result = await parseEmailApi("email body");
    expect(result).toBeNull();
  });

  it("returns null when Zod validation fails", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          type: "expense",
          amountCents: -100,
          categoryId: "food",
          description: "Bad",
          date: "2026-03-05",
          confidence: 0.9,
        },
      },
      error: null,
    });

    const result = await parseEmailApi("email body");
    expect(result).toBeNull();
  });
});

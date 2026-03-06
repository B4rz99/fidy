import { describe, expect, it, vi } from "vitest";

vi.mock("../../features/email-capture/lib/prompt-template", () => ({
  buildExtractionPrompt: vi.fn(() => "mock prompt"),
}));

import { parseEmailWithLlm } from "../../features/email-capture/services/llm-parser";

describe("parseEmailWithLlm", () => {
  it("returns parsed transaction from valid LLM output", async () => {
    const mockContext = {
      completion: vi.fn().mockResolvedValue({
        text: '{"type":"expense","amountCents":5000000,"categoryId":"food","description":"Exito","date":"2026-03-01","confidence":0.9}',
      }),
    };

    const result = await parseEmailWithLlm("email body", mockContext as any);
    expect(result).toEqual({
      type: "expense",
      amountCents: 5000000,
      categoryId: "food",
      description: "Exito",
      date: "2026-03-01",
      confidence: 0.9,
    });
  });

  it("extracts JSON from markdown code block", async () => {
    const mockContext = {
      completion: vi.fn().mockResolvedValue({
        text: '```json\n{"type":"income","amountCents":100000,"categoryId":"transfer","description":"Transfer","date":"2026-03-01","confidence":0.85}\n```',
      }),
    };

    const result = await parseEmailWithLlm("email body", mockContext as any);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("income");
  });

  it("returns null when LLM output is not valid JSON", async () => {
    const mockContext = {
      completion: vi.fn().mockResolvedValue({ text: "I cannot parse this email" }),
    };

    const result = await parseEmailWithLlm("email body", mockContext as any);
    expect(result).toBeNull();
  });

  it("returns null when JSON fails Zod validation", async () => {
    const mockContext = {
      completion: vi.fn().mockResolvedValue({
        text: '{"type":"expense","amountCents":-100,"categoryId":"food","description":"","date":"bad","confidence":0.5}',
      }),
    };

    const result = await parseEmailWithLlm("email body", mockContext as any);
    expect(result).toBeNull();
  });
});

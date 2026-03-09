import { describe, expect, it } from "vitest";
import { parseActionFromResponse } from "../../features/ai-chat/lib/parse-action";

describe("parseActionFromResponse", () => {
  it("extracts add action from mixed text", () => {
    const text =
      'Sure, I\'ll add that for you. [ACTION]{"type":"add","data":{"type":"expense","amountCents":5000000,"categoryId":"food","description":"Almuerzo","date":"2026-03-05"}}[/ACTION]';

    const result = parseActionFromResponse(text);

    expect(result).toEqual({
      type: "add",
      data: {
        type: "expense",
        amountCents: 5000000,
        categoryId: "food",
        description: "Almuerzo",
        date: "2026-03-05",
      },
    });
  });

  it("extracts delete action", () => {
    const text =
      'I\'ll delete that transaction. [ACTION]{"type":"delete","transactionId":"tx-123","description":"Uber","amountCents":1500000,"date":"2026-03-01"}[/ACTION] Done!';

    const result = parseActionFromResponse(text);

    expect(result).toEqual({
      type: "delete",
      transactionId: "tx-123",
      description: "Uber",
      amountCents: 1500000,
      date: "2026-03-01",
    });
  });

  it("extracts edit action", () => {
    const text =
      '[ACTION]{"type":"edit","transactionId":"tx-456","data":{"amountCents":2000000}}[/ACTION]';

    const result = parseActionFromResponse(text);

    expect(result).toEqual({
      type: "edit",
      transactionId: "tx-456",
      data: { amountCents: 2000000 },
    });
  });

  it("returns null when no action block present", () => {
    const text = "Your total spending this month is $150,000 COP.";
    expect(parseActionFromResponse(text)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const text = "[ACTION]{not valid json}[/ACTION]";
    expect(parseActionFromResponse(text)).toBeNull();
  });

  it("returns null for invalid action shape", () => {
    const text = '[ACTION]{"type":"unknown","foo":"bar"}[/ACTION]';
    expect(parseActionFromResponse(text)).toBeNull();
  });

  it("extracts text content without action block", () => {
    const text =
      'Here is the result. [ACTION]{"type":"add","data":{"type":"expense","amountCents":1000,"categoryId":"food","description":"test","date":"2026-03-01"}}[/ACTION] All done.';

    const result = parseActionFromResponse(text);
    expect(result).not.toBeNull();
  });
});

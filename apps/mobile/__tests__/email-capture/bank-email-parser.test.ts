import { describe, expect, it } from "vitest";
import { parseKnownBankEmail } from "@/features/email-capture/services/bank-email-parser";
import type { RawEmail } from "@/features/email-capture/schema";

const makeEmail = (overrides: Partial<RawEmail>): RawEmail => ({
  externalId: "email-1",
  from: "alertas@davibank.com",
  subject: "Compra aprobada",
  body: "",
  receivedAt: "2026-05-18T19:04:59.000Z",
  provider: "gmail",
  ...overrides,
});

describe("known bank email parser", () => {
  it("extracts Davibank transaction details without calling the LLM", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Alertas Davibank <alertas@davibank.com>",
        body: "Compra aprobada en EXITO COLOMBIA por $50.000 el 18/05/2026 con tarjeta **** 1234.",
      })
    );

    expect(result).toEqual({
      kind: "parsed",
      parserKey: "davibank:purchase",
      parsed: {
        type: "expense",
        amount: 50000,
        categoryId: "other",
        description: "EXITO COLOMBIA",
        counterpartyHint: "EXITO COLOMBIA",
        date: "2026-05-18",
        confidence: 0.92,
        cardProductHint: "tarjeta 1234",
      },
    });
  });

  it("returns a redacted regex failure request for known banks with unknown templates", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Alertas Davibank <alertas@davibank.com>",
        body: "Operacion bancaria nueva en Super Nuevo Comercio con tarjeta 1234.",
      })
    );

    expect(result).toEqual({
      kind: "failed",
      parserKey: "davibank",
      request: {
        rawText:
          "Compra aprobada\n\nOperacion bancaria nueva en Super Nuevo Comercio con tarjeta 1234.",
        parserTemplate:
          "Compra aprobada Operacion bancaria nueva en [MERCHANT] con tarjeta [CARD].",
        senderDomain: "davibank.com",
        source: "email_gmail",
        status: "failed",
        confidence: null,
        parseMethod: "regex",
      },
    });
  });

  it("does not treat lookalike domains as known banks", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Alertas <alertas@fake-davibank.com>",
        body: "Compra aprobada en EXITO COLOMBIA por $50.000 el 18/05/2026.",
      })
    );

    expect(result).toEqual({ kind: "unsupported" });
  });

  it("allows exact known domains and their subdomains", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Alertas <alertas@mail.davibank.com>",
        body: "Compra aprobada en EXITO COLOMBIA por $50.000 el 18/05/2026.",
      })
    );

    expect(result.kind).toBe("parsed");
  });
});

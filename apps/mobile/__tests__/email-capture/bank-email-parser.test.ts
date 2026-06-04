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

  it("does not interpret Colombian full dates as US month-day-year dates", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Alertas Davibank <alertas@davibank.com>",
        body: "Compra aprobada en EXITO COLOMBIA por $50.000 el 05/18/2026 con tarjeta **** 1234.",
      })
    );

    expect(result).toEqual({
      kind: "failed",
      parserKey: "davibank",
      request: expect.objectContaining({
        status: "failed",
      }),
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

  it("extracts BBVA reference amount and establishment details", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "BBVA <bbva@bbvanet.com.co>",
        subject: "BBVA - Notificacion Ref: $125.900",
        body: "Estamos contigo en BBVA. Operacion: Pago Restaurante Central Tarjeta terminada en: 1234 Fecha de operacion: 18/05/2026 Establecimiento: Restaurante Central. Ref: $125.900",
      })
    );

    expect(result).toEqual({
      kind: "parsed",
      parserKey: "bbva:purchase",
      parsed: {
        type: "expense",
        amount: 125900,
        categoryId: "other",
        description: "Restaurante Central",
        counterpartyHint: "Restaurante Central",
        date: "2026-05-18",
        confidence: 0.86,
        cardProductHint: "tarjeta 1234",
      },
    });
  });

  it("extracts ISO BBVA dates without treating them as Colombian slash dates", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "BBVA <bbva@bbvanet.com.co>",
        receivedAt: "2026-05-19T19:04:59.000Z",
        subject: "BBVA - Notificacion Ref: $125.900",
        body: "Operacion: Pago Restaurante Central Tarjeta terminada en: 1234 Fecha de operacion: 2026-05-18 Establecimiento: Restaurante Central. Ref: $125.900",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          date: "2026-05-18",
        }),
      })
    );
  });

  it("keeps dotted BBVA establishment names intact", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "BBVA <bbva@bbvanet.com.co>",
        subject: "BBVA - Notificacion Ref: $45.900",
        body: "Operacion: Pago NETFLIX.COM Tarjeta terminada en: 1234 Fecha de operacion: 18/05/2026 Establecimiento: NETFLIX.COM. Ref: $45.900",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          description: "NETFLIX.COM",
          counterpartyHint: "NETFLIX.COM",
        }),
      })
    );
  });

  it("stops BBVA establishment capture before HTML-entity disclaimer labels", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "BBVA <bbva@bbvanet.com.co>",
        subject: "BBVA - Notificacion Ref: $45.900",
        body: "Operacion: Pago NETFLIX.COM Tarjeta terminada en: 1234 Fecha de operacion: 18/05/2026 Establecimiento: NETFLIX.COM c&oacute;digos de seguridad nunca seran solicitados. Ref: $45.900",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          description: "NETFLIX.COM",
        }),
      })
    );
  });

  it("parses BBVA reference-only notifications when the operation line is absent", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "BBVA <bbva@bbvanet.com.co>",
        receivedAt: "2026-05-19T19:04:59.000Z",
        subject: "BBVA - Notificacion Ref: $45.900",
        body: "Fecha: 18/05/2026 Establecimiento: PANADERIA CENTRAL. Ref: $45.900",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          amount: 45900,
          description: "PANADERIA CENTRAL",
          date: "2026-05-18",
          confidence: 0.84,
        }),
      })
    );
  });

  it("extracts Davibank transaction-line amount and date", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Davibank <davibankinforma@davibank.com>",
        receivedAt: "2026-05-19T19:04:59.000Z",
        body: "Compraste en Tienda Norte el dia 18/05 con tu tarjeta. La siguiente transaccion o compra Tienda Norte. $88.500 $88.500/18/05 14:22:10",
      })
    );

    expect(result).toEqual({
      kind: "parsed",
      parserKey: "davibank:purchase",
      parsed: {
        type: "expense",
        amount: 88500,
        categoryId: "other",
        description: "Tienda Norte",
        counterpartyHint: "Tienda Norte",
        date: "2026-05-18",
        confidence: 0.88,
      },
    });
  });

  it("uses the previous year for partial Davibank dates received in January", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Davibank <davibankinforma@davibank.com>",
        receivedAt: "2026-01-01T01:04:59.000Z",
        body: "Compraste en Tienda Norte el dia 31/12 con tu tarjeta. La siguiente transaccion o compra Tienda Norte. $88.500 $88.500/31/12 23:22:10",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          date: "2025-12-31",
        }),
      })
    );
  });

  it("does not shift partial Davibank dates into the next year", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Davibank <davibankinforma@davibank.com>",
        receivedAt: "2026-12-31T23:04:59.000Z",
        body: "Compraste en Tienda Norte el dia 01/01 con tu tarjeta. La siguiente transaccion o compra Tienda Norte. $88.500 $88.500/01/01 00:22:10",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          date: "2026-01-01",
        }),
      })
    );
  });

  it("falls back to received date when Davibank partial dates are malformed", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Davibank <davibankinforma@davibank.com>",
        body: "Compraste en Tienda Norte el dia 18/05 con tu tarjeta. La siguiente transaccion o compra Tienda Norte. $88.500 $88.500/13/40 14:22:10",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          date: "2026-05-18",
        }),
      })
    );
  });

  it("extracts Davibank short purchase alerts", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Davibank <davibankinforma@davibank.com>",
        body: "Compra en Cafe Local el $22.300 . Si no lo hiciste comunicate a la linea.",
      })
    );

    expect(result).toEqual({
      kind: "parsed",
      parserKey: "davibank:purchase",
      parsed: {
        type: "expense",
        amount: 22300,
        categoryId: "other",
        description: "Cafe Local",
        counterpartyHint: "Cafe Local",
        date: "2026-05-18",
        confidence: 0.86,
      },
    });
  });

  it("extracts Davibank short purchase alerts with HTML entity accents", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Davibank <davibankinforma@davibank.com>",
        body: "Compra en Cafe Local el $22.300 . s&iacute; no lo hiciste comunicate a la linea.",
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "parsed",
        parsed: expect.objectContaining({
          description: "Cafe Local",
        }),
      })
    );
  });

  it("does not parse generic Davibank content as a short purchase alert", () => {
    const result = parseKnownBankEmail(
      makeEmail({
        from: "Davibank <davibankinforma@davibank.com>",
        subject: "Actualizacion de canales",
        body: "Consulta tus extractos en Davibank el $22.300 . Revisa terminos y condiciones.",
      })
    );

    expect(result).toEqual({
      kind: "failed",
      parserKey: "davibank",
      request: expect.objectContaining({
        status: "failed",
      }),
    });
  });
});

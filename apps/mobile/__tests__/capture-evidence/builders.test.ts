import { describe, expect, it } from "vitest";
import {
  buildApplePayCaptureEvidence,
  buildEmailCaptureEvidence,
  buildNotificationCaptureEvidence,
} from "@/features/capture-evidence";
import { summarizeEmailEvidenceInputDiagnostics } from "@/features/capture-evidence/lib/build-capture-evidence";

describe("capture evidence builders", () => {
  it("builds normalized sender and domain evidence from email senders", () => {
    expect(buildEmailCaptureEvidence({ from: "Notificaciones@Bancolombia.com.co" })).toEqual([
      {
        sourceFamily: "bancolombia",
        evidenceType: "sender_email",
        scope: "email:bancolombia:sender",
        value: "notificaciones@bancolombia.com.co",
      },
      {
        sourceFamily: "bancolombia",
        evidenceType: "sender_domain",
        scope: "email:bancolombia:domain",
        value: "bancolombia.com.co",
      },
    ]);
  });

  it("builds typed LLM account evidence from parsed email account hints", () => {
    expect(
      buildEmailCaptureEvidence({
        from: "Notificaciones@Bancolombia.com.co",
        cardProductHint: "Visa Oro",
        accountTypeHint: "Tarjeta de credito",
        counterpartyHint: "Rappi Colombia",
      })
    ).toEqual([
      {
        sourceFamily: "bancolombia",
        evidenceType: "sender_email",
        scope: "email:bancolombia:sender",
        value: "notificaciones@bancolombia.com.co",
      },
      {
        sourceFamily: "bancolombia",
        evidenceType: "sender_domain",
        scope: "email:bancolombia:domain",
        value: "bancolombia.com.co",
      },
      {
        sourceFamily: "bancolombia",
        evidenceType: "card_product_hint",
        scope: "email:bancolombia:card_product_hint",
        value: "visa oro",
      },
      {
        sourceFamily: "bancolombia",
        evidenceType: "account_type_hint",
        scope: "email:bancolombia:account_type_hint",
        value: "tarjeta de credito",
      },
      {
        sourceFamily: "bancolombia",
        evidenceType: "counterparty_hint",
        scope: "email:bancolombia:counterparty_hint",
        value: "rappi colombia",
      },
    ]);
  });

  it("extracts last4 evidence from precise email payment method labels", () => {
    expect(
      buildEmailCaptureEvidence({
        from: "notificaciones@rappicard.co",
        body: "Metodo de pago *0746\nAutorizacion 446288",
      })
    ).toContainEqual({
      sourceFamily: "rappicard",
      evidenceType: "last4",
      scope: "email:rappicard:last4",
      value: "0746",
    });
  });

  it("extracts last4 evidence when the email payment method label has card text before the suffix", () => {
    expect(
      buildEmailCaptureEvidence({
        from: "notificaciones@rappicard.co",
        body: "Método de pago\nRappiCard Crédito **** 0746\nAutorizacion 446288",
      })
    ).toContainEqual({
      sourceFamily: "rappicard",
      evidenceType: "last4",
      scope: "email:rappicard:last4",
      value: "0746",
    });
  });

  it("extracts last4 evidence when Outlook provides an HTML email body", () => {
    expect(
      buildEmailCaptureEvidence({
        from: "notificaciones@rappicard.co",
        body: `
          <html><body>
            <table>
              <tr><td>Método de pago</td></tr>
              <tr><td>RappiCard Crédito</td><td>**** 0746</td></tr>
            </table>
            <p>Autorizacion 446288</p>
          </body></html>
        `,
      })
    ).toContainEqual({
      sourceFamily: "rappicard",
      evidenceType: "last4",
      scope: "email:rappicard:last4",
      value: "0746",
    });
  });

  it("summarizes email evidence input shape without exposing the card suffix", () => {
    const diagnostics = summarizeEmailEvidenceInputDiagnostics({
      family: "rappicard",
      rawText: "Método de pago\nRappiCard Crédito **** 0746\nAutorizacion 446288",
    });

    expect(diagnostics).toEqual({
      sourceFamily: "rappicard",
      bodyLength: expect.any(Number),
      evidenceTextLength: expect.any(Number),
      hasPaymentMethodLabel: true,
      maskedPaymentMethodMatchCount: 1,
    });
    expect(JSON.stringify(diagnostics)).not.toContain("0746");
    expect(JSON.stringify(diagnostics)).not.toContain("446288");
  });

  it("does not extract email authorization numbers as last4 evidence", () => {
    expect(
      buildEmailCaptureEvidence({
        from: "notificaciones@rappicard.co",
        body: "Autorizacion 446288\nReferencia 1829\nCompra por $18.290",
      })
    ).not.toContainEqual({
      sourceFamily: "rappicard",
      evidenceType: "last4",
      scope: "email:rappicard:last4",
      value: "1829",
    });
  });

  it("extracts package family, alias tokens, and last4 evidence from notifications", () => {
    expect(
      buildNotificationCaptureEvidence({
        packageName: "com.todo1.mobile.co.bancolombia",
        title: "Bancolombia",
        subText: "Cuenta ahorros",
        text: "Compra aprobada",
        bigText: "Compra aprobada con tarjeta ****1234 desde tu cuenta de ahorros",
        timestamp: Date.UTC(2026, 3, 19),
      })
    ).toEqual([
      {
        sourceFamily: "bancolombia",
        evidenceType: "package_name",
        scope: "notification:bancolombia:package",
        value: "com.todo1.mobile.co.bancolombia",
      },
      {
        sourceFamily: "bancolombia",
        evidenceType: "alias_token",
        scope: "notification:bancolombia:alias",
        value: "ahorros",
      },
      {
        sourceFamily: "bancolombia",
        evidenceType: "last4",
        scope: "notification:bancolombia:last4",
        value: "1234",
      },
    ]);
  });

  it("preserves Apple Pay card hints and extracts last4 when present", () => {
    expect(
      buildApplePayCaptureEvidence({
        amount: 50000,
        merchant: "Farmatodo",
        card: "Visa *1234",
      })
    ).toEqual([
      {
        sourceFamily: "apple_pay",
        evidenceType: "card_hint",
        scope: "apple_pay:card_hint",
        value: "visa *1234",
      },
      {
        sourceFamily: "apple_pay",
        evidenceType: "last4",
        scope: "apple_pay:last4",
        value: "1234",
      },
    ]);
  });
});

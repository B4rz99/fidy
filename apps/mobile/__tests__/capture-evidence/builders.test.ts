import { describe, expect, it } from "vitest";
import {
  buildApplePayCaptureEvidence,
  buildEmailCaptureEvidence,
  buildNotificationCaptureEvidence,
} from "@/features/capture-evidence";

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

  it("builds LLM account hint evidence from parsed email account hints", () => {
    expect(
      buildEmailCaptureEvidence({
        from: "Notificaciones@Bancolombia.com.co",
        fromAccountHint: "Tarjeta de credito Bancolombia",
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
        evidenceType: "llm_account_hint",
        scope: "email:bancolombia:llm_account_hint",
        value: "tarjeta de credito bancolombia",
      },
    ]);
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

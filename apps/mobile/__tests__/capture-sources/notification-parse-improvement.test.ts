import { describe, expect, it, vi } from "vitest";
import {
  buildNotificationParseImprovementSample,
  shareNotificationParseImprovementSample,
} from "@/features/capture-sources/lib/notification-parse-improvement";

const mockCapturePipelineEvent = vi.fn<(...args: any[]) => any>();
const mockInsertNotificationParseImprovementSample = vi
  .fn<(...args: any[]) => any>()
  .mockResolvedValue(undefined);

vi.mock("@/shared/lib", () => ({
  capturePipelineEvent: (...args: Parameters<typeof mockCapturePipelineEvent>) =>
    mockCapturePipelineEvent(...args),
}));

vi.mock("@/features/capture-sources/lib/notification-parse-improvement-repository", () => ({
  insertNotificationParseImprovementSample: (...args: unknown[]) =>
    mockInsertNotificationParseImprovementSample(...args),
}));

describe("notification parse improvement samples", () => {
  it("turns a raw purchase notification into a structural template", () => {
    const sample = buildNotificationParseImprovementSample({
      rawText:
        "Bancolombia le informa compra por $50,000 en EXITO el 02/05/2026 con tarjeta *1234.",
      source: "notification_android",
      status: "needs_review",
      confidence: 0.45,
      parseMethod: "llm",
    });

    expect(sample).toEqual({
      template:
        "[ENTITY] le informa compra por [AMOUNT] en [MERCHANT] el [DATE] con tarjeta [CARD].",
      source: "notification_android",
      status: "needs_review",
      confidenceBucket: "low",
      parseMethod: "llm",
    });
  });

  it("redacts transfer counterparties without trusting the hinted direction", () => {
    const sample = buildNotificationParseImprovementSample({
      rawText: "Nequi: Recibiste $30.000 de Pedro Lopez el 2026-05-02.",
      source: "notification_android",
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    });

    expect(sample.template).toBe("[ENTITY]: Recibiste [AMOUNT] de [COUNTERPARTY] el [DATE].");
  });

  it("redacts account, ID, NIT, local phone, and masked card values", () => {
    const sample = buildNotificationParseImprovementSample({
      rawText:
        "Bancolombia: C.C. 1012345678 transfirio desde Cuenta 12345678901. NIT 900.123.456-7. Tel 601 456 7890. Cel 300 123 4567. Tarjeta 1234******9876.",
      source: "notification_android",
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    });

    expect(sample.template).toBe(
      "[ENTITY]: [ID] transfirio desde [ACCOUNT]. [ID]. Tel [PHONE]. Cel [PHONE]. Tarjeta [CARD]."
    );
    expect(sample.template).not.toMatch(
      /1012345678|12345678901|900\.123\.456|601 456 7890|300 123 4567|9876/u
    );
  });

  it("redacts unlabeled financial identifiers and counterparty labels", () => {
    const sample = buildNotificationParseImprovementSample({
      rawText:
        "Nequi: Compra EXITO por $50,000. Beneficiario Juan Perez. para Maria Garcia. Ref 900.123.456-7 900123456-7 12345678901 1234 5678 9012 300 123 4567 tarjeta terminada en 1234.",
      source: "notification_android",
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    });

    expect(sample.template).toBe(
      "[ENTITY]: Compra [MERCHANT] por [AMOUNT]. Beneficiario [COUNTERPARTY]. para [COUNTERPARTY]. Ref [ID] [ID] [ACCOUNT] [ACCOUNT] [PHONE] tarjeta [CARD]."
    );
    expect(sample.template).not.toMatch(
      /EXITO|Juan Perez|Maria Garcia|900\.123\.456|900123456|12345678901|1234 5678 9012|300 123 4567|terminada en 1234/u
    );
  });

  it("redacts bare amount values", () => {
    const sample = buildNotificationParseImprovementSample({
      rawText: "Compra Exito por 900. Pago Movistar 50.000.",
      source: "notification_android",
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    });

    expect(sample.template).toBe("Compra [MERCHANT] por [NUMBER]. Pago [MERCHANT].");
    expect(sample.template).not.toMatch(/900|50\.000|Exito|Movistar/u);
  });

  it("redacts lowercase counterparty names before transfer verbs", () => {
    const sample = buildNotificationParseImprovementSample({
      rawText: "juan perez: te envio $10.000",
      source: "notification_android",
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    });

    expect(sample.template).toBe("[COUNTERPARTY]: te envio [AMOUNT]");
    expect(sample.template).not.toContain("juan perez");
  });

  it("does not share samples without explicit consent", async () => {
    await shareNotificationParseImprovementSample({
      consent: false,
      userId: "user-1",
      rawText: "Compra por $50,000 en EXITO.",
      source: "notification_android",
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    });

    expect(mockInsertNotificationParseImprovementSample).not.toHaveBeenCalled();
    expect(mockCapturePipelineEvent).not.toHaveBeenCalled();
  });

  it("stores the anonymized template and sends metadata-only telemetry when consent is explicit", async () => {
    await shareNotificationParseImprovementSample({
      consent: true,
      userId: "user-1",
      rawText: "Compra por $50,000 en EXITO tarjeta *1234.",
      source: "notification_android",
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    });

    expect(mockInsertNotificationParseImprovementSample).toHaveBeenCalledWith({
      userId: "user-1",
      sample: {
        template: "Compra por [AMOUNT] en [MERCHANT] tarjeta [CARD].",
        source: "notification_android",
        status: "failed",
        confidenceBucket: "none",
        parseMethod: "llm",
      },
    });
    expect(mockCapturePipelineEvent).toHaveBeenCalledWith({
      source: "notification_parse_improvement",
      schema: "notification_parse_improvement_v1",
      notificationSource: "notification_android",
      status: "failed",
      confidenceBucket: "none",
      parseMethod: "llm",
      templateLengthBucket: "20_49",
    });
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("EXITO");
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("50,000");
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("1234");
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("MERCHANT");
  });

  it("uses a prebuilt parser template for opted-in email samples", async () => {
    await shareNotificationParseImprovementSample({
      consent: true,
      userId: "user-1",
      parserTemplate: "Compra [MERCHANT] por [AMOUNT] con tarjeta [CARD].",
      rawText: "Compra EXITO por $50,000 con tarjeta *1234.",
      senderDomain: "davibank.com",
      source: "email_gmail",
      status: "needs_review",
      confidence: 0.4,
      parseMethod: "llm",
    });

    expect(mockInsertNotificationParseImprovementSample).toHaveBeenCalledWith({
      userId: "user-1",
      sample: {
        template: "Compra [MERCHANT] por [AMOUNT] con tarjeta [CARD].",
        senderDomain: "davibank.com",
        source: "email_gmail",
        status: "needs_review",
        confidenceBucket: "low",
        parseMethod: "llm",
      },
    });
  });
});

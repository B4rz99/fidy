import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteNotificationParseImprovementSamplesForUser,
  insertNotificationParseImprovementSample,
  setNotificationParseImprovementPreference,
} from "@/features/capture-sources/lib/notification-parse-improvement-repository";

const mockFunctionsInvoke = vi.fn<(...args: any[]) => any>();
const mockFrom = vi.fn<(...args: any[]) => any>();

vi.mock("@/shared/db", () => ({
  getSupabase: () => ({
    from: mockFrom,
    functions: {
      invoke: mockFunctionsInvoke,
    },
  }),
}));

describe("notification parse improvement repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retains structural samples through the Remote API Boundary without direct table access", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, data: { code: "accepted" } },
      error: null,
    });

    await insertNotificationParseImprovementSample({
      userId: "user-1",
      sample: {
        template: "Compra por [AMOUNT] en [MERCHANT].",
        senderDomain: "davibank.com",
        source: "notification_android",
        status: "failed",
        confidenceBucket: "none",
        parseMethod: "llm",
      },
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith("cloud-ledger-api", {
      body: {
        action: "retainCaptureImprovementSample",
        sample: {
          sourceChannel: "notification",
          sourceFamily: "android_notification",
          providerCategory: "unknown",
          templateShape: "Compra por [AMOUNT] en [MERCHANT].",
          parseOutcome: "failed",
          confidenceBucket: "none",
          extractor: {
            method: "llm",
            version: 1,
          },
        },
      },
    });
    expect(JSON.stringify(mockFunctionsInvoke.mock.calls)).not.toMatch(
      /user-1|davibank\.com|sender_domain|rawText|parserTemplate/u
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("maps email sources to safe provider categories before upload", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, data: { code: "accepted" } },
      error: null,
    });

    await insertNotificationParseImprovementSample({
      userId: "user-1",
      sample: {
        template: "Compra por [AMOUNT] en [MERCHANT].",
        senderDomain: "davibank.com",
        source: "email_gmail",
        status: "failed",
        confidenceBucket: "none",
        parseMethod: "llm",
      },
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith("cloud-ledger-api", {
      body: expect.objectContaining({
        sample: expect.objectContaining({
          sourceChannel: "email",
          sourceFamily: "email",
          providerCategory: "bank",
        }),
      }),
    });
    expect(JSON.stringify(mockFunctionsInvoke.mock.calls)).not.toContain("davibank.com");
  });

  it("throws a privacy failure when the Remote API Boundary rejects the sample as unsafe", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: false, error: "unsafe_capture_improvement_sample" },
      error: null,
    });

    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Compra por [AMOUNT] en [MERCHANT].",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");
  });

  it("throws an opt-out failure when the Remote API Boundary rejects retention for preference", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: false, error: "capture_improvement_opted_out" },
      error: null,
    });

    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Compra por [AMOUNT] en [MERCHANT].",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toMatchObject({ name: "ParseImprovementSampleOptOutError" });
  });

  it("deletes user-linked samples through the Remote API Boundary", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, data: { code: "accepted" } },
      error: null,
    });

    await deleteNotificationParseImprovementSamplesForUser({ userId: "user-1" });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith("cloud-ledger-api", {
      body: {
        action: "deleteCaptureImprovementSamples",
      },
    });
    expect(JSON.stringify(mockFunctionsInvoke.mock.calls)).not.toContain("user-1");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("updates Capture Improvement Preference through the Remote API Boundary", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, data: { code: "accepted" } },
      error: null,
    });

    await setNotificationParseImprovementPreference({ userId: "user-1", enabled: true });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith("cloud-ledger-api", {
      body: {
        action: "setCaptureImprovementPreference",
        enabled: true,
      },
    });
    expect(JSON.stringify(mockFunctionsInvoke.mock.calls)).not.toContain("user-1");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects templates that still contain sensitive values before inserting", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Compra con Cuenta 12345678901.",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("rejects unlabeled account, phone, and NIT-like values", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Ref 12345678901 300 123 4567 900.123.456-7.",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("rejects residual bare amount values", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Compra por 50000.",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("rejects residual alphanumeric reference values before upload", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Referencia ABC123XYZ por [AMOUNT].",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("retains structural authorization reference placeholders", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, data: { code: "accepted" } },
      error: null,
    });

    await insertNotificationParseImprovementSample({
      userId: "user-1",
      sample: {
        template: "Autorizacion [REFERENCE] por [AMOUNT].",
        source: "notification_android",
        status: "failed",
        confidenceBucket: "none",
        parseMethod: "llm",
      },
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith("cloud-ledger-api", {
      body: expect.objectContaining({
        sample: expect.objectContaining({
          templateShape: "Autorizacion [REFERENCE] por [AMOUNT].",
        }),
      }),
    });
  });

  it("rejects residual lowercase counterparty names before transfer verbs", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "nequi: juan perez te envio [AMOUNT]",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("rejects residual lowercase entities after colon-labeled fields", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Comercio: exito por [AMOUNT]. Beneficiario: juan perez.",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("rejects unredacted lowercase locations before upload", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "retiro bogota por [AMOUNT].",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("rejects residual all-caps entity names", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Compra EXITO por [AMOUNT].",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("rejects residual title-case entity names", async () => {
    await expect(
      insertNotificationParseImprovementSample({
        userId: "user-1",
        sample: {
          template: "Compra Exito por [AMOUNT].",
          source: "notification_android",
          status: "failed",
          confidenceBucket: "none",
          parseMethod: "llm",
        },
      })
    ).rejects.toThrow("sensitive values");

    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertNotificationParseImprovementSample } from "@/features/capture-sources/lib/notification-parse-improvement-repository";

const mockInsert = vi.fn();

vi.mock("@/shared/db", () => ({
  getSupabase: () => ({
    from: (tableName: string) => {
      expect(tableName).toBe("notification_parse_improvement_samples");
      return { insert: mockInsert };
    },
  }),
}));

describe("notification parse improvement repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts anonymized parse samples into Supabase", async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    await insertNotificationParseImprovementSample({
      userId: "user-1",
      sample: {
        template: "Compra por [AMOUNT] en [MERCHANT].",
        source: "notification_android",
        status: "failed",
        confidenceBucket: "none",
        parseMethod: "llm",
      },
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        template: "Compra por [AMOUNT] en [MERCHANT].",
        source: "notification_android",
        status: "failed",
        confidence_bucket: "none",
        parse_method: "llm",
        review_status: "pending",
      })
    );
    expect(mockInsert.mock.calls[0]?.[0].template_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws when Supabase rejects the insert", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "rls denied" } });

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
    ).rejects.toThrow("Unable to store parse improvement sample");
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

    expect(mockInsert).not.toHaveBeenCalled();
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

    expect(mockInsert).not.toHaveBeenCalled();
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

    expect(mockInsert).not.toHaveBeenCalled();
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

    expect(mockInsert).not.toHaveBeenCalled();
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

    expect(mockInsert).not.toHaveBeenCalled();
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

    expect(mockInsert).not.toHaveBeenCalled();
  });
});

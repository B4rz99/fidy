// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BankSender } from "@/features/email-capture/lib/bank-senders";
import type { RawEmail } from "@/features/email-capture/schema";

const mockGetProcessedExternalIds = vi.fn().mockResolvedValue(new Set<string>());
const mockInsertProcessedEmail = vi.fn();
const mockInsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();
const mockLookupMerchantRule = vi.fn().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn();
const mockParseEmailApi = vi.fn().mockResolvedValue(null);

vi.mock("@/features/email-capture/lib/repository", () => ({
  getProcessedExternalIds: (...args: unknown[]) => mockGetProcessedExternalIds(...args),
  insertProcessedEmail: (...args: unknown[]) => mockInsertProcessedEmail(...args),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: unknown[]) => mockInsertTransaction(...args),
  enqueueSync: (...args: unknown[]) => mockEnqueueSync(...args),
}));

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  lookupMerchantRule: (...args: unknown[]) => mockLookupMerchantRule(...args),
  insertMerchantRule: (...args: unknown[]) => mockInsertMerchantRule(...args),
}));

vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  parseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: unknown[]) => mockGenerateId(...args),
}));

import { processEmails } from "@/features/email-capture/services/email-pipeline";

const mockDb = {} as any;
const USER_ID = "user-1";

const SENDERS: BankSender[] = [
  { bank: "Bancolombia", email: "notificaciones@bancolombia.com.co" },
  { bank: "BBVA", email: "bbva@bbvanet.com.co" },
];

function makeRawEmail(overrides: Partial<RawEmail> = {}): RawEmail {
  return {
    externalId: "ext-1",
    from: "notificaciones@bancolombia.com.co",
    subject: "Compra aprobada",
    body: "Su compra por $50.000 fue aprobada",
    receivedAt: "2026-03-05T10:00:00Z",
    provider: "gmail",
    ...overrides,
  };
}

describe("email processing pipeline", () => {
  let idCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockGenerateId.mockImplementation((prefix: string) => {
      idCounter++;
      return `${prefix}-${idCounter}`;
    });
    mockGetProcessedExternalIds.mockResolvedValue(new Set<string>());
    mockInsertProcessedEmail.mockResolvedValue(undefined);
    mockInsertTransaction.mockResolvedValue(undefined);
    mockEnqueueSync.mockResolvedValue(undefined);
    mockLookupMerchantRule.mockResolvedValue(null);
    mockInsertMerchantRule.mockResolvedValue(undefined);
    mockParseEmailApi.mockResolvedValue(null);
  });

  it("filters out emails from unknown senders", async () => {
    const emails = [makeRawEmail({ from: "promo@random.com" })];

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(mockParseEmailApi).not.toHaveBeenCalled();
    expect(result.filtered).toBe(1);
    expect(result.saved).toBe(0);
  });

  it("skips already processed emails", async () => {
    mockGetProcessedExternalIds.mockResolvedValueOnce(new Set(["ext-1"]));

    const emails = [makeRawEmail()];

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(mockParseEmailApi).not.toHaveBeenCalled();
    expect(result.skippedDuplicate).toBe(1);
  });

  it("marks email as failed when LLM returns null", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(null);

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        externalId: "ext-1",
        status: "failed",
        failureReason: "parse_failed",
      })
    );
  });

  it("saves transaction and caches merchant rule when LLM returns high confidence", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amountCents: 5000000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.saved).toBe(1);
    expect(result.needsReview).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        userId: USER_ID,
        type: "expense",
        amountCents: 5000000,
        source: "email_gmail",
      })
    );
    expect(mockEnqueueSync).toHaveBeenCalled();
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        externalId: "ext-1",
        status: "success",
        confidence: 0.9,
      })
    );
    expect(mockInsertMerchantRule).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "notificaciones@bancolombia.com.co",
      "compra aprobada",
      "other"
    );
  });

  it("saves transaction as needs_review when LLM returns low confidence", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amountCents: 5000000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.5,
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.needsReview).toBe(1);
    expect(result.saved).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockInsertTransaction).toHaveBeenCalled();
    expect(mockEnqueueSync).toHaveBeenCalled();
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        externalId: "ext-1",
        status: "needs_review",
        confidence: 0.5,
      })
    );
    expect(mockInsertMerchantRule).not.toHaveBeenCalled();
  });

  it("uses cached category from merchant rule hit", async () => {
    const emails = [makeRawEmail()];
    mockLookupMerchantRule.mockResolvedValueOnce("food");
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amountCents: 5000000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.8,
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.saved).toBe(1);
    expect(mockLookupMerchantRule).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "notificaciones@bancolombia.com.co",
      "compra aprobada"
    );
    // Should override LLM categoryId with cached one
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        categoryId: "food",
      })
    );
    // Confidence should be 1.0 for merchant rule hits
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        confidence: 1.0,
      })
    );
  });

  it("marks email as failed when Zod validation fails", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amountCents: -100,
      categoryId: "other",
      description: "Bad",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "failed",
        failureReason: expect.stringContaining("validation"),
      })
    );
  });

  it("processes multiple emails in a batch", async () => {
    const emails = [
      makeRawEmail({ externalId: "ext-1" }),
      makeRawEmail({ externalId: "ext-2", from: "promo@random.com" }),
      makeRawEmail({ externalId: "ext-3" }),
    ];

    mockParseEmailApi
      .mockResolvedValueOnce({
        type: "expense",
        amountCents: 5000000,
        categoryId: "other",
        description: "Compra 1",
        date: "2026-03-05",
        confidence: 0.9,
      })
      .mockResolvedValueOnce(null);

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.filtered).toBe(1);
    expect(result.saved).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockParseEmailApi).toHaveBeenCalledTimes(2);
  });

  it("sets source to email_outlook for outlook provider", async () => {
    const emails = [makeRawEmail({ provider: "outlook" })];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "income",
      amountCents: 100000,
      categoryId: "transfer",
      description: "Deposito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.saved).toBe(1);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ source: "email_outlook" })
    );
  });

  it("marks email as failed when LLM throws", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processEmails(mockDb, USER_ID, emails, SENDERS);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "failed",
        failureReason: "parse_error",
      })
    );
  });

  it("returns zero counts for empty input", async () => {
    const result = await processEmails(mockDb, USER_ID, [], SENDERS);

    expect(result).toEqual({
      filtered: 0,
      skippedDuplicate: 0,
      saved: 0,
      failed: 0,
      needsReview: 0,
    });
  });
});

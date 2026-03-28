// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEmail } from "@/features/email-capture/schema";

import { processEmails, processRetries } from "@/features/email-capture/services/email-pipeline";

const mockGetProcessedExternalIds = vi.fn().mockResolvedValue(new Set<string>());
const mockInsertProcessedEmail = vi.fn();
const mockInsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();
const mockLookupMerchantRule = vi.fn().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn();
const mockParseEmailApi = vi.fn().mockResolvedValue(null);
const mockFindDuplicateTransaction = vi.fn().mockResolvedValue(null);
const mockGetPendingRetryEmails = vi.fn().mockResolvedValue([]);
const mockMarkForRetry = vi.fn();
const mockMarkPermanentlyFailed = vi.fn();
const mockMarkRetrySuccess = vi.fn();
const mockUpdateProcessedEmailStatus = vi.fn();

vi.mock("@/features/capture-sources/lib/dedup", () => ({
  findDuplicateTransaction: (...args: unknown[]) => mockFindDuplicateTransaction(...args),
}));

vi.mock("@/features/email-capture/lib/repository", () => ({
  getProcessedExternalIds: (...args: unknown[]) => mockGetProcessedExternalIds(...args),
  insertProcessedEmail: (...args: unknown[]) => mockInsertProcessedEmail(...args),
  getPendingRetryEmails: (...args: unknown[]) => mockGetPendingRetryEmails(...args),
  markForRetry: (...args: unknown[]) => mockMarkForRetry(...args),
  markPermanentlyFailed: (...args: unknown[]) => mockMarkPermanentlyFailed(...args),
  markRetrySuccess: (...args: unknown[]) => mockMarkRetrySuccess(...args),
  updateProcessedEmailStatus: (...args: unknown[]) => mockUpdateProcessedEmailStatus(...args),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: unknown[]) => mockInsertTransaction(...args),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: (...args: unknown[]) => mockEnqueueSync(...args),
}));

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  lookupMerchantRule: (...args: unknown[]) => mockLookupMerchantRule(...args),
  insertMerchantRule: (...args: unknown[]) => mockInsertMerchantRule(...args),
}));

vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  parseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
}));

vi.mock("@/shared/lib/sentry", () => ({
  captureError: vi.fn(),
  capturePipelineEvent: vi.fn(),
  captureWarning: vi.fn(),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: unknown[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
  generateProcessedEmailId: () => mockGenerateId("pe"),
  generateSyncQueueId: () => mockGenerateId("sq"),
}));

const mockDb = {} as any;
const USER_ID = "user-1";

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
    mockFindDuplicateTransaction.mockResolvedValue(null);
    mockGetPendingRetryEmails.mockResolvedValue([]);
    mockMarkForRetry.mockResolvedValue(undefined);
    mockMarkPermanentlyFailed.mockResolvedValue(undefined);
    mockMarkRetrySuccess.mockResolvedValue(undefined);
    mockUpdateProcessedEmailStatus.mockResolvedValue(undefined);
  });

  it("skips already processed emails", async () => {
    mockGetProcessedExternalIds.mockResolvedValueOnce(new Set(["ext-1"]));

    const emails = [makeRawEmail()];

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(mockParseEmailApi).not.toHaveBeenCalled();
    expect(result.skippedDuplicate).toBe(1);
  });

  it("skips non-transaction email when LLM returns null", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(null);

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.filtered).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        externalId: "ext-1",
        status: "skipped",
        failureReason: null,
      })
    );
  });

  it("saves transaction and caches merchant rule when LLM returns high confidence", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.saved).toBe(1);
    expect(result.needsReview).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        userId: USER_ID,
        type: "expense",
        amount: 50000,
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
      "compra en exito",
      "other",
      expect.any(String)
    );
  });

  it("saves transaction as needs_review when LLM returns low confidence", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.5,
    });

    const result = await processEmails(mockDb, USER_ID, emails);

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
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.8,
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.saved).toBe(1);
    expect(mockLookupMerchantRule).toHaveBeenCalledWith(mockDb, USER_ID, "compra en exito");
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

  it("processes multiple emails in a batch", async () => {
    const emails = [
      makeRawEmail({ externalId: "ext-1" }),
      makeRawEmail({ externalId: "ext-2" }),
      makeRawEmail({ externalId: "ext-3" }),
    ];

    mockParseEmailApi
      .mockResolvedValueOnce({
        type: "expense",
        amount: 50000,
        categoryId: "other",
        description: "Compra 1",
        date: "2026-03-05",
        confidence: 0.9,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.saved).toBe(1);
    expect(result.filtered).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockParseEmailApi).toHaveBeenCalledTimes(3);
  });

  it("sets source to email_outlook for outlook provider", async () => {
    const emails = [makeRawEmail({ provider: "outlook" })];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "income",
      amount: 1000,
      categoryId: "transfer",
      description: "Deposito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.saved).toBe(1);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ source: "email_outlook" })
    );
  });

  it("marks email as pending_retry with cached rawBody when LLM throws", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "pending_retry",
        failureReason: "parse_error",
        rawBody: "Su compra por $50.000 fue aprobada",
        retryCount: 0,
      })
    );
    // nextRetryAt should be set
    const call = mockInsertProcessedEmail.mock.calls[0]?.[1];
    expect(call.nextRetryAt).toBeTruthy();
  });

  it("marks email as skipped (not pending_retry) when LLM returns null", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(null);

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.filtered).toBe(1);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "skipped",
        failureReason: null,
      })
    );
    // rawBody should NOT be cached for skipped emails
    const call = mockInsertProcessedEmail.mock.calls[0]?.[1];
    expect(call.rawBody).toBeUndefined();
  });

  it("includes needsReview in progress callback", async () => {
    const emails = [makeRawEmail({ externalId: "ext-1" }), makeRawEmail({ externalId: "ext-2" })];
    // First email: low confidence → needs_review
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra 1",
      date: "2026-03-05",
      confidence: 0.5,
    });
    // Second email: high confidence → saved
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 30000,
      categoryId: "food",
      description: "Compra 2",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const progressCalls: {
      total: number;
      completed: number;
      saved: number;
      failed: number;
      needsReview: number;
    }[] = [];

    await processEmails(mockDb, USER_ID, emails, (p) => progressCalls.push(p));

    // Initial call + one per email
    expect(progressCalls.length).toBeGreaterThanOrEqual(3);
    // First call is initial: all zeros
    expect(progressCalls[0]).toEqual(
      expect.objectContaining({ total: 2, completed: 0, saved: 0, failed: 0, needsReview: 0 })
    );
    // After first email (needs_review): needsReview = 1
    const afterFirst = progressCalls[1]!;
    expect(afterFirst.needsReview).toBe(1);
    expect(afterFirst.saved).toBe(0);
    // After second email (saved): saved = 1
    const last = progressCalls[progressCalls.length - 1]!;
    expect(last.needsReview).toBe(1);
    expect(last.saved).toBe(1);
  });

  it("returns zero counts for empty input", async () => {
    const result = await processEmails(mockDb, USER_ID, []);

    expect(result).toEqual({
      filtered: 0,
      skippedDuplicate: 0,
      skippedCrossSource: 0,
      saved: 0,
      failed: 0,
      needsReview: 0,
    });
  });

  it("deduplicates emails with the same externalId within a batch", async () => {
    // Same externalId appearing twice (e.g., same Gmail account connected twice)
    const emails = [
      makeRawEmail({ externalId: "ext-dup", body: "Compra por $64.000 en CHERNIKA SAS" }),
      makeRawEmail({ externalId: "ext-dup", body: "Compra por $64.000 en CHERNIKA SAS" }),
    ];
    mockParseEmailApi.mockResolvedValue({
      type: "expense",
      amount: 64000,
      categoryId: "other",
      description: "CHERNIKA SAS",
      date: "2026-03-20",
      confidence: 0.9,
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    // Only ONE transaction should be created, second email should be skipped as duplicate
    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
    expect(result.saved + result.needsReview + result.filtered).toBeLessThanOrEqual(1);
    expect(result.skippedDuplicate).toBeGreaterThanOrEqual(1);
  });
});

function makePendingRetryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pe-retry-1",
    externalId: "ext-retry-1",
    provider: "gmail",
    status: "pending_retry",
    failureReason: "parse_error",
    subject: "Compra aprobada",
    rawBodyPreview: "Su compra por $50.000...",
    rawBody: "Su compra por $50.000 fue aprobada",
    receivedAt: "2026-03-05T10:00:00Z",
    transactionId: null,
    confidence: null,
    retryCount: 1,
    nextRetryAt: "2026-03-15T11:00:00Z",
    createdAt: "2026-03-05T10:00:00Z",
    ...overrides,
  };
}

describe("processRetries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let idCounter = 0;
    mockGenerateId.mockImplementation((prefix: string) => {
      idCounter++;
      return `${prefix}-${idCounter}`;
    });
    mockGetPendingRetryEmails.mockResolvedValue([]);
    mockMarkForRetry.mockResolvedValue(undefined);
    mockMarkPermanentlyFailed.mockResolvedValue(undefined);
    mockMarkRetrySuccess.mockResolvedValue(undefined);
    mockInsertTransaction.mockResolvedValue(undefined);
    mockEnqueueSync.mockResolvedValue(undefined);
    mockLookupMerchantRule.mockResolvedValue(null);
    mockInsertMerchantRule.mockResolvedValue(undefined);
    mockParseEmailApi.mockResolvedValue(null);
    mockUpdateProcessedEmailStatus.mockResolvedValue(undefined);
    mockFindDuplicateTransaction.mockResolvedValue(null);
  });

  it("picks up due pending_retry emails and calls parseEmailApi with cached rawBody", async () => {
    const row = makePendingRetryRow();
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce(null);

    await processRetries(mockDb, USER_ID);

    expect(mockGetPendingRetryEmails).toHaveBeenCalledWith(mockDb);
    expect(mockParseEmailApi).toHaveBeenCalledWith(row.rawBody);
  });

  it("creates transaction on successful retry", async () => {
    const row = makePendingRetryRow();
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processRetries(mockDb, USER_ID);

    expect(mockInsertTransaction).toHaveBeenCalled();
    expect(mockEnqueueSync).toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it("calls markRetrySuccess with correct status/transactionId/confidence", async () => {
    const row = makePendingRetryRow();
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    await processRetries(mockDb, USER_ID);

    expect(mockMarkRetrySuccess).toHaveBeenCalledWith(
      mockDb,
      "pe-retry-1",
      "success",
      expect.stringMatching(/^tx-/),
      0.9
    );
  });

  it("marks as needs_review when confidence < 0.7 on retry", async () => {
    const row = makePendingRetryRow();
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.5,
    });

    await processRetries(mockDb, USER_ID);

    expect(mockMarkRetrySuccess).toHaveBeenCalledWith(
      mockDb,
      "pe-retry-1",
      "needs_review",
      expect.stringMatching(/^tx-/),
      0.5
    );
  });

  it("increments retryCount on failure and schedules next retry", async () => {
    const row = makePendingRetryRow({ retryCount: 2 });
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkForRetry).toHaveBeenCalledWith(mockDb, "pe-retry-1", 3, expect.any(String));
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("marks as permanently failed when max retries reached", async () => {
    const row = makePendingRetryRow({ retryCount: 4 });
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkPermanentlyFailed).toHaveBeenCalledWith(mockDb, "pe-retry-1");
    expect(result.permanentlyFailed).toBe(1);
  });

  it("marks as skipped when LLM returns null on retry", async () => {
    const row = makePendingRetryRow();
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce(null);

    await processRetries(mockDb, USER_ID);

    expect(mockUpdateProcessedEmailStatus).toHaveBeenCalledWith(
      mockDb,
      "pe-retry-1",
      "skipped",
      null
    );
  });

  it("skips duplicate transaction from another source on retry", async () => {
    const row = makePendingRetryRow();
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });
    mockFindDuplicateTransaction.mockResolvedValueOnce("tx-existing");

    const result = await processRetries(mockDb, USER_ID);

    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockMarkRetrySuccess).toHaveBeenCalledWith(
      mockDb,
      "pe-retry-1",
      "success",
      "tx-existing",
      0.9
    );
    expect(result.succeeded).toBe(1);
  });

  it("permanently fails email with missing rawBody", async () => {
    const row = makePendingRetryRow({ rawBody: null });
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkPermanentlyFailed).toHaveBeenCalledWith(mockDb, "pe-retry-1");
    expect(result.permanentlyFailed).toBe(1);
    expect(mockParseEmailApi).not.toHaveBeenCalled();
  });

  it("schedules retry with backoff when save fails", async () => {
    const row = makePendingRetryRow({ retryCount: 1 });
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });
    mockInsertTransaction.mockImplementationOnce(() => {
      throw new Error("DB constraint error");
    });

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkForRetry).toHaveBeenCalledWith(mockDb, "pe-retry-1", 2, expect.any(String));
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("permanently fails when save fails at max retries", async () => {
    const row = makePendingRetryRow({ retryCount: 4 });
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });
    mockInsertTransaction.mockImplementationOnce(() => {
      throw new Error("DB constraint error");
    });

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkPermanentlyFailed).toHaveBeenCalledWith(mockDb, "pe-retry-1");
    expect(result.permanentlyFailed).toBe(1);
  });

  it("returns correct counts", async () => {
    mockGetPendingRetryEmails.mockResolvedValueOnce([]);

    const result = await processRetries(mockDb, USER_ID);

    expect(result).toEqual({ retried: 0, succeeded: 0, permanentlyFailed: 0 });
  });
});

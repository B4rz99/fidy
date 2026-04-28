// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEmail } from "@/features/email-capture/schema";
import { createEmailPipelineService } from "@/features/email-capture/services/create-email-pipeline-service";
import { processEmails, processRetries } from "@/features/email-capture/services/email-pipeline";
import { requireIsoDateTime, requireUserId } from "@/shared/types/assertions";
import type { FinancialAccountId } from "@/shared/types/branded";

const mockGetProcessedExternalIds = vi.fn().mockResolvedValue(new Set<string>());
const mockInsertProcessedEmail = vi.fn();
const mockInsertTransaction = vi.fn();
const mockLookupMerchantRule = vi.fn().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn();
const mockParseEmailApi = vi.fn().mockResolvedValue(null);
const mockFindDuplicateTransaction = vi.fn().mockResolvedValue(null);
const mockGetPendingRetryEmails = vi.fn().mockResolvedValue([]);
const mockMarkForRetry = vi.fn();
const mockMarkPermanentlyFailed = vi.fn();
const mockMarkRetrySuccess = vi.fn();
const mockUpdateProcessedEmailStatus = vi.fn();
const mockEnsureDefaultFinancialAccount = vi.fn().mockReturnValue({
  id: "fa-default-user-1" as FinancialAccountId,
  userId: requireUserId("user-1"),
  name: "Cash",
  kind: "cash",
  isDefault: true,
  createdAt: "2026-04-18T10:00:00.000Z",
  updatedAt: "2026-04-18T10:00:00.000Z",
  deletedAt: null,
});
const mockBuildEmailCaptureEvidence = vi.fn().mockReturnValue([
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
const mockSaveCaptureEvidenceRows = vi.fn();
const mockLinkCaptureEvidenceToTransaction = vi.fn();

function buildCaptureEvidenceRow(
  row: Record<string, unknown>,
  index: number,
  link: Record<string, unknown>
) {
  return {
    id: `ce-${index + 1}`,
    ...row,
    ...link,
    deletedAt: null,
  };
}

function materializeCaptureEvidenceRowsFixture(
  evidence: Record<string, unknown>[],
  link: Record<string, unknown>
) {
  return evidence.map((row, index) => buildCaptureEvidenceRow(row, index, link));
}

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

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  lookupMerchantRule: (...args: unknown[]) => mockLookupMerchantRule(...args),
  insertMerchantRule: (...args: unknown[]) => mockInsertMerchantRule(...args),
}));

vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  parseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
}));

vi.mock("@/features/financial-accounts", () => ({
  ensureDefaultFinancialAccount: (...args: unknown[]) => mockEnsureDefaultFinancialAccount(...args),
}));

vi.mock("@/features/capture-evidence", () => ({
  buildEmailCaptureEvidence: (...args: unknown[]) => mockBuildEmailCaptureEvidence(...args),
  materializeCaptureEvidenceRows: (evidence: any[], link: Record<string, unknown>) =>
    materializeCaptureEvidenceRowsFixture(evidence, link),
  saveCaptureEvidenceRows: (...args: unknown[]) => mockSaveCaptureEvidenceRows(...args),
  linkCaptureEvidenceToTransaction: (...args: unknown[]) =>
    mockLinkCaptureEvidenceToTransaction(...args),
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
}));

const mockDb = {} as any;
const USER_ID = requireUserId("user-1");
let idCounter = 0;

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

function makeParsedEmailResult(overrides: Record<string, unknown> = {}) {
  return {
    type: "expense",
    amount: 50000,
    categoryId: "other",
    description: "Compra en Exito",
    date: "2026-03-05",
    confidence: 0.9,
    ...overrides,
  };
}

function resetGeneratedIds() {
  idCounter = 0;
  mockGenerateId.mockImplementation((prefix: string) => {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
  });
}

function resetPipelineMocks() {
  mockGetProcessedExternalIds.mockResolvedValue(new Set<string>());
  mockInsertProcessedEmail.mockResolvedValue(undefined);
  mockInsertTransaction.mockResolvedValue(undefined);
  mockLookupMerchantRule.mockResolvedValue(null);
  mockInsertMerchantRule.mockResolvedValue(undefined);
  mockParseEmailApi.mockResolvedValue(null);
  mockFindDuplicateTransaction.mockResolvedValue(null);
  mockGetPendingRetryEmails.mockResolvedValue([]);
  mockMarkForRetry.mockResolvedValue(undefined);
  mockMarkPermanentlyFailed.mockResolvedValue(undefined);
  mockMarkRetrySuccess.mockResolvedValue(undefined);
  mockUpdateProcessedEmailStatus.mockResolvedValue(undefined);
}

function resetCaptureEvidenceMocks() {
  mockBuildEmailCaptureEvidence.mockReturnValue([
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
  mockSaveCaptureEvidenceRows.mockResolvedValue(undefined);
  mockLinkCaptureEvidenceToTransaction.mockResolvedValue(undefined);
}

function createTestEmailPipelineService(overrides: Record<string, unknown> = {}) {
  return createEmailPipelineService({
    parseEmailApi: mockParseEmailApi,
    lookupMerchantRule: mockLookupMerchantRule,
    findDuplicateTransaction: mockFindDuplicateTransaction,
    getProcessedExternalIds: mockGetProcessedExternalIds,
    getPendingRetryEmails: mockGetPendingRetryEmails,
    insertProcessedEmail: mockInsertProcessedEmail,
    markForRetry: mockMarkForRetry,
    markPermanentlyFailed: mockMarkPermanentlyFailed,
    markRetrySuccess: mockMarkRetrySuccess,
    updateProcessedEmailStatus: mockUpdateProcessedEmailStatus,
    ensureDefaultFinancialAccount: mockEnsureDefaultFinancialAccount,
    buildEmailCaptureEvidence: mockBuildEmailCaptureEvidence,
    saveCaptureEvidenceRows: mockSaveCaptureEvidenceRows,
    linkCaptureEvidenceToTransaction: mockLinkCaptureEvidenceToTransaction,
    insertTransaction: mockInsertTransaction,
    insertMerchantRule: mockInsertMerchantRule,
    trackTransactionCreated: vi.fn(),
    ...overrides,
  });
}

function expectSavedTransaction(matcher: Record<string, unknown>) {
  expect(mockInsertTransaction).toHaveBeenCalledWith(mockDb, expect.objectContaining(matcher));
}

function expectProcessedEmailSaved(matcher: Record<string, unknown>) {
  expect(mockInsertProcessedEmail).toHaveBeenCalledWith(mockDb, expect.objectContaining(matcher));
}

function expectCaptureEvidenceSaved(transactionId: string | null) {
  expect(mockSaveCaptureEvidenceRows).toHaveBeenCalledWith(
    mockDb,
    expect.arrayContaining([
      expect.objectContaining({
        userId: USER_ID,
        processedEmailId: expect.any(String),
        processedCaptureId: null,
        transactionId,
        scope: "email:bancolombia:sender",
        value: "notificaciones@bancolombia.com.co",
      }),
    ])
  );
}

function expectCaptureEvidenceBuiltFromEmailContent() {
  expect(mockBuildEmailCaptureEvidence).toHaveBeenCalledWith({
    from: "notificaciones@bancolombia.com.co",
    fromAccountHint: undefined,
    toAccountHint: undefined,
  });
}

function expectCaptureEvidenceBuiltFromLlmAccountHint() {
  expect(mockBuildEmailCaptureEvidence).toHaveBeenCalledWith({
    from: "notificaciones@bancolombia.com.co",
    fromAccountHint: "Tarjeta credito Bancolombia",
    toAccountHint: undefined,
  });
}

function mockNeedsReviewThenSavedParseResults() {
  mockParseEmailApi
    .mockResolvedValueOnce(makeParsedEmailResult({ description: "Compra 1", confidence: 0.5 }))
    .mockResolvedValueOnce(
      makeParsedEmailResult({
        amount: 30000,
        categoryId: "food",
        description: "Compra 2",
      })
    );
}

function expectProgressIncludesNeedsReview(
  progressCalls: {
    total: number;
    completed: number;
    saved: number;
    failed: number;
    needsReview: number;
  }[]
) {
  expect(progressCalls.length).toBeGreaterThanOrEqual(3);
  expect(progressCalls[0]).toEqual(
    expect.objectContaining({ total: 2, completed: 0, saved: 0, failed: 0, needsReview: 0 })
  );
  expect(progressCalls[1]?.needsReview).toBe(1);
  expect(progressCalls[1]?.saved).toBe(0);
  expect(progressCalls.at(-1)?.needsReview).toBe(1);
  expect(progressCalls.at(-1)?.saved).toBe(1);
}

describe("email processing pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGeneratedIds();
    resetPipelineMocks();
    resetCaptureEvidenceMocks();
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
    expect(mockSaveCaptureEvidenceRows).toHaveBeenCalledWith(
      mockDb,
      expect.arrayContaining([
        expect.objectContaining({
          userId: USER_ID,
          processedEmailId: expect.any(String),
          processedCaptureId: null,
          transactionId: null,
          scope: "email:bancolombia:sender",
          value: "notificaciones@bancolombia.com.co",
        }),
      ])
    );
    expectCaptureEvidenceBuiltFromEmailContent();
  });

  it("saves transaction and caches merchant rule when LLM returns high confidence", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.saved).toBe(1);
    expect(result.needsReview).toBe(0);
    expect(result.failed).toBe(0);
    expectSavedTransaction({
      userId: USER_ID,
      type: "expense",
      amount: 50000,
      accountId: "fa-default-user-1",
      accountAttributionState: "unresolved",
      source: "email_gmail",
    });
    expectProcessedEmailSaved({
      externalId: "ext-1",
      status: "success",
      confidence: 0.9,
    });
    expectCaptureEvidenceSaved("tx-1");
    expect(mockInsertMerchantRule).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "compra en exito",
      "other",
      expect.any(String)
    );
  });

  it("uses the injected clock for persisted email timestamps and retry backoff", async () => {
    const fixedNow = requireIsoDateTime("2026-04-18T12:34:56.000Z");
    const service = createTestEmailPipelineService({
      clock: {
        now: () => new Date(fixedNow),
        nowIsoDateTime: () => fixedNow,
      },
    });

    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    await service.processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        createdAt: fixedNow,
        nextRetryAt: "2026-04-18T12:35:56.000Z",
      })
    );
  });

  it("waits between parse-email calls when a rate-limit delay is configured", async () => {
    const events: string[] = [];
    const service = createTestEmailPipelineService({
      parseRateLimit: {
        delayMs: 3000,
        sleep: async (delayMs: number) => {
          events.push(`sleep:${delayMs}`);
        },
      },
    });
    mockParseEmailApi.mockImplementation(async (body: string) => {
      events.push(`parse:${body}`);
      return makeParsedEmailResult({ description: body });
    });

    await service.processEmails(mockDb, USER_ID, [
      makeRawEmail({ externalId: "ext-1", body: "Compra 1" }),
      makeRawEmail({ externalId: "ext-2", body: "Compra 2" }),
      makeRawEmail({ externalId: "ext-3", body: "Compra 3" }),
    ]);

    expect(events).toEqual([
      "parse:Compra 1",
      "sleep:3000",
      "parse:Compra 2",
      "sleep:3000",
      "parse:Compra 3",
    ]);
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
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        externalId: "ext-1",
        status: "needs_review",
        confidence: 0.5,
      })
    );
    expect(mockInsertMerchantRule).not.toHaveBeenCalled();
    expectCaptureEvidenceBuiltFromEmailContent();
  });

  it("uses LLM account hints as capture evidence for account suggestions", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(
      makeParsedEmailResult({ fromAccountHint: "Tarjeta credito Bancolombia" })
    );

    await processEmails(mockDb, USER_ID, emails);

    expectCaptureEvidenceBuiltFromLlmAccountHint();
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

  it("marks parsed email as pending_retry when duplicate lookup fails", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    mockFindDuplicateTransaction.mockRejectedValueOnce(new Error("dedup lookup down"));

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "pending_retry",
        failureReason: null,
        rawBody: "Su compra por $50.000 fue aprobada",
        retryCount: 0,
      })
    );
  });

  it("marks parsed email as pending_retry when transaction save fails", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    mockInsertTransaction.mockImplementationOnce(() => {
      throw new Error("db write failed");
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "pending_retry",
        failureReason: null,
        rawBody: "Su compra por $50.000 fue aprobada",
        retryCount: 0,
      })
    );
  });

  it("does not insert a second processed email row after a partial save already persisted one", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    mockGetProcessedExternalIds
      .mockResolvedValueOnce(new Set<string>())
      .mockResolvedValueOnce(new Set<string>(["ext-1"]));
    mockSaveCaptureEvidenceRows.mockImplementationOnce(() => {
      throw new Error("capture evidence failed");
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(mockInsertProcessedEmail).toHaveBeenCalledTimes(1);
    expect(mockInsertProcessedEmail).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "success",
        transactionId: expect.stringMatching(/^tx-/),
      })
    );
  });

  it("continues the batch when parsed output is malformed", async () => {
    const emails = [makeRawEmail({ externalId: "ext-1" }), makeRawEmail({ externalId: "ext-2" })];
    mockParseEmailApi
      .mockResolvedValueOnce({
        type: "expense",
        amount: -1,
        categoryId: "other",
        description: "Compra 1",
        date: "2026-03-05",
        confidence: 0.9,
      } as never)
      .mockResolvedValueOnce({
        type: "expense",
        amount: 30000,
        categoryId: "food",
        description: "Compra 2",
        date: "2026-03-05",
        confidence: 0.9,
      });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(result.saved).toBe(1);
    expect(mockParseEmailApi).toHaveBeenCalledTimes(2);
    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
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
    mockNeedsReviewThenSavedParseResults();

    const progressCalls: {
      total: number;
      completed: number;
      saved: number;
      failed: number;
      needsReview: number;
    }[] = [];

    await processEmails(mockDb, USER_ID, emails, (p) => progressCalls.push(p));

    expectProgressIncludesNeedsReview(progressCalls);
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

    expect(mockEnsureDefaultFinancialAccount).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      expect.objectContaining({ now: expect.any(String) })
    );
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        accountId: "fa-default-user-1",
        accountAttributionState: "unresolved",
      })
    );
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
      expect.objectContaining({
        db: mockDb,
        id: "pe-retry-1",
        status: "success",
        transactionId: expect.stringMatching(/^tx-/),
        confidence: 0.9,
      })
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
      expect.objectContaining({
        db: mockDb,
        id: "pe-retry-1",
        status: "needs_review",
        transactionId: expect.stringMatching(/^tx-/),
        confidence: 0.5,
      })
    );
  });

  it("increments retryCount on failure and schedules next retry", async () => {
    const row = makePendingRetryRow({ retryCount: 2 });
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkForRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pe-retry-1",
        retryCount: 3,
        nextRetryAt: expect.any(String),
      })
    );
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("reschedules retry when parsed output is malformed", async () => {
    const row = makePendingRetryRow({ retryCount: 1 });
    mockGetPendingRetryEmails.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: -1,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    } as never);

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkForRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pe-retry-1",
        retryCount: 2,
        nextRetryAt: expect.any(String),
      })
    );
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
      expect.objectContaining({
        db: mockDb,
        id: "pe-retry-1",
        status: "skipped",
        transactionId: null,
      })
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
      expect.objectContaining({
        db: mockDb,
        id: "pe-retry-1",
        status: "success",
        transactionId: "tx-existing",
        confidence: 0.9,
      })
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

    expect(mockMarkForRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pe-retry-1",
        retryCount: 2,
        nextRetryAt: expect.any(String),
      })
    );
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

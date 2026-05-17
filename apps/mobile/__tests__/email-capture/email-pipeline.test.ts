// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEmail } from "@/features/email-capture/schema";
import { createEmailPipelineService } from "@/features/email-capture/services/create-email-pipeline-service";
import {
  processBackgroundEmails,
  processEmails,
  processInitialSyncEmails,
  processRetries,
} from "@/features/email-capture/services/email-pipeline";
import { requireIsoDateTime, requireUserId } from "@/shared/types/assertions";
import type { FinancialAccountId } from "@/shared/types/branded";

const mockGetProcessedEmailSourceEventIds = vi
  .fn<(...args: any[]) => any>()
  .mockResolvedValue(new Set<string>());
const mockInsertProcessedEmailSourceEvent = vi.fn<(...args: any[]) => any>();
const mockInsertTransaction = vi.fn<(...args: any[]) => any>();
const mockRecordTransaction = vi.fn<(...args: any[]) => any>();
const mockCreateReviewCandidate = vi.fn<(...args: any[]) => any>();
const mockWriteThroughCommit = vi.fn<(...args: any[]) => any>();
const mockLookupMerchantRule = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn<(...args: any[]) => any>();
const mockParseEmailApi = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockFindDuplicateTransaction = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockGetPendingRetryEmailSourceEvents = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
const mockMarkSourceEventForRetry = vi.fn<(...args: any[]) => any>();
const mockMarkSourceEventPermanentlyFailed = vi.fn<(...args: any[]) => any>();
const mockMarkSourceEventRetrySuccess = vi.fn<(...args: any[]) => any>();
const mockUpdateProcessedSourceEventStatus = vi.fn<(...args: any[]) => any>();
const mockEnsureDefaultFinancialAccount = vi.fn<(...args: any[]) => any>().mockReturnValue({
  id: "fa-default-user-1" as FinancialAccountId,
  userId: requireUserId("user-1"),
  name: "Cash",
  kind: "cash",
  isDefault: true,
  createdAt: "2026-04-18T10:00:00.000Z",
  updatedAt: "2026-04-18T10:00:00.000Z",
  deletedAt: null,
});
const mockBuildEmailCaptureEvidence = vi.fn<(...args: any[]) => any>().mockReturnValue([
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
const mockSaveCaptureEvidenceRows = vi.fn<(...args: any[]) => any>();
const mockLinkCaptureEvidenceToTransaction = vi.fn<(...args: any[]) => any>();

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

vi.mock("@/local-ledger/public", () => ({
  createReviewCandidateUseCase:
    ({ commit }: { commit: (command: unknown) => Promise<unknown> }) =>
    async (input: unknown) => {
      await commit({ type: "test-review-candidate" });
      return { success: true, candidate: input };
    },
  recordTransaction: (...args: unknown[]) => mockRecordTransaction(...args),
}));

vi.mock("@/mutations", () => ({
  createWriteThroughMutationModule: (db: unknown) => ({
    commit: (command: unknown) => mockWriteThroughCommit(db, command),
  }),
}));

vi.mock("@/features/email-capture/lib/repository", () => ({
  getProcessedEmailSourceEventIds: (...args: unknown[]) =>
    mockGetProcessedEmailSourceEventIds(...args),
  insertProcessedEmailSourceEvent: (...args: unknown[]) =>
    mockInsertProcessedEmailSourceEvent(...args),
  getPendingRetryEmailSourceEvents: (...args: unknown[]) =>
    mockGetPendingRetryEmailSourceEvents(...args),
  markSourceEventForRetry: (...args: unknown[]) => mockMarkSourceEventForRetry(...args),
  markSourceEventPermanentlyFailed: (...args: unknown[]) =>
    mockMarkSourceEventPermanentlyFailed(...args),
  markSourceEventRetrySuccess: (...args: unknown[]) => mockMarkSourceEventRetrySuccess(...args),
  updateProcessedSourceEventStatus: (...args: unknown[]) =>
    mockUpdateProcessedSourceEventStatus(...args),
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
  retryableParseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
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
  captureError: vi.fn<(...args: any[]) => any>(),
  capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
  captureWarning: vi.fn<(...args: any[]) => any>(),
}));

const mockGenerateId = vi.fn<(...args: any[]) => any>();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: unknown[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
  generateCaptureEvidenceId: () => mockGenerateId("ce"),
  generateProcessedSourceEventId: () => mockGenerateId("pse"),
  generateReviewCandidateId: () => mockGenerateId("rc"),
  generateReviewCandidateCaptureEvidenceId: () => mockGenerateId("rce"),
}));

const mockDb = {} as any;
const USER_ID = requireUserId("user-1");
let idCounter = 0;

const normalizeLedgerText = (value: string | null | undefined) =>
  (value ?? "").trim().slice(0, 200);

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
  [
    mockGetProcessedEmailSourceEventIds,
    mockInsertProcessedEmailSourceEvent,
    mockInsertTransaction,
    mockRecordTransaction,
    mockCreateReviewCandidate,
    mockWriteThroughCommit,
    mockLookupMerchantRule,
    mockInsertMerchantRule,
    mockParseEmailApi,
    mockFindDuplicateTransaction,
    mockGetPendingRetryEmailSourceEvents,
    mockMarkSourceEventForRetry,
    mockMarkSourceEventPermanentlyFailed,
    mockMarkSourceEventRetrySuccess,
    mockUpdateProcessedSourceEventStatus,
  ].forEach((mock) => mock.mockReset());
  mockGetProcessedEmailSourceEventIds.mockResolvedValue(new Set<string>());
  mockInsertProcessedEmailSourceEvent.mockReturnValue(undefined);
  mockInsertTransaction.mockReturnValue(undefined);
  mockRecordTransaction.mockImplementation(async ({ ports, command }) => {
    const transaction = {
      id: ports.generateEntryId(),
      userId: command.userId,
      type: command.type,
      amount: command.amount,
      accountId: command.accountId,
      accountAttributionState: command.accountAttributionState,
      categoryId: command.categoryId,
      occurredOn: command.occurredOn,
      description: normalizeLedgerText(command.description),
      counterpartyName: normalizeLedgerText(command.counterpartyName),
      source: command.source,
    };
    await ports.commit(transaction);
    return { ok: true, transaction, events: [] };
  });
  mockCreateReviewCandidate.mockResolvedValue({ success: true });
  mockWriteThroughCommit.mockResolvedValue(undefined);
  mockLookupMerchantRule.mockResolvedValue(null);
  mockInsertMerchantRule.mockResolvedValue(undefined);
  mockParseEmailApi.mockResolvedValue(null);
  mockFindDuplicateTransaction.mockResolvedValue(null);
  mockGetPendingRetryEmailSourceEvents.mockResolvedValue([]);
  mockMarkSourceEventForRetry.mockResolvedValue(undefined);
  mockMarkSourceEventPermanentlyFailed.mockResolvedValue(undefined);
  mockMarkSourceEventRetrySuccess.mockResolvedValue(undefined);
  mockUpdateProcessedSourceEventStatus.mockResolvedValue(undefined);
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
  mockSaveCaptureEvidenceRows.mockReturnValue(undefined);
  mockLinkCaptureEvidenceToTransaction.mockResolvedValue(undefined);
}

function createTestEmailPipelineService(overrides: Record<string, unknown> = {}) {
  return createEmailPipelineService({
    parseEmailApi: mockParseEmailApi,
    lookupMerchantRule: mockLookupMerchantRule,
    findDuplicateTransaction: mockFindDuplicateTransaction,
    getProcessedEmailSourceEventIds: mockGetProcessedEmailSourceEventIds,
    getPendingRetryEmailSourceEvents: mockGetPendingRetryEmailSourceEvents,
    insertProcessedEmailSourceEvent: mockInsertProcessedEmailSourceEvent,
    markSourceEventForRetry: mockMarkSourceEventForRetry,
    markSourceEventPermanentlyFailed: mockMarkSourceEventPermanentlyFailed,
    markSourceEventRetrySuccess: mockMarkSourceEventRetrySuccess,
    updateProcessedSourceEventStatus: mockUpdateProcessedSourceEventStatus,
    ensureDefaultFinancialAccount: mockEnsureDefaultFinancialAccount,
    buildEmailCaptureEvidence: mockBuildEmailCaptureEvidence,
    saveCaptureEvidenceRows: mockSaveCaptureEvidenceRows,
    insertTransaction: mockInsertTransaction,
    recordTransaction: mockRecordTransaction,
    createReviewCandidate: mockCreateReviewCandidate,
    insertMerchantRule: mockInsertMerchantRule,
    trackTransactionCreated: vi.fn<(...args: any[]) => any>(),
    ...overrides,
  });
}

function expectSavedTransaction(matcher: Record<string, unknown>) {
  expect(mockInsertTransaction).toHaveBeenCalledWith(mockDb, expect.objectContaining(matcher));
}

function expectProcessedSourceEventSaved(matcher: Record<string, unknown>) {
  expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining(matcher)
  );
}

function expectCaptureEvidenceSaved(transactionId: string | null) {
  expect(mockSaveCaptureEvidenceRows).toHaveBeenCalledWith(
    mockDb,
    expect.arrayContaining([
      expect.objectContaining({
        userId: USER_ID,
        processedSourceEventId: expect.any(String),
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
    body: "Su compra por $50.000 fue aprobada",
    fromAccountHint: undefined,
    toAccountHint: undefined,
    cardProductHint: undefined,
    accountTypeHint: undefined,
    counterpartyHint: undefined,
  });
}

function expectCaptureEvidenceBuiltFromLlmAccountHint() {
  expect(mockBuildEmailCaptureEvidence).toHaveBeenCalledWith({
    from: "notificaciones@bancolombia.com.co",
    body: "Su compra por $50.000 fue aprobada",
    fromAccountHint: undefined,
    toAccountHint: undefined,
    cardProductHint: "Visa Oro",
    accountTypeHint: "Tarjeta credito",
    counterpartyHint: "Exito",
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
  expect(progressCalls.some((progress) => progress.needsReview === 1)).toBe(true);
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

  it("skips already processed email source events", async () => {
    mockGetProcessedEmailSourceEventIds.mockResolvedValueOnce(new Set(["email_gmail:ext-1"]));

    const result = await processEmails(mockDb, USER_ID, [makeRawEmail()]);

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
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        sourceEventId: "ext-1",
        status: "dismissed",
        failureReason: null,
        subject: "",
        rawBodyPreview: "",
      })
    );
    expect(mockSaveCaptureEvidenceRows).not.toHaveBeenCalled();
    expect(mockBuildEmailCaptureEvidence).not.toHaveBeenCalled();
  });

  it("emits privacy-safe diagnostics for skipped emails and batch outcomes", async () => {
    const capturePipelineEvent = vi.fn<(...args: any[]) => any>();
    const service = createTestEmailPipelineService({
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent,
      },
    });
    mockParseEmailApi.mockResolvedValueOnce(null);

    await service.processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(capturePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: "email_skipped_v1",
        providerFamily: "gmail",
        skipReason: "filtered",
      })
    );
    expect(capturePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "email",
        schema: "email_pipeline_batch_v1",
        batchSize: 1,
        providerFamilyCount: 1,
        providerFamilies: "gmail",
        dedupedInBatch: 0,
        skippedAlreadyProcessed: 0,
        skippedCrossSource: 0,
        skippedDuplicate: 0,
        filtered: 1,
        saved: 0,
        failed: 0,
        pendingRetry: 0,
        needsReview: 0,
        batchDurationMs: expect.any(Number),
        parseTotalDurationMs: expect.any(Number),
        parseMaxDurationMs: expect.any(Number),
        parseAverageDurationMs: expect.any(Number),
        persistenceTotalDurationMs: expect.any(Number),
        hasFirstSavedTransaction: false,
      })
    );
    expect(JSON.stringify(capturePipelineEvent.mock.calls)).not.toContain("Compra aprobada");
    expect(JSON.stringify(capturePipelineEvent.mock.calls)).not.toContain("50.000");
    expect(JSON.stringify(capturePipelineEvent.mock.calls)).not.toContain(
      "notificaciones@bancolombia.com.co"
    );
    expect(JSON.stringify(capturePipelineEvent.mock.calls)).not.toContain("bancolombia.com.co");
  });

  it("reports parser exceptions without exception messages", async () => {
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const service = createTestEmailPipelineService({
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning,
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });
    mockParseEmailApi.mockRejectedValueOnce(new Error("Compra en Exito por $50.000"));

    await service.processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(captureWarning).toHaveBeenCalledWith("email_parse_exception", {
      provider: "gmail",
      errorType: "Error",
    });
    expect(JSON.stringify(captureWarning.mock.calls)).not.toContain("Exito");
    expect(JSON.stringify(captureWarning.mock.calls)).not.toContain("50.000");
  });

  it("reports first-saved timing without transaction content", async () => {
    const capturePipelineEvent = vi.fn<(...args: any[]) => any>();
    const service = createTestEmailPipelineService({
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent,
      },
    });
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    await service.processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(capturePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: "email_pipeline_batch_v1",
        saved: 1,
        hasFirstSavedTransaction: true,
        firstSavedLatencyMs: expect.any(Number),
      })
    );
    expect(JSON.stringify(capturePipelineEvent.mock.calls)).not.toContain("Compra aprobada");
    expect(JSON.stringify(capturePipelineEvent.mock.calls)).not.toContain("50.000");
    expect(JSON.stringify(capturePipelineEvent.mock.calls)).not.toContain("Exito");
  });

  it("reports first-saved timing when the persisted transaction needs review", async () => {
    const capturePipelineEvent = vi.fn<(...args: any[]) => any>();
    const service = createTestEmailPipelineService({
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent,
      },
    });
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult({ confidence: 0.5 }));

    await service.processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(capturePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: "email_pipeline_batch_v1",
        saved: 0,
        needsReview: 1,
        hasFirstSavedTransaction: true,
        firstSavedLatencyMs: expect.any(Number),
      })
    );
  });

  it("saves transaction and caches merchant rule when LLM returns high confidence", async () => {
    const emails = [makeRawEmail()];
    const trackTransactionCreated = vi.fn<(...args: any[]) => any>();
    const service = createTestEmailPipelineService({ trackTransactionCreated });
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult({ counterpartyHint: "   " }));

    const result = await service.processEmails(mockDb, USER_ID, emails);

    expect(result.saved).toBe(1);
    expect(result.needsReview).toBe(0);
    expect(result.failed).toBe(0);
    expectSavedTransaction({
      userId: USER_ID,
      type: "expense",
      amount: 50000,
      accountId: "fa-default-user-1",
      accountAttributionState: "unresolved",
      description: null,
      counterpartyName: "Compra en Exito",
      source: "email_capture",
    });
    expectProcessedSourceEventSaved({
      sourceEventId: "ext-1",
      status: "processed",
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
    expect(mockFindDuplicateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ merchant: "Compra en Exito" })
    );
    expect(trackTransactionCreated).toHaveBeenCalledWith({
      type: "expense",
      category: "other",
      source: "email",
    });
  });

  it("truncates persisted raw body previews to 500 characters", async () => {
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    const longBody = "x".repeat(501);

    await processEmails(mockDb, USER_ID, [makeRawEmail({ body: longBody })]);

    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ rawBodyPreview: "x".repeat(500) })
    );
  });

  it("persists a new transaction and its processed email in one database transaction", async () => {
    const dbWithTransaction = {
      transaction: vi.fn<(...args: any[]) => any>((operation: (tx: unknown) => unknown) =>
        operation(mockDb)
      ),
    } as any;
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    const result = await processEmails(dbWithTransaction, USER_ID, [makeRawEmail()]);

    expect(result.saved).toBe(1);
    expect(dbWithTransaction.transaction).toHaveBeenCalledTimes(1);
    expect(mockInsertTransaction).toHaveBeenCalledWith(mockDb, expect.any(Object));
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(mockDb, expect.any(Object));
    expect(mockSaveCaptureEvidenceRows).toHaveBeenCalledWith(mockDb, expect.any(Array));
  });

  it("persists a new transaction without a database transaction helper", async () => {
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    const result = await processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(result.saved).toBe(1);
    expect(mockEnsureDefaultFinancialAccount).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      expect.objectContaining({ now: expect.any(String) })
    );
    expect(mockInsertTransaction).toHaveBeenCalledWith(mockDb, expect.any(Object));
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(mockDb, expect.any(Object));
    expect(mockSaveCaptureEvidenceRows).toHaveBeenCalledWith(mockDb, expect.any(Array));
  });

  it("falls back when a database exposes a non-function transaction property", async () => {
    const dbWithNonFunctionTransaction = { transaction: true } as any;
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    const result = await processEmails(dbWithNonFunctionTransaction, USER_ID, [makeRawEmail()]);

    expect(result.saved).toBe(1);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      dbWithNonFunctionTransaction,
      expect.any(Object)
    );
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      dbWithNonFunctionTransaction,
      expect.any(Object)
    );
  });

  it("does not track low-confidence persisted email transactions", async () => {
    const trackTransactionCreated = vi.fn<(...args: any[]) => any>(() => {
      throw new Error("should not track needs_review");
    });
    const service = createTestEmailPipelineService({ trackTransactionCreated });
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult({ confidence: 0.5 }));

    const result = await service.processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(result.needsReview).toBe(1);
    expect(trackTransactionCreated).not.toHaveBeenCalled();
  });

  it("persists review candidates and processed email markers in one database transaction", async () => {
    const txDb = { tx: true };
    const dbWithTransaction = {
      transaction: vi.fn<(...args: any[]) => any>((operation: (tx: unknown) => unknown) =>
        operation(txDb)
      ),
    } as any;
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult({ confidence: 0.5 }));

    const result = await processEmails(dbWithTransaction, USER_ID, [makeRawEmail()]);

    expect(result.needsReview).toBe(1);
    expect(dbWithTransaction.transaction).toHaveBeenCalledTimes(0);
    expect(mockWriteThroughCommit).toHaveBeenCalledWith(
      dbWithTransaction,
      expect.objectContaining({ type: "test-review-candidate" })
    );
    expect(mockInsertProcessedEmailSourceEvent).not.toHaveBeenCalled();
  });

  it("does not report saved when a bundled async write rejects", async () => {
    const dbWithTransaction = {
      transaction: vi.fn<(...args: any[]) => any>((operation: (tx: unknown) => unknown) =>
        operation(mockDb)
      ),
    } as any;
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    mockInsertProcessedEmailSourceEvent.mockRejectedValueOnce(
      new Error("processed email insert failed")
    );

    const result = await processEmails(dbWithTransaction, USER_ID, [makeRawEmail()]);

    expect(result.saved).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.pendingRetry).toBe(1);
    expect(mockInsertMerchantRule).not.toHaveBeenCalled();
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

    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
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
        concurrency: 1,
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

  it("can overlap parse-email calls when rate-limited concurrency is configured", async () => {
    const events: string[] = [];
    let resolveFirstParse!: (result: ReturnType<typeof makeParsedEmailResult>) => void;
    const service = createTestEmailPipelineService({
      parseRateLimit: {
        delayMs: 1000,
        concurrency: 2,
        sleep: async (delayMs: number) => {
          events.push(`sleep:${delayMs}`);
        },
      },
    });
    mockParseEmailApi.mockImplementation(async (body: string) => {
      events.push(`parse:${body}`);
      if (body === "Compra 1") {
        return new Promise((resolve) => {
          resolveFirstParse = resolve;
        });
      }

      return makeParsedEmailResult({ description: body });
    });

    const processing = service.processEmails(mockDb, USER_ID, [
      makeRawEmail({ externalId: "ext-1", body: "Compra 1" }),
      makeRawEmail({ externalId: "ext-2", body: "Compra 2" }),
    ]);

    await vi.waitFor(() => expect(events).toContain("parse:Compra 2"));
    expect(events).toEqual(["parse:Compra 1", "sleep:1000", "parse:Compra 2"]);

    resolveFirstParse(makeParsedEmailResult({ description: "Compra 1" }));
    await processing;
  });

  async function expectSharedParseConcurrencyLimit(
    processEmailsFn:
      | typeof processEmails
      | typeof processBackgroundEmails
      | typeof processInitialSyncEmails
  ) {
    const parseStarts: string[] = [];
    const pendingParses: Array<(result: null) => void> = [];
    mockParseEmailApi.mockImplementation(async (body: string) => {
      parseStarts.push(`parse:${body}`);
      return new Promise((resolve) => pendingParses.push(resolve));
    });

    const processing = processEmailsFn(
      mockDb,
      USER_ID,
      Array.from({ length: 16 }, (_, index) =>
        makeRawEmail({ externalId: `ext-${index + 1}`, body: `Compra ${index + 1}` })
      )
    );

    await vi.waitFor(() => expect(parseStarts).toHaveLength(15));
    expect(parseStarts).not.toContain("parse:Compra 16");

    pendingParses[0]?.(null);
    await vi.waitFor(() => expect(parseStarts).toContain("parse:Compra 16"));

    pendingParses.slice(1).forEach((resolve) => {
      resolve(null);
    });
    await processing;
  }

  it("uses foreground policy with shared parse concurrency", async () => {
    await expectSharedParseConcurrencyLimit(processEmails);
  });

  it("uses background policy with shared parse concurrency", async () => {
    await expectSharedParseConcurrencyLimit(processBackgroundEmails);
  });

  it("uses initial sync policy with shared parse concurrency", async () => {
    await expectSharedParseConcurrencyLimit(processInitialSyncEmails);
  });

  it("does not bound background parsing after durable skips", async () => {
    mockGetProcessedEmailSourceEventIds.mockResolvedValueOnce(
      new Set(["email_gmail:ext-1", "email_gmail:ext-2"])
    );
    mockParseEmailApi.mockResolvedValue(makeParsedEmailResult());

    await processBackgroundEmails(
      mockDb,
      USER_ID,
      Array.from({ length: 14 }, (_, index) =>
        makeRawEmail({ externalId: `ext-${index + 1}`, body: `Compra ${index + 1}` })
      )
    );

    expect(mockParseEmailApi).toHaveBeenCalledTimes(12);
    expect(mockParseEmailApi).toHaveBeenCalledWith("Compra 3");
    expect(mockParseEmailApi).toHaveBeenCalledWith("Compra 14");
  });

  it("serializes duplicate lookup and transaction insert under concurrent parsing", async () => {
    const persistedTransactions: Array<{
      id: string;
      amount: number;
      date: string;
      counterpartyName: string;
    }> = [];
    let releaseFirstInsert!: () => void;
    const firstInsertStarted = new Promise<void>((resolve) => {
      mockInsertTransaction.mockImplementation(async (_db, row) => {
        if (mockInsertTransaction.mock.calls.length === 1) {
          resolve();
          await new Promise<void>((release) => {
            releaseFirstInsert = release;
          });
        }

        persistedTransactions.push({
          id: row.id,
          amount: row.amount,
          date: row.date,
          counterpartyName: row.counterpartyName,
        });
      });
    });
    const service = createTestEmailPipelineService({
      parseRateLimit: { delayMs: 0, concurrency: 2 },
    });
    mockParseEmailApi.mockResolvedValue(makeParsedEmailResult({ description: "Compra duplicada" }));
    mockFindDuplicateTransaction.mockImplementation(async ({ amount, date, merchant }) => {
      const existing = persistedTransactions.find(
        (transaction) =>
          transaction.amount === amount &&
          transaction.date === date &&
          transaction.counterpartyName === merchant
      );

      return existing?.id ?? null;
    });

    const processing = service.processEmails(mockDb, USER_ID, [
      makeRawEmail({ externalId: "ext-1", body: "Compra duplicada 1" }),
      makeRawEmail({ externalId: "ext-2", body: "Compra duplicada 2" }),
    ]);

    await firstInsertStarted;
    await Promise.resolve();
    await Promise.resolve();
    releaseFirstInsert();

    const result = await processing;

    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
    expect(result.saved).toBe(1);
    expect(result.skippedCrossSource).toBe(1);
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        sourceEventId: "ext-2",
        status: "duplicate",
        transactionId: expect.stringMatching(/^tx-/),
      })
    );
  });

  it("starts all initial sync parses immediately", async () => {
    const events: string[] = [];
    const pendingParses: Array<(result: ReturnType<typeof makeParsedEmailResult>) => void> = [];
    mockParseEmailApi.mockImplementation(async (body: string) => {
      events.push(`parse:${body}`);
      return new Promise((resolve) => pendingParses.push(resolve));
    });

    const processing = processInitialSyncEmails(
      mockDb,
      USER_ID,
      Array.from({ length: 3 }, (_, index) =>
        makeRawEmail({ externalId: `ext-${index + 1}`, body: `Compra ${index + 1}` })
      )
    );

    await vi.waitFor(() => expect(events).toContain("parse:Compra 3"));
    expect(events).toEqual(["parse:Compra 1", "parse:Compra 2", "parse:Compra 3"]);

    pendingParses[0]?.(makeParsedEmailResult({ description: "Compra 1" }));
    pendingParses[1]?.(makeParsedEmailResult({ description: "Compra 2" }));
    pendingParses[2]?.(makeParsedEmailResult({ description: "Compra 3" }));
    await processing;
  });

  it("does not stop scheduling initial sync parses after the preview target is reached", async () => {
    const events: string[] = [];
    const pendingParses: Array<(result: ReturnType<typeof makeParsedEmailResult>) => void> = [];
    mockParseEmailApi.mockImplementation(async (body: string) => {
      events.push(`parse:${body}`);
      return new Promise((resolve) => pendingParses.push(resolve));
    });

    const processing = processInitialSyncEmails(
      mockDb,
      USER_ID,
      Array.from({ length: 6 }, (_, index) =>
        makeRawEmail({ externalId: `ext-${index + 1}`, body: `Compra ${index + 1}` })
      )
    );

    await vi.waitFor(() => expect(events).toContain("parse:Compra 6"));
    expect(events).toEqual([
      "parse:Compra 1",
      "parse:Compra 2",
      "parse:Compra 3",
      "parse:Compra 4",
      "parse:Compra 5",
      "parse:Compra 6",
    ]);

    pendingParses[0]?.(makeParsedEmailResult({ description: "Compra 1" }));
    pendingParses[1]?.(makeParsedEmailResult({ description: "Compra 2" }));
    pendingParses[2]?.(makeParsedEmailResult({ description: "Compra 3" }));
    pendingParses[3]?.(makeParsedEmailResult({ description: "Compra 4" }));
    pendingParses[4]?.(makeParsedEmailResult({ description: "Compra 5" }));
    pendingParses[5]?.(makeParsedEmailResult({ description: "Compra 6" }));

    const result = await processing;

    expect(result.saved).toBe(6);
  });

  it("passes the explicit initial-sync parse context to remote parsing", async () => {
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    await processInitialSyncEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(mockParseEmailApi).toHaveBeenCalledWith("Su compra por $50.000 fue aprobada", {
      parseContext: "initial_sync",
    });
  });

  it("creates a review candidate without committing a transaction when LLM returns low confidence", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.5,
    });

    const result = await createTestEmailPipelineService().processEmails(mockDb, USER_ID, emails);

    expect(result.needsReview).toBe(1);
    expect(result.saved).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockRecordTransaction).not.toHaveBeenCalled();
    expect(mockCreateReviewCandidate).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        source: expect.objectContaining({
          sourceFamily: "email",
          sourceId: "email_gmail",
          sourceEventId: "ext-1",
          status: "needs_review",
        }),
        candidate: expect.objectContaining({
          candidateKind: "transaction",
          status: "pending",
          money: { amount: 50000, currency: "COP" },
          description: "Compra en Exito",
          confidence: 0.5,
        }),
      })
    );
    expect(mockInsertProcessedEmailSourceEvent).not.toHaveBeenCalled();
    expect(mockInsertMerchantRule).not.toHaveBeenCalled();
    expectCaptureEvidenceBuiltFromEmailContent();
    expect(result.parseImprovementRequests).toEqual([
      {
        rawText: "Compra aprobada\n\nSu compra por $50.000 fue aprobada",
        source: "email_gmail",
        status: "needs_review",
        confidence: 0.5,
        parseMethod: "llm",
      },
    ]);
  });

  it("uses the production email-pipeline review candidate adapter for low-confidence emails", async () => {
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
    expect(mockWriteThroughCommit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        type: "test-review-candidate",
      })
    );
    expect(mockInsertProcessedEmailSourceEvent).not.toHaveBeenCalled();
  });

  it("uses typed LLM account hints as capture evidence for account suggestions", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(
      makeParsedEmailResult({
        cardProductHint: "Visa Oro",
        accountTypeHint: "Tarjeta credito",
        counterpartyHint: "Exito",
      })
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
      counterpartyHint: "   ",
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
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
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
      expect.objectContaining({ source: "email_capture", counterpartyName: "Deposito" })
    );
  });

  it("records successful email intake on processed source events with source-event evidence", async () => {
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    const result = await processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(result.saved).toBe(1);
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        userId: USER_ID,
        sourceFamily: "email",
        sourceId: "email_gmail",
        sourceEventId: "ext-1",
        status: "processed",
        transactionId: expect.stringMatching(/^tx-/),
      })
    );
    expect(mockSaveCaptureEvidenceRows).toHaveBeenCalledWith(
      mockDb,
      expect.arrayContaining([
        expect.objectContaining({
          processedSourceEventId: expect.stringMatching(/^pse-/),
          transactionId: expect.stringMatching(/^tx-/),
        }),
      ])
    );
  });

  it("stores the local-ledger accepted counterparty value", async () => {
    const longCounterparty = "Counterparty ".repeat(30);
    mockParseEmailApi.mockResolvedValueOnce(
      makeParsedEmailResult({
        description: "Parser description",
        counterpartyHint: longCounterparty,
      })
    );

    await processEmails(mockDb, USER_ID, [makeRawEmail()]);

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        counterpartyName: longCounterparty.trim().slice(0, 200),
      })
    );
  });

  it("marks email as pending_retry with cached rawBody when LLM throws", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(result.pendingRetry).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "pending_retry",
        failureReason: "parse_error",
        rawBody: "Su compra por $50.000 fue aprobada",
        retryCount: 0,
      })
    );
    // nextRetryAt should be set
    const call = mockInsertProcessedEmailSourceEvent.mock.calls[0]?.[1];
    expect(call.nextRetryAt).toBeTruthy();
    expect(result.parseImprovementRequests).toEqual([
      {
        rawText: "Compra aprobada\n\nSu compra por $50.000 fue aprobada",
        source: "email_gmail",
        status: "failed",
        confidence: null,
        parseMethod: "llm",
      },
    ]);
  });

  it("marks parsed email as pending_retry when duplicate lookup fails", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    mockFindDuplicateTransaction.mockRejectedValueOnce(new Error("dedup lookup down"));

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(result.pendingRetry).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "pending_retry",
        failureReason: null,
        rawBody: "Su compra por $50.000 fue aprobada",
        retryCount: 0,
      })
    );
    expect(result.parseImprovementRequests).toEqual([]);
  });

  it("marks parsed email as pending_retry when transaction save fails", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    mockInsertTransaction.mockImplementationOnce(() => {
      throw new Error("db write failed");
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(result.pendingRetry).toBe(1);
    expect(result.saved).toBe(0);
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "pending_retry",
        failureReason: null,
        rawBody: "Su compra por $50.000 fue aprobada",
        retryCount: 0,
      })
    );
    expect(result.parseImprovementRequests).toEqual([]);
  });

  it("does not insert a second processed email row after a partial save already persisted one", async () => {
    const emails = [makeRawEmail()];
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());
    mockGetProcessedEmailSourceEventIds
      .mockResolvedValueOnce(new Set<string>())
      .mockResolvedValueOnce(new Set<string>(["email_gmail:ext-1"]));
    mockSaveCaptureEvidenceRows.mockImplementationOnce(() => {
      throw new Error("capture evidence failed");
    });

    const result = await processEmails(mockDb, USER_ID, emails);

    expect(result.failed).toBe(1);
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledTimes(1);
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "processed",
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
      })
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
    expect(mockInsertProcessedEmailSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "dismissed",
        failureReason: null,
      })
    );
    // rawBody should NOT be cached for skipped emails
    const call = mockInsertProcessedEmailSourceEvent.mock.calls[0]?.[1];
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

    await createTestEmailPipelineService().processEmails(mockDb, USER_ID, emails, (p) =>
      progressCalls.push(p)
    );

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
      pendingRetry: 0,
      needsReview: 0,
      parseImprovementRequests: [],
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

  it("does not deduplicate matching source event ids from different providers", async () => {
    mockParseEmailApi.mockResolvedValue(makeParsedEmailResult());

    const result = await processEmails(mockDb, USER_ID, [
      makeRawEmail({ externalId: "same-provider-id", provider: "gmail" }),
      makeRawEmail({ externalId: "same-provider-id", provider: "outlook" }),
    ]);

    expect(mockParseEmailApi).toHaveBeenCalledTimes(2);
    expect(result.saved).toBe(2);
    expect(result.skippedDuplicate).toBe(0);
  });
});

function makePendingRetrySourceEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pse-retry-1",
    userId: USER_ID,
    sourceFamily: "email",
    sourceId: "email_gmail",
    sourceEventId: "ext-retry-1",
    status: "pending_retry",
    failureReason: "parse_error",
    subject: "Compra aprobada",
    rawBodyPreview: "Su compra por $50.000...",
    rawBody: "Su compra por $50.000 fue aprobada",
    retryCount: 1,
    nextRetryAt: "2026-03-15T11:00:00Z",
    transactionId: null,
    confidence: null,
    receivedAt: "2026-03-05T10:00:00Z",
    processedAt: "2026-03-05T10:00:00Z",
    createdAt: "2026-03-05T10:00:00Z",
    updatedAt: "2026-03-05T10:00:00Z",
    deletedAt: null,
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
    mockGetPendingRetryEmailSourceEvents.mockResolvedValue([]);
    mockMarkSourceEventForRetry.mockResolvedValue(undefined);
    mockMarkSourceEventForRetry.mockResolvedValue(undefined);
    mockMarkSourceEventPermanentlyFailed.mockResolvedValue(undefined);
    mockMarkSourceEventPermanentlyFailed.mockResolvedValue(undefined);
    mockMarkSourceEventRetrySuccess.mockResolvedValue(undefined);
    mockMarkSourceEventRetrySuccess.mockResolvedValue(undefined);
    mockInsertTransaction.mockResolvedValue(undefined);
    mockRecordTransaction.mockImplementation(async ({ ports, command }) => {
      const transaction = {
        id: ports.generateEntryId(),
        userId: command.userId,
        type: command.type,
        amount: command.amount,
        accountId: command.accountId,
        accountAttributionState: command.accountAttributionState,
        categoryId: command.categoryId,
        occurredOn: command.occurredOn,
        description: command.description ?? "",
        counterpartyName: normalizeLedgerText(command.counterpartyName),
        source: command.source,
      };
      await ports.commit(transaction);
      return { ok: true, transaction, events: [] };
    });
    mockCreateReviewCandidate.mockResolvedValue({ success: true });
    mockLookupMerchantRule.mockResolvedValue(null);
    mockInsertMerchantRule.mockResolvedValue(undefined);
    mockParseEmailApi.mockResolvedValue(null);
    mockUpdateProcessedSourceEventStatus.mockResolvedValue(undefined);
    mockUpdateProcessedSourceEventStatus.mockResolvedValue(undefined);
    mockFindDuplicateTransaction.mockResolvedValue(null);
  });

  it("picks up due pending_retry email source events and marks retry success on the source event", async () => {
    const row = makePendingRetrySourceEventRow();
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce(makeParsedEmailResult());

    await processRetries(mockDb, USER_ID);

    expect(mockGetPendingRetryEmailSourceEvents).toHaveBeenCalledWith(mockDb, USER_ID);
    expect(mockParseEmailApi).toHaveBeenCalledWith(row.rawBody);
    expect(mockMarkSourceEventRetrySuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-retry-1",
        status: "processed",
        transactionId: expect.stringMatching(/^tx-/),
        confidence: 0.9,
      })
    );
  });

  it("picks up due pending_retry emails and calls parseEmailApi with cached rawBody", async () => {
    const row = makePendingRetrySourceEventRow();
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce(null);

    await processRetries(mockDb, USER_ID);

    expect(mockGetPendingRetryEmailSourceEvents).toHaveBeenCalledWith(mockDb, USER_ID);
    expect(mockParseEmailApi).toHaveBeenCalledWith(row.rawBody);
  });

  it("creates transaction on successful retry", async () => {
    const row = makePendingRetrySourceEventRow();
    const trackTransactionCreated = vi.fn<(...args: any[]) => any>();
    const service = createTestEmailPipelineService({ trackTransactionCreated });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra con tarjeta terminada en 1234",
      counterpartyHint: "Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await service.processRetries(mockDb, USER_ID);

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
    expect(mockInsertMerchantRule).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "exito",
      "other",
      expect.any(String)
    );
    expect(trackTransactionCreated).toHaveBeenCalledWith({
      type: "expense",
      category: "other",
      source: "email",
    });
    expect(result.succeeded).toBe(1);
  });

  it("calls markSourceEventRetrySuccess with correct status/transactionId/confidence", async () => {
    const row = makePendingRetrySourceEventRow();
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    await processRetries(mockDb, USER_ID);

    expect(mockMarkSourceEventRetrySuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-retry-1",
        status: "processed",
        transactionId: expect.stringMatching(/^tx-/),
        confidence: 0.9,
      })
    );
  });

  it("creates a review candidate without a transaction when confidence < 0.7 on retry", async () => {
    const row = makePendingRetrySourceEventRow();
    const trackTransactionCreated = vi.fn<(...args: any[]) => any>();
    const service = createTestEmailPipelineService({ trackTransactionCreated });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.5,
    });

    await service.processRetries(mockDb, USER_ID);

    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockCreateReviewCandidate).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        source: expect.objectContaining({
          processedSourceEventId: "pse-retry-1",
          sourceFamily: "email",
          sourceId: "email_gmail",
          sourceEventId: "ext-retry-1",
          status: "needs_review",
          subject: "Compra aprobada",
          rawBodyPreview: "Su compra por $50.000 fue aprobada",
          confidence: 0.5,
        }),
        candidate: expect.objectContaining({
          candidateKind: "transaction",
          status: "pending",
          money: { amount: 50000, currency: "COP" },
          description: "Compra en Exito",
          confidence: 0.5,
        }),
      })
    );
    expect(mockMarkSourceEventRetrySuccess).not.toHaveBeenCalled();
    expect(mockLinkCaptureEvidenceToTransaction).not.toHaveBeenCalled();
    expect(mockInsertMerchantRule).not.toHaveBeenCalled();
    expect(trackTransactionCreated).not.toHaveBeenCalled();
  });

  it("increments retryCount on failure and schedules next retry", async () => {
    const row = makePendingRetrySourceEventRow({ retryCount: 2 });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkSourceEventForRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-retry-1",
        retryCount: 3,
        nextRetryAt: expect.any(String),
      })
    );
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("reschedules retry when parsed output is malformed", async () => {
    const row = makePendingRetrySourceEventRow({ retryCount: 1 });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: -1,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkSourceEventForRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-retry-1",
        retryCount: 2,
        nextRetryAt: expect.any(String),
      })
    );
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("marks as permanently failed when max retries reached", async () => {
    const row = makePendingRetrySourceEventRow({ retryCount: 4 });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockRejectedValueOnce(new Error("LLM timeout"));

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkSourceEventPermanentlyFailed).toHaveBeenCalledWith(mockDb, "pse-retry-1");
    expect(result.permanentlyFailed).toBe(1);
  });

  it("marks as skipped when LLM returns null on retry", async () => {
    const row = makePendingRetrySourceEventRow();
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
    mockParseEmailApi.mockResolvedValueOnce(null);

    await processRetries(mockDb, USER_ID);

    expect(mockUpdateProcessedSourceEventStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-retry-1",
        status: "dismissed",
        transactionId: null,
      })
    );
  });

  it("skips duplicate transaction from another source on retry", async () => {
    const row = makePendingRetrySourceEventRow();
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
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
    expect(mockMarkSourceEventRetrySuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-retry-1",
        status: "duplicate",
        transactionId: "tx-existing",
        confidence: 0.9,
      })
    );
    expect(result.succeeded).toBe(1);
  });

  it("permanently fails email with missing rawBody", async () => {
    const row = makePendingRetrySourceEventRow({ rawBody: null });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);

    const result = await processRetries(mockDb, USER_ID);

    expect(mockMarkSourceEventPermanentlyFailed).toHaveBeenCalledWith(mockDb, "pse-retry-1");
    expect(result.permanentlyFailed).toBe(1);
    expect(mockParseEmailApi).not.toHaveBeenCalled();
  });

  it("schedules retry with backoff when save fails", async () => {
    const row = makePendingRetrySourceEventRow({ retryCount: 1 });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
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

    expect(mockMarkSourceEventForRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-retry-1",
        retryCount: 2,
        nextRetryAt: expect.any(String),
      })
    );
    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it("permanently fails when save fails at max retries", async () => {
    const row = makePendingRetrySourceEventRow({ retryCount: 4 });
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([row]);
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

    expect(mockMarkSourceEventPermanentlyFailed).toHaveBeenCalledWith(mockDb, "pse-retry-1");
    expect(result.permanentlyFailed).toBe(1);
  });

  it("returns correct counts", async () => {
    mockGetPendingRetryEmailSourceEvents.mockResolvedValueOnce([]);

    const result = await processRetries(mockDb, USER_ID);

    expect(result).toEqual({ retried: 0, succeeded: 0, permanentlyFailed: 0 });
  });
});

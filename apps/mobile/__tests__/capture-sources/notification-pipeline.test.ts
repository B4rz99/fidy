// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationData } from "@/features/capture-sources/schema";
import { processNotification } from "@/features/capture-sources/services/notification-pipeline";
import type { FinancialAccountId } from "@/shared/types/branded";

const mockInsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();
const mockLookupMerchantRule = vi.fn().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn();
const mockParseNotificationApi = vi.fn().mockResolvedValue(null);
const mockIsCaptureProcessed = vi.fn().mockResolvedValue(false);
const mockFindDuplicateTransaction = vi.fn().mockResolvedValue(null);
const mockCaptureFingerprint = vi.fn().mockReturnValue("test-fingerprint");
const mockInsertProcessedCapture = vi.fn();
const mockStripPii = vi.fn().mockImplementation((t: string) => t);
const mockEnsureDefaultFinancialAccount = vi.fn().mockReturnValue({
  id: "fa-default-user-1" as FinancialAccountId,
  userId: "user-1",
  name: "Cash",
  kind: "cash",
  isDefault: true,
  createdAt: "2026-04-18T10:00:00.000Z",
  updatedAt: "2026-04-18T10:00:00.000Z",
  deletedAt: null,
});
const mockBuildNotificationCaptureEvidence = vi.fn().mockReturnValue([
  {
    sourceFamily: "bancolombia",
    evidenceType: "last4",
    scope: "notification:bancolombia:last4",
    value: "1234",
  },
]);
const mockSaveCaptureEvidenceRows = vi.fn();
const mockFindMatchingFinancialAccountId = vi.fn().mockReturnValue(null);
const DEFAULT_NOTIFICATION_CAPTURE_EVIDENCE = {
  sourceFamily: "bancolombia",
  evidenceType: "last4",
  scope: "notification:bancolombia:last4",
  value: "1234",
};

function materializeCaptureEvidenceRow(link: Record<string, unknown>, row: any, index: number) {
  return {
    id: `ce-${index + 1}`,
    ...row,
    ...link,
    deletedAt: null,
  };
}

function materializeCaptureEvidenceRows(evidence: any[], link: Record<string, unknown>) {
  return evidence.map((row, index) => materializeCaptureEvidenceRow(link, row, index));
}

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: any[]) => mockInsertTransaction(...args),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: (...args: any[]) => mockEnqueueSync(...args),
}));

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  lookupMerchantRule: (...args: any[]) => mockLookupMerchantRule(...args),
  insertMerchantRule: (...args: any[]) => mockInsertMerchantRule(...args),
}));

vi.mock("@/features/capture-sources/services/parse-notification-api", () => ({
  parseNotificationApi: (...args: any[]) => mockParseNotificationApi(...args),
}));

vi.mock("@/features/capture-sources/lib/dedup", () => ({
  isCaptureProcessed: (...args: any[]) => mockIsCaptureProcessed(...args),
  findDuplicateTransaction: (...args: any[]) => mockFindDuplicateTransaction(...args),
  captureFingerprint: (...args: any[]) => mockCaptureFingerprint(...args),
}));

vi.mock("@/features/capture-sources/lib/repository", () => ({
  insertProcessedCapture: (...args: any[]) => mockInsertProcessedCapture(...args),
}));

vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  stripPii: (...args: any[]) => mockStripPii(...args),
}));

vi.mock("@/features/financial-accounts", () => ({
  ensureDefaultFinancialAccount: (...args: any[]) => mockEnsureDefaultFinancialAccount(...args),
}));

vi.mock("@/features/account-suggestions", () => ({
  findMatchingFinancialAccountId: (...args: any[]) => mockFindMatchingFinancialAccountId(...args),
}));

vi.mock("@/features/capture-evidence", () => ({
  buildNotificationCaptureEvidence: (...args: any[]) =>
    mockBuildNotificationCaptureEvidence(...args),
  materializeCaptureEvidenceRows,
  saveCaptureEvidenceRows: (...args: any[]) => mockSaveCaptureEvidenceRows(...args),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: any[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
  generateProcessedCaptureId: () => mockGenerateId("pc"),
  generateSyncQueueId: () => mockGenerateId("sq"),
}));

const mockDb = {} as any;
const USER_ID = "user-1";

function makeNotification(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    packageName: "com.todo1.mobile.co.bancolombia",
    text: "Bancolombia le informa compra por $50,000 en EDS LA CASTELLANA. ",
    timestamp: Date.now(),
    ...overrides,
  };
}

function expectSavedNotificationTransaction(transactionId: string) {
  expect(mockInsertTransaction).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      userId: USER_ID,
      type: "expense",
      amount: 50000,
      description: "EDS LA CASTELLANA",
      accountId: "fa-default-user-1",
      accountAttributionState: "unresolved",
      source: "notification_android",
    })
  );
  expect(mockEnqueueSync).toHaveBeenCalled();
  expect(mockInsertProcessedCapture).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      status: "success",
      transactionId,
    })
  );
}

function expectSavedNotificationEvidence(transactionId: string) {
  expect(mockSaveCaptureEvidenceRows).toHaveBeenCalledWith(
    mockDb,
    expect.arrayContaining([
      expect.objectContaining({
        userId: USER_ID,
        processedCaptureId: expect.any(String),
        processedEmailId: null,
        transactionId,
        scope: "notification:bancolombia:last4",
        value: "1234",
      }),
    ])
  );
}

describe("processNotification", () => {
  let idCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockGenerateId.mockImplementation((prefix: string) => {
      idCounter++;
      return `${prefix}-${idCounter}`;
    });
    mockIsCaptureProcessed.mockResolvedValue(false);
    mockFindDuplicateTransaction.mockResolvedValue(null);
    mockLookupMerchantRule.mockResolvedValue(null);
    mockParseNotificationApi.mockResolvedValue(null);
    mockCaptureFingerprint.mockReturnValue("test-fingerprint");
    mockStripPii.mockImplementation((t: string) => t);
    mockBuildNotificationCaptureEvidence.mockReturnValue([DEFAULT_NOTIFICATION_CAPTURE_EVIDENCE]);
    mockFindMatchingFinancialAccountId.mockReturnValue(null);
    mockSaveCaptureEvidenceRows.mockResolvedValue(undefined);
  });

  it("saves transaction when local regex parses successfully", async () => {
    const result = await processNotification(mockDb, USER_ID, makeNotification());

    expect(result.saved).toBe(true);
    expect(result.skippedDuplicate).toBe(false);
    expect(result.transactionId).toBe("tx-1");
    expectSavedNotificationTransaction("tx-1");
    expectSavedNotificationEvidence("tx-1");
  });

  it("falls through to LLM when local regex fails", async () => {
    mockParseNotificationApi.mockResolvedValueOnce({
      type: "expense",
      amount: 35000,
      categoryId: "food",
      description: "Restaurante XYZ",
      date: "2026-03-07",
      confidence: 0.9,
    });

    const result = await processNotification(
      mockDb,
      USER_ID,
      makeNotification({ text: "Some unrecognized bank format with $35,000" })
    );

    expect(mockParseNotificationApi).toHaveBeenCalled();
    expect(result.saved).toBe(true);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        amount: 35000,
        categoryId: "food",
        description: "Restaurante XYZ",
      })
    );
  });

  it("records failed capture when both regex and LLM fail", async () => {
    const result = await processNotification(
      mockDb,
      USER_ID,
      makeNotification({ text: "Your password was changed" })
    );

    expect(result.saved).toBe(false);
    expect(result.skippedDuplicate).toBe(false);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockInsertProcessedCapture).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ status: "failed" })
    );
  });

  it("skips when fingerprint already processed", async () => {
    mockIsCaptureProcessed.mockResolvedValueOnce(true);

    const result = await processNotification(mockDb, USER_ID, makeNotification());

    expect(result.saved).toBe(false);
    expect(result.skippedDuplicate).toBe(true);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockInsertProcessedCapture).not.toHaveBeenCalled();
  });

  it("skips when cross-source duplicate found", async () => {
    mockFindDuplicateTransaction.mockResolvedValueOnce("existing-tx-1");

    const result = await processNotification(mockDb, USER_ID, makeNotification());

    expect(result.saved).toBe(false);
    expect(result.skippedDuplicate).toBe(true);
    expect(result.transactionId).toBe("existing-tx-1");
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(mockInsertProcessedCapture).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "skipped_duplicate",
        transactionId: "existing-tx-1",
      })
    );
  });

  it("uses cached merchant rule for category", async () => {
    mockLookupMerchantRule.mockResolvedValueOnce("transport");

    const result = await processNotification(mockDb, USER_ID, makeNotification());

    expect(result.saved).toBe(true);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "transport" })
    );
  });

  it("marks the transaction as inferred when evidence matches a known financial account", async () => {
    mockFindMatchingFinancialAccountId.mockReturnValueOnce("fa-card-1");

    const result = await processNotification(mockDb, USER_ID, makeNotification());

    expect(result.saved).toBe(true);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        accountId: "fa-card-1",
        accountAttributionState: "inferred",
      })
    );
  });

  it("caches merchant rule when confidence >= 0.7", async () => {
    await processNotification(mockDb, USER_ID, makeNotification());

    expect(mockInsertMerchantRule).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "eds la castellana",
      expect.any(String),
      expect.any(String)
    );
  });

  it("resolves Google Wallet as google_pay source", async () => {
    const result = await processNotification(
      mockDb,
      USER_ID,
      makeNotification({
        packageName: "com.google.android.apps.walletnfcrel",
        text: "Payment of $25,000 at STARBUCKS. ",
      })
    );

    expect(result.saved).toBe(true);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ source: "google_pay" })
    );
  });
});

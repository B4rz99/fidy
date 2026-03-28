// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const mockResolveBankKeyFromPackage = vi.fn().mockReturnValue(null);
const mockGetDefaultAccount = vi.fn().mockReturnValue(null);
const mockGetAccountsByUser = vi.fn().mockReturnValue([]);
const mockLinkTransactionToAccount = vi
  .fn()
  .mockReturnValue({ accountId: "default-account-id", needsReview: false });
const mockGetTransferCandidates = vi.fn().mockReturnValue([]);
const mockDetectTransferCounterpart = vi.fn().mockReturnValue(null);
const mockLinkTransferPair = vi.fn();

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

vi.mock("@/features/accounts", () => ({
  resolveBankKeyFromPackage: (...args: any[]) => mockResolveBankKeyFromPackage(...args),
  getDefaultAccount: (...args: any[]) => mockGetDefaultAccount(...args),
  getAccountsByUser: (...args: any[]) => mockGetAccountsByUser(...args),
  linkTransactionToAccount: (...args: any[]) => mockLinkTransactionToAccount(...args),
  getTransferCandidates: (...args: any[]) => mockGetTransferCandidates(...args),
  detectTransferCounterpart: (...args: any[]) => mockDetectTransferCounterpart(...args),
  linkTransferPair: (...args: any[]) => mockLinkTransferPair(...args),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: any[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
  generateProcessedCaptureId: () => mockGenerateId("pc"),
  generateSyncQueueId: () => mockGenerateId("sq"),
}));

import type { NotificationData } from "@/features/capture-sources/schema";
import { processNotification } from "@/features/capture-sources/services/notification-pipeline";

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
    mockResolveBankKeyFromPackage.mockReturnValue(null);
    mockGetDefaultAccount.mockReturnValue(null);
    mockGetAccountsByUser.mockReturnValue([]);
    mockLinkTransactionToAccount.mockReturnValue({
      accountId: "default-account-id",
      needsReview: false,
    });
    mockGetTransferCandidates.mockReturnValue([]);
    mockDetectTransferCounterpart.mockReturnValue(null);
  });

  it("saves transaction when local regex parses successfully", async () => {
    const result = await processNotification(mockDb, USER_ID, makeNotification());

    expect(result.saved).toBe(true);
    expect(result.skippedDuplicate).toBe(false);
    expect(result.transactionId).toBe("tx-1");
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        userId: USER_ID,
        type: "expense",
        amount: 50000,
        description: "EDS LA CASTELLANA",
        source: "notification_android",
      })
    );
    expect(mockEnqueueSync).toHaveBeenCalled();
    expect(mockInsertProcessedCapture).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "success",
        transactionId: "tx-1",
      })
    );
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

// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsertTransaction = vi.fn();
const mockEnqueueSync = vi.fn();
const mockLookupMerchantRule = vi.fn().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn();
const mockClassifyMerchantApi = vi.fn().mockResolvedValue("other");
const mockIsCaptureProcessed = vi.fn().mockResolvedValue(false);
const mockFindDuplicateTransaction = vi.fn().mockResolvedValue(null);
const mockCaptureFingerprint = vi.fn().mockReturnValue("test-fingerprint");
const mockInsertProcessedCapture = vi.fn();

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

vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  classifyMerchantApi: (...args: any[]) => mockClassifyMerchantApi(...args),
}));

vi.mock("@/features/capture-sources/lib/dedup", () => ({
  isCaptureProcessed: (...args: any[]) => mockIsCaptureProcessed(...args),
  findDuplicateTransaction: (...args: any[]) => mockFindDuplicateTransaction(...args),
  captureFingerprint: (...args: any[]) => mockCaptureFingerprint(...args),
}));

vi.mock("@/features/capture-sources/lib/repository", () => ({
  insertProcessedCapture: (...args: any[]) => mockInsertProcessedCapture(...args),
}));

const mockGenerateId = vi.fn();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: any[]) => mockGenerateId(...args),
}));

import type { ApplePayIntentData } from "@/features/capture-sources/schema";
import { processApplePayIntent } from "@/features/capture-sources/services/apple-pay-pipeline";

const mockDb = {} as any;
const USER_ID = "user-1";

function makeIntent(overrides: Partial<ApplePayIntentData> = {}): ApplePayIntentData {
  return {
    amount: 50000,
    merchant: "Farmatodo",
    ...overrides,
  };
}

describe("processApplePayIntent", () => {
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
    mockClassifyMerchantApi.mockResolvedValue("other");
  });

  it("saves transaction with apple_pay source", async () => {
    const result = await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(result.saved).toBe(true);
    expect(result.transactionId).toBe("tx-1");
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        userId: USER_ID,
        type: "expense",
        amount: 50000,
        description: "Farmatodo",
        source: "apple_pay",
      })
    );
    expect(mockEnqueueSync).toHaveBeenCalled();
  });

  it("converts amount to pesos correctly", async () => {
    await processApplePayIntent(mockDb, USER_ID, makeIntent({ amount: 7500.5 }));

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ amount: 7501 })
    );
  });

  it("skips when fingerprint already processed", async () => {
    mockIsCaptureProcessed.mockResolvedValueOnce(true);

    const result = await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(result.saved).toBe(false);
    expect(result.skippedDuplicate).toBe(true);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
  });

  it("skips when cross-source duplicate found", async () => {
    mockFindDuplicateTransaction.mockResolvedValueOnce("existing-tx-1");

    const result = await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(result.saved).toBe(false);
    expect(result.skippedDuplicate).toBe(true);
    expect(result.transactionId).toBe("existing-tx-1");
    expect(mockInsertProcessedCapture).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "skipped_duplicate",
        transactionId: "existing-tx-1",
      })
    );
  });

  it("uses cached merchant rule for category", async () => {
    mockLookupMerchantRule.mockResolvedValueOnce("health");

    await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "health" })
    );
    expect(mockClassifyMerchantApi).not.toHaveBeenCalled();
  });

  it("calls classify API when no cached category", async () => {
    mockClassifyMerchantApi.mockResolvedValueOnce("health");

    await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(mockClassifyMerchantApi).toHaveBeenCalledWith("Farmatodo");
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ categoryId: "health" })
    );
  });

  it("always caches merchant rule (high confidence)", async () => {
    mockClassifyMerchantApi.mockResolvedValueOnce("health");

    await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(mockInsertMerchantRule).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "farmatodo",
      "health",
      expect.any(String)
    );
  });

  it("records processed capture on success", async () => {
    await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(mockInsertProcessedCapture).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        source: "apple_pay",
        status: "success",
        confidence: 1.0,
      })
    );
  });
});

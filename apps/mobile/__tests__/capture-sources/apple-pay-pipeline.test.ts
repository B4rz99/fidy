// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplePayIntentData } from "@/features/capture-sources/schema";
import { processApplePayIntent } from "@/features/capture-sources/services/apple-pay-pipeline";
import type { FinancialAccountId } from "@/shared/types/branded";

const mockInsertTransaction = vi.fn<(...args: any[]) => any>();
const mockLookupMerchantRule = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockInsertMerchantRule = vi.fn<(...args: any[]) => any>();
const mockClassifyMerchantApi = vi.fn<(...args: any[]) => any>().mockResolvedValue("other");
const mockIsCaptureProcessed = vi.fn<(...args: any[]) => any>().mockResolvedValue(false);
const mockFindDuplicateTransaction = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
const mockCaptureFingerprint = vi.fn<(...args: any[]) => any>().mockReturnValue("test-fingerprint");
const mockPersistProcessedSourceEvent = vi.fn<(...args: any[]) => any>();
const mockPersistCommittedCaptureSourceEvent = vi.fn<(...args: any[]) => any>();
const mockRecordAutomatedTransactionWithLocalLedger = vi.fn<(...args: any[]) => any>();
const mockEnsureDefaultFinancialAccount = vi.fn<(...args: any[]) => any>().mockReturnValue({
  id: "fa-default-user-1" as FinancialAccountId,
  userId: "user-1",
  name: "Cash",
  kind: "cash",
  isDefault: true,
  createdAt: "2026-04-18T10:00:00.000Z",
  updatedAt: "2026-04-18T10:00:00.000Z",
  deletedAt: null,
});
const mockBuildApplePayCaptureEvidence = vi.fn<(...args: any[]) => any>().mockReturnValue([
  {
    sourceFamily: "apple_pay",
    evidenceType: "card_hint",
    scope: "apple_pay:card_hint",
    value: "visa *1234",
  },
]);
const mockSaveCaptureEvidenceRows = vi.fn<(...args: any[]) => any>();
const mockFindMatchingFinancialAccountId = vi.fn<(...args: any[]) => any>().mockReturnValue(null);
const DEFAULT_APPLE_PAY_CAPTURE_EVIDENCE = {
  sourceFamily: "apple_pay",
  evidenceType: "card_hint",
  scope: "apple_pay:card_hint",
  value: "visa *1234",
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

function mockRecordedApplePayTransaction(input: any) {
  const { command } = input;
  mockInsertTransaction(input.db, {
    id: input.transactionId,
    userId: command.userId,
    type: command.type,
    amount: command.amount,
    categoryId: command.categoryId,
    description: command.description,
    counterpartyName: command.counterpartyName,
    date: command.occurredOn,
    accountId: command.accountId,
    accountAttributionState: command.accountAttributionState,
    source: command.source,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (...args: any[]) => mockInsertTransaction(...args),
}));

vi.mock("@/infrastructure/local-ledger/record-transaction", () => ({
  recordAutomatedTransactionWithLocalLedger: (...args: any[]) =>
    mockRecordAutomatedTransactionWithLocalLedger(...args),
}));

vi.mock("@/infrastructure/local-ledger/source-events", () => ({
  persistProcessedSourceEvent: (...args: any[]) => mockPersistProcessedSourceEvent(...args),
  persistCommittedCaptureSourceEvent: (...args: any[]) =>
    mockPersistCommittedCaptureSourceEvent(...args),
  persistCommittedCaptureSourceEventInTransaction: (...args: any[]) =>
    mockPersistCommittedCaptureSourceEvent(...args),
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

vi.mock("@/features/financial-accounts", () => ({
  ensureDefaultFinancialAccount: (...args: any[]) => mockEnsureDefaultFinancialAccount(...args),
}));

vi.mock("@/features/account-suggestions", () => ({
  findMatchingFinancialAccountId: (...args: any[]) => mockFindMatchingFinancialAccountId(...args),
}));

vi.mock("@/features/capture-evidence", () => ({
  buildApplePayCaptureEvidence: (...args: any[]) => mockBuildApplePayCaptureEvidence(...args),
  materializeCaptureEvidenceRows,
  saveCaptureEvidenceRows: (...args: any[]) => mockSaveCaptureEvidenceRows(...args),
}));

const mockGenerateId = vi.fn<(...args: any[]) => any>();
vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (...args: any[]) => mockGenerateId(...args),
  generateTransactionId: () => mockGenerateId("tx"),
  generateProcessedCaptureId: () => mockGenerateId("pc"),
}));

const mockDb = {} as any;
const USER_ID = "user-1";

function makeIntent(overrides: Partial<ApplePayIntentData> = {}): ApplePayIntentData {
  return {
    amount: 50000,
    merchant: "Farmatodo",
    ...overrides,
  };
}

function expectSavedApplePayTransaction(transactionId: string) {
  expect(mockInsertTransaction).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      userId: USER_ID,
      type: "expense",
      amount: 50000,
      description: "",
      counterpartyName: "Farmatodo",
      accountId: "fa-default-user-1",
      accountAttributionState: "unresolved",
      source: "apple_pay_capture",
    })
  );
  expect(transactionId).toBe("tx-1");
}

function expectSavedApplePayEvidence(transactionId: string) {
  expect(mockPersistCommittedCaptureSourceEvent).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      userId: USER_ID,
      transactionId,
      evidence: expect.arrayContaining([
        expect.objectContaining({
          scope: "apple_pay:card_hint",
          value: "visa *1234",
        }),
      ]),
    })
  );
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
    mockBuildApplePayCaptureEvidence.mockReturnValue([DEFAULT_APPLE_PAY_CAPTURE_EVIDENCE]);
    mockFindMatchingFinancialAccountId.mockReturnValue(null);
    mockSaveCaptureEvidenceRows.mockResolvedValue(undefined);
    mockPersistProcessedSourceEvent.mockReturnValue(undefined);
    mockPersistCommittedCaptureSourceEvent.mockReturnValue(undefined);
    mockRecordAutomatedTransactionWithLocalLedger.mockImplementation(async (input: any) => {
      input.afterRecord?.(input.db, { id: input.transactionId });
      mockRecordedApplePayTransaction(input);
      return { success: true, transaction: { id: input.transactionId } };
    });
  });

  it("saves automated transaction with Apple Pay source event evidence", async () => {
    const result = await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(result.saved).toBe(true);
    expectSavedApplePayTransaction(result.transactionId ?? "");
    expectSavedApplePayEvidence("tx-1");
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
    expect(mockPersistProcessedSourceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "duplicate", failureReason: null })
    );
  });

  it("skips when cross-source duplicate found", async () => {
    mockFindDuplicateTransaction.mockResolvedValueOnce("existing-tx-1");

    const result = await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(result.saved).toBe(false);
    expect(result.skippedDuplicate).toBe(true);
    expect(result.transactionId).toBe("existing-tx-1");
    expect(mockPersistCommittedCaptureSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        status: "duplicate",
        failureReason: null,
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

  it("marks the transaction as inferred when evidence matches a known financial account", async () => {
    mockFindMatchingFinancialAccountId.mockReturnValueOnce("fa-card-1");

    const result = await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(result.saved).toBe(true);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        accountId: "fa-card-1",
        accountAttributionState: "inferred",
      })
    );
  });

  it("records processed capture on success", async () => {
    await processApplePayIntent(mockDb, USER_ID, makeIntent());

    expect(mockPersistCommittedCaptureSourceEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        sourceFamily: "apple_pay",
        status: "processed",
        failureReason: null,
      })
    );
  });

  it("records failed source event before throwing when Local Ledger rejects", async () => {
    mockRecordAutomatedTransactionWithLocalLedger.mockResolvedValueOnce({
      success: false,
      error: "account-not-usable",
    });

    await expect(processApplePayIntent(mockDb, USER_ID, makeIntent())).rejects.toThrow(
      "Local Ledger rejected Apple Pay transaction: account-not-usable"
    );

    expect(mockPersistProcessedSourceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFamily: "apple_pay",
        status: "failed",
        failureReason: "local_ledger_rejected:account-not-usable",
      })
    );
  });
});

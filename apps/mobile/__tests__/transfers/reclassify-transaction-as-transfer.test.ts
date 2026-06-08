import { beforeEach, describe, expect, test, vi } from "vitest";
import { reclassifyTransactionAsTransfer } from "@/features/transfers/lib/reclassify-transaction-as-transfer";
import type { AnyDb } from "@/shared/db";
import type {
  FinancialAccountId,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

const { reclassifyWithLocalLedgerMock } = vi.hoisted(() => ({
  reclassifyWithLocalLedgerMock: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/infrastructure/local-ledger/public", () => ({
  reclassifyTransactionAsTransfer: reclassifyWithLocalLedgerMock,
}));

const db = {} as AnyDb;
const now = new Date("2026-04-19T10:00:00.000Z");
const userId = "user-1" as UserId;
const transactionId = "tx-1" as TransactionId;
const transferId = "transfer-1" as TransferId;
const fromAccountId = "fa-checking" as FinancialAccountId;
const toAccountId = "fa-savings" as FinancialAccountId;

const validInput = {
  userId,
  transactionId,
  processedSourceEventId: "event-1" as ProcessedSourceEventId,
  reviewCandidateId: "candidate-1" as ReviewCandidateId,
  digits: "450000",
  fromSide: { kind: "account" as const, accountId: fromAccountId },
  toSide: { kind: "account" as const, accountId: toAccountId },
  description: "Transfer to savings",
  date: new Date("2026-04-19T12:00:00.000Z"),
};

describe("reclassifyTransactionAsTransfer", () => {
  beforeEach(() => {
    reclassifyWithLocalLedgerMock.mockReset();
  });

  test("persists a built transfer through the local ledger", () => {
    reclassifyWithLocalLedgerMock.mockReturnValue({
      success: true,
      transfer: { id: transferId },
    });

    const result = reclassifyTransactionAsTransfer(db, validInput, {
      now: () => now,
      createId: () => transferId,
    });

    expect(result).toMatchObject({
      success: true,
      transfer: {
        id: transferId,
        amount: 450000,
        fromSide: validInput.fromSide,
        toSide: validInput.toSide,
        source: "capture-match",
      },
    });
    expect(reclassifyWithLocalLedgerMock).toHaveBeenCalledWith(db, {
      userId,
      transactionId,
      processedSourceEventId: validInput.processedSourceEventId,
      reviewCandidateId: validInput.reviewCandidateId,
      transfer: {
        id: transferId,
        userId,
        amount: 450000,
        fromSide: validInput.fromSide,
        toSide: validInput.toSide,
        description: "Transfer to savings",
        date: "2026-04-19",
        createdAt: "2026-04-19T10:00:00.000Z",
        updatedAt: "2026-04-19T10:00:00.000Z",
        voidedAt: null,
        source: "capture-match",
      },
      updatedAt: "2026-04-19T10:00:00.000Z",
    });
  });

  test("returns build errors before touching the ledger", () => {
    const result = reclassifyTransactionAsTransfer(
      db,
      { ...validInput, fromSide: null },
      {
        now: () => now,
        createId: () => transferId,
      }
    );

    expect(result).toEqual({ success: false, error: "fromSideRequired" });
    expect(reclassifyWithLocalLedgerMock).not.toHaveBeenCalled();
  });

  test("forwards local ledger reclassification failures", () => {
    reclassifyWithLocalLedgerMock.mockReturnValue({
      success: false,
      error: "transactionNotFound",
    });

    const result = reclassifyTransactionAsTransfer(db, validInput, {
      now: () => now,
      createId: () => transferId,
    });

    expect(result).toEqual({ success: false, error: "transactionNotFound" });
  });
});

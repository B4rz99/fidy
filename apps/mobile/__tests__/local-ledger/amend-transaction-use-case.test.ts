import { describe, expect, it, vi } from "vitest";
import {
  createAmendTransactionUseCase,
  createVoidTransactionUseCase,
  type AmendableTransaction,
} from "@/local-ledger/public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
} from "@/shared/types/branded";
import type { LocalLedgerEntryId, UserId } from "@/local-ledger/domain/public";

const userId = "user-1" as UserId;
const transactionId = "txn-1" as LocalLedgerEntryId;
const accountId = "acct-1" as FinancialAccountId;
const categoryId = "cat-1" as CategoryId;
const amount = 12_000 as CopAmount;
const occurredOn = "2026-04-10" as IsoDate;
const now = "2026-04-10T12:00:00.000Z" as IsoDateTime;

describe("amend transaction use case", () => {
  it("preserves source, counterparty, and attribution metadata from the existing ledger entry", async () => {
    const existing: AmendableTransaction = {
      id: transactionId,
      userId,
      accountAttributionState: "inferred",
      counterpartyName: "Cafe Uno",
      source: "email_capture",
    };
    const recordTransaction = vi.fn().mockResolvedValue({
      ok: true,
      transaction: { id: transactionId },
      events: [],
    });
    const amendTransaction = createAmendTransactionUseCase({
      loadAmendableTransaction: async () => existing,
      recordTransaction,
    });

    await expect(
      amendTransaction({
        userId,
        transactionId,
        type: "expense",
        amount,
        accountId,
        categoryId,
        occurredOn,
        description: "Lunch",
      })
    ).resolves.toMatchObject({ ok: true });

    expect(recordTransaction).toHaveBeenCalledWith({
      userId,
      type: "expense",
      amount,
      accountId,
      accountAttributionState: "inferred",
      categoryId,
      occurredOn,
      description: "Lunch",
      counterpartyName: "Cafe Uno",
      source: "email_capture",
    });
  });

  it("rejects missing transactions before recording an amendment", async () => {
    const recordTransaction = vi.fn();
    const amendTransaction = createAmendTransactionUseCase({
      loadAmendableTransaction: async () => null,
      recordTransaction,
    });

    await expect(
      amendTransaction({
        userId,
        transactionId,
        type: "expense",
        amount,
        accountId,
        categoryId,
        occurredOn,
        description: "Lunch",
      })
    ).resolves.toEqual({ ok: false, code: "transaction-not-found" });
    expect(recordTransaction).not.toHaveBeenCalled();
  });
});

describe("void transaction use case", () => {
  it("commits a void only after the transaction is voidable", () => {
    const commitVoidTransaction = vi.fn().mockReturnValue(true);
    const voidTransaction = createVoidTransactionUseCase({
      canVoidTransaction: () => true,
      commitVoidTransaction,
    });

    expect(voidTransaction({ userId, transactionId, now })).toEqual({ ok: true });
    expect(commitVoidTransaction).toHaveBeenCalledWith({ userId, transactionId, now });
  });

  it("rejects non-voidable transactions without committing", () => {
    const commitVoidTransaction = vi.fn();
    const voidTransaction = createVoidTransactionUseCase({
      canVoidTransaction: () => false,
      commitVoidTransaction,
    });

    expect(voidTransaction({ userId, transactionId, now })).toEqual({
      ok: false,
      code: "transaction-not-voidable",
    });
    expect(commitVoidTransaction).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  confirmReviewCandidateAsTransaction,
  confirmReviewCandidateAsTransfer,
  dismissReviewCandidate,
  type LocalLedgerReviewCandidateId,
  type RecordTransferCommand,
  type RecordTransactionCommand,
} from "@/local-ledger/public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const CANDIDATE_ID = "rc-1" as LocalLedgerReviewCandidateId;
const SOURCE_EVENT_ID = "pse-1" as ProcessedSourceEventId;

const transactionCommand: RecordTransactionCommand = {
  userId: USER_ID,
  type: "expense",
  amount: 12_500 as CopAmount,
  accountId: "account-1" as FinancialAccountId,
  accountAttributionState: "confirmed",
  categoryId: "food" as CategoryId,
  occurredOn: "2026-04-12" as IsoDate,
  description: "Cafe",
  counterpartyName: "Cafe",
  source: "email_capture",
};

const pendingTransactionCandidate = {
  id: CANDIDATE_ID,
  userId: USER_ID,
  processedSourceEventId: SOURCE_EVENT_ID,
  status: "pending" as const,
  candidateKind: "transaction" as const,
};

const pendingTransferCandidate = {
  ...pendingTransactionCandidate,
  candidateKind: "transfer" as const,
};

const pendingUnknownCandidate = {
  ...pendingTransactionCandidate,
  candidateKind: "unknown" as const,
};

const transferCommand: RecordTransferCommand = {
  userId: USER_ID,
  transferId: "transfer-1" as TransferId,
  amount: 12_500 as CopAmount,
  fromSide: { kind: "account", accountId: "account-1" as FinancialAccountId },
  toSide: { kind: "account", accountId: "account-2" as FinancialAccountId },
  description: "Move funds",
  date: "2026-04-12" as IsoDate,
  source: "review-confirmation",
  now: "2026-04-12T10:00:00.000Z" as IsoDateTime,
};

const resolutionInput = {
  userId: USER_ID,
  candidateId: CANDIDATE_ID,
  processedSourceEventId: SOURCE_EVENT_ID,
  now: "2026-04-12T10:00:00.000Z" as IsoDateTime,
};

describe("review candidate resolution", () => {
  it("confirms a transaction candidate through RecordTransaction before accepting it", async () => {
    const confirmTransaction = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      ok: true,
      recorded: {
        ok: true,
        transaction: { id: "tx-1" },
        events: [{ type: "local-ledger.transaction-recorded", transactionId: "tx-1" }],
      },
    });

    await expect(
      confirmReviewCandidateAsTransaction(
        {
          ...resolutionInput,
          command: transactionCommand,
        },
        {
          loadCandidate: async () => pendingTransactionCandidate,
          confirmTransaction,
        }
      )
    ).resolves.toEqual({ ok: true, code: "accepted", recorded: { id: "tx-1" } });

    expect(confirmTransaction).toHaveBeenCalledWith({
      userId: USER_ID,
      candidateId: CANDIDATE_ID,
      processedSourceEventId: SOURCE_EVENT_ID,
      now: "2026-04-12T10:00:00.000Z",
      command: transactionCommand,
    });
  });

  it("confirms a transfer candidate through RecordTransfer before accepting it", async () => {
    const confirmTransfer = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      ok: true,
      recorded: {
        code: "recorded",
        transfer: { id: "transfer-1" },
        events: [{ type: "local-ledger.transfer-recorded", transferId: "transfer-1" }],
      },
    });

    await expect(
      confirmReviewCandidateAsTransfer(
        { ...resolutionInput, command: transferCommand },
        {
          loadCandidate: async () => pendingTransferCandidate,
          confirmTransfer,
        }
      )
    ).resolves.toEqual({ ok: true, code: "accepted", recorded: { id: "transfer-1" } });

    expect(confirmTransfer).toHaveBeenCalledWith({ ...resolutionInput, command: transferCommand });
  });

  it("allows unknown candidates to be confirmed as a transaction after user review", async () => {
    const confirmTransaction = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      ok: true,
      recorded: {
        ok: true,
        transaction: { id: "tx-1" },
        events: [],
      },
    });

    await expect(
      confirmReviewCandidateAsTransaction(
        { ...resolutionInput, command: transactionCommand },
        {
          loadCandidate: async () => pendingUnknownCandidate,
          confirmTransaction,
        }
      )
    ).resolves.toEqual({ ok: true, code: "accepted", recorded: { id: "tx-1" } });
  });

  it("allows unknown candidates to be confirmed as a transfer after user review", async () => {
    const confirmTransfer = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      ok: true,
      recorded: {
        code: "recorded",
        transfer: { id: "transfer-1" },
        events: [],
      },
    });

    await expect(
      confirmReviewCandidateAsTransfer(
        { ...resolutionInput, command: transferCommand },
        {
          loadCandidate: async () => pendingUnknownCandidate,
          confirmTransfer,
        }
      )
    ).resolves.toEqual({ ok: true, code: "accepted", recorded: { id: "transfer-1" } });
  });

  it("returns transfer commit failures from the atomic confirmation port", async () => {
    const confirmTransfer = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      ok: false,
      code: "commit-failed",
      reason: "Review candidate resolution target was not found",
    });

    await expect(
      confirmReviewCandidateAsTransfer(
        { ...resolutionInput, command: transferCommand },
        {
          loadCandidate: async () => pendingTransferCandidate,
          confirmTransfer,
        }
      )
    ).resolves.toEqual({
      ok: false,
      code: "commit-failed",
      reason: "Review candidate resolution target was not found",
    });

    expect(confirmTransfer).toHaveBeenCalledWith({ ...resolutionInput, command: transferCommand });
  });

  it("rejects transfer confirmation commands for a different user before commit", async () => {
    const confirmTransfer = vi.fn<(...args: any[]) => any>();

    await expect(
      confirmReviewCandidateAsTransfer(
        { ...resolutionInput, command: { ...transferCommand, userId: "user-2" as UserId } },
        {
          loadCandidate: async () => pendingTransferCandidate,
          confirmTransfer,
        }
      )
    ).resolves.toEqual({ ok: false, code: "record-command-user-mismatch" });

    expect(confirmTransfer).not.toHaveBeenCalled();
  });

  it("returns transaction commit failures from the atomic confirmation port", async () => {
    const confirmTransaction = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      ok: false,
      code: "commit-failed",
      reason: "Review candidate resolution target was not found",
    });

    await expect(
      confirmReviewCandidateAsTransaction(
        { ...resolutionInput, command: transactionCommand },
        {
          loadCandidate: async () => pendingTransactionCandidate,
          confirmTransaction,
        }
      )
    ).resolves.toEqual({
      ok: false,
      code: "commit-failed",
      reason: "Review candidate resolution target was not found",
    });

    expect(confirmTransaction).toHaveBeenCalledWith({
      ...resolutionInput,
      command: transactionCommand,
    });
  });

  it("dismisses a candidate without recording a transaction or transfer", async () => {
    const rejectCandidate = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: true,
      didMutate: true,
    });

    await expect(
      dismissReviewCandidate(resolutionInput, {
        loadCandidate: async () => pendingTransactionCandidate,
        rejectCandidate,
      })
    ).resolves.toEqual({ ok: true, code: "rejected" });

    expect(rejectCandidate).toHaveBeenCalledWith(resolutionInput);
  });

  it("rejects confirmation when the candidate belongs to a different user", async () => {
    const confirmTransaction = vi.fn<(...args: any[]) => any>();

    const result = await confirmReviewCandidateAsTransaction(
      { ...resolutionInput, command: transactionCommand },
      {
        loadCandidate: async () => ({
          ...pendingTransactionCandidate,
          userId: "other-user" as UserId,
        }),
        confirmTransaction,
      }
    );

    expect(result).toEqual({ ok: false, code: "candidate-owner-mismatch" });
    expect(confirmTransaction).not.toHaveBeenCalled();
  });

  it("rejects confirmation when the source event does not match the candidate", async () => {
    const confirmTransaction = vi.fn<(...args: any[]) => any>();

    const result = await confirmReviewCandidateAsTransaction(
      { ...resolutionInput, command: transactionCommand },
      {
        loadCandidate: async () => ({
          ...pendingTransactionCandidate,
          processedSourceEventId: "pse-other" as ProcessedSourceEventId,
        }),
        confirmTransaction,
      }
    );

    expect(result).toEqual({ ok: false, code: "source-event-mismatch" });
    expect(confirmTransaction).not.toHaveBeenCalled();
  });

  it("rejects transaction confirmation when the command user does not match the candidate user", async () => {
    const confirmTransaction = vi.fn<(...args: any[]) => any>();

    const result = await confirmReviewCandidateAsTransaction(
      {
        ...resolutionInput,
        command: { ...transactionCommand, userId: "user-2" as UserId },
      },
      {
        loadCandidate: async () => pendingTransactionCandidate,
        confirmTransaction,
      }
    );

    expect(result).toEqual({ ok: false, code: "record-command-user-mismatch" });
    expect(confirmTransaction).not.toHaveBeenCalled();
  });
});

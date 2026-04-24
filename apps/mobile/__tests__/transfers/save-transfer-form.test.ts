import { beforeEach, expect, it, vi } from "vitest";
import type { AnyDb } from "@/shared/db";
import type { FinancialAccountId, UserId } from "@/shared/types/branded";

const { refreshTransactionsMock, reclassifyTransactionAsTransferMock } = vi.hoisted(() => ({
  refreshTransactionsMock: vi.fn(),
  reclassifyTransactionAsTransferMock: vi.fn(),
}));

vi.mock("@/features/transactions/store.public", () => ({
  refreshTransactions: refreshTransactionsMock,
}));

vi.mock("@/features/transfers/lib/reclassify-transaction-as-transfer", () => ({
  reclassifyTransactionAsTransfer: reclassifyTransactionAsTransferMock,
}));

import { submitTransferForm } from "@/features/transfers/components/transfer-form/saveTransferForm";

const db = {} as AnyDb;
const userId = "user-1" as UserId;
const accountId = "fa-1" as FinancialAccountId;
const sourceTransaction = {
  id: "tx-1",
  description: "Move to savings",
} as Parameters<typeof submitTransferForm>[0]["sourceTransaction"];

function buildReclassificationInput(): Parameters<typeof submitTransferForm>[0] {
  return {
    date: new Date("2026-04-20T00:00:00.000Z"),
    db,
    digits: "450000",
    fromSide: { kind: "account", accountId },
    processedEmailId: null,
    sourceTransaction,
    toSide: { kind: "external", label: "Outside Fidy" },
    userId,
  };
}

beforeEach(() => {
  refreshTransactionsMock.mockReset();
  reclassifyTransactionAsTransferMock.mockReset();
});

it("maps thrown reclassification writes to saveFailed", async () => {
  reclassifyTransactionAsTransferMock.mockImplementation(() => {
    throw new Error("db failed");
  });

  await expect(submitTransferForm(buildReclassificationInput())).resolves.toEqual({
    success: false,
    error: "saveFailed",
  });
  expect(refreshTransactionsMock).not.toHaveBeenCalled();
});

it("treats refresh failures as a successful persisted reclassification", async () => {
  reclassifyTransactionAsTransferMock.mockReturnValue({
    success: true,
    transfer: { id: "tr-1" },
  });
  refreshTransactionsMock.mockRejectedValueOnce(new Error("refresh failed"));

  await expect(submitTransferForm(buildReclassificationInput())).resolves.toEqual({
    success: true,
    destination: "tabs",
  });
  expect(refreshTransactionsMock).toHaveBeenCalledWith(db, userId);
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { CloudLedgerRepairScreen } from "@/features/cloud-ledger/ui.public";
import type { CloudLedgerRepairItem } from "@/features/cloud-ledger/outbox.public";
import { renderFidy } from "@/__tests__/helpers/render";
import i18n from "@/shared/i18n/i18n";
import {
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireTransactionId,
  requireUserId,
} from "@/shared/types/assertions";

const mocks = vi.hoisted(() => ({
  back: vi.fn<(...args: any[]) => any>(),
  discardCloudLedgerRepairItemForUser: vi.fn<(...args: any[]) => any>(),
  getCloudLedgerOutbox: vi.fn<(...args: any[]) => any>(),
  loadCloudLedgerRepairItems: vi.fn<(...args: any[]) => any>(),
  persistCloudLedgerRuntimeTransactionShadows: vi.fn<(...args: any[]) => any>(),
  push: vi.fn<(...args: any[]) => any>(),
  refreshTransactions: vi.fn<(...args: any[]) => any>(),
  replace: vi.fn<(...args: any[]) => any>(),
  retryCloudLedgerRepairItemForUser: vi.fn<(...args: any[]) => any>(),
  retryCloudLedgerRepairSetForUser: vi.fn<(...args: any[]) => any>(),
  tryGetDb: vi.fn<(...args: any[]) => any>(),
  userId: "user-repair-screen",
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mocks.back, push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/features/auth/public", () => ({
  useOptionalUserId: () => requireUserId(mocks.userId),
}));

vi.mock("@/features/cloud-ledger/outbox", () => ({
  getCloudLedgerOutbox: mocks.getCloudLedgerOutbox,
  loadCloudLedgerRepairItems: mocks.loadCloudLedgerRepairItems,
}));

vi.mock("@/features/cloud-ledger/runtime-mutations.public", () => ({
  discardCloudLedgerRepairItemForUser: mocks.discardCloudLedgerRepairItemForUser,
  retryCloudLedgerRepairItemForUser: mocks.retryCloudLedgerRepairItemForUser,
  retryCloudLedgerRepairSetForUser: mocks.retryCloudLedgerRepairSetForUser,
}));

vi.mock("@/features/transactions/store.public", () => ({
  persistCloudLedgerRuntimeTransactionShadows: mocks.persistCloudLedgerRuntimeTransactionShadows,
  refreshTransactions: mocks.refreshTransactions,
}));

vi.mock("@/shared/db", () => ({
  tryGetDb: mocks.tryGetDb,
}));

describe("Cloud Ledger repair screen", () => {
  const userId = requireUserId("user-repair-screen");
  const db = { id: "db-repair-screen" };
  const outbox = { id: "outbox-repair-screen" };

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.locale = "en";
    mocks.discardCloudLedgerRepairItemForUser.mockResolvedValue(true);
    mocks.getCloudLedgerOutbox.mockReturnValue(outbox);
    mocks.loadCloudLedgerRepairItems.mockResolvedValue([repairItem()]);
    mocks.refreshTransactions.mockResolvedValue(undefined);
    mocks.retryCloudLedgerRepairItemForUser.mockResolvedValue(true);
    mocks.retryCloudLedgerRepairSetForUser.mockResolvedValue(true);
    mocks.tryGetDb.mockReturnValue(db);
  });

  it("refreshes transaction shadows after discarding a repair item from the reachable flow", async () => {
    const screen = renderFidy(<CloudLedgerRepairScreen />);

    await vi.waitFor(() => expect(screen.getByText("Discard change")).toBeTruthy());
    screen.pressByText("Discard change");

    await vi.waitFor(() =>
      expect(mocks.discardCloudLedgerRepairItemForUser).toHaveBeenCalledWith(
        userId,
        requireLedgerChangeId("change-repair-screen")
      )
    );
    await vi.waitFor(() =>
      expect(mocks.persistCloudLedgerRuntimeTransactionShadows).toHaveBeenCalledWith(db, userId)
    );
    expect(mocks.refreshTransactions).toHaveBeenCalledWith(db, userId);
    expect(
      mocks.persistCloudLedgerRuntimeTransactionShadows.mock.invocationCallOrder[0]!
    ).toBeLessThan(mocks.refreshTransactions.mock.invocationCallOrder[0]!);
  });
});

function repairItem(): CloudLedgerRepairItem {
  const changeId = requireLedgerChangeId("change-repair-screen");
  return {
    id: changeId,
    kind: "createTransaction",
    change: {
      id: changeId,
      kind: "createTransaction",
      commandVersion: 1,
      transaction: {
        id: requireTransactionId("txn-repair-screen"),
        type: "expense",
        amount: requireCopAmount(18_000),
        currency: "COP",
        categoryId: null,
        accountId: requireFinancialAccountId("acct-cash"),
        description: "Coffee",
        date: requireIsoDate("2026-06-02"),
      },
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
    },
    outcome: {
      changeId,
      status: "repair_required",
      code: "invalid_transaction",
    },
    reason: "invalidTransaction",
    actions: ["discard"],
  };
}

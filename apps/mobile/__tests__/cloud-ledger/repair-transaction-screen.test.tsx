import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudLedgerRepairTransactionScreen } from "@/features/cloud-ledger/ui.public";
import type { CloudLedgerRepairItem } from "@/features/cloud-ledger/outbox.public";
import { renderFidy } from "@/__tests__/helpers/render";
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
  flushCloudLedgerOutboxForUser: vi.fn<(...args: any[]) => any>(),
  getCloudLedgerOutbox: vi.fn<(...args: any[]) => any>(),
  loadCloudLedgerRepairItems: vi.fn<(...args: any[]) => any>(),
  persistCloudLedgerRuntimeTransactionShadows: vi.fn<(...args: any[]) => any>(),
  refreshTransactions: vi.fn<(...args: any[]) => any>(),
  replace: vi.fn<(...args: any[]) => any>(),
  resubmitCloudLedgerRepairTransactionChangeForUser: vi.fn<(...args: any[]) => any>(),
  routeParams: { changeId: ["bad-change-id"] } as { changeId?: string | readonly string[] },
  transactionForm: vi.fn<(...args: any[]) => any>(),
  tryGetDb: vi.fn<(...args: any[]) => any>(),
  userId: "user-repair-transaction-screen",
}));

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => mocks.routeParams,
  useRouter: () => ({ back: mocks.back, replace: mocks.replace }),
}));

vi.mock("@/features/auth/public", () => ({
  useOptionalUserId: () => requireUserId(mocks.userId),
}));

vi.mock("@/features/categories/hooks.public", () => ({
  useAvailableCategories: () => [],
}));

vi.mock("@/features/financial-accounts/public", () => ({
  getFinancialAccountsForUser: vi.fn(() => []),
  tryEnsureDefaultFinancialAccount: vi.fn(),
}));

vi.mock("@/features/transactions/ui.public", () => ({
  TransactionForm: (props: unknown) => mocks.transactionForm(props),
}));

vi.mock("@/features/cloud-ledger/outbox", () => ({
  getCloudLedgerOutbox: mocks.getCloudLedgerOutbox,
  loadCloudLedgerRepairItems: mocks.loadCloudLedgerRepairItems,
}));

vi.mock("@/features/cloud-ledger/runtime-mutations.public", () => ({
  flushCloudLedgerOutboxForUser: mocks.flushCloudLedgerOutboxForUser,
  resubmitCloudLedgerRepairTransactionChangeForUser:
    mocks.resubmitCloudLedgerRepairTransactionChangeForUser,
}));

vi.mock("@/features/cloud-ledger/runtime.public", () => ({
  getCloudLedgerRuntimeCache: vi.fn(() => ({ transactions: [] })),
}));

vi.mock("@/features/transactions/store.public", () => ({
  persistCloudLedgerRuntimeTransactionShadows: mocks.persistCloudLedgerRuntimeTransactionShadows,
  refreshTransactions: mocks.refreshTransactions,
}));

vi.mock("@/shared/db", () => ({
  tryGetDb: mocks.tryGetDb,
}));

describe("Cloud Ledger repair transaction screen", () => {
  const userId = requireUserId("user-repair-transaction-screen");
  const db = { id: "db-repair-transaction-screen" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flushCloudLedgerOutboxForUser.mockResolvedValue(true);
    mocks.routeParams = { changeId: ["bad-change-id"] };
    mocks.loadCloudLedgerRepairItems.mockResolvedValue([]);
    mocks.refreshTransactions.mockResolvedValue(undefined);
    mocks.resubmitCloudLedgerRepairTransactionChangeForUser.mockResolvedValue(true);
    mocks.transactionForm.mockReturnValue(null);
    mocks.tryGetDb.mockReturnValue(db);
  });

  it("rejects malformed route params without throwing during render", async () => {
    expect(() => renderFidy(<CloudLedgerRepairTransactionScreen />)).not.toThrow();

    await vi.waitFor(() => expect(mocks.back).toHaveBeenCalledOnce());
    expect(mocks.loadCloudLedgerRepairItems).not.toHaveBeenCalled();
  });

  it("loads editable repairs without enabling transfer mode in the repair editor", async () => {
    mocks.routeParams = { changeId: "change-repair-editor" };
    mocks.loadCloudLedgerRepairItems.mockResolvedValue([repairItem()]);

    renderFidy(<CloudLedgerRepairTransactionScreen />);

    await vi.waitFor(() =>
      expect(mocks.transactionForm).toHaveBeenCalledWith(
        expect.objectContaining({ allowTransferMode: false })
      )
    );
  });

  it("refreshes transaction shadows after successful repair resubmit", async () => {
    mocks.routeParams = { changeId: "change-repair-editor" };
    mocks.loadCloudLedgerRepairItems.mockResolvedValue([repairItem()]);

    renderFidy(<CloudLedgerRepairTransactionScreen />);

    await vi.waitFor(() => expect(mocks.transactionForm).toHaveBeenCalled());
    const formProps = mocks.transactionForm.mock.lastCall?.[0] as { readonly onSave: () => void };
    formProps.onSave();

    await vi.waitFor(() =>
      expect(mocks.resubmitCloudLedgerRepairTransactionChangeForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          changeId: requireLedgerChangeId("change-repair-editor"),
          expectedVersion: 5,
        })
      )
    );
    await vi.waitFor(() =>
      expect(mocks.persistCloudLedgerRuntimeTransactionShadows).toHaveBeenCalledWith(db, userId)
    );
    expect(mocks.flushCloudLedgerOutboxForUser).toHaveBeenCalledWith(userId);
    expect(mocks.refreshTransactions).toHaveBeenCalledWith(db, userId);
    expect(mocks.replace).toHaveBeenCalledWith("/ledger-repair");
    expect(mocks.flushCloudLedgerOutboxForUser.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.persistCloudLedgerRuntimeTransactionShadows.mock.invocationCallOrder[0]!
    );
    expect(
      mocks.persistCloudLedgerRuntimeTransactionShadows.mock.invocationCallOrder[0]!
    ).toBeLessThan(mocks.refreshTransactions.mock.invocationCallOrder[0]!);
    expect(mocks.refreshTransactions.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.replace.mock.invocationCallOrder[0]!
    );
  });
});

function repairItem(): CloudLedgerRepairItem {
  const changeId = requireLedgerChangeId("change-repair-editor");
  return {
    id: changeId,
    kind: "amendTransaction",
    change: {
      id: changeId,
      kind: "amendTransaction",
      commandVersion: 1,
      dependencies: [],
      expectedVersion: 4,
      transaction: {
        id: requireTransactionId("txn-repair-editor"),
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
      code: "stale_expected_version",
    },
    reason: "staleConflict",
    actions: ["editAndResubmit", "discard"],
    acceptedTransactionVersion: 5,
  };
}

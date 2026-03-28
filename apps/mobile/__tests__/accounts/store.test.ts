import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AccountId,
  CopAmount,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

vi.mock("@/features/accounts/lib/repository", () => ({
  getAccountsByUser: vi.fn().mockReturnValue([]),
  getDefaultAccount: vi.fn().mockReturnValue(null),
  getReviewCount: vi.fn().mockReturnValue(0),
  insertAccount: vi.fn(),
  updateAccount: vi.fn(),
  softDeleteAccount: vi.fn(),
  setDefaultAccount: vi.fn(),
  reassignTransactionAccount: vi.fn(),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: vi.fn(),
}));

import {
  getAccountsByUser,
  getReviewCount,
  insertAccount,
  reassignTransactionAccount,
  setDefaultAccount,
  softDeleteAccount,
  updateAccount,
} from "@/features/accounts/lib/repository";
import { useAccountStore } from "@/features/accounts/store";
import { enqueueSync } from "@/shared/db/enqueue-sync";

// biome-ignore lint/suspicious/noExplicitAny: mock db needs flexible typing
const mockDb = {} as any;
const mockUserId = "user-1" as UserId;

const makeAccountRow = (
  overrides: Partial<{
    id: string;
    isDefault: number;
    name: string;
  }> = {}
) => ({
  id: (overrides.id ?? "acc-1") as AccountId,
  userId: mockUserId,
  name: overrides.name ?? "Bancolombia Ahorros",
  type: "debit",
  bankKey: "bancolombia",
  identifiers: "[]",
  initialBalance: 0 as CopAmount,
  isDefault: overrides.isDefault ?? 0,
  createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
  updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
  deletedAt: null,
});

describe("useAccountStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccountsByUser).mockReturnValue([]);
    vi.mocked(getReviewCount).mockReturnValue(0);
    useAccountStore.getState().initStore(mockDb, mockUserId);
    useAccountStore.setState({
      accounts: [],
      defaultAccountId: null,
      reviewCount: 0,
    });
  });

  // ── initStore ────────────────────────────────────────────────────────────────

  it("loadAccounts returns early when store is not initialized", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useAccountStore.getState().initStore(null as any, null as any);
    useAccountStore.getState().loadAccounts();
    expect(getAccountsByUser).not.toHaveBeenCalled();
  });

  it("starts with default state values", () => {
    const state = useAccountStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.defaultAccountId).toBeNull();
    expect(state.reviewCount).toBe(0);
  });

  // ── loadAccounts ─────────────────────────────────────────────────────────────

  it("loadAccounts populates accounts from DB", () => {
    vi.mocked(getAccountsByUser).mockReturnValueOnce([makeAccountRow()]);

    useAccountStore.getState().loadAccounts();

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(1);
    expect(state.accounts[0].id).toBe("acc-1");
    expect(state.accounts[0].name).toBe("Bancolombia Ahorros");
    expect(state.accounts[0].isDefault).toBe(false);
    expect(state.accounts[0].createdAt).toBeInstanceOf(Date);
    expect(state.accounts[0].identifiers).toEqual([]);
  });

  it("loadAccounts sets defaultAccountId when a default account exists", () => {
    vi.mocked(getAccountsByUser).mockReturnValueOnce([
      makeAccountRow({ id: "acc-default", isDefault: 1 }),
      makeAccountRow({ id: "acc-other", isDefault: 0 }),
    ]);

    useAccountStore.getState().loadAccounts();

    const state = useAccountStore.getState();
    expect(state.defaultAccountId).toBe("acc-default");
  });

  it("loadAccounts sets defaultAccountId to null when no default exists", () => {
    vi.mocked(getAccountsByUser).mockReturnValueOnce([
      makeAccountRow({ id: "acc-1", isDefault: 0 }),
    ]);

    useAccountStore.getState().loadAccounts();

    expect(useAccountStore.getState().defaultAccountId).toBeNull();
  });

  it("loadAccounts parses identifiers JSON string into array", () => {
    const row = {
      ...makeAccountRow(),
      identifiers: '["1234","5678"]',
    };
    vi.mocked(getAccountsByUser).mockReturnValueOnce([row]);

    useAccountStore.getState().loadAccounts();

    const state = useAccountStore.getState();
    expect(state.accounts[0].identifiers).toEqual(["1234", "5678"]);
  });

  it("loadAccounts parses deletedAt date when present", () => {
    const row = {
      ...makeAccountRow(),
      deletedAt: "2026-03-10T12:00:00.000Z" as IsoDateTime,
    };
    vi.mocked(getAccountsByUser).mockReturnValueOnce([row]);

    useAccountStore.getState().loadAccounts();

    const state = useAccountStore.getState();
    expect(state.accounts[0].deletedAt).toBeInstanceOf(Date);
  });

  it("loadAccounts sets deletedAt to null when not present", () => {
    vi.mocked(getAccountsByUser).mockReturnValueOnce([makeAccountRow()]);

    useAccountStore.getState().loadAccounts();

    expect(useAccountStore.getState().accounts[0].deletedAt).toBeNull();
  });

  // ── createAccount ────────────────────────────────────────────────────────────

  it("createAccount throws when store is not initialized", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useAccountStore.getState().initStore(null as any, null as any);
    expect(() =>
      useAccountStore.getState().createAccount({
        name: "Test",
        type: "debit",
        bankKey: "bancolombia",
        identifiers: [],
        initialBalance: 0,
      })
    ).toThrow("Store not initialized");
  });

  it("createAccount inserts account into DB", () => {
    useAccountStore.getState().createAccount({
      name: "Nequi",
      type: "wallet",
      bankKey: "nequi",
      identifiers: ["3001234567"],
      initialBalance: 50000,
    });

    expect(insertAccount).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        name: "Nequi",
        type: "wallet",
        bankKey: "nequi",
        identifiers: '["3001234567"]',
        initialBalance: 50000,
        isDefault: 0,
        userId: mockUserId,
      })
    );
  });

  it("createAccount enqueues sync entry", () => {
    useAccountStore.getState().createAccount({
      name: "Nequi",
      type: "wallet",
      bankKey: "nequi",
      identifiers: [],
      initialBalance: 0,
    });

    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "accounts",
        operation: "insert",
      })
    );
  });

  it("createAccount returns a generated account id", () => {
    const id = useAccountStore.getState().createAccount({
      name: "Test",
      type: "debit",
      bankKey: "bancolombia",
      identifiers: [],
      initialBalance: 0,
    });

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("createAccount calls loadAccounts after insert", () => {
    useAccountStore.getState().createAccount({
      name: "Test",
      type: "debit",
      bankKey: "bancolombia",
      identifiers: [],
      initialBalance: 0,
    });

    expect(getAccountsByUser).toHaveBeenCalledWith(mockDb, mockUserId);
  });

  // ── updateAccountById ─────────────────────────────────────────────────────────

  it("updateAccountById does nothing when store is not initialized", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useAccountStore.getState().initStore(null as any, mockUserId);
    useAccountStore.getState().updateAccountById("acc-1" as AccountId, { name: "New Name" });
    expect(updateAccount).not.toHaveBeenCalled();
  });

  it("updateAccountById calls updateAccount with correct args", () => {
    useAccountStore.getState().updateAccountById("acc-1" as AccountId, { name: "New Name" });

    expect(updateAccount).toHaveBeenCalledWith(
      mockDb,
      "acc-1",
      { name: "New Name" },
      expect.any(String)
    );
  });

  it("updateAccountById enqueues sync entry", () => {
    useAccountStore.getState().updateAccountById("acc-1" as AccountId, { name: "Updated" });

    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "accounts",
        rowId: "acc-1",
        operation: "update",
      })
    );
  });

  it("updateAccountById calls loadAccounts after update", () => {
    useAccountStore.getState().updateAccountById("acc-1" as AccountId, { name: "Updated" });

    expect(getAccountsByUser).toHaveBeenCalled();
  });

  // ── deleteAccount ─────────────────────────────────────────────────────────────

  it("deleteAccount does nothing when dbRef is null", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useAccountStore.getState().initStore(null as any, mockUserId);
    useAccountStore.getState().deleteAccount("acc-1" as AccountId);
    expect(softDeleteAccount).not.toHaveBeenCalled();
  });

  it("deleteAccount calls softDeleteAccount", () => {
    useAccountStore.getState().deleteAccount("acc-1" as AccountId);

    expect(softDeleteAccount).toHaveBeenCalledWith(mockDb, "acc-1", expect.any(String));
  });

  it("deleteAccount enqueues sync entry", () => {
    useAccountStore.getState().deleteAccount("acc-1" as AccountId);

    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "accounts",
        rowId: "acc-1",
        operation: "update",
      })
    );
  });

  it("deleteAccount calls loadAccounts after soft delete", () => {
    useAccountStore.getState().deleteAccount("acc-1" as AccountId);

    expect(getAccountsByUser).toHaveBeenCalled();
  });

  // ── setDefault ────────────────────────────────────────────────────────────────

  it("setDefault does nothing when store is not initialized", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useAccountStore.getState().initStore(null as any, null as any);
    useAccountStore.getState().setDefault("acc-1" as AccountId);
    expect(setDefaultAccount).not.toHaveBeenCalled();
  });

  it("setDefault calls setDefaultAccount in DB", () => {
    useAccountStore.getState().setDefault("acc-1" as AccountId);

    expect(setDefaultAccount).toHaveBeenCalledWith(mockDb, mockUserId, "acc-1", expect.any(String));
  });

  it("setDefault enqueues sync entry", () => {
    useAccountStore.getState().setDefault("acc-1" as AccountId);

    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "accounts",
        rowId: "acc-1",
        operation: "update",
      })
    );
  });

  it("setDefault calls loadAccounts to reflect new default", () => {
    useAccountStore.getState().setDefault("acc-1" as AccountId);

    expect(getAccountsByUser).toHaveBeenCalled();
  });

  // ── loadReviewCount ───────────────────────────────────────────────────────────

  it("loadReviewCount does nothing when store is not initialized", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useAccountStore.getState().initStore(null as any, null as any);
    useAccountStore.getState().loadReviewCount();
    expect(getReviewCount).not.toHaveBeenCalled();
  });

  it("loadReviewCount updates reviewCount from DB", () => {
    vi.mocked(getReviewCount).mockReturnValueOnce(5);

    useAccountStore.getState().loadReviewCount();

    expect(useAccountStore.getState().reviewCount).toBe(5);
  });

  it("loadReviewCount sets reviewCount to 0 when no pending reviews", () => {
    vi.mocked(getReviewCount).mockReturnValueOnce(0);

    useAccountStore.getState().loadReviewCount();

    expect(useAccountStore.getState().reviewCount).toBe(0);
  });

  // ── reassignTransaction ───────────────────────────────────────────────────────

  it("reassignTransaction does nothing when dbRef is null", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useAccountStore.getState().initStore(null as any, mockUserId);
    useAccountStore.getState().reassignTransaction("tx-1" as TransactionId, "acc-1" as AccountId);
    expect(reassignTransactionAccount).not.toHaveBeenCalled();
  });

  it("reassignTransaction calls reassignTransactionAccount in DB", () => {
    useAccountStore.getState().reassignTransaction("tx-1" as TransactionId, "acc-2" as AccountId);

    expect(reassignTransactionAccount).toHaveBeenCalledWith(
      mockDb,
      "tx-1",
      "acc-2",
      expect.any(String)
    );
  });

  it("reassignTransaction enqueues sync entry for transactions table", () => {
    useAccountStore.getState().reassignTransaction("tx-1" as TransactionId, "acc-2" as AccountId);

    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        rowId: "tx-1",
        operation: "update",
      })
    );
  });

  it("reassignTransaction calls loadReviewCount after reassignment", () => {
    useAccountStore.getState().reassignTransaction("tx-1" as TransactionId, "acc-2" as AccountId);

    expect(getReviewCount).toHaveBeenCalledWith(mockDb, mockUserId);
  });
});

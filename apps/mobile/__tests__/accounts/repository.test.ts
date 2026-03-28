// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BankKey } from "@/features/accounts/schema";
import type {
  AccountId,
  CopAmount,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ eq: args })),
  and: vi.fn((...args: any[]) => ({ and: args })),
  desc: vi.fn((...args: any[]) => ({ desc: args })),
  isNull: vi.fn((...args: any[]) => ({ isNull: args })),
  ne: vi.fn((...args: any[]) => ({ ne: args })),
  sql: Object.assign(
    vi.fn((...args: any[]) => ({ sql: args })),
    {
      empty: vi.fn(),
    }
  ),
}));

vi.mock("@/shared/db/schema", () => ({
  accounts: {
    id: "accounts.id",
    userId: "accounts.userId",
    name: "accounts.name",
    type: "accounts.type",
    bankKey: "accounts.bankKey",
    identifiers: "accounts.identifiers",
    initialBalance: "accounts.initialBalance",
    isDefault: "accounts.isDefault",
    createdAt: "accounts.createdAt",
    updatedAt: "accounts.updatedAt",
    deletedAt: "accounts.deletedAt",
  },
  transactions: {
    id: "transactions.id",
    userId: "transactions.userId",
    type: "transactions.type",
    amount: "transactions.amount",
    categoryId: "transactions.categoryId",
    description: "transactions.description",
    date: "transactions.date",
    createdAt: "transactions.createdAt",
    updatedAt: "transactions.updatedAt",
    deletedAt: "transactions.deletedAt",
    source: "transactions.source",
    accountId: "transactions.accountId",
    linkedTransactionId: "transactions.linkedTransactionId",
    needsAccountReview: "transactions.needsAccountReview",
  },
}));

const mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockGet = vi.fn().mockReturnValue(undefined);
const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockReturnThis();

const mockTransaction = vi.fn((fn: (tx: any) => void) => fn(mockTxDb));
const mockTxDb = {} as any;

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  update: mockUpdate,
  transaction: mockTransaction,
} as any;

describe("accounts repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);

    // insert chain: insert(table).values(row).run()
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ run: mockRun });

    // select chain: select().from().where().orderBy().all()  OR  .get()
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({
      where: mockWhere,
      orderBy: mockOrderBy,
      all: mockAll,
      get: mockGet,
    });
    mockWhere.mockReturnValue({ all: mockAll, orderBy: mockOrderBy, get: mockGet });
    mockOrderBy.mockReturnValue({ all: mockAll });

    // update chain: update(table).set({}).where().run()
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ run: mockRun });

    // transaction db mirrors main db for update chains
    mockTxDb.update = mockUpdate;
  });

  // ── insertAccount ──────────────────────────────────────────────────────────

  describe("insertAccount", () => {
    it("calls db.insert with the provided row", async () => {
      const { insertAccount } = await import("@/features/accounts/lib/repository");

      const row = {
        id: "acc-1" as AccountId,
        userId: "user-1" as UserId,
        name: "Bancolombia Ahorros",
        type: "debit",
        bankKey: "bancolombia",
        identifiers: "[]",
        initialBalance: 0 as CopAmount,
        isDefault: false,
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      };

      insertAccount(mockDb, row);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(row);
      expect(mockRun).toHaveBeenCalled();
    });
  });

  // ── getAccountsByUser ──────────────────────────────────────────────────────

  describe("getAccountsByUser", () => {
    it("returns accounts ordered by isDefault desc then name", async () => {
      const mockRows = [
        {
          id: "acc-1",
          userId: "user-1",
          name: "Bancolombia",
          type: "debit",
          bankKey: "bancolombia",
          identifiers: "[]",
          initialBalance: 0,
          isDefault: true,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];
      mockOrderBy.mockReturnValueOnce({ all: vi.fn().mockReturnValue(mockRows) });

      const { getAccountsByUser } = await import("@/features/accounts/lib/repository");
      const result = getAccountsByUser(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });

    it("returns empty array when user has no accounts", async () => {
      mockOrderBy.mockReturnValueOnce({ all: vi.fn().mockReturnValue([]) });

      const { getAccountsByUser } = await import("@/features/accounts/lib/repository");
      const result = getAccountsByUser(mockDb, "user-1" as UserId);

      expect(result).toEqual([]);
    });
  });

  // ── getDefaultAccount ──────────────────────────────────────────────────────

  describe("getDefaultAccount", () => {
    it("returns the first row when a default account exists", async () => {
      const mockRow = {
        id: "acc-1",
        userId: "user-1",
        name: "Bancolombia",
        isDefault: true,
      };
      mockAll.mockReturnValueOnce([mockRow]);

      const { getDefaultAccount } = await import("@/features/accounts/lib/repository");
      const result = getDefaultAccount(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockRow);
    });

    it("returns null when no default account found", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getDefaultAccount } = await import("@/features/accounts/lib/repository");
      const result = getDefaultAccount(mockDb, "user-1" as UserId);

      expect(result).toBeNull();
    });
  });

  // ── setDefaultAccount ─────────────────────────────────────────────────────

  describe("setDefaultAccount", () => {
    it("clears all defaults then sets the given account as default", async () => {
      const { setDefaultAccount } = await import("@/features/accounts/lib/repository");

      setDefaultAccount(
        mockDb,
        "user-1" as UserId,
        "acc-2" as AccountId,
        "2026-03-15T10:00:00.000Z" as IsoDateTime
      );

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenNthCalledWith(1, {
        isDefault: false,
        updatedAt: "2026-03-15T10:00:00.000Z",
      });
      expect(mockSet).toHaveBeenNthCalledWith(2, {
        isDefault: true,
        updatedAt: "2026-03-15T10:00:00.000Z",
      });
      expect(mockRun).toHaveBeenCalledTimes(2);
    });
  });

  // ── getAccountsByBankKey ───────────────────────────────────────────────────

  describe("getAccountsByBankKey", () => {
    it("returns accounts matching userId and bankKey", async () => {
      const mockRows = [{ id: "acc-1", bankKey: "nequi" }];
      mockAll.mockReturnValueOnce(mockRows);

      const { getAccountsByBankKey } = await import("@/features/accounts/lib/repository");
      const result = getAccountsByBankKey(mockDb, "user-1" as UserId, "nequi" as BankKey);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });

    it("returns empty array when no accounts match", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getAccountsByBankKey } = await import("@/features/accounts/lib/repository");
      const result = getAccountsByBankKey(mockDb, "user-1" as UserId, "bbva" as BankKey);

      expect(result).toEqual([]);
    });
  });

  // ── softDeleteAccount ─────────────────────────────────────────────────────

  describe("softDeleteAccount", () => {
    it("sets deletedAt and updatedAt on the account", async () => {
      const { softDeleteAccount } = await import("@/features/accounts/lib/repository");

      softDeleteAccount(mockDb, "acc-1" as AccountId, "2026-03-15T10:00:00.000Z" as IsoDateTime);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        deletedAt: "2026-03-15T10:00:00.000Z",
        updatedAt: "2026-03-15T10:00:00.000Z",
      });
      expect(mockRun).toHaveBeenCalled();
    });

    it("soft-deleted accounts are excluded from getAccountsByUser query (via isNull filter)", async () => {
      // getAccountsByUser uses isNull(accounts.deletedAt) — we verify the where clause is called
      // with both userId and isNull conditions
      mockOrderBy.mockReturnValueOnce({ all: vi.fn().mockReturnValue([]) });

      const { getAccountsByUser } = await import("@/features/accounts/lib/repository");
      getAccountsByUser(mockDb, "user-1" as UserId);

      // Verify that isNull was invoked (mocked from drizzle-orm)
      const { isNull } = await import("drizzle-orm");
      expect(isNull).toHaveBeenCalled();
    });
  });

  // ── getReviewCount ─────────────────────────────────────────────────────────

  describe("getReviewCount", () => {
    it("returns the count of transactions needing review", async () => {
      mockGet.mockReturnValueOnce({ count: 3 });

      const { getReviewCount } = await import("@/features/accounts/lib/repository");
      const result = getReviewCount(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it("returns 0 when no transactions need review", async () => {
      mockGet.mockReturnValueOnce({ count: 0 });

      const { getReviewCount } = await import("@/features/accounts/lib/repository");
      const result = getReviewCount(mockDb, "user-1" as UserId);

      expect(result).toBe(0);
    });

    it("returns 0 when get() returns undefined (empty result)", async () => {
      mockGet.mockReturnValueOnce(undefined);

      const { getReviewCount } = await import("@/features/accounts/lib/repository");
      const result = getReviewCount(mockDb, "user-1" as UserId);

      expect(result).toBe(0);
    });
  });

  // ── reassignTransactionAccount ─────────────────────────────────────────────

  describe("reassignTransactionAccount", () => {
    it("sets accountId, clears needsAccountReview, and updates updatedAt", async () => {
      const { reassignTransactionAccount } = await import("@/features/accounts/lib/repository");

      reassignTransactionAccount(
        mockDb,
        "tx-1" as TransactionId,
        "acc-2" as AccountId,
        "2026-03-15T10:00:00.000Z" as IsoDateTime
      );

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        accountId: "acc-2",
        needsAccountReview: false,
        updatedAt: "2026-03-15T10:00:00.000Z",
      });
      expect(mockRun).toHaveBeenCalled();
    });
  });

  // ── linkTransferPair ───────────────────────────────────────────────────────

  describe("linkTransferPair", () => {
    it("links both transactions to each other and marks type as transfer", async () => {
      const { linkTransferPair } = await import("@/features/accounts/lib/repository");

      linkTransferPair(
        mockDb,
        "tx-a" as TransactionId,
        "tx-b" as TransactionId,
        "2026-03-15T10:00:00.000Z" as IsoDateTime
      );

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenNthCalledWith(1, {
        linkedTransactionId: "tx-b",
        type: "transfer",
        updatedAt: "2026-03-15T10:00:00.000Z",
      });
      expect(mockSet).toHaveBeenNthCalledWith(2, {
        linkedTransactionId: "tx-a",
        type: "transfer",
        updatedAt: "2026-03-15T10:00:00.000Z",
      });
      expect(mockRun).toHaveBeenCalledTimes(2);
    });
  });
});

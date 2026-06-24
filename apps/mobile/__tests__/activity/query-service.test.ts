import { describe, expect, it, vi } from "vitest";
import { createActivityQueryService } from "@/features/activity/services/create-activity-query-service";
import type { StoredTransaction } from "@/features/transactions/query.public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;

function makeTransactionRow(
  overrides: Partial<{
    id: TransactionId;
    amount: CopAmount;
    categoryId: CategoryId;
    date: IsoDate;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
  }> = {}
) {
  return {
    id: "tx-1" as TransactionId,
    userId: USER_ID,
    type: "expense",
    amount: 120_000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Lunch",
    date: "2026-04-18" as IsoDate,
    accountId: "fa-checking" as FinancialAccountId,
    accountAttributionState: "confirmed",
    createdAt: "2026-04-18T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-04-18T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    source: "manual",
    ...overrides,
  };
}

function makeTransferRow(
  overrides: Partial<{
    id: TransferId;
    amount: CopAmount;
    date: IsoDate;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
  }> = {}
) {
  return {
    id: "tr-1" as TransferId,
    userId: USER_ID,
    amount: 450_000 as CopAmount,
    fromAccountId: "fa-checking" as FinancialAccountId,
    toAccountId: "fa-card" as FinancialAccountId,
    fromExternalLabel: null,
    toExternalLabel: null,
    description: null,
    date: "2026-04-19" as IsoDate,
    createdAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    ...overrides,
  };
}

type ActivityServiceHarnessInput = {
  readonly transactionRows: readonly ReturnType<typeof makeTransactionRow>[];
  readonly transferRows: readonly ReturnType<typeof makeTransferRow>[];
};

const PAGINATION_TRANSACTION_ROWS = [
  makeTransactionRow({
    id: "tx-1" as TransactionId,
    date: "2026-04-19" as IsoDate,
    updatedAt: "2026-04-19T08:00:00.000Z" as IsoDateTime,
  }),
  makeTransactionRow({
    id: "tx-2" as TransactionId,
    date: "2026-04-18" as IsoDate,
    updatedAt: "2026-04-18T08:00:00.000Z" as IsoDateTime,
  }),
  makeTransactionRow({
    id: "tx-3" as TransactionId,
    date: "2026-04-17" as IsoDate,
    updatedAt: "2026-04-17T08:00:00.000Z" as IsoDateTime,
  }),
];

const PAGINATION_TRANSFER_ROWS = [
  makeTransferRow({
    id: "tr-1" as TransferId,
    date: "2026-04-19" as IsoDate,
    updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
  }),
  makeTransferRow({
    id: "tr-2" as TransferId,
    date: "2026-04-18" as IsoDate,
    updatedAt: "2026-04-18T09:00:00.000Z" as IsoDateTime,
  }),
  makeTransferRow({
    id: "tr-3" as TransferId,
    date: "2026-04-16" as IsoDate,
    updatedAt: "2026-04-16T09:00:00.000Z" as IsoDateTime,
  }),
];

const SAME_DAY_TRANSACTION_ROWS = [
  makeTransactionRow({
    id: "tx-edited" as TransactionId,
    date: "2026-04-19" as IsoDate,
    createdAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-04-19T13:00:00.000Z" as IsoDateTime,
  }),
];

const SAME_DAY_TRANSFER_ROWS = [
  makeTransferRow({
    id: "tr-midday" as TransferId,
    date: "2026-04-19" as IsoDate,
    updatedAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
  }),
];

const MERGED_TRANSACTION_ROWS = [
  makeTransactionRow({
    id: "tx-newer" as TransactionId,
    date: "2026-04-19" as IsoDate,
    updatedAt: "2026-04-19T08:00:00.000Z" as IsoDateTime,
  }),
  makeTransactionRow({
    id: "tx-older" as TransactionId,
    date: "2026-04-17" as IsoDate,
    updatedAt: "2026-04-17T08:00:00.000Z" as IsoDateTime,
  }),
];

const MERGED_TRANSFER_ROWS = [
  makeTransferRow({
    id: "tr-newest" as TransferId,
    date: "2026-04-19" as IsoDate,
    updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
  }),
];

function createActivityServiceHarness(input: ActivityServiceHarnessInput) {
  const getTransactionsPaginated = vi
    .fn<(...args: any[]) => any>()
    .mockReturnValue(input.transactionRows);
  const getTransfersPaginated = vi
    .fn<(...args: any[]) => any>()
    .mockReturnValue(input.transferRows);

  return {
    getTransactionsPaginated,
    getTransfersPaginated,
    service: createActivityQueryService({
      getTransactionsPaginated,
      getTransfersPaginated,
    }),
  };
}

const CLOUD_LEDGER_STORED_TRANSACTION_DEFAULTS = {
  id: "tx-cloud-pending" as TransactionId,
  amount: 85_000 as CopAmount,
  categoryId: "food" as CategoryId,
  description: "Offline groceries",
  date: "2026-04-20" as IsoDate,
  createdAt: "2026-04-20T12:00:00.000Z" as IsoDateTime,
} as const;

function makeCloudLedgerStoredTransaction(
  overrides: Partial<{
    id: TransactionId;
    amount: CopAmount;
    categoryId: CategoryId;
    description: string;
    date: IsoDate;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
  }> = {}
): StoredTransaction {
  const values = { ...CLOUD_LEDGER_STORED_TRANSACTION_DEFAULTS, ...overrides };
  const updatedAt = overrides.updatedAt ?? values.createdAt;

  return {
    id: values.id,
    userId: USER_ID,
    type: "expense",
    amount: values.amount,
    categoryId: values.categoryId,
    description: values.description,
    date: new Date(`${values.date}T00:00:00.000Z`),
    accountId: "fa-checking" as FinancialAccountId,
    accountAttributionState: "confirmed",
    counterpartyName: "",
    createdAt: new Date(values.createdAt),
    updatedAt: new Date(updatedAt),
    source: "manual",
    supersededAt: null,
    supersededByTransferId: null,
    voidedAt: null,
  };
}

function loadActivitySnapshot(
  service: ReturnType<typeof createActivityServiceHarness>["service"],
  pageSize: number,
  offset: number
) {
  return service.loadPage({
    db: {} as never,
    userId: USER_ID,
    pageSize,
    offset,
  });
}

describe("activity query service", () => {
  it("merges transactions and transfers into one newest-first activity page", () => {
    const { service } = createActivityServiceHarness({
      transactionRows: MERGED_TRANSACTION_ROWS,
      transferRows: MERGED_TRANSFER_ROWS,
    });
    const snapshot = loadActivitySnapshot(service, 30, 0);

    expect(snapshot.hasMore).toBe(false);
    expect(snapshot.offset).toBe(3);
    expect(snapshot.pages.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "transfer:tr-newest",
      "transaction:tx-newer",
      "transaction:tx-older",
    ]);
  });

  it("paginates after merging instead of paging the sources independently", () => {
    const { service, getTransactionsPaginated, getTransfersPaginated } =
      createActivityServiceHarness({
        transactionRows: PAGINATION_TRANSACTION_ROWS,
        transferRows: PAGINATION_TRANSFER_ROWS,
      });

    const snapshot = loadActivitySnapshot(service, 2, 2);

    expect(snapshot).toEqual(
      expect.objectContaining({
        hasMore: true,
        offset: 4,
      })
    );
    expect(snapshot.pages.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "transaction:tx-2",
      "transfer:tr-2",
    ]);
    expect(getTransactionsPaginated).toHaveBeenCalledWith({
      db: expect.anything(),
      userId: USER_ID,
      limit: 5,
      offset: 0,
    });
    expect(getTransfersPaginated).toHaveBeenCalledWith({
      db: expect.anything(),
      userId: USER_ID,
      limit: 5,
      offset: 0,
    });
  });

  it("orders same-day transaction activity with the transaction source sort key", () => {
    const { service } = createActivityServiceHarness({
      transactionRows: SAME_DAY_TRANSACTION_ROWS,
      transferRows: SAME_DAY_TRANSFER_ROWS,
    });
    const snapshot = loadActivitySnapshot(service, 30, 0);

    expect(snapshot.pages.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "transfer:tr-midday",
      "transaction:tx-edited",
    ]);
  });

  it("preserves custom transaction category IDs in activity items", () => {
    const { service } = createActivityServiceHarness({
      transactionRows: [
        makeTransactionRow({
          id: "tx-custom-category" as TransactionId,
          categoryId: "ucat-desserts" as CategoryId,
        }),
      ],
      transferRows: [],
    });

    const snapshot = loadActivitySnapshot(service, 30, 0);
    const item = snapshot.pages[0];

    expect(item?.kind).toBe("transaction");
    if (item?.kind !== "transaction") return;
    expect(item.transaction.categoryId).toBe("ucat-desserts");
  });

  it("includes optimistic Cloud Ledger transactions in the ordinary home activity page", async () => {
    const loadCloudLedgerOptimisticTransactions = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue([
        makeCloudLedgerStoredTransaction({
          id: "tx-cloud-pending" as TransactionId,
          date: "2026-04-20" as IsoDate,
          createdAt: "2026-04-20T12:00:00.000Z" as IsoDateTime,
        }),
      ]);
    const getTransactionsPaginated = vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue(MERGED_TRANSACTION_ROWS);
    const getTransfersPaginated = vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue(MERGED_TRANSFER_ROWS);
    const service = createActivityQueryService({
      getTransactionsPaginated,
      getTransfersPaginated,
      loadCloudLedgerOptimisticTransactions,
    });

    const snapshot = await service.loadPageWithCloudLedgerOptimisticView({
      db: {} as never,
      userId: USER_ID,
      pageSize: 30,
      offset: 0,
    });

    expect(loadCloudLedgerOptimisticTransactions).toHaveBeenCalledWith(USER_ID);
    expect(snapshot.pages.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "transaction:tx-cloud-pending",
      "transfer:tr-newest",
      "transaction:tx-newer",
      "transaction:tx-older",
    ]);
    const cloudLedgerItem = snapshot.pages[0];
    expect(cloudLedgerItem?.kind).toBe("transaction");
    if (cloudLedgerItem?.kind !== "transaction") return;
    expect(cloudLedgerItem.transaction).toMatchObject({
      amount: 85_000,
      categoryId: "food",
      description: "Offline groceries",
    });
    expect(cloudLedgerItem.transaction).not.toHaveProperty("commitStatus");
    expect(cloudLedgerItem.transaction).not.toHaveProperty("pendingChangeId");
  });

  it("keeps ordinary home activity when encrypted Cloud Ledger outbox optimistic loading fails", async () => {
    const outboxFailure = new Error("decrypt failed");
    outboxFailure.name = "CloudLedgerOutboxFailure";
    const loadCloudLedgerOptimisticTransactions = vi
      .fn<(...args: any[]) => any>()
      .mockRejectedValue(outboxFailure);
    const captureWarning = vi.fn<(...args: any[]) => any>();
    const service = createActivityQueryService({
      getTransactionsPaginated: vi
        .fn<(...args: any[]) => any>()
        .mockReturnValue(MERGED_TRANSACTION_ROWS),
      getTransfersPaginated: vi.fn<(...args: any[]) => any>().mockReturnValue(MERGED_TRANSFER_ROWS),
      loadCloudLedgerOptimisticTransactions,
      captureWarning,
    });

    const snapshot = await service.loadPageWithCloudLedgerOptimisticView({
      db: {} as never,
      userId: USER_ID,
      pageSize: 30,
      offset: 0,
    });

    expect(snapshot.pages.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "transfer:tr-newest",
      "transaction:tx-newer",
      "transaction:tx-older",
    ]);
    expect(captureWarning).toHaveBeenCalledWith("cloud_ledger_home_activity_load_failed", {
      errorType: "CloudLedgerOutboxFailure",
    });
  });

  it("keeps large merged offsets stack-safe", () => {
    const totalItems = 6000;
    const buildTimestamp = (dayOffset: number): IsoDateTime =>
      new Date(Date.UTC(2026, 3, 19 - dayOffset, 12, 0, 0)).toISOString() as IsoDateTime;
    const buildDate = (dayOffset: number): IsoDate =>
      buildTimestamp(dayOffset).slice(0, 10) as IsoDate;
    const getTransactionsPaginated = vi.fn<(...args: any[]) => any>().mockReturnValue(
      Array.from({ length: totalItems }, (_, index) =>
        makeTransactionRow({
          id: `tx-${index}` as TransactionId,
          date: buildDate(index),
          createdAt: buildTimestamp(index),
          updatedAt: buildTimestamp(index),
        })
      )
    );
    const getTransfersPaginated = vi.fn<(...args: any[]) => any>().mockReturnValue(
      Array.from({ length: totalItems }, (_, index) =>
        makeTransferRow({
          id: `tr-${index}` as TransferId,
          date: buildDate(index),
          updatedAt: buildTimestamp(index),
        })
      )
    );
    const service = createActivityQueryService({
      getTransactionsPaginated,
      getTransfersPaginated,
    });

    expect(() =>
      service.loadPage({
        db: {} as never,
        userId: USER_ID,
        pageSize: 20,
        offset: 5900,
      })
    ).not.toThrow();
  });
});

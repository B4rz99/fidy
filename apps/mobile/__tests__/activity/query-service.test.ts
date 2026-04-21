import { describe, expect, it, vi } from "vitest";
import { createActivityQueryService } from "@/features/activity/services/create-activity-query-service";
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
  const getTransactionsPaginated = vi.fn().mockReturnValue(input.transactionRows);
  const getTransfersPaginated = vi.fn().mockReturnValue(input.transferRows);

  return {
    getTransactionsPaginated,
    getTransfersPaginated,
    service: createActivityQueryService({
      getTransactionsPaginated,
      getTransfersPaginated,
    }),
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

  it("keeps large merged offsets stack-safe", () => {
    const totalItems = 6000;
    const buildTimestamp = (dayOffset: number): IsoDateTime =>
      new Date(Date.UTC(2026, 3, 19 - dayOffset, 12, 0, 0)).toISOString() as IsoDateTime;
    const buildDate = (dayOffset: number): IsoDate =>
      buildTimestamp(dayOffset).slice(0, 10) as IsoDate;
    const getTransactionsPaginated = vi.fn().mockReturnValue(
      Array.from({ length: totalItems }, (_, index) =>
        makeTransactionRow({
          id: `tx-${index}` as TransactionId,
          date: buildDate(index),
          createdAt: buildTimestamp(index),
          updatedAt: buildTimestamp(index),
        })
      )
    );
    const getTransfersPaginated = vi.fn().mockReturnValue(
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

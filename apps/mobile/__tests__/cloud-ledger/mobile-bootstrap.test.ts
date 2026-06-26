// biome-ignore-all lint/style/useNamingConvention: Supabase function payloads use snake_case fields
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  CloudLedgerClientFailure,
  createCloudLedgerTransactionAndRefresh,
  createEmptyCloudLedgerCache,
  refreshCloudLedgerCache,
} from "@/features/cloud-ledger/public";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireTransactionId,
} from "@/shared/types/assertions";

describe("mobile Cloud Ledger bootstrap", () => {
  it("hydrates the Ledger Cache through the Remote API Boundary without direct table access", async () => {
    const supabase = createCloudLedgerSupabase();

    const cache = await refreshCloudLedgerCache(supabase.client, createEmptyCloudLedgerCache());

    expect(supabase.functionsInvoke).toHaveBeenCalledWith("cloud-ledger-api", {
      body: { action: "bootstrap" },
    });
    expect(cache).toEqual({
      cursor: "ledger:7",
      categories: [
        {
          id: "cat-groceries",
          name: "Groceries",
          icon: "basket",
          color: "#2F6F5E",
          updatedAt: "2026-06-01T10:00:00.000Z",
        },
      ],
      financialAccounts: [
        {
          id: "acct-cash",
          name: "Cash",
          type: "cash",
          currency: "COP",
          updatedAt: "2026-06-01T10:01:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-user",
          type: "expense",
          amount: 15_000,
          currency: "COP",
          categoryId: "cat-groceries",
          accountId: "acct-cash",
          description: "Market",
          date: "2026-06-01",
          updatedAt: "2026-06-01T10:02:00.000Z",
        },
      ],
      transactionProjection: {
        categorySpending: [{ categoryId: "cat-groceries", total: 15_000 }],
        dailySpending: [{ date: "2026-06-01", total: 15_000 }],
        expenseTotal: 15_000,
        incomeTotal: 0,
      },
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.getSession).not.toHaveBeenCalled();
  });

  it("refreshes an existing Ledger Cache with its cursor and merges returned rows", async () => {
    const supabase = createCloudLedgerSupabase({
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            id: "txn-refresh",
            type: "income",
            amount: 20_000,
            currency: "COP",
            categoryId: null,
            accountId: "acct-cash",
            description: "Refund",
            date: "2026-06-02",
            updatedAt: "2026-06-02T10:02:00.000Z",
          },
        ],
        tombstones: [],
      },
    });

    const bootstrappedCache = await refreshCloudLedgerCache(
      supabase.client,
      createEmptyCloudLedgerCache()
    );
    const refreshedCache = await refreshCloudLedgerCache(supabase.client, bootstrappedCache);

    expect(supabase.functionsInvoke).toHaveBeenLastCalledWith("cloud-ledger-api", {
      body: { action: "refresh", cursor: "ledger:7" },
    });
    expect(refreshedCache.cursor).toBe("ledger:8");
    expect(refreshedCache.categories).toHaveLength(1);
    expect(refreshedCache.transactions.map((transaction) => transaction.id)).toEqual([
      "txn-user",
      "txn-refresh",
    ]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("creates a transaction online and refreshes the Ledger Cache from Cloud Ledger state", async () => {
    const acceptedTransaction = {
      id: "txn-20260622-client",
      type: "expense",
      amount: 18_000,
      currency: "COP",
      categoryId: "cat-groceries",
      accountId: "acct-cash",
      description: "Coffee",
      date: "2026-06-02",
      updatedAt: "2026-06-02T10:02:00.000Z",
    };
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        transaction: acceptedTransaction,
        cursor: "ledger:8",
      },
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [acceptedTransaction],
        tombstones: [],
      },
    });

    const bootstrappedCache = await refreshCloudLedgerCache(
      supabase.client,
      createEmptyCloudLedgerCache()
    );
    const refreshedCache = await createCloudLedgerTransactionAndRefresh(
      supabase.client,
      bootstrappedCache,
      {
        commandVersion: 1,
        transaction: {
          id: requireTransactionId("txn-20260622-client"),
          type: "expense",
          amount: requireCopAmount(18_000),
          currency: "COP",
          categoryId: requireCategoryId("cat-groceries"),
          accountId: requireFinancialAccountId("acct-cash"),
          description: "Coffee",
          date: requireIsoDate("2026-06-02"),
        },
      }
    );

    expect(supabase.functionsInvoke).toHaveBeenNthCalledWith(2, "cloud-ledger-api", {
      body: {
        action: "createTransaction",
        commandVersion: 1,
        transaction: {
          id: "txn-20260622-client",
          type: "expense",
          amount: 18_000,
          currency: "COP",
          categoryId: "cat-groceries",
          accountId: "acct-cash",
          description: "Coffee",
          date: "2026-06-02",
        },
      },
    });
    expect(supabase.functionsInvoke).toHaveBeenNthCalledWith(3, "cloud-ledger-api", {
      body: { action: "refresh", cursor: "ledger:7" },
    });
    expect(refreshedCache.cursor).toBe("ledger:8");
    expect(refreshedCache.transactions.map((transaction) => transaction.id)).toEqual([
      "txn-user",
      "txn-20260622-client",
    ]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("applies tombstones from refresh responses so deleted ledger records leave the cache", async () => {
    const supabase = createCloudLedgerSupabase({
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [
          {
            recordType: "transaction",
            recordId: "txn-user",
            deletedAt: "2026-06-02T11:00:00.000Z",
          },
        ],
      },
    });

    const bootstrappedCache = await refreshCloudLedgerCache(
      supabase.client,
      createEmptyCloudLedgerCache()
    );
    const refreshedCache = await refreshCloudLedgerCache(supabase.client, bootstrappedCache);

    expect(refreshedCache.cursor).toBe("ledger:8");
    expect(refreshedCache.transactions).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("preserves tombstone record ids exactly during cache reconciliation", async () => {
    const supabase = createCloudLedgerSupabase({
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [
          {
            recordType: "transaction",
            recordId: " txn-user ",
            deletedAt: "2026-06-02T11:00:00.000Z",
          },
        ],
      },
    });

    const bootstrappedCache = await refreshCloudLedgerCache(
      supabase.client,
      createEmptyCloudLedgerCache()
    );
    const refreshedCache = await refreshCloudLedgerCache(supabase.client, bootstrappedCache);

    expect(refreshedCache.transactions.map((transaction) => transaction.id)).toEqual(["txn-user"]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects blank tombstone record ids from Remote API Boundary responses", async () => {
    const supabase = createCloudLedgerSupabase({
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [
          {
            recordType: "transaction",
            recordId: "   ",
            deletedAt: "2026-06-02T11:00:00.000Z",
          },
        ],
      },
    });

    const bootstrappedCache = await refreshCloudLedgerCache(
      supabase.client,
      createEmptyCloudLedgerCache()
    );

    await expect(refreshCloudLedgerCache(supabase.client, bootstrappedCache)).rejects.toMatchObject(
      {
        code: "invalid_response",
        name: "CloudLedgerClientFailure",
      } satisfies Partial<CloudLedgerClientFailure>
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("treats missing tombstones as an invalid Remote API Boundary response", async () => {
    const supabase = createCloudLedgerSupabase({
      bootstrapPayload: {
        cursor: "ledger:7",
        categories: [],
        financialAccounts: [],
        transactions: [],
      },
    });

    await expect(
      refreshCloudLedgerCache(supabase.client, createEmptyCloudLedgerCache())
    ).rejects.toMatchObject({
      code: "invalid_response",
      name: "CloudLedgerClientFailure",
    } satisfies Partial<CloudLedgerClientFailure>);
  });

  it("surfaces typed Cloud Ledger API failures when invoke also reports non-2xx", async () => {
    const supabase = createCloudLedgerSupabase({
      apiFailure: "invalid_cursor",
      invokeError: { message: "Edge Function returned a non-2xx status code" },
    });

    await expect(
      refreshCloudLedgerCache(supabase.client, createEmptyCloudLedgerCache())
    ).rejects.toMatchObject({
      code: "invalid_cursor",
      name: "CloudLedgerClientFailure",
    } satisfies Partial<CloudLedgerClientFailure>);
  });

  it("surfaces typed create failures without refreshing the Ledger Cache", async () => {
    const supabase = createCloudLedgerSupabase({
      apiFailure: "invalid_ledger_reference",
      invokeError: { message: "Edge Function returned a non-2xx status code" },
    });

    await expect(
      createCloudLedgerTransactionAndRefresh(supabase.client, createEmptyCloudLedgerCache(), {
        commandVersion: 1,
        transaction: {
          id: requireTransactionId("txn-20260622-client"),
          type: "expense",
          amount: requireCopAmount(18_000),
          currency: "COP",
          categoryId: requireCategoryId("cat-groceries"),
          accountId: requireFinancialAccountId("acct-missing"),
          description: "Coffee",
          date: requireIsoDate("2026-06-02"),
        },
      })
    ).rejects.toMatchObject({
      code: "invalid_ledger_reference",
      name: "CloudLedgerClientFailure",
    } satisfies Partial<CloudLedgerClientFailure>);
    expect(supabase.functionsInvoke).toHaveBeenCalledTimes(1);
  });

  it("surfaces typed create failures from Functions HTTP error context", async () => {
    const supabase = createCloudLedgerSupabase({
      httpFailure: "invalid_ledger_reference",
    });

    await expect(
      createCloudLedgerTransactionAndRefresh(supabase.client, createEmptyCloudLedgerCache(), {
        commandVersion: 1,
        transaction: {
          id: requireTransactionId("txn-20260622-client"),
          type: "expense",
          amount: requireCopAmount(18_000),
          currency: "COP",
          categoryId: requireCategoryId("cat-groceries"),
          accountId: requireFinancialAccountId("acct-missing"),
          description: "Coffee",
          date: requireIsoDate("2026-06-02"),
        },
      })
    ).rejects.toMatchObject({
      code: "invalid_ledger_reference",
      name: "CloudLedgerClientFailure",
    } satisfies Partial<CloudLedgerClientFailure>);
    expect(supabase.functionsInvoke).toHaveBeenCalledTimes(1);
  });
});

type WirePayload = {
  readonly cursor: string;
  readonly categories: readonly unknown[];
  readonly financialAccounts: readonly unknown[];
  readonly transactions: readonly unknown[];
  readonly tombstones?: readonly unknown[];
};

function createCloudLedgerSupabase(
  options: {
    readonly apiFailure?: "invalid_cursor" | "invalid_auth" | "invalid_ledger_reference";
    readonly bootstrapPayload?: WirePayload;
    readonly createTransactionPayload?: unknown;
    readonly httpFailure?: "invalid_ledger_reference";
    readonly invokeError?: { readonly message: string };
    readonly refreshPayload?: WirePayload;
  } = {}
) {
  const bootstrapPayload = options.bootstrapPayload ?? defaultBootstrapPayload();
  const refreshPayload = options.refreshPayload ?? bootstrapPayload;
  const functionsInvoke = vi.fn<(...args: any[]) => any>(
    (_functionName: string, invokeOptions: { readonly body: { readonly action: string } }) =>
      Promise.resolve({
        data: invokeData(options, invokeOptions.body.action, {
          bootstrapPayload,
          refreshPayload,
        }),
        error: invokeError(options),
      })
  );
  const from = vi.fn<(...args: any[]) => any>();
  const getSession = vi.fn(() =>
    Promise.resolve({
      data: { session: { access_token: "ledger-access-token" } },
      error: null,
    })
  );
  const client = {
    auth: {
      getSession,
    },
    from,
    functions: { invoke: functionsInvoke },
  };

  return {
    client: client as unknown as SupabaseClient,
    from,
    functionsInvoke,
    getSession,
  };
}

function invokeData(
  options: {
    readonly apiFailure?: "invalid_cursor" | "invalid_auth" | "invalid_ledger_reference";
    readonly createTransactionPayload?: unknown;
    readonly httpFailure?: "invalid_ledger_reference";
  },
  action: string,
  payloads: {
    readonly bootstrapPayload: WirePayload;
    readonly refreshPayload: WirePayload;
  }
) {
  if (options.httpFailure !== undefined) {
    return null;
  }
  if (options.apiFailure !== undefined) {
    return { success: false, error: options.apiFailure };
  }
  return {
    success: true,
    data:
      action === "createTransaction"
        ? options.createTransactionPayload
        : action === "refresh"
          ? payloads.refreshPayload
          : payloads.bootstrapPayload,
  };
}

function invokeError(options: {
  readonly httpFailure?: "invalid_ledger_reference";
  readonly invokeError?: { readonly message: string };
}) {
  if (options.httpFailure === undefined) {
    return options.invokeError ?? null;
  }
  return {
    message: "Edge Function returned a non-2xx status code",
    context: new Response(
      JSON.stringify({
        success: false,
        error: options.httpFailure,
      }),
      { status: 400 }
    ),
  };
}

function defaultBootstrapPayload(): WirePayload {
  return {
    cursor: "ledger:7",
    categories: [
      {
        id: "cat-groceries",
        name: "Groceries",
        icon: "basket",
        color: "#2F6F5E",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
    financialAccounts: [
      {
        id: "acct-cash",
        name: "Cash",
        type: "cash",
        currency: "COP",
        updatedAt: "2026-06-01T10:01:00.000Z",
      },
    ],
    transactions: [
      {
        id: "txn-user",
        type: "expense",
        amount: 15_000,
        currency: "COP",
        categoryId: "cat-groceries",
        accountId: "acct-cash",
        description: "Market",
        date: "2026-06-01",
        updatedAt: "2026-06-01T10:02:00.000Z",
      },
    ],
    tombstones: [],
  };
}

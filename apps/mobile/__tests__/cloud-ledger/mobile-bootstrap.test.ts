// biome-ignore-all lint/style/useNamingConvention: Supabase function payloads use snake_case fields
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  CloudLedgerClientFailure,
  createEmptyCloudLedgerCache,
  refreshCloudLedgerCache,
} from "@/features/cloud-ledger/public";

describe("mobile Cloud Ledger bootstrap", () => {
  it("hydrates the Ledger Cache through the Remote API Boundary without direct table access", async () => {
    const supabase = createCloudLedgerSupabase();

    const cache = await refreshCloudLedgerCache(supabase.client, createEmptyCloudLedgerCache());

    expect(supabase.functionsInvoke).toHaveBeenCalledWith("cloud-ledger-api", {
      body: { action: "bootstrap" },
      headers: { Authorization: "Bearer ledger-access-token" },
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
    });
    expect(supabase.from).not.toHaveBeenCalled();
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
      headers: { Authorization: "Bearer ledger-access-token" },
    });
    expect(refreshedCache.cursor).toBe("ledger:8");
    expect(refreshedCache.categories).toHaveLength(1);
    expect(refreshedCache.transactions.map((transaction) => transaction.id)).toEqual([
      "txn-user",
      "txn-refresh",
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
    readonly apiFailure?: "invalid_cursor" | "invalid_auth";
    readonly bootstrapPayload?: WirePayload;
    readonly invokeError?: { readonly message: string };
    readonly refreshPayload?: WirePayload;
  } = {}
) {
  const bootstrapPayload = options.bootstrapPayload ?? defaultBootstrapPayload();
  const refreshPayload = options.refreshPayload ?? bootstrapPayload;
  const functionsInvoke = vi.fn<(...args: any[]) => any>(
    (_functionName: string, invokeOptions: { readonly body: { readonly action: string } }) =>
      Promise.resolve({
        data:
          options.apiFailure === undefined
            ? {
                success: true,
                data: invokeOptions.body.action === "refresh" ? refreshPayload : bootstrapPayload,
              }
            : { success: false, error: options.apiFailure },
        error: options.invokeError ?? null,
      })
  );
  const from = vi.fn<(...args: any[]) => any>();
  const client = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { access_token: "ledger-access-token" } },
          error: null,
        }),
    },
    from,
    functions: { invoke: functionsInvoke },
  };

  return {
    client: client as unknown as SupabaseClient,
    from,
    functionsInvoke,
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

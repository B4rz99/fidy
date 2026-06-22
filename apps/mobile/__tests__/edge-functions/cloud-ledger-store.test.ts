// biome-ignore-all lint/style/useNamingConvention: Supabase rows use snake_case fields
import { describe, expect, it, vi } from "vitest";
import { createCloudLedgerStore } from "../../../../supabase/functions/cloud-ledger-api/store";

const USER_ID = "00000000-0000-4000-8000-000000000001";

describe("Cloud Ledger Edge store", () => {
  it("refreshes through the service-only Cloud Ledger RPC without exposing table APIs", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const payload = await store.bootstrapLedger(USER_ID, "ledger:1");

    expect(payload).toEqual({
      cursor: "ledger:3",
      categories: [],
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
          categoryId: null,
          accountId: "acct-cash",
          description: "Market",
          date: "2026-06-01",
          updatedAt: "2026-06-01T10:02:00.000Z",
        },
      ],
      tombstones: [
        {
          recordType: "transaction",
          recordId: "txn-deleted",
          deletedAt: "2026-06-02T11:00:00.000Z",
        },
      ],
    });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_bootstrap", {
      p_after_sequence: 1,
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });
});

function createLedgerSupabase() {
  const rpc = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({
      data: {
        cursor: "ledger:3",
        categories: [],
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
            categoryId: null,
            accountId: "acct-cash",
            description: "Market",
            date: "2026-06-01",
            updatedAt: "2026-06-01T10:02:00.000Z",
          },
        ],
        tombstones: [
          {
            recordType: "transaction",
            recordId: "txn-deleted",
            deletedAt: "2026-06-02T11:00:00.000Z",
          },
        ],
      },
      error: null,
    })
  );
  const from = vi.fn<(...args: any[]) => any>();
  const schema = vi.fn<(...args: any[]) => any>();

  return {
    client: {
      from,
      rpc,
      schema,
    },
    from,
    rpc,
    schema,
  };
}

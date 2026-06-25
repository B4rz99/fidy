// biome-ignore-all lint/style/useNamingConvention: Supabase rows use snake_case fields
import { describe, expect, it, vi } from "vitest";
import { createCloudLedgerStore } from "../../../../supabase/functions/cloud-ledger-api/store";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_TRANSACTION_ID = "txn-20260622-client";
const BOOTSTRAP_RPC_DATA = {
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
} as const;
const CREATE_TRANSACTION_RPC_DATA = {
  code: "accepted",
  transaction: {
    id: CLIENT_TRANSACTION_ID,
    type: "expense",
    amount: 15_000,
    currency: "COP",
    categoryId: "cat-groceries",
    accountId: "acct-cash",
    description: "Market",
    date: "2026-06-01",
    updatedAt: "2026-06-01T10:02:00.000Z",
  },
  cursor: "ledger:4",
} as const;

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
      p_after_sequence: "1",
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it("passes large Ledger Cursor sequences to the RPC without unsafe numeric coercion", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    await store.bootstrapLedger(USER_ID, "ledger:9007199254740993");

    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_bootstrap", {
      p_after_sequence: "9007199254740993",
      p_user_id: USER_ID,
    });
  });

  it("creates transactions through the service-only Cloud Ledger command RPC", async () => {
    const supabase = createLedgerSupabase();
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.createTransaction(USER_ID, {
      commandVersion: 1,
      transaction: {
        id: CLIENT_TRANSACTION_ID,
        type: "expense",
        amount: 15_000,
        currency: "COP",
        categoryId: "cat-groceries",
        accountId: "acct-cash",
        description: "Market",
        date: "2026-06-01",
      },
    });

    expect(outcome).toEqual({
      code: "accepted",
      transaction: {
        id: CLIENT_TRANSACTION_ID,
        type: "expense",
        amount: 15_000,
        currency: "COP",
        categoryId: "cat-groceries",
        accountId: "acct-cash",
        description: "Market",
        date: "2026-06-01",
        updatedAt: "2026-06-01T10:02:00.000Z",
      },
      cursor: "ledger:4",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_create_transaction", {
      p_account_id: "acct-cash",
      p_amount: 15_000,
      p_category_id: "cat-groceries",
      p_command_version: 1,
      p_currency: "COP",
      p_date: "2026-06-01",
      p_description: "Market",
      p_transaction_id: CLIENT_TRANSACTION_ID,
      p_type: "expense",
      p_user_id: USER_ID,
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.schema).not.toHaveBeenCalled();
  });

  it("returns permanent pending-change create rejections instead of accepting an empty retry", async () => {
    const supabase = createLedgerSupabase({
      createTransactionOutcome: { code: "invalid_ledger_reference" },
    });
    const store = createCloudLedgerStore(supabase.client);

    const outcome = await store.applyPendingChanges(USER_ID, {
      commandVersion: 1,
      changes: [
        {
          id: "change-rejected-offline-create",
          kind: "createTransaction",
          commandVersion: 1,
          transaction: {
            id: CLIENT_TRANSACTION_ID,
            type: "expense",
            amount: 15_000,
            currency: "COP",
            categoryId: "cat-groceries",
            accountId: "acct-cash",
            description: "Market",
            date: "2026-06-01",
          },
        },
      ],
    });

    expect(outcome).toEqual({ code: "invalid_ledger_reference" });
  });
});

function createLedgerSupabase(
  options: {
    readonly createTransactionOutcome?: unknown;
  } = {}
) {
  const rpc = vi.fn<(...args: any[]) => any>((functionName: string) =>
    Promise.resolve(ledgerRpcResult(functionName, options))
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

function ledgerRpcResult(
  functionName: string,
  options: {
    readonly createTransactionOutcome?: unknown;
  }
) {
  return {
    data:
      functionName === "cloud_ledger_create_transaction"
        ? (options.createTransactionOutcome ?? CREATE_TRANSACTION_RPC_DATA)
        : BOOTSTRAP_RPC_DATA,
    error: null,
  };
}

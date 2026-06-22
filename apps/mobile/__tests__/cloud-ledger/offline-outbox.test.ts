import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  applyCloudLedgerBootstrap,
  CloudLedgerOutboxFailure,
  createEmptyCloudLedgerCache,
  createEncryptedCloudLedgerOutbox,
  createOfflineCloudLedgerTransaction,
  flushPendingCloudLedgerChanges,
  restoreOptimisticCloudLedgerCache,
  type EncryptedCloudLedgerOutboxSnapshot,
  type EncryptedCloudLedgerOutboxStorage,
} from "@/features/cloud-ledger/public";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireLedgerCursor,
  requireTransactionId,
} from "@/shared/types/assertions";

const OUTBOX_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1));

describe("mobile Cloud Ledger offline outbox", () => {
  it("creates a transaction while offline, shows it optimistically, and stores only encrypted pending state", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createSeededLedgerCache();

    const optimisticCache = await createOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });

    const optimisticTransaction = optimisticCache.transactions.find(
      (transaction) => transaction.id === "txn-20260622-client"
    );
    expect(optimisticTransaction).toEqual({
      id: "txn-20260622-client",
      type: "expense",
      amount: 18_000,
      currency: "COP",
      categoryId: "cat-groceries",
      accountId: "acct-cash",
      description: "Coffee",
      date: "2026-06-02",
      updatedAt: "2026-06-02T10:03:00.000Z",
    });
    expect(optimisticTransaction).not.toHaveProperty("commitStatus");
    expect(optimisticTransaction).not.toHaveProperty("pendingChangeId");
    expect(JSON.stringify(storage.readRaw())).not.toContain("Coffee");
    expect(JSON.stringify(storage.readRaw())).not.toContain("txn-20260622-client");
    expect(storage.readRaw()).toMatchObject({
      algorithm: "AES-GCM",
      version: 1,
    });
  });

  it("replays encrypted pending changes after restart and fails loudly on unreadable outbox state", async () => {
    const storage = createMemoryOutboxStorage();
    const cache = createSeededLedgerCache();
    const firstOutbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });

    await createOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox: firstOutbox,
    });

    const restartedOutbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const restoredCache = await restoreOptimisticCloudLedgerCache({
      cache,
      outbox: restartedOutbox,
    });

    expect(restoredCache.transactions.map((transaction) => transaction.id)).toEqual([
      "txn-20260622-client",
    ]);

    storage.replaceRaw({
      algorithm: "AES-GCM",
      ciphertext: "not-valid-ciphertext",
      nonce: "not-valid-nonce",
      version: 1,
    });
    await expect(restartedOutbox.load()).rejects.toMatchObject({
      code: "invalid_encrypted_outbox",
      name: "CloudLedgerOutboxFailure",
    } satisfies Partial<CloudLedgerOutboxFailure>);
  });

  it("flushes pending creates through the Remote API Boundary and reconciles accepted Ledger Cache state", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createSeededLedgerCache();
    const optimisticCache = await createOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const acceptedTransaction = acceptedCoffeeTransaction();
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

    const reconciledCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: supabase.client,
    });

    expectFlushThroughRemoteApiBoundary(supabase);
    expect(reconciledCache.transactions).toEqual([acceptedCoffeeTransaction()]);
    expect(await outbox.load()).toEqual([]);
    expect(storage.readRaw()).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.getSession).not.toHaveBeenCalled();
  });
});

function createMemoryOutboxStorage() {
  let stored: EncryptedCloudLedgerOutboxSnapshot | null = null;
  const adapter: EncryptedCloudLedgerOutboxStorage = {
    clear: async () => {
      stored = null;
    },
    read: async () => stored,
    write: async (snapshot) => {
      stored = snapshot;
    },
  };

  return {
    adapter,
    readRaw: () => stored,
    replaceRaw: (snapshot: EncryptedCloudLedgerOutboxSnapshot | null) => {
      stored = snapshot;
    },
  };
}

function createSeededLedgerCache() {
  return applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
    cursor: requireLedgerCursor("ledger:7"),
    categories: [
      {
        id: requireCategoryId("cat-groceries"),
        name: "Groceries",
        icon: "basket",
        color: "#2F6F5E",
        updatedAt: requireIsoDateTime("2026-06-01T10:00:00.000Z"),
      },
    ],
    financialAccounts: [
      {
        id: requireFinancialAccountId("acct-cash"),
        name: "Cash",
        type: "cash",
        currency: "COP",
        updatedAt: requireIsoDateTime("2026-06-01T10:01:00.000Z"),
      },
    ],
    transactions: [],
    tombstones: [],
  });
}

function offlineCoffeeCommand() {
  return {
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
  } as const;
}

function acceptedCoffeeTransaction() {
  return {
    id: "txn-20260622-client",
    type: "expense",
    amount: 18_000,
    currency: "COP",
    categoryId: "cat-groceries",
    accountId: "acct-cash",
    description: "Coffee accepted",
    date: "2026-06-02",
    updatedAt: "2026-06-02T10:04:00.000Z",
  };
}

function expectFlushThroughRemoteApiBoundary(
  supabase: ReturnType<typeof createCloudLedgerSupabase>
) {
  expect(supabase.functionsInvoke).toHaveBeenNthCalledWith(1, "cloud-ledger-api", {
    body: {
      action: "createTransaction",
      commandVersion: 1,
      transaction: offlineCoffeeCommand().transaction,
    },
  });
  expect(supabase.functionsInvoke).toHaveBeenNthCalledWith(2, "cloud-ledger-api", {
    body: { action: "refresh", cursor: "ledger:7" },
  });
}

type WirePayload = {
  readonly cursor: string;
  readonly categories: readonly unknown[];
  readonly financialAccounts: readonly unknown[];
  readonly transactions: readonly unknown[];
  readonly tombstones: readonly unknown[];
};

function createCloudLedgerSupabase(options: {
  readonly createTransactionPayload: unknown;
  readonly refreshPayload: WirePayload;
}) {
  const functionsInvoke = vi.fn<(...args: any[]) => any>(
    (_functionName: string, invokeOptions: { readonly body: { readonly action: string } }) =>
      Promise.resolve({
        data: {
          success: true,
          data:
            invokeOptions.body.action === "createTransaction"
              ? options.createTransactionPayload
              : options.refreshPayload,
        },
        error: null,
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

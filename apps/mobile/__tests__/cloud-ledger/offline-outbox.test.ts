import type { SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import {
  applyCloudLedgerBootstrap,
  type CloudLedgerCreateTransactionCommand,
  CloudLedgerOutboxFailure,
  createEmptyCloudLedgerCache,
  createEncryptedCloudLedgerOutbox,
  createOfflineCloudLedgerTransaction,
  discardCloudLedgerOutbox,
  getCloudLedgerOutbox,
  flushPendingCloudLedgerChanges,
  hasPendingCloudLedgerOutboxChanges,
  resetCloudLedgerOutboxInstances,
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
  requireUserId,
} from "@/shared/types/assertions";

const OUTBOX_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1));
const USER_ID = requireUserId("user-1");
const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;
const SECURE_STORE_VALUE_LIMIT_BYTES = 2048;
const secureStore = new Map<string, string>();

beforeEach(() => {
  secureStore.clear();
  resetCloudLedgerOutboxInstances();
  vi.mocked(SecureStore.getItem).mockImplementation((key: string) => secureStore.get(key) ?? null);
  vi.mocked(SecureStore.setItem).mockImplementation((key: string, value: string) => {
    secureStore.set(key, value);
  });
  vi.mocked(SecureStore.getItemAsync).mockImplementation((key: string) =>
    Promise.resolve(secureStore.get(key) ?? null)
  );
  vi.mocked(SecureStore.setItemAsync).mockImplementation((key: string, value: string) => {
    secureStore.set(key, value);
    return Promise.resolve();
  });
  vi.mocked(SecureStore.deleteItemAsync).mockImplementation((key: string) => {
    secureStore.delete(key);
    return Promise.resolve();
  });
});

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
    expect(optimisticCache.transactionProjection).toEqual({
      categorySpending: [{ categoryId: "cat-groceries", total: 18_000 }],
      dailySpending: [{ date: "2026-06-02", total: 18_000 }],
      expenseTotal: 18_000,
      incomeTotal: 0,
    });
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

  it("persists encrypted pending changes in app storage across outbox recreation", async () => {
    const cache = createSeededLedgerCache();

    await createOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox: getCloudLedgerOutbox(USER_ID),
    });

    resetCloudLedgerOutboxInstances();
    const restoredCache = await restoreOptimisticCloudLedgerCache({
      cache,
      outbox: getCloudLedgerOutbox(USER_ID),
    });

    expect(restoredCache.transactions.map((transaction) => transaction.id)).toEqual([
      "txn-20260622-client",
    ]);
    expect(JSON.stringify([...secureStore.entries()])).not.toContain("Coffee");
    expect(JSON.stringify([...secureStore.entries()])).not.toContain("txn-20260622-client");
  });

  it("uses SecureStore-compatible key names for encrypted outbox state and key material", async () => {
    const userId = requireUserId("user:1/with spaces@example.com");
    vi.mocked(SecureStore.setItem).mockImplementation((key: string, value: string) => {
      expect(key).toMatch(SECURE_STORE_KEY_PATTERN);
      secureStore.set(key, value);
    });
    vi.mocked(SecureStore.setItemAsync).mockImplementation((key: string, value: string) => {
      expect(key).toMatch(SECURE_STORE_KEY_PATTERN);
      secureStore.set(key, value);
      return Promise.resolve();
    });

    await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-secure-store-key-safe"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox: getCloudLedgerOutbox(userId),
    });

    expect([...secureStore.keys()]).not.toHaveLength(0);
    expect([...secureStore.keys()].every((key) => SECURE_STORE_KEY_PATTERN.test(key))).toBe(true);
  });

  it("persists large encrypted pending outbox payloads beyond SecureStore single-value limits", async () => {
    vi.mocked(SecureStore.setItemAsync).mockImplementation((key: string, value: string) => {
      if (value.length > SECURE_STORE_VALUE_LIMIT_BYTES) {
        return Promise.reject(new Error("SecureStore value exceeds native limit"));
      }
      secureStore.set(key, value);
      return Promise.resolve();
    });
    const pendingChanges = createLargePendingChanges();

    await enqueueCloudLedgerPendingChanges(pendingChanges);

    resetCloudLedgerOutboxInstances();
    const restored = await getCloudLedgerOutbox(USER_ID).load();

    expect(restored.map((change) => change.id)).toEqual(
      pendingChanges.map((pending) => pending.changeId)
    );
    expect(
      [...secureStore.entries()]
        .filter(([key]) => key.includes("cloud-ledger-outbox"))
        .every(([, value]) => value.length <= SECURE_STORE_VALUE_LIMIT_BYTES)
    ).toBe(true);
    expect(JSON.stringify([...secureStore.entries()])).not.toContain("Large offline purchase");
  });

  it("keeps the previous encrypted snapshot readable when a chunked overwrite crashes before manifest flip", async () => {
    const pendingChanges = createLargePendingChanges();
    await enqueueCloudLedgerPendingChanges(pendingChanges);
    const originalChangeIds = pendingChanges.map((pending) => pending.changeId);
    expect(secureStoreOutboxPayloadChunkKeys().length).toBeGreaterThan(1);

    let failManifestWrite = true;
    vi.mocked(SecureStore.setItemAsync).mockImplementation((key: string, value: string) => {
      if (failManifestWrite && key === "cloud-ledger-outbox_user-1") {
        return Promise.reject(new Error("simulated crash before manifest flip"));
      }
      secureStore.set(key, value);
      return Promise.resolve();
    });

    await expect(
      getCloudLedgerOutbox(USER_ID).remove(
        pendingChanges.slice(1).map((pending) => pending.changeId)
      )
    ).rejects.toThrow("simulated crash before manifest flip");

    resetCloudLedgerOutboxInstances();
    failManifestWrite = false;
    await expect(getCloudLedgerOutbox(USER_ID).load()).resolves.toEqual(
      expect.arrayContaining(originalChangeIds.map((id) => expect.objectContaining({ id })))
    );
    expect((await getCloudLedgerOutbox(USER_ID).load()).map((change) => change.id)).toEqual(
      originalChangeIds
    );
  });

  it("removes stale encrypted chunks when a large payload is overwritten with a smaller one", async () => {
    const pendingChanges = createLargePendingChanges();
    await enqueueCloudLedgerPendingChanges(pendingChanges);
    expect(secureStoreOutboxPayloadChunkKeys().length).toBeGreaterThan(1);

    await getCloudLedgerOutbox(USER_ID).remove(
      pendingChanges.slice(1).map((pending) => pending.changeId)
    );

    expect(secureStoreOutboxPayloadChunkKeys()).toHaveLength(1);
    expect((await getCloudLedgerOutbox(USER_ID).load()).map((change) => change.id)).toEqual(
      pendingChanges.slice(0, 1).map((pending) => pending.changeId)
    );
  });

  it("removes stale encrypted payload chunks on logout after a failed smaller overwrite cleanup", async () => {
    const pendingChanges = createLargePendingChanges();
    await enqueueCloudLedgerPendingChanges(pendingChanges);
    const staleChunkKey = secureStoreOutboxPayloadChunkKeys().find((key) =>
      key.endsWith("_chunk_1")
    );
    expect(staleChunkKey).toBeDefined();

    let failStaleChunkCleanup = true;
    vi.mocked(SecureStore.deleteItemAsync).mockImplementation((key: string) => {
      if (failStaleChunkCleanup && key === staleChunkKey) {
        return Promise.reject(new Error("simulated stale chunk cleanup failure"));
      }
      secureStore.delete(key);
      return Promise.resolve();
    });

    await expect(
      getCloudLedgerOutbox(USER_ID).remove(
        pendingChanges.slice(1).map((pending) => pending.changeId)
      )
    ).resolves.toBeUndefined();
    expect(secureStoreOutboxPayloadChunkKeys()).toContain(staleChunkKey);

    failStaleChunkCleanup = false;
    await discardCloudLedgerOutbox(USER_ID);

    expect([...secureStore.keys()]).toEqual([]);
  });

  it("discards persisted encrypted outbox state and keys on logout", async () => {
    await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox: getCloudLedgerOutbox(USER_ID),
    });

    expect([...secureStore.keys()]).toEqual(
      expect.arrayContaining(["cloud-ledger-outbox_user-1", "cloud-ledger-outbox-key_user-1"])
    );
    expect(secureStoreOutboxPayloadChunkKeys()).toHaveLength(1);
    expect([...secureStore.keys()].every((key) => SECURE_STORE_KEY_PATTERN.test(key))).toBe(true);

    await discardCloudLedgerOutbox(USER_ID);

    expect([...secureStore.keys()]).toEqual([]);
  });

  it("does not create encrypted outbox keys when logout discard has no stored outbox", async () => {
    await discardCloudLedgerOutbox(USER_ID);

    expect([...secureStore.keys()]).toEqual([]);
  });

  it("checks for pending encrypted outbox changes without creating outbox keys", async () => {
    await expect(hasPendingCloudLedgerOutboxChanges(USER_ID)).resolves.toBe(false);

    expect([...secureStore.keys()]).toEqual([]);
  });

  it("keeps pending encrypted outbox usable when logout discard cannot delete the encryption key", async () => {
    await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox: getCloudLedgerOutbox(USER_ID),
    });
    vi.mocked(SecureStore.deleteItemAsync).mockImplementation((key: string) => {
      if (key === "cloud-ledger-outbox-key_user-1") {
        return Promise.reject(new Error("simulated key delete failure"));
      }
      secureStore.delete(key);
      return Promise.resolve();
    });

    await expect(discardCloudLedgerOutbox(USER_ID)).rejects.toThrow("simulated key delete failure");

    resetCloudLedgerOutboxInstances();
    expect((await getCloudLedgerOutbox(USER_ID).load()).map((change) => change.id)).toEqual([
      "change-offline-coffee",
    ]);
  });

  it("keeps pending encrypted outbox usable when logout discard cannot delete a payload chunk", async () => {
    await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox: getCloudLedgerOutbox(USER_ID),
    });
    const activeChunkKey = secureStoreOutboxPayloadChunkKeys()[0];
    expect(activeChunkKey).toBeDefined();
    vi.mocked(SecureStore.deleteItemAsync).mockImplementation((key: string) => {
      if (key === activeChunkKey) {
        return Promise.reject(new Error("simulated payload chunk delete failure"));
      }
      secureStore.delete(key);
      return Promise.resolve();
    });

    await expect(discardCloudLedgerOutbox(USER_ID)).rejects.toThrow(
      "simulated payload chunk delete failure"
    );

    resetCloudLedgerOutboxInstances();
    expect((await getCloudLedgerOutbox(USER_ID).load()).map((change) => change.id)).toEqual([
      "change-offline-coffee",
    ]);
  });

  it("preserves concurrent pending creates enqueued for the same encrypted outbox", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const coffeeChange = pendingCreateChange({
      changeId: "change-offline-coffee",
      command: offlineCoffeeCommand(),
      createdAt: "2026-06-02T10:03:00.000Z",
    });
    const taxiChange = pendingCreateChange({
      changeId: "change-offline-taxi",
      command: offlineTaxiCommand(),
      createdAt: "2026-06-02T10:04:00.000Z",
    });

    await Promise.all([outbox.enqueue(coffeeChange), outbox.enqueue(taxiChange)]);

    expect((await outbox.load()).map((change) => change.id)).toEqual([
      "change-offline-coffee",
      "change-offline-taxi",
    ]);
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
        acceptedChangeIds: ["change-offline-coffee"],
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

  it("does not send pending changes when the flush generation is stale after loading them", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createSeededLedgerCache();
    await createOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        cursor: "ledger:8",
      },
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [acceptedCoffeeTransaction()],
        tombstones: [],
      },
    });

    const guardedCache = await flushPendingCloudLedgerChanges({
      cache,
      outbox,
      supabase: supabase.client,
      shouldContinue: () => false,
    });

    expect(supabase.functionsInvoke).not.toHaveBeenCalled();
    expect((await outbox.load()).map((change) => change.id)).toEqual(["change-offline-coffee"]);
    expect(storage.readRaw()).not.toBeNull();
    expect(guardedCache.transactions).toEqual([
      expect.objectContaining({
        id: "txn-20260622-client",
        description: "Coffee",
      }),
    ]);
  });

  it("keeps pending state when Cloud Ledger acceptance succeeds but cache reconciliation fails", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        cursor: "ledger:8",
      },
      refreshFailure: true,
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [],
      },
    });

    await expect(
      flushPendingCloudLedgerChanges({
        cache,
        outbox,
        supabase: supabase.client,
      })
    ).rejects.toMatchObject({ code: "transport_error" });

    expect(await outbox.load()).toHaveLength(1);
    expect(storage.readRaw()).not.toBeNull();
  });
});

function secureStoreOutboxPayloadChunkKeys() {
  return [...secureStore.keys()]
    .filter(
      (key) =>
        key.startsWith("cloud-ledger-outbox_user-1_chunk_") ||
        key.startsWith("cloud-ledger-outbox_user-1_generation_")
    )
    .sort();
}

function createLargePendingChanges() {
  return Array.from({ length: 12 }, (_, index) => ({
    changeId: requireLedgerChangeId(`change-large-pending-${index}`),
    command: largeOfflineCommand(index),
    createdAt: requireIsoDateTime(`2026-06-02T10:${String(index).padStart(2, "0")}:00.000Z`),
  }));
}

async function enqueueCloudLedgerPendingChanges(
  pendingChanges: readonly ReturnType<typeof createLargePendingChanges>[number][]
): Promise<void> {
  await pendingChanges.reduce<Promise<void>>(
    (previous, pending) =>
      previous.then(async () => {
        await createOfflineCloudLedgerTransaction({
          cache: createSeededLedgerCache(),
          changeId: pending.changeId,
          command: pending.command,
          createdAt: pending.createdAt,
          outbox: getCloudLedgerOutbox(USER_ID),
        });
      }),
    Promise.resolve()
  );
}

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

function offlineTaxiCommand() {
  return {
    commandVersion: 1,
    transaction: {
      id: requireTransactionId("txn-20260622-taxi"),
      type: "expense",
      amount: requireCopAmount(12_000),
      currency: "COP",
      categoryId: requireCategoryId("cat-groceries"),
      accountId: requireFinancialAccountId("acct-cash"),
      description: "Taxi",
      date: requireIsoDate("2026-06-02"),
    },
  } as const;
}

function largeOfflineCommand(index: number) {
  const suffix = String(index).padStart(2, "0");
  return {
    commandVersion: 1,
    transaction: {
      id: requireTransactionId(`txn-large-offline-${suffix}`),
      type: "expense",
      amount: requireCopAmount(10_000 + index),
      currency: "COP",
      categoryId: requireCategoryId("cat-groceries"),
      accountId: requireFinancialAccountId("acct-cash"),
      description: `Large offline purchase ${suffix} ${"x".repeat(150)}`,
      date: requireIsoDate("2026-06-02"),
    },
  } as const;
}

function pendingCreateChange(input: {
  readonly changeId: string;
  readonly command: CloudLedgerCreateTransactionCommand;
  readonly createdAt: string;
}) {
  return {
    id: requireLedgerChangeId(input.changeId),
    kind: "createTransaction",
    commandVersion: input.command.commandVersion,
    transaction: input.command.transaction,
    createdAt: requireIsoDateTime(input.createdAt),
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
      action: "applyPendingChanges",
      commandVersion: 1,
      changes: [
        {
          id: "change-offline-coffee",
          kind: "createTransaction",
          commandVersion: 1,
          transaction: offlineCoffeeCommand().transaction,
        },
      ],
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
  readonly refreshFailure?: boolean;
  readonly refreshPayload: WirePayload;
}) {
  const functionsInvoke = vi.fn<(...args: any[]) => any>(
    (_functionName: string, invokeOptions: { readonly body: { readonly action: string } }) => {
      if (options.refreshFailure === true && invokeOptions.body.action === "refresh") {
        return Promise.resolve({ data: null, error: { message: "network unavailable" } });
      }
      return Promise.resolve({
        data: {
          success: true,
          data:
            invokeOptions.body.action === "createTransaction" ||
            invokeOptions.body.action === "applyPendingChanges"
              ? options.createTransactionPayload
              : options.refreshPayload,
        },
        error: null,
      });
    }
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

import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import {
  applyCloudLedgerBootstrap,
  type CloudLedgerCreateTransactionCommand,
  createEmptyCloudLedgerCache,
} from "@/features/cloud-ledger/public";
import {
  amendOfflineCloudLedgerTransaction,
  CloudLedgerOutboxFailure,
  createEncryptedCloudLedgerOutbox,
  createOfflineCloudLedgerTransaction,
  discardCloudLedgerOutbox,
  discardCloudLedgerRepairItem,
  deleteOfflineCloudLedgerTransaction,
  getCloudLedgerOutbox,
  flushPendingCloudLedgerChanges,
  hasPendingCloudLedgerOutboxChanges,
  loadCloudLedgerRepairItems,
  resetCloudLedgerOutboxInstances,
  resubmitCloudLedgerRepairTransactionChange,
  restoreOptimisticCloudLedgerCache,
  retryCloudLedgerRepairItem,
  retryCloudLedgerRepairSet,
  type EncryptedCloudLedgerOutboxSnapshot,
  type EncryptedCloudLedgerOutboxStorage,
} from "@/features/cloud-ledger/outbox.public";
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
const CLOUD_LEDGER_DEVICE_ID = "device-0102030405060708090a0b0c0d0e0f10";
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
      version: 1,
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

  it("writes and reads encrypted pending changes through Expo AES without WebCrypto globals", async () => {
    const unavailableWebCrypto = {
      getRandomValues: vi.fn(() => {
        throw new Error("WebCrypto getRandomValues should not be used by Cloud Ledger outbox");
      }),
      subtle: {
        decrypt: vi.fn(() =>
          Promise.reject(new Error("WebCrypto decrypt should not be used by Cloud Ledger outbox"))
        ),
        encrypt: vi.fn(() =>
          Promise.reject(new Error("WebCrypto encrypt should not be used by Cloud Ledger outbox"))
        ),
      },
    };
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });

    await withTemporaryGlobalCrypto(unavailableWebCrypto, async () => {
      await outbox.enqueue(
        pendingCreateChange({
          changeId: "change-offline-coffee",
          command: offlineCoffeeCommand(),
          createdAt: "2026-06-02T10:03:00.000Z",
        })
      );

      await expect(outbox.load()).resolves.toEqual([
        expect.objectContaining({ id: "change-offline-coffee" }),
      ]);
    });

    expect(unavailableWebCrypto.getRandomValues).not.toHaveBeenCalled();
    expect(unavailableWebCrypto.subtle.encrypt).not.toHaveBeenCalled();
    expect(unavailableWebCrypto.subtle.decrypt).not.toHaveBeenCalled();
    expect(Crypto.aesEncryptAsync).toHaveBeenCalled();
    expect(Crypto.aesDecryptAsync).toHaveBeenCalled();
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

  it("removes stale encrypted payload chunks on logout retry after a failed discard", async () => {
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

    await expect(discardCloudLedgerOutbox(USER_ID)).rejects.toThrow(
      "simulated stale chunk cleanup failure"
    );
    resetCloudLedgerOutboxInstances();
    expect((await getCloudLedgerOutbox(USER_ID).load()).map((change) => change.id)).toEqual(
      pendingChanges.slice(0, 1).map((pending) => pending.changeId)
    );

    failStaleChunkCleanup = false;
    await discardCloudLedgerOutbox(USER_ID);
    expect([...secureStore.keys()]).toEqual([]);
  });

  it("does not reuse retained stale chunk generations after a failed discard restore", async () => {
    const largeChange = pendingCreateChange({
      changeId: "change-huge-generation-one",
      command: hugeOfflineCommand(),
      createdAt: "2026-06-02T10:01:00.000Z",
    });
    const smallChange = pendingCreateChange({
      changeId: "change-small-generation-two",
      command: offlineCoffeeCommand(),
      createdAt: "2026-06-02T10:02:00.000Z",
    });
    await getCloudLedgerOutbox(USER_ID).enqueue(largeChange);
    const retainedGenerationOneChunkKey = secureStoreOutboxPayloadChunkKeys().find((key) =>
      key.endsWith("_generation_1_chunk_1")
    );
    expect(retainedGenerationOneChunkKey).toBeDefined();

    let failGenerationOneCleanup = true;
    vi.mocked(SecureStore.deleteItemAsync).mockImplementation((key: string) => {
      if (failGenerationOneCleanup && key === retainedGenerationOneChunkKey) {
        return Promise.reject(new Error("simulated retained generation cleanup failure"));
      }
      secureStore.delete(key);
      return Promise.resolve();
    });

    await getCloudLedgerOutbox(USER_ID).enqueue(smallChange);
    await getCloudLedgerOutbox(USER_ID).remove([largeChange.id]);
    expect(secureStoreOutboxPayloadChunkKeys()).toContain(retainedGenerationOneChunkKey);

    await expect(discardCloudLedgerOutbox(USER_ID)).rejects.toThrow(
      "simulated retained generation cleanup failure"
    );
    resetCloudLedgerOutboxInstances();
    expect((await getCloudLedgerOutbox(USER_ID).load()).map((change) => change.id)).toEqual([
      smallChange.id,
    ]);

    failGenerationOneCleanup = false;
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

    vi.mocked(SecureStore.deleteItemAsync).mockImplementation((key: string) => {
      secureStore.delete(key);
      return Promise.resolve();
    });
    await expect(discardCloudLedgerOutbox(USER_ID)).resolves.toBeUndefined();

    expect([...secureStore.keys()]).toEqual([]);
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

  it("discards corrupted chunked encrypted outboxes when active chunks are missing", async () => {
    await enqueueCloudLedgerPendingChanges(createLargePendingChanges());
    const activeChunkKey = secureStoreOutboxPayloadChunkKeys()[0];
    if (activeChunkKey === undefined) {
      throw new Error("expected chunked encrypted outbox payload");
    }
    secureStore.delete(activeChunkKey);

    await expect(discardCloudLedgerOutbox(USER_ID)).resolves.toBeUndefined();

    expect([...secureStore.keys()]).toEqual([]);
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

  it("amends accepted transactions offline and reconciles the accepted edit after flush", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createAcceptedCoffeeLedgerCache();
    const amendedTransaction = acceptedCoffeeLedgerTransaction({
      amount: 19_000,
      description: "Coffee corrected",
      version: 2,
      updatedAt: "2026-06-02T10:05:00.000Z",
    });
    const amendedTransactionCommand = {
      id: amendedTransaction.id,
      type: amendedTransaction.type,
      amount: amendedTransaction.amount,
      currency: amendedTransaction.currency,
      categoryId: amendedTransaction.categoryId,
      accountId: amendedTransaction.accountId,
      description: amendedTransaction.description,
      date: amendedTransaction.date,
    } as const;
    const optimisticCache = await amendOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-amend-coffee"),
      createdAt: requireIsoDateTime("2026-06-02T10:05:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: amendedTransaction,
    });
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-amend-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-amend-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: {
        cursor: "ledger:9",
        categories: [],
        financialAccounts: [],
        transactions: [
          acceptedCoffeeTransaction({ description: "Coffee accepted corrected", version: 2 }),
        ],
        tombstones: [],
      },
    });

    expect(optimisticCache.transactions).toEqual([amendedTransaction]);
    expect(optimisticCache.transactionProjection).toMatchObject({
      categorySpending: [{ categoryId: "cat-groceries", total: 19_000 }],
      dailySpending: [{ date: "2026-06-02", total: 19_000 }],
      expenseTotal: 19_000,
      incomeTotal: 0,
    });
    expect(JSON.stringify(storage.readRaw())).not.toContain("Coffee corrected");

    const reconciledCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: supabase.client,
    });

    expect(supabase.functionsInvoke).toHaveBeenNthCalledWith(1, "cloud-ledger-api", {
      body: {
        action: "applyPendingChanges",
        commandVersion: 1,
        deviceId: CLOUD_LEDGER_DEVICE_ID,
        batchId: "batch-change-amend-coffee",
        changes: [
          {
            id: "change-amend-coffee",
            kind: "amendTransaction",
            commandVersion: 1,
            idempotencyKey: "change-amend-coffee",
            dependencies: [],
            expectedVersions: [
              {
                recordType: "transaction",
                recordId: "txn-20260622-client",
                version: 1,
              },
            ],
            clientTimestamp: "2026-06-02T10:05:00.000Z",
            transaction: amendedTransactionCommand,
          },
        ],
      },
    });
    expect(reconciledCache.transactions).toEqual([
      acceptedCoffeeLedgerTransaction({
        description: "Coffee accepted corrected",
        version: 2,
        updatedAt: "2026-06-02T10:04:00.000Z",
      }),
    ]);
    expect(await outbox.load()).toEqual([]);
  });

  it("deletes accepted transactions offline and reconciles the tombstone after flush", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createAcceptedCoffeeLedgerCache();
    const optimisticCache = await deleteOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-delete-coffee"),
      createdAt: requireIsoDateTime("2026-06-02T10:06:00.000Z"),
      expectedVersion: 1,
      outbox,
      transactionId: requireTransactionId("txn-20260622-client"),
    });
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-delete-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-delete-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: {
        cursor: "ledger:9",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [
          {
            recordType: "transaction",
            recordId: "txn-20260622-client",
            deletedAt: "2026-06-02T10:06:00.000Z",
          },
        ],
      },
    });

    expect(optimisticCache.transactions).toEqual([]);
    expect(optimisticCache.transactionProjection).toMatchObject({
      categorySpending: [],
      dailySpending: [],
      expenseTotal: 0,
      incomeTotal: 0,
    });
    expect(JSON.stringify(storage.readRaw())).not.toContain("txn-20260622-client");

    const reconciledCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: supabase.client,
    });

    expect(supabase.functionsInvoke).toHaveBeenNthCalledWith(1, "cloud-ledger-api", {
      body: {
        action: "applyPendingChanges",
        commandVersion: 1,
        deviceId: CLOUD_LEDGER_DEVICE_ID,
        batchId: "batch-change-delete-coffee",
        changes: [
          {
            id: "change-delete-coffee",
            kind: "deleteTransaction",
            commandVersion: 1,
            idempotencyKey: "change-delete-coffee",
            dependencies: [],
            expectedVersions: [
              {
                recordType: "transaction",
                recordId: "txn-20260622-client",
                version: 1,
              },
            ],
            clientTimestamp: "2026-06-02T10:06:00.000Z",
            transactionId: "txn-20260622-client",
          },
        ],
      },
    });
    expect(reconciledCache.transactions).toEqual([]);
    expect(await outbox.load()).toEqual([]);
  });

  it("keeps stale amend and delete conflicts as repair items after server rejection", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createAcceptedCoffeeAndTaxiLedgerCache();
    const amendedCoffee = acceptedCoffeeLedgerTransaction({
      amount: 19_000,
      description: "Coffee stale correction",
      version: 2,
      updatedAt: "2026-06-02T10:05:00.000Z",
    });
    const optimisticAmendCache = await amendOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-stale-amend-coffee"),
      createdAt: requireIsoDateTime("2026-06-02T10:05:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: amendedCoffee,
    });
    const optimisticDeleteCache = await deleteOfflineCloudLedgerTransaction({
      cache: optimisticAmendCache,
      changeId: requireLedgerChangeId("change-stale-delete-taxi"),
      createdAt: requireIsoDateTime("2026-06-02T10:06:00.000Z"),
      expectedVersion: 1,
      outbox,
      transactionId: requireTransactionId("txn-20260622-taxi"),
    });
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-stale-amend-coffee", "change-stale-delete-taxi"],
        changeOutcomes: [
          {
            changeId: "change-stale-amend-coffee",
            status: "repair_required",
            code: "stale_expected_version",
          },
          {
            changeId: "change-stale-delete-taxi",
            status: "repair_required",
            code: "stale_expected_version",
          },
        ],
        cursor: "ledger:10",
      },
      refreshPayload: {
        cursor: "ledger:10",
        categories: [],
        financialAccounts: [],
        transactions: [
          acceptedCoffeeTransaction({ description: "Coffee accepted elsewhere", version: 5 }),
          acceptedTaxiTransaction(),
        ],
        tombstones: [],
      },
    });

    const reconciledCache = await flushPendingCloudLedgerChanges({
      cache: optimisticDeleteCache,
      outbox,
      supabase: supabase.client,
    });

    expect((await outbox.load()).map((change) => change.id)).toEqual([
      "change-stale-amend-coffee",
      "change-stale-delete-taxi",
    ]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-stale-amend-coffee",
        kind: "amendTransaction",
        actions: ["editAndResubmit", "discard"],
        acceptedTransactionVersion: 5,
      }),
      expect.objectContaining({
        id: "change-stale-delete-taxi",
        kind: "deleteTransaction",
        actions: ["discard"],
      }),
    ]);
    expect(reconciledCache.transactions).toEqual([amendedCoffee]);
  });

  it("keeps stale amend conflicts as repair items without retrying them automatically", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createAcceptedCoffeeLedgerCache();
    const amendedCoffee = acceptedCoffeeLedgerTransaction({
      amount: 19_000,
      description: "Coffee stale correction",
      version: 2,
      updatedAt: "2026-06-02T10:05:00.000Z",
    });
    const optimisticCache = await amendOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-stale-amend-coffee"),
      createdAt: requireIsoDateTime("2026-06-02T10:05:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: amendedCoffee,
    });
    const staleSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-stale-amend-coffee"],
        changeOutcomes: [
          {
            changeId: "change-stale-amend-coffee",
            status: "repair_required",
            code: "stale_expected_version",
          },
        ],
        cursor: "ledger:10",
      },
      refreshPayload: {
        cursor: "ledger:10",
        categories: [],
        financialAccounts: [],
        transactions: [
          acceptedCoffeeTransaction({ description: "Coffee accepted elsewhere", version: 2 }),
        ],
        tombstones: [],
      },
    });
    const retrySupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-stale-amend-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-stale-amend-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:11",
      },
      refreshPayload: {
        cursor: "ledger:11",
        categories: [],
        financialAccounts: [],
        transactions: [acceptedCoffeeTransaction({ description: "Retry should not apply" })],
        tombstones: [],
      },
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: staleSupabase.client,
    });
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: retrySupabase.client,
    });

    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-stale-amend-coffee",
        kind: "amendTransaction",
        reason: "staleConflict",
        actions: ["editAndResubmit", "discard"],
        outcome: expect.objectContaining({
          code: "stale_expected_version",
          status: "repair_required",
        }),
      }),
    ]);
    expect(retrySupabase.functionsInvoke).not.toHaveBeenCalled();
    expect((await outbox.load()).map((change) => change.id)).toEqual(["change-stale-amend-coffee"]);
    expect(repairCache.transactions).toEqual([amendedCoffee]);
  });

  it("auto-retries retryable failures before surfacing a repair item", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-retryable-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const retryableOutcome = {
      code: "accepted" as const,
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-retryable-coffee"],
      changeOutcomes: [
        {
          changeId: "change-retryable-coffee",
          status: "retryable" as const,
          code: "retryable_failure",
        },
      ],
      cursor: "ledger:8",
    };
    const firstRetryableSupabase = createCloudLedgerSupabase({
      createTransactionPayload: retryableOutcome,
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const secondRetryableSupabase = createCloudLedgerSupabase({
      createTransactionPayload: retryableOutcome,
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const thirdSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-retryable-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-retryable-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: emptyRefreshPayload("ledger:9"),
    });

    const retryCache = await flushPendingCloudLedgerChanges({
      cache,
      outbox,
      supabase: firstRetryableSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);

    await flushPendingCloudLedgerChanges({
      cache: retryCache,
      outbox,
      supabase: secondRetryableSupabase.client,
    });
    await flushPendingCloudLedgerChanges({
      cache: retryCache,
      outbox,
      supabase: thirdSupabase.client,
    });

    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-retryable-coffee",
        reason: "retryableFailure",
        actions: ["retry", "discard"],
      }),
    ]);
    expect(thirdSupabase.functionsInvoke).not.toHaveBeenCalled();
  });

  it("keeps a retryable repair visible when manual retry receives another retryable response", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-manual-retryable-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const retryableOutcome = {
      code: "accepted" as const,
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-manual-retryable-coffee"],
      changeOutcomes: [
        {
          changeId: "change-manual-retryable-coffee",
          status: "retryable" as const,
          code: "edge_function_unavailable",
        },
      ],
      cursor: "ledger:8",
    };
    const firstRetryableSupabase = createCloudLedgerSupabase({
      createTransactionPayload: retryableOutcome,
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const secondRetryableSupabase = createCloudLedgerSupabase({
      createTransactionPayload: retryableOutcome,
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const manualRetrySupabase = createCloudLedgerSupabase({
      createTransactionPayload: retryableOutcome,
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });

    const retryCache = await flushPendingCloudLedgerChanges({
      cache,
      outbox,
      supabase: firstRetryableSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: retryCache,
      outbox,
      supabase: secondRetryableSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-manual-retryable-coffee",
        reason: "retryableFailure",
        actions: ["retry", "discard"],
      }),
    ]);

    await retryCloudLedgerRepairItem(
      outbox,
      requireLedgerChangeId("change-manual-retryable-coffee")
    );
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);

    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: manualRetrySupabase.client,
    });

    expect(manualRetrySupabase.functionsInvoke).toHaveBeenCalled();
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-manual-retryable-coffee",
        reason: "retryableFailure",
        actions: ["retry", "discard"],
      }),
    ]);
  });

  it("retries a failed pending change from the repair flow", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-repair-retry-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-repair-retry-coffee"],
        changeOutcomes: [
          {
            changeId: "change-repair-retry-coffee",
            status: "repair_required",
            code: "invalid_transaction",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-repair-retry-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-repair-retry-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:9"),
        transactions: [acceptedCoffeeTransaction()],
      },
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache,
      outbox,
      supabase: failedSupabase.client,
    });
    await retryCloudLedgerRepairItem(outbox, requireLedgerChangeId("change-repair-retry-coffee"));
    const acceptedCache = await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(acceptedSupabase.functionsInvoke).toHaveBeenCalledWith(
      "cloud-ledger-api",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "applyPendingChanges",
          changes: [expect.objectContaining({ id: "change-repair-retry-coffee" })],
        }),
      })
    );
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect(await outbox.load()).toEqual([]);
    expect(acceptedCache.transactions).toEqual([acceptedCoffeeTransaction()]);
  });

  it("retries a failed Pending Change Set from the repair flow", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    await outbox.enqueue(
      pendingCreateChange({
        changeId: "change-set-coffee",
        command: offlineCoffeeCommand(),
        createdAt: "2026-06-02T10:03:00.000Z",
      })
    );
    await outbox.enqueue(
      pendingCreateChange({
        changeId: "change-set-taxi",
        command: offlineTaxiCommand(),
        createdAt: "2026-06-02T10:04:00.000Z",
      })
    );
    const retryableOutcome = {
      code: "accepted" as const,
      acceptedChangeIds: [],
      rejectedChangeIds: ["change-set-coffee", "change-set-taxi"],
      changeOutcomes: [
        {
          changeId: "change-set-coffee",
          status: "retryable" as const,
          code: "edge_function_unavailable",
        },
        {
          changeId: "change-set-taxi",
          status: "retryable" as const,
          code: "edge_function_unavailable",
        },
      ],
      cursor: "ledger:8",
    };
    const firstFailedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: retryableOutcome,
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const secondFailedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: retryableOutcome,
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-set-coffee", "change-set-taxi"],
        rejectedChangeIds: [],
        changeOutcomes: [
          { changeId: "change-set-coffee", status: "accepted", code: "accepted" },
          { changeId: "change-set-taxi", status: "accepted", code: "accepted" },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: emptyRefreshPayload("ledger:9"),
    });

    const retryCache = await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: firstFailedSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: retryCache,
      outbox,
      supabase: secondFailedSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-set-coffee",
        reason: "retryableFailure",
        actions: ["retry", "discard"],
      }),
      expect.objectContaining({
        id: "change-set-taxi",
        reason: "retryableFailure",
        actions: ["retry", "discard"],
      }),
    ]);

    await retryCloudLedgerRepairSet(outbox);
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(
      acceptedSupabase.functionsInvoke.mock.calls
        .filter(([, options]) => options.body.action === "applyPendingChanges")
        .flatMap(([, options]) =>
          ((options as CloudLedgerInvokeOptions).body.changes ?? []).map((change) => change.id)
        )
    ).toEqual(["change-set-coffee", "change-set-taxi"]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect(await outbox.load()).toEqual([]);
  });

  it("retries only retryable repairs from a mixed Pending Change Set repair flow", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    await outbox.enqueue(
      pendingCreateChange({
        changeId: "change-set-retryable-coffee",
        command: offlineCoffeeCommand(),
        createdAt: "2026-06-02T10:03:00.000Z",
      })
    );
    await outbox.enqueue(
      pendingCreateChange({
        changeId: "change-set-invalid-taxi",
        command: offlineTaxiCommand(),
        createdAt: "2026-06-02T10:04:00.000Z",
      })
    );
    const firstFailedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-set-retryable-coffee", "change-set-invalid-taxi"],
        changeOutcomes: [
          {
            changeId: "change-set-retryable-coffee",
            status: "retryable",
            code: "edge_function_unavailable",
          },
          {
            changeId: "change-set-invalid-taxi",
            status: "repair_required",
            code: "invalid_transaction",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const secondFailedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-set-retryable-coffee"],
        changeOutcomes: [
          {
            changeId: "change-set-retryable-coffee",
            status: "retryable",
            code: "edge_function_unavailable",
          },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: emptyRefreshPayload("ledger:9"),
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-set-retryable-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          { changeId: "change-set-retryable-coffee", status: "accepted", code: "accepted" },
        ],
        cursor: "ledger:10",
      },
      refreshPayload: emptyRefreshPayload("ledger:10"),
    });

    const retryCache = await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: firstFailedSupabase.client,
    });
    const repairCache = await flushPendingCloudLedgerChanges({
      cache: retryCache,
      outbox,
      supabase: secondFailedSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-set-invalid-taxi",
        reason: "invalidTransaction",
        actions: ["editAndResubmit", "discard"],
      }),
      expect.objectContaining({
        id: "change-set-retryable-coffee",
        reason: "retryableFailure",
        actions: ["retry", "discard"],
      }),
    ]);

    await retryCloudLedgerRepairSet(outbox);
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(
      acceptedSupabase.functionsInvoke.mock.calls
        .filter(([, options]) => options.body.action === "applyPendingChanges")
        .flatMap(([, options]) =>
          ((options as CloudLedgerInvokeOptions).body.changes ?? []).map((change) => change.id)
        )
    ).toEqual(["change-set-retryable-coffee"]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-set-invalid-taxi",
        reason: "invalidTransaction",
        actions: ["editAndResubmit", "discard"],
      }),
    ]);
  });

  it("edits and resubmits a stale pending transaction change from the repair flow", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const cache = createAcceptedCoffeeLedgerCache();
    const staleCorrection = acceptedCoffeeLedgerTransaction({
      description: "Coffee stale correction",
      version: 2,
      updatedAt: "2026-06-02T10:05:00.000Z",
    });
    const optimisticCache = await amendOfflineCloudLedgerTransaction({
      cache,
      changeId: requireLedgerChangeId("change-edit-resubmit-coffee"),
      createdAt: requireIsoDateTime("2026-06-02T10:05:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: staleCorrection,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-edit-resubmit-coffee"],
        changeOutcomes: [
          {
            changeId: "change-edit-resubmit-coffee",
            status: "repair_required",
            code: "stale_expected_version",
          },
        ],
        cursor: "ledger:10",
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:10"),
        transactions: [
          acceptedCoffeeTransaction({ description: "Coffee accepted elsewhere", version: 2 }),
        ],
      },
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-edit-resubmit-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-edit-resubmit-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:11",
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:11"),
        transactions: [acceptedCoffeeTransaction({ description: "Coffee repaired", version: 3 })],
      },
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    const repairedCoffee = acceptedCoffeeLedgerTransaction({
      description: "Coffee repaired",
      version: 3,
      updatedAt: "2026-06-02T10:07:00.000Z",
    });
    const resubmitCache = await resubmitCloudLedgerRepairTransactionChange({
      cache: repairCache,
      changeId: requireLedgerChangeId("change-edit-resubmit-coffee"),
      createdAt: requireIsoDateTime("2026-06-02T10:07:00.000Z"),
      expectedVersion: 2,
      outbox,
      transaction: repairedCoffee,
    });
    const acceptedCache = await flushPendingCloudLedgerChanges({
      cache: resubmitCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(resubmitCache.transactions).toEqual([repairedCoffee]);
    expect(acceptedSupabase.functionsInvoke).toHaveBeenCalledWith(
      "cloud-ledger-api",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "applyPendingChanges",
          changes: [
            expect.objectContaining({
              id: "change-edit-resubmit-coffee",
              kind: "amendTransaction",
              clientTimestamp: "2026-06-02T10:07:00.000Z",
              expectedVersions: [
                {
                  recordType: "transaction",
                  recordId: "txn-20260622-client",
                  version: 2,
                },
              ],
              transaction: expect.objectContaining({
                description: "Coffee repaired",
              }),
            }),
          ],
        }),
      })
    );
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect(await outbox.load()).toEqual([]);
    expect(acceptedCache.transactions).toEqual([
      acceptedCoffeeLedgerTransaction({ description: "Coffee repaired", version: 3 }),
    ]);
  });

  it("edits and resubmits an invalid pending transaction create from the repair flow", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const optimisticCache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-invalid-create-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-invalid-create-coffee"],
        changeOutcomes: [
          {
            changeId: "change-invalid-create-coffee",
            status: "repair_required",
            code: "invalid_transaction",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-invalid-create-coffee"],
        rejectedChangeIds: [],
        changeOutcomes: [
          {
            changeId: "change-invalid-create-coffee",
            status: "accepted",
            code: "accepted",
          },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:9"),
        transactions: [acceptedCoffeeTransaction({ description: "Coffee fixed" })],
      },
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    const fixedCoffee = acceptedCoffeeLedgerTransaction({
      description: "Coffee fixed",
      updatedAt: "2026-06-02T10:06:00.000Z",
    });
    await resubmitCloudLedgerRepairTransactionChange({
      cache: repairCache,
      changeId: requireLedgerChangeId("change-invalid-create-coffee"),
      createdAt: requireIsoDateTime("2026-06-02T10:06:00.000Z"),
      outbox,
      transaction: fixedCoffee,
    });
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(acceptedSupabase.functionsInvoke).toHaveBeenCalledWith(
      "cloud-ledger-api",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "applyPendingChanges",
          changes: [
            expect.objectContaining({
              id: "change-invalid-create-coffee",
              kind: "createTransaction",
              clientTimestamp: "2026-06-02T10:06:00.000Z",
              expectedVersions: [],
              transaction: expect.objectContaining({
                description: "Coffee fixed",
              }),
            }),
          ],
        }),
      })
    );
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect(await outbox.load()).toEqual([]);
  });

  it("discards a repair item without dropping unrelated pending optimistic changes", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const coffeeCache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-discard-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const optimisticCache = await createOfflineCloudLedgerTransaction({
      cache: coffeeCache,
      changeId: requireLedgerChangeId("change-keep-taxi"),
      command: offlineTaxiCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
      outbox,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-discard-coffee"],
        changeOutcomes: [
          {
            changeId: "change-discard-coffee",
            status: "repair_required",
            code: "invalid_transaction",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    await discardCloudLedgerRepairItem(outbox, requireLedgerChangeId("change-discard-coffee"));
    const restoredCache = await restoreOptimisticCloudLedgerCache({
      cache: createSeededLedgerCache(),
      outbox,
    });

    expect(repairCache.transactions.map((transaction) => transaction.id)).toEqual([
      "txn-20260622-client",
      "txn-20260622-taxi",
    ]);
    expect((await outbox.load()).map((change) => change.id)).toEqual(["change-keep-taxi"]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect(restoredCache.transactions).toEqual([
      expect.objectContaining({
        id: "txn-20260622-taxi",
        description: "Taxi",
      }),
    ]);
  });

  it("discards dependent children when a parent repair is discarded", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const parentCache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-discard-parent"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const childAmend = acceptedCoffeeLedgerTransaction({
      description: "Coffee impossible child",
      version: 2,
      updatedAt: "2026-06-02T10:04:00.000Z",
    });
    const optimisticCache = await amendOfflineCloudLedgerTransaction({
      cache: parentCache,
      changeId: requireLedgerChangeId("change-discard-child"),
      createdAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: childAmend,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-discard-parent", "change-discard-child"],
        changeOutcomes: [
          {
            changeId: "change-discard-parent",
            status: "repair_required",
            code: "invalid_transaction",
          },
          {
            changeId: "change-discard-child",
            status: "repair_required",
            code: "dependency_failed",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-discard-parent",
        reason: "invalidTransaction",
      }),
      expect.objectContaining({
        id: "change-discard-child",
        reason: "dependencyFailure",
        parentChangeId: "change-discard-parent",
      }),
    ]);

    await discardCloudLedgerRepairItem(outbox, requireLedgerChangeId("change-discard-parent"));
    const restoredCache = await restoreOptimisticCloudLedgerCache({
      cache: createSeededLedgerCache(),
      outbox,
    });

    expect(repairCache.transactions).toEqual([childAmend]);
    expect(await outbox.load()).toEqual([]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect(restoredCache.transactions).toEqual([]);
  });

  it("identifies the parent problem for dependency failures and holds impossible child changes", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const parentCache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-parent-invalid"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const amendedCoffee = acceptedCoffeeLedgerTransaction({
      description: "Coffee child amend",
      version: 2,
      updatedAt: "2026-06-02T10:04:00.000Z",
    });
    const optimisticCache = await amendOfflineCloudLedgerTransaction({
      cache: parentCache,
      changeId: requireLedgerChangeId("change-child-blocked"),
      createdAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: amendedCoffee,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-parent-invalid", "change-child-blocked"],
        changeOutcomes: [
          {
            changeId: "change-parent-invalid",
            status: "repair_required",
            code: "invalid_transaction",
          },
          {
            changeId: "change-child-blocked",
            status: "repair_required",
            code: "dependency_failed",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-parent-invalid", "change-child-blocked"],
        rejectedChangeIds: [],
        changeOutcomes: [
          { changeId: "change-parent-invalid", status: "accepted", code: "accepted" },
          { changeId: "change-child-blocked", status: "accepted", code: "accepted" },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: emptyRefreshPayload("ledger:9"),
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-parent-invalid",
        reason: "invalidTransaction",
      }),
      expect.objectContaining({
        id: "change-child-blocked",
        reason: "dependencyFailure",
        parentChangeId: "change-parent-invalid",
      }),
    ]);
    expect(failedSupabase.functionsInvoke).toHaveBeenCalledWith(
      "cloud-ledger-api",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "applyPendingChanges",
          changes: [
            expect.objectContaining({
              id: "change-parent-invalid",
              dependencies: [],
            }),
            expect.objectContaining({
              id: "change-child-blocked",
              dependencies: ["change-parent-invalid"],
            }),
          ],
        }),
      })
    );

    await retryCloudLedgerRepairItem(outbox, requireLedgerChangeId("change-child-blocked"));
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(acceptedSupabase.functionsInvoke).not.toHaveBeenCalled();
  });

  it("identifies dependency failure parents across chunked Pending Change Set flushes", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const pendingChanges = Array.from({ length: 11 }, (_, index) => ({
      changeId: requireLedgerChangeId(`change-chunked-parent-${String(index).padStart(2, "0")}`),
      createdAt: requireIsoDateTime(`2026-06-02T10:${String(index + 10).padStart(2, "0")}:00.000Z`),
      transaction: acceptedCoffeeLedgerTransaction({
        description: `Coffee chunked ${index}`,
        version: index + 2,
        updatedAt: `2026-06-02T10:${String(index + 10).padStart(2, "0")}:00.000Z`,
      }),
    }));
    const optimisticCache = await pendingChanges.reduce<
      Promise<Awaited<ReturnType<typeof createOfflineCloudLedgerTransaction>>>
    >(
      async (previousCache, pending, index) =>
        await amendOfflineCloudLedgerTransaction({
          cache: await previousCache,
          changeId: pending.changeId,
          createdAt: pending.createdAt,
          expectedVersion: index + 1,
          outbox,
          transaction: pending.transaction,
        }),
      Promise.resolve(createAcceptedCoffeeLedgerCache())
    );
    const acceptedDependencyIds = pendingChanges.slice(0, 9).map((change) => change.changeId);
    const failedParentId = pendingChanges[9]?.changeId;
    const dependentChildId = pendingChanges[10]?.changeId;
    if (failedParentId === undefined || dependentChildId === undefined) {
      throw new Error("Expected chunked parent and child changes");
    }
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: (changes: readonly CloudLedgerApplyPendingChangeRequest[]) => {
        const changeIds = changes.map((change) => change.id);
        return changeIds.includes(dependentChildId)
          ? {
              code: "accepted",
              acceptedChangeIds: [],
              rejectedChangeIds: [dependentChildId],
              changeOutcomes: [
                {
                  changeId: dependentChildId,
                  status: "repair_required",
                  code: "dependency_failed",
                },
              ],
              cursor: "ledger:9",
            }
          : {
              code: "accepted",
              acceptedChangeIds: acceptedDependencyIds,
              rejectedChangeIds: [failedParentId],
              changeOutcomes: [
                ...acceptedDependencyIds.map((changeId) => ({
                  changeId,
                  status: "accepted" as const,
                  code: "accepted",
                })),
                {
                  changeId: failedParentId,
                  status: "repair_required" as const,
                  code: "invalid_transaction",
                },
              ],
              cursor: "ledger:8",
            };
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:9"),
        transactions: [acceptedCoffeeTransaction({ description: "Coffee accepted dependency" })],
      },
    });

    await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: supabase.client,
    });

    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: failedParentId,
        reason: "invalidTransaction",
      }),
      expect.objectContaining({
        id: dependentChildId,
        reason: "dependencyFailure",
        parentChangeId: failedParentId,
      }),
    ]);
  });

  it("resumes a dependency-failed child after the parent repair is accepted", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const parentCache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-parent-fixed"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const childAmend = acceptedCoffeeLedgerTransaction({
      description: "Coffee child amend",
      version: 2,
      updatedAt: "2026-06-02T10:04:00.000Z",
    });
    const optimisticCache = await amendOfflineCloudLedgerTransaction({
      cache: parentCache,
      changeId: requireLedgerChangeId("change-child-resumes"),
      createdAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: childAmend,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-parent-fixed", "change-child-resumes"],
        changeOutcomes: [
          {
            changeId: "change-parent-fixed",
            status: "repair_required",
            code: "invalid_transaction",
          },
          {
            changeId: "change-child-resumes",
            status: "repair_required",
            code: "dependency_failed",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const parentAcceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-parent-fixed"],
        rejectedChangeIds: [],
        changeOutcomes: [{ changeId: "change-parent-fixed", status: "accepted", code: "accepted" }],
        cursor: "ledger:9",
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:9"),
        transactions: [acceptedCoffeeTransaction({ description: "Coffee parent accepted" })],
      },
    });
    const childAcceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-child-resumes"],
        rejectedChangeIds: [],
        changeOutcomes: [
          { changeId: "change-child-resumes", status: "accepted", code: "accepted" },
        ],
        cursor: "ledger:10",
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:10"),
        transactions: [
          acceptedCoffeeTransaction({ description: "Coffee child accepted", version: 2 }),
        ],
      },
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-parent-fixed",
        reason: "invalidTransaction",
      }),
      expect.objectContaining({
        id: "change-child-resumes",
        reason: "dependencyFailure",
        parentChangeId: "change-parent-fixed",
      }),
    ]);

    const fixedParent = acceptedCoffeeLedgerTransaction({
      description: "Coffee parent fixed",
      updatedAt: "2026-06-02T10:06:00.000Z",
    });
    const resubmitCache = await resubmitCloudLedgerRepairTransactionChange({
      cache: repairCache,
      changeId: requireLedgerChangeId("change-parent-fixed"),
      createdAt: requireIsoDateTime("2026-06-02T10:06:00.000Z"),
      outbox,
      transaction: fixedParent,
    });
    const parentAcceptedCache = await flushPendingCloudLedgerChanges({
      cache: resubmitCache,
      outbox,
      supabase: parentAcceptedSupabase.client,
    });

    expect(
      parentAcceptedSupabase.functionsInvoke.mock.calls
        .filter(([, options]) => options.body.action === "applyPendingChanges")
        .flatMap(([, options]) =>
          ((options as CloudLedgerInvokeOptions).body.changes ?? []).map((change) => change.id)
        )
    ).toEqual(["change-parent-fixed"]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect((await outbox.load()).map((change) => change.id)).toEqual(["change-child-resumes"]);

    const acceptedCache = await flushPendingCloudLedgerChanges({
      cache: parentAcceptedCache,
      outbox,
      supabase: childAcceptedSupabase.client,
    });

    expect(
      childAcceptedSupabase.functionsInvoke.mock.calls
        .filter(([, options]) => options.body.action === "applyPendingChanges")
        .flatMap(([, options]) =>
          ((options as CloudLedgerInvokeOptions).body.changes ?? []).map((change) => change.id)
        )
    ).toEqual(["change-child-resumes"]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([]);
    expect(await outbox.load()).toEqual([]);
    expect(acceptedCache.transactions).toEqual([
      acceptedCoffeeLedgerTransaction({ description: "Coffee child accepted", version: 2 }),
    ]);
  });

  it("does not strand dependency repairs when storage fails after a parent is accepted", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const parentCache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-parent-atomic-cleanup"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const childAmend = acceptedCoffeeLedgerTransaction({
      description: "Coffee child waits for atomic cleanup",
      version: 2,
      updatedAt: "2026-06-02T10:04:00.000Z",
    });
    const optimisticCache = await amendOfflineCloudLedgerTransaction({
      cache: parentCache,
      changeId: requireLedgerChangeId("change-child-atomic-cleanup"),
      createdAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
      expectedVersion: 1,
      outbox,
      transaction: childAmend,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-parent-atomic-cleanup", "change-child-atomic-cleanup"],
        changeOutcomes: [
          {
            changeId: "change-parent-atomic-cleanup",
            status: "repair_required",
            code: "invalid_transaction",
          },
          {
            changeId: "change-child-atomic-cleanup",
            status: "repair_required",
            code: "dependency_failed",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const parentAcceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-parent-atomic-cleanup"],
        rejectedChangeIds: [],
        changeOutcomes: [
          { changeId: "change-parent-atomic-cleanup", status: "accepted", code: "accepted" },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: {
        ...emptyRefreshPayload("ledger:9"),
        transactions: [acceptedCoffeeTransaction({ description: "Coffee parent accepted" })],
      },
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    const fixedParent = acceptedCoffeeLedgerTransaction({
      description: "Coffee parent fixed",
      updatedAt: "2026-06-02T10:06:00.000Z",
    });
    const resubmitCache = await resubmitCloudLedgerRepairTransactionChange({
      cache: repairCache,
      changeId: requireLedgerChangeId("change-parent-atomic-cleanup"),
      createdAt: requireIsoDateTime("2026-06-02T10:06:00.000Z"),
      outbox,
      transaction: fixedParent,
    });

    storage.failNthWrite(2, "simulated crash after accepted parent removal");
    await flushPendingCloudLedgerChanges({
      cache: resubmitCache,
      outbox,
      supabase: parentAcceptedSupabase.client,
    }).catch(() => undefined);

    const restartedOutbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    expect(await loadCloudLedgerRepairItems(restartedOutbox)).toEqual([]);
    expect((await restartedOutbox.load()).map((change) => change.id)).toEqual([
      "change-child-atomic-cleanup",
    ]);
  });

  it("surfaces unsupported command versions as app-update repair items that cannot be retried", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const optimisticCache = await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-unsupported-version"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-unsupported-version"],
        changeOutcomes: [
          {
            changeId: "change-unsupported-version",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-unsupported-version"],
        rejectedChangeIds: [],
        changeOutcomes: [
          { changeId: "change-unsupported-version", status: "accepted", code: "accepted" },
        ],
        cursor: "ledger:9",
      },
      refreshPayload: emptyRefreshPayload("ledger:9"),
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: optimisticCache,
      outbox,
      supabase: failedSupabase.client,
    });
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-unsupported-version",
        reason: "unsupportedCommandVersion",
        actions: ["discard"],
      }),
    ]);
    expect(acceptedSupabase.functionsInvoke).not.toHaveBeenCalled();
  });

  it("surfaces persisted unsupported command versions instead of treating the outbox as corrupt", async () => {
    const storage = createMemoryOutboxStorage();
    await writePlainOutboxSnapshot(storage, {
      version: 1,
      changes: [
        {
          id: "change-persisted-unsupported-version",
          kind: "createTransaction",
          commandVersion: 2,
          dependencies: [],
          transaction: offlineCoffeeCommand().transaction,
          createdAt: "2026-06-02T10:03:00.000Z",
        },
      ],
      retryAttempts: [],
      repairs: [],
    });
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: ["change-persisted-unsupported-version"],
        changeOutcomes: [
          {
            changeId: "change-persisted-unsupported-version",
            status: "requires_app_update",
            code: "unsupported_command_version",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });

    await expect(outbox.load()).resolves.toEqual([
      expect.objectContaining({
        id: "change-persisted-unsupported-version",
        commandVersion: 2,
      }),
    ]);
    await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: failedSupabase.client,
    });

    expect(
      failedSupabase.functionsInvoke.mock.calls
        .filter(([, options]) => options.body.action === "applyPendingChanges")
        .flatMap(([, options]) =>
          ((options as CloudLedgerInvokeOptions).body.changes ?? []).map((change) => change)
        )
    ).toEqual([
      expect.objectContaining({
        id: "change-persisted-unsupported-version",
        commandVersion: 2,
      }),
    ]);
    expect(await loadCloudLedgerRepairItems(outbox)).toEqual([
      expect.objectContaining({
        id: "change-persisted-unsupported-version",
        reason: "unsupportedCommandVersion",
        actions: ["discard"],
      }),
    ]);
  });

  it("surfaces terminal backend repair outcomes and holds them from automatic retry", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const pendingChanges = [
      {
        changeId: "change-duplicate-change-id",
        code: "duplicate_change_id",
        expectedReason: "duplicateChange",
      },
      {
        changeId: "change-duplicate-transaction-id",
        code: "duplicate_transaction_id",
        expectedReason: "duplicateChange",
      },
      {
        changeId: "change-duplicate-idempotency-key",
        code: "duplicate_idempotency_key",
        expectedReason: "duplicateChange",
      },
      {
        changeId: "change-unauthorized-transaction-id",
        code: "unauthorized_transaction_id",
        expectedReason: "unauthorizedTransaction",
      },
    ] as const;
    await pendingChanges.reduce<Promise<void>>(
      (previous, pending, index) =>
        previous.then(async () => {
          await outbox.enqueue(
            pendingCreateChange({
              changeId: pending.changeId,
              command: largeOfflineCommand(index),
              createdAt: `2026-06-02T10:${String(index + 10).padStart(2, "0")}:00.000Z`,
            })
          );
        }),
      Promise.resolve()
    );
    const failedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [],
        rejectedChangeIds: pendingChanges.map((pending) => pending.changeId),
        changeOutcomes: pendingChanges.map((pending) => ({
          changeId: pending.changeId,
          status: "repair_required",
          code: pending.code,
        })),
        cursor: "ledger:8",
      },
      refreshPayload: emptyRefreshPayload("ledger:8"),
    });
    const acceptedSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: pendingChanges.map((pending) => pending.changeId),
        rejectedChangeIds: [],
        changeOutcomes: pendingChanges.map((pending) => ({
          changeId: pending.changeId,
          status: "accepted",
          code: "accepted",
        })),
        cursor: "ledger:9",
      },
      refreshPayload: emptyRefreshPayload("ledger:9"),
    });

    const repairCache = await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: failedSupabase.client,
    });
    await flushPendingCloudLedgerChanges({
      cache: repairCache,
      outbox,
      supabase: acceptedSupabase.client,
    });

    expect(
      (await loadCloudLedgerRepairItems(outbox)).map((item) => ({
        id: item.id,
        reason: item.reason,
        actions: item.actions,
      }))
    ).toEqual(
      pendingChanges.map((pending) => ({
        id: pending.changeId,
        reason: pending.expectedReason,
        actions: ["discard"],
      }))
    );
    expect(acceptedSupabase.functionsInvoke).not.toHaveBeenCalled();
  });

  it("reuses a durable device id for Pending Change Set flush envelopes", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const firstSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-coffee"],
        cursor: "ledger:8",
      },
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [],
      },
    });
    const secondSupabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-taxi"],
        cursor: "ledger:9",
      },
      refreshPayload: {
        cursor: "ledger:9",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [],
      },
    });

    await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-offline-coffee"),
      command: offlineCoffeeCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:03:00.000Z"),
      outbox,
    });
    await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: firstSupabase.client,
    });
    await createOfflineCloudLedgerTransaction({
      cache: createSeededLedgerCache(),
      changeId: requireLedgerChangeId("change-offline-taxi"),
      command: offlineTaxiCommand(),
      createdAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
      outbox,
    });
    await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: secondSupabase.client,
    });

    expect(secureStore.get("cloud-ledger-device-id")).toBe(CLOUD_LEDGER_DEVICE_ID);
    expect(firstSupabase.functionsInvoke.mock.calls[0]?.[1].body.deviceId).toBe(
      CLOUD_LEDGER_DEVICE_ID
    );
    expect(secondSupabase.functionsInvoke.mock.calls[0]?.[1].body.deviceId).toBe(
      CLOUD_LEDGER_DEVICE_ID
    );
  });

  it("removes accepted pending changes while retaining reported rejected changes", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    await outbox.enqueue(
      pendingCreateChange({
        changeId: "change-offline-coffee",
        command: offlineCoffeeCommand(),
        createdAt: "2026-06-02T10:03:00.000Z",
      })
    );
    await outbox.enqueue(
      pendingCreateChange({
        changeId: "change-offline-taxi",
        command: offlineTaxiCommand(),
        createdAt: "2026-06-02T10:04:00.000Z",
      })
    );
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: ["change-offline-taxi"],
        rejectedChangeIds: ["change-offline-coffee"],
        cursor: "ledger:8",
      },
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [],
      },
    });

    await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: supabase.client,
    });

    expect((await outbox.load()).map((change) => change.id)).toEqual(["change-offline-coffee"]);
  });

  it("retains a duplicate local change id when only one occurrence is accepted", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const duplicateChangeId = "change-duplicate-local";
    await outbox.enqueue(
      pendingCreateChange({
        changeId: duplicateChangeId,
        command: offlineCoffeeCommand(),
        createdAt: "2026-06-02T10:03:00.000Z",
      })
    );
    await outbox.enqueue(
      pendingCreateChange({
        changeId: duplicateChangeId,
        command: offlineTaxiCommand(),
        createdAt: "2026-06-02T10:04:00.000Z",
      })
    );
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: {
        code: "accepted",
        acceptedChangeIds: [duplicateChangeId],
        rejectedChangeIds: [duplicateChangeId],
        changeOutcomes: [
          {
            changeId: duplicateChangeId,
            status: "accepted",
            code: "accepted",
          },
          {
            changeId: duplicateChangeId,
            status: "repair_required",
            code: "duplicate_change_id",
          },
        ],
        cursor: "ledger:8",
      },
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [],
      },
    });

    await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: supabase.client,
    });

    const remaining = await outbox.load();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      id: duplicateChangeId,
      transaction: {
        id: "txn-20260622-taxi",
        description: "Taxi",
      },
    });
    expect(storage.readRaw()).not.toBeNull();
  });

  it("flushes large pending create sets in bounded Remote API batches", async () => {
    const storage = createMemoryOutboxStorage();
    const outbox = createEncryptedCloudLedgerOutbox({
      encryptionKey: OUTBOX_KEY,
      storage: storage.adapter,
    });
    const pendingChanges = createLargePendingChanges();
    await pendingChanges.reduce<Promise<void>>(
      (previous, pending) =>
        previous.then(async () => {
          await createOfflineCloudLedgerTransaction({
            cache: createSeededLedgerCache(),
            changeId: pending.changeId,
            command: pending.command,
            createdAt: pending.createdAt,
            outbox,
          });
        }),
      Promise.resolve()
    );
    const supabase = createCloudLedgerSupabase({
      createTransactionPayload: (changes: readonly CloudLedgerApplyPendingChangeRequest[]) => ({
        code: "accepted",
        acceptedChangeIds: changes.map((change) => change.id),
        cursor: "ledger:8",
      }),
      refreshPayload: {
        cursor: "ledger:8",
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [],
      },
    });

    await flushPendingCloudLedgerChanges({
      cache: createSeededLedgerCache(),
      outbox,
      supabase: supabase.client,
    });

    const applyPendingCalls = supabase.functionsInvoke.mock.calls.filter(
      ([, options]) => options.body.action === "applyPendingChanges"
    );
    const applyPendingBatches = applyPendingCalls.map(
      ([, options]) => (options as CloudLedgerInvokeOptions).body.changes ?? []
    );
    expect(applyPendingBatches.map((changes) => changes.length)).toEqual([10, 2]);
    expect(applyPendingBatches.flatMap((changes) => changes.map((change) => change.id))).toEqual(
      pendingChanges.map((change) => change.changeId)
    );
    expect((await outbox.load()).map((change) => change.id)).toEqual([]);
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

  it("passes abort signals to the Remote API Boundary so logout discard can cancel in-flight flushes", async () => {
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
    const abortController = new AbortController();
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

    await flushPendingCloudLedgerChanges({
      abortSignal: abortController.signal,
      cache,
      outbox,
      supabase: supabase.client,
    });

    expect(supabase.functionsInvoke).toHaveBeenNthCalledWith(
      1,
      "cloud-ledger-api",
      expect.objectContaining({
        signal: abortController.signal,
      })
    );
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
  let writeFailure: { readonly message: string; readonly writeNumber: number } | null = null;
  const adapter: EncryptedCloudLedgerOutboxStorage = {
    clear: async () => {
      stored = null;
    },
    read: async () => stored,
    write: async (snapshot) => {
      if (writeFailure !== null) {
        if (writeFailure.writeNumber === 1) {
          const { message } = writeFailure;
          writeFailure = null;
          throw new Error(message);
        }
        writeFailure = {
          ...writeFailure,
          writeNumber: writeFailure.writeNumber - 1,
        };
      }
      stored = snapshot;
    },
  };

  return {
    adapter,
    failNthWrite: (writeNumber: number, message: string) => {
      writeFailure = { message, writeNumber };
    },
    readRaw: () => stored,
    replaceRaw: (snapshot: EncryptedCloudLedgerOutboxSnapshot | null) => {
      stored = snapshot;
    },
  };
}

async function writePlainOutboxSnapshot(
  storage: ReturnType<typeof createMemoryOutboxStorage>,
  snapshot: unknown
): Promise<void> {
  const nonce = Crypto.getRandomBytes(12);
  const sealedData = await Crypto.aesEncryptAsync(
    new TextEncoder().encode(JSON.stringify(snapshot)),
    await Crypto.AESEncryptionKey.import(OUTBOX_KEY),
    {
      nonce: { bytes: nonce },
      tagLength: 16,
    }
  );
  await storage.adapter.write({
    version: 1,
    algorithm: "AES-GCM",
    nonce: await sealedData.iv("base64"),
    ciphertext: await sealedData.ciphertext({ includeTag: true, encoding: "base64" }),
  });
}

async function withTemporaryGlobalCrypto<Result>(
  cryptoValue: unknown,
  run: () => Promise<Result>
): Promise<Result> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: cryptoValue,
  });
  try {
    return await run();
  } finally {
    if (originalDescriptor === undefined) {
      Reflect.deleteProperty(globalThis, "crypto");
    } else {
      Object.defineProperty(globalThis, "crypto", originalDescriptor);
    }
  }
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

function createAcceptedCoffeeLedgerCache() {
  return applyCloudLedgerBootstrap(createSeededLedgerCache(), {
    cursor: requireLedgerCursor("ledger:8"),
    categories: [],
    financialAccounts: [],
    transactions: [acceptedCoffeeLedgerTransaction()],
    tombstones: [],
  });
}

function createAcceptedCoffeeAndTaxiLedgerCache() {
  return applyCloudLedgerBootstrap(createSeededLedgerCache(), {
    cursor: requireLedgerCursor("ledger:8"),
    categories: [],
    financialAccounts: [],
    transactions: [acceptedCoffeeLedgerTransaction(), acceptedTaxiLedgerTransaction()],
    tombstones: [],
  });
}

function emptyRefreshPayload(cursor: string) {
  return {
    cursor,
    categories: [],
    financialAccounts: [],
    transactions: [],
    tombstones: [],
  };
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

function hugeOfflineCommand() {
  return {
    commandVersion: 1,
    transaction: {
      id: requireTransactionId("txn-huge-offline-generation-one"),
      type: "expense",
      amount: requireCopAmount(21_000),
      currency: "COP",
      categoryId: requireCategoryId("cat-groceries"),
      accountId: requireFinancialAccountId("acct-cash"),
      description: `Huge offline purchase ${"x".repeat(4_000)}`,
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

function acceptedCoffeeLedgerTransaction(
  overrides: Partial<{
    readonly amount: number;
    readonly description: string;
    readonly version: number;
    readonly updatedAt: string;
  }> = {}
) {
  return {
    id: requireTransactionId("txn-20260622-client"),
    type: "expense" as const,
    amount: requireCopAmount(overrides.amount ?? 18_000),
    currency: "COP" as const,
    categoryId: requireCategoryId("cat-groceries"),
    accountId: requireFinancialAccountId("acct-cash"),
    description: overrides.description ?? "Coffee accepted",
    date: requireIsoDate("2026-06-02"),
    version: overrides.version ?? 1,
    updatedAt: requireIsoDateTime(overrides.updatedAt ?? "2026-06-02T10:04:00.000Z"),
  };
}

function acceptedCoffeeTransaction(
  overrides: Partial<{
    readonly description: string;
    readonly version: number;
  }> = {}
) {
  return {
    id: "txn-20260622-client",
    type: "expense",
    amount: 18_000,
    currency: "COP",
    categoryId: "cat-groceries",
    accountId: "acct-cash",
    description: overrides.description ?? "Coffee accepted",
    date: "2026-06-02",
    version: overrides.version ?? 1,
    updatedAt: "2026-06-02T10:04:00.000Z",
  };
}

function acceptedTaxiLedgerTransaction() {
  return {
    id: requireTransactionId("txn-20260622-taxi"),
    type: "expense" as const,
    amount: requireCopAmount(12_000),
    currency: "COP" as const,
    categoryId: requireCategoryId("cat-groceries"),
    accountId: requireFinancialAccountId("acct-cash"),
    description: "Taxi accepted",
    date: requireIsoDate("2026-06-02"),
    version: 1,
    updatedAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
  };
}

function acceptedTaxiTransaction() {
  return {
    id: "txn-20260622-taxi",
    type: "expense",
    amount: 12_000,
    currency: "COP",
    categoryId: "cat-groceries",
    accountId: "acct-cash",
    description: "Taxi accepted",
    date: "2026-06-02",
    version: 1,
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
      deviceId: CLOUD_LEDGER_DEVICE_ID,
      batchId: "batch-change-offline-coffee",
      changes: [
        {
          id: "change-offline-coffee",
          kind: "createTransaction",
          commandVersion: 1,
          idempotencyKey: "change-offline-coffee",
          dependencies: [],
          expectedVersions: [],
          clientTimestamp: "2026-06-02T10:03:00.000Z",
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
type CloudLedgerApplyPendingChangeRequest = { readonly id: string };
type CloudLedgerInvokeOptions = {
  readonly body: {
    readonly action: string;
    readonly changes?: readonly CloudLedgerApplyPendingChangeRequest[];
  };
};
type CloudLedgerSupabaseOptions = {
  readonly createTransactionPayload:
    | unknown
    | ((changes: readonly CloudLedgerApplyPendingChangeRequest[]) => unknown);
  readonly refreshFailure?: boolean;
  readonly refreshPayload: WirePayload;
};

function createCloudLedgerSupabase(options: CloudLedgerSupabaseOptions) {
  const functionsInvoke = vi.fn<(...args: any[]) => any>(
    (_functionName: string, invokeOptions: CloudLedgerInvokeOptions) =>
      Promise.resolve(resolveCloudLedgerInvokeResult(options, invokeOptions))
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

function resolveCloudLedgerInvokeResult(
  options: CloudLedgerSupabaseOptions,
  invokeOptions: CloudLedgerInvokeOptions
) {
  if (options.refreshFailure === true && invokeOptions.body.action === "refresh") {
    return { data: null, error: { message: "network unavailable" } };
  }
  return {
    data: {
      success: true,
      data: resolveCloudLedgerInvokePayload(options, invokeOptions),
    },
    error: null,
  };
}

function resolveCloudLedgerInvokePayload(
  options: CloudLedgerSupabaseOptions,
  invokeOptions: CloudLedgerInvokeOptions
) {
  if (invokeOptions.body.action === "refresh") {
    return options.refreshPayload;
  }
  if (
    typeof options.createTransactionPayload === "function" &&
    invokeOptions.body.action === "applyPendingChanges"
  ) {
    return options.createTransactionPayload(invokeOptions.body.changes ?? []);
  }
  return options.createTransactionPayload;
}

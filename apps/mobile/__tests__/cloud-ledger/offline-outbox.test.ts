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
  CloudLedgerOutboxFailure,
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

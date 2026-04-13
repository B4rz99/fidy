// biome-ignore-all lint/suspicious/noExplicitAny: focused store test uses lightweight mocks
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/shared/types/branded";

const mockGetItemAsync = vi.fn();
const mockSetItemAsync = vi.fn();
const mockCountNotificationsSince = vi.fn();
const mockGetNotifications = vi.fn(() => []);
const mockCommit = vi.fn();

vi.mock("expo-secure-store", () => ({
  getItemAsync: mockGetItemAsync,
  setItemAsync: mockSetItemAsync,
}));

vi.mock("@/features/notifications/repository", () => ({
  countNotificationsSince: mockCountNotificationsSince,
  getNotifications: mockGetNotifications,
}));

vi.mock("@/shared/lib", () => ({
  generateNotificationId: vi.fn(() => "notif-generated"),
  toIsoDateTime: vi.fn(() => "2026-04-12T10:00:00.000Z"),
}));

vi.mock("@/shared/mutations", () => ({
  createWriteThroughMutationModule: vi.fn(() => ({
    commit: mockCommit,
  })),
}));

const USER_1 = "user-1" as UserId;
const USER_2 = "user-2" as UserId;
const mockDb = {} as any;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function getStore() {
  const { useNotificationStore } = await import("@/features/notifications/store");
  return useNotificationStore;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useNotificationStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItemAsync.mockResolvedValue(null);
    mockCountNotificationsSince.mockReturnValue(0);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("ignores stale async initStore completion after the active user changes", async () => {
    const deferredVisited = createDeferred<string | null>();
    mockGetItemAsync.mockReturnValueOnce(deferredVisited.promise);
    mockCountNotificationsSince.mockImplementation((_db, userId: UserId) =>
      userId === USER_2 ? 2 : 7
    );

    const store = await getStore();
    const firstInit = store.getState().initStore(mockDb, USER_1);
    const secondInit = store.getState().initStore(mockDb, USER_2);

    deferredVisited.resolve(null);
    await firstInit;
    await secondInit;

    expect(store.getState().newCount).toBe(2);
    expect(mockCountNotificationsSince).toHaveBeenLastCalledWith(mockDb, USER_2, null);
    expect(mockCountNotificationsSince).not.toHaveBeenCalledWith(mockDb, USER_1, null);
  });

  it("does not increment newCount when an older user's insert completes later", async () => {
    const deferredCommit = createDeferred<{ success: true; didMutate: true }>();
    mockCommit.mockReturnValueOnce(deferredCommit.promise);

    const store = await getStore();
    await store.getState().initStore(mockDb, USER_1);
    store.getState().insertNotification({
      type: "budget_alert",
      dedupKey: "budget:1",
      categoryId: null,
      goalId: null,
      titleKey: "title",
      messageKey: "message",
      params: null,
    });

    await store.getState().initStore(mockDb, USER_2);
    deferredCommit.resolve({ success: true, didMutate: true });
    await flushMicrotasks();

    expect(store.getState().newCount).toBe(0);
    expect(mockCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "notification.insert",
        row: expect.objectContaining({ userId: USER_1 }),
      })
    );
  });

  it("does not clear another user's state when an older clearAll completes later", async () => {
    const deferredCommit = createDeferred<{ success: true; didMutate: true }>();
    mockCommit.mockReturnValueOnce(deferredCommit.promise);

    const store = await getStore();
    await store.getState().initStore(mockDb, USER_1);
    store.setState({
      notifications: [{ id: "old-user-notif" }] as any[],
      newCount: 4,
    });

    store.getState().clearAll();

    await store.getState().initStore(mockDb, USER_2);
    store.setState({
      notifications: [{ id: "new-user-notif" }] as any[],
      newCount: 2,
    });

    deferredCommit.resolve({ success: true, didMutate: true });
    await flushMicrotasks();

    expect(store.getState().notifications).toEqual([{ id: "new-user-notif" }]);
    expect(store.getState().newCount).toBe(2);
    expect(mockCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "notification.clearAll",
        userId: USER_1,
      })
    );
  });
});

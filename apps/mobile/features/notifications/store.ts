import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createWriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import { generateNotificationId, toIsoDateTime } from "@/shared/lib";
import type { CategoryId, IsoDateTime, UserId } from "@/shared/types/branded";
import type { NotificationType, StoredNotification } from "./lib/types";
import { countNotificationsSince, getNotifications } from "./repository";

const lastVisitedKey = (userId: UserId) => `notification_last_visited_${userId}`;

type InsertNotificationInput = {
  readonly type: NotificationType;
  readonly dedupKey: string;
  readonly categoryId: CategoryId | null;
  readonly goalId: string | null;
  readonly titleKey: string;
  readonly messageKey: string;
  readonly params: string | null;
};

type NotificationState = {
  notifications: readonly StoredNotification[];
  newCount: number;
  isLoading: boolean;
  activeUserId: UserId | null;
};

type NotificationActions = {
  beginSession: (userId: UserId) => void;
  setNewCount: (newCount: number) => void;
  setNotifications: (notifications: readonly StoredNotification[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  incrementNewCount: () => void;
  clearState: () => void;
};

export const useNotificationStore = create<NotificationState & NotificationActions>((set) => ({
  notifications: [],
  newCount: 0,
  isLoading: false,
  activeUserId: null,

  beginSession: (userId) =>
    set({
      activeUserId: userId,
      notifications: [],
      newCount: 0,
      isLoading: false,
    }),

  setNewCount: (newCount) => set({ newCount }),

  setNotifications: (notifications) => set({ notifications: [...notifications], isLoading: false }),

  setIsLoading: (isLoading) => set({ isLoading }),

  incrementNewCount: () => set((state) => ({ newCount: state.newCount + 1 })),

  clearState: () => set({ notifications: [], newCount: 0 }),
}));

function isActiveNotificationUser(userId: UserId): boolean {
  return useNotificationStore.getState().activeUserId === userId;
}

export async function initializeNotificationStore(db: AnyDb, userId: UserId): Promise<void> {
  useNotificationStore.getState().beginSession(userId);

  let lastVisitedAt: IsoDateTime | null = null;
  try {
    const stored = await SecureStore.getItemAsync(lastVisitedKey(userId));
    lastVisitedAt = stored ? (stored as IsoDateTime) : null;
  } catch {
    // SecureStore may fail in tests — default to null
  }

  if (!isActiveNotificationUser(userId)) return;
  const newCount = countNotificationsSince(db, userId, lastVisitedAt);
  useNotificationStore.getState().setNewCount(newCount);
}

export function loadNotificationsForUser(db: AnyDb, userId: UserId): void {
  useNotificationStore.getState().setIsLoading(true);

  try {
    const rows = getNotifications(db, userId);
    if (!isActiveNotificationUser(userId)) {
      useNotificationStore.getState().setIsLoading(false);
      return;
    }
    useNotificationStore.getState().setNotifications(rows as readonly StoredNotification[]);
  } catch {
    useNotificationStore.getState().setIsLoading(false);
  }
}

export async function insertNotificationRecord(
  db: AnyDb,
  userId: UserId,
  input: InsertNotificationInput
): Promise<void> {
  const now = toIsoDateTime(new Date());
  const id = generateNotificationId();
  const mutations = createWriteThroughMutationModule(db);

  const result = await mutations.commit({
    kind: "notification.insert",
    row: {
      id,
      userId,
      type: input.type,
      dedupKey: input.dedupKey,
      categoryId: input.categoryId,
      goalId: input.goalId,
      titleKey: input.titleKey,
      messageKey: input.messageKey,
      params: input.params,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  });

  if (result.success && result.didMutate && isActiveNotificationUser(userId)) {
    useNotificationStore.getState().incrementNewCount();
  }
}

export function markNotificationsVisited(userId: UserId): void {
  const now = toIsoDateTime(new Date());
  void SecureStore.setItemAsync(lastVisitedKey(userId), now).catch(() => undefined);

  if (isActiveNotificationUser(userId)) {
    useNotificationStore.getState().setNewCount(0);
  }
}

export async function clearAllNotifications(db: AnyDb, userId: UserId): Promise<void> {
  const mutations = createWriteThroughMutationModule(db);
  const now = toIsoDateTime(new Date());
  const result = await mutations.commit({
    kind: "notification.clearAll",
    userId,
    now,
  });

  if (result.success && isActiveNotificationUser(userId)) {
    useNotificationStore.getState().clearState();
  }
}

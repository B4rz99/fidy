import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { generateNotificationId, toIsoDateTime } from "@/shared/lib";
import {
  createWriteThroughMutationModule,
  type WriteThroughMutationModule,
} from "@/shared/mutations";
import type { CategoryId, IsoDateTime, UserId } from "@/shared/types/branded";
import type { NotificationType, StoredNotification } from "./lib/types";
import { countNotificationsSince, getNotifications } from "./repository";

const lastVisitedKey = (userId: UserId) => `notification_last_visited_${userId}`;

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;
let mutations: WriteThroughMutationModule | null = null;

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
};

type NotificationActions = {
  initStore: (db: AnyDb, userId: UserId) => Promise<void>;
  loadNotifications: () => void;
  insertNotification: (input: InsertNotificationInput) => void;
  markVisited: () => void;
  clearAll: () => void;
};

export const useNotificationStore = create<NotificationState & NotificationActions>(
  (set, _get) => ({
    notifications: [],
    newCount: 0,
    isLoading: false,

    initStore: async (db, userId) => {
      dbRef = db;
      userIdRef = userId;
      mutations = createWriteThroughMutationModule(db);
      const requestedUserId = userId;

      let lastVisitedAt: IsoDateTime | null = null;
      try {
        const stored = await SecureStore.getItemAsync(lastVisitedKey(userId));
        lastVisitedAt = stored ? (stored as IsoDateTime) : null;
      } catch {
        // SecureStore may fail in tests — default to null
      }

      if (userIdRef !== requestedUserId) return;
      const newCount = countNotificationsSince(db, userId, lastVisitedAt);
      set({ newCount });
    },

    loadNotifications: () => {
      if (!dbRef || !userIdRef) return;
      set({ isLoading: true });
      try {
        const rows = getNotifications(dbRef, userIdRef);
        set({ notifications: rows as readonly StoredNotification[], isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    insertNotification: (input) => {
      if (!dbRef || !userIdRef) return;
      const mutationModule = mutations;
      if (!mutationModule) return;
      const requestedUserId = userIdRef;
      const now = toIsoDateTime(new Date());
      const id = generateNotificationId();
      void mutationModule
        .commit({
          kind: "notification.insert",
          row: {
            id,
            userId: requestedUserId,
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
        })
        .then((result) => {
          if (result.success && result.didMutate && userIdRef === requestedUserId) {
            set((state) => ({ newCount: state.newCount + 1 }));
          }
        });
    },

    markVisited: () => {
      const now = toIsoDateTime(new Date());
      if (!userIdRef) return;
      void SecureStore.setItemAsync(lastVisitedKey(userIdRef), now).catch(() => undefined);
      set({ newCount: 0 });
    },

    clearAll: () => {
      if (!dbRef || !userIdRef) return;
      const mutationModule = mutations;
      if (!mutationModule) return;
      const requestedUserId = userIdRef;
      const now = toIsoDateTime(new Date());
      void mutationModule
        .commit({
          kind: "notification.clearAll",
          userId: requestedUserId,
          now,
        })
        .then((result) => {
          if (result.success && userIdRef === requestedUserId) {
            set({ notifications: [], newCount: 0 });
          }
        });
    },
  })
);

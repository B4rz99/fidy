/* eslint-disable no-restricted-imports */

import {
  getAllNotificationIds,
  insertNotification,
  softDeleteAllNotifications,
} from "@/features/notifications/repository";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand } from "./common";

type NotificationInsertCommand = MutationCommandByKind<"notification.insert">;
type NotificationClearAllCommand = MutationCommandByKind<"notification.clearAll">;

const applyNotificationInsert = (
  db: Parameters<MutationHandlerSubset<"notification.insert">["notification.insert"]>[0],
  command: NotificationInsertCommand
) => {
  const result = insertNotification(db, command.row);
  if (result.changes === 0) {
    return completeCommand(command.afterCommit, false);
  }
  return completeCommand(command.afterCommit);
};

const applyNotificationClearAll = (
  db: Parameters<MutationHandlerSubset<"notification.clearAll">["notification.clearAll"]>[0],
  command: NotificationClearAllCommand
) => {
  const allIds = getAllNotificationIds(db, command.userId);
  softDeleteAllNotifications(db, command.userId, command.now);
  return completeCommand(command.afterCommit, allIds.length > 0);
};

export const notificationHandlers: MutationHandlerSubset<
  "notification.insert" | "notification.clearAll"
> = {
  "notification.insert": applyNotificationInsert,
  "notification.clearAll": applyNotificationClearAll,
};

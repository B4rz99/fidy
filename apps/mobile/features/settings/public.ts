import type { NotificationPreferences } from "./store";
import { useSettingsStore } from "./store";

export type NotificationPreferenceKey = keyof NotificationPreferences;

export const isNotificationPreferenceEnabled = (key: NotificationPreferenceKey) =>
  useSettingsStore.getState().notificationPreferences[key];

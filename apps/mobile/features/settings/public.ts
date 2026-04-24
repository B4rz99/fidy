import type { NotificationPreferences } from "./store";
import { useSettingsStore } from "./store";

export { getUnsyncedCount } from "./lib/check-unsynced";
export {
  buildPrivacyUrl,
  buildTermsUrl,
  buildWhatsAppUrl,
  getUserInitials,
} from "./lib/settings-links";
export type { NotificationPreferences, ThemePreference } from "./store";
export { useSettingsStore };

export type NotificationPreferenceKey = keyof NotificationPreferences;

export const isNotificationPreferenceEnabled = (key: NotificationPreferenceKey) =>
  useSettingsStore.getState().notificationPreferences[key];

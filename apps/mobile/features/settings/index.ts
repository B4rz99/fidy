export { NotificationPreferencesScreen } from "./components/NotificationPreferencesScreen";
export { ProfileScreen } from "./components/ProfileScreen";
export { SettingsScreen } from "./components/SettingsScreen";
export { getUnsyncedCount } from "./lib/check-unsynced";
export {
  buildPrivacyUrl,
  buildTermsUrl,
  buildWhatsAppUrl,
  getUserInitials,
} from "./lib/settings-links";
export {
  type NotificationPreferences,
  type ThemePreference,
  useSettingsStore,
} from "./store";

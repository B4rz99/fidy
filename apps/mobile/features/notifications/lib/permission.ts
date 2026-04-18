import type { PermissionStatus } from "expo-notifications";

/** SecureStore key tracking whether the user has seen the pre-permission screen. */
export const PRE_PERMISSION_KEY = "has_seen_pre_permission";

/** Possible actions when a fresh budget/goal alert fires. */
export type AlertAction =
  | { readonly type: "send" }
  | { readonly type: "pre_permission" }
  | { readonly type: "skip" };

/**
 * Determine what to do when a fresh alert fires.
 *
 * Rules (evaluated in order):
 * 1. notificationsEnabled is false           -> skip (user disabled in app settings)
 * 2. osPermissionStatus is "granted"         -> send
 * 3. osPermissionStatus is "undetermined"
 *    AND hasSeenPrePermission is false        -> pre_permission (show explanatory screen)
 * 4. osPermissionStatus is "undetermined"
 *    AND hasSeenPrePermission is true         -> skip (already declined once)
 * 5. osPermissionStatus is "denied"          -> skip
 */
export function determineAlertAction(
  osPermissionStatus: PermissionStatus,
  hasSeenPrePermission: boolean,
  notificationsEnabled: boolean
): AlertAction {
  if (!notificationsEnabled) return { type: "skip" };
  if (osPermissionStatus === "granted") return { type: "send" };
  if (osPermissionStatus === "undetermined" && !hasSeenPrePermission) {
    return { type: "pre_permission" };
  }
  return { type: "skip" };
}

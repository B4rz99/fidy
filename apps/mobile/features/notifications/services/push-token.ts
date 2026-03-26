import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSupabase } from "@/shared/db/supabase";
import { captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";

export const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string;

/**
 * Register the device's push token with Supabase.
 * Called after permission grant and on app launch (idempotent upsert).
 */
export async function registerPushToken(userId: UserId): Promise<string | null> {
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });

    const supabase = getSupabase();
    const { error } = await supabase.from("push_devices").upsert(
      {
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        user_id: userId,
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        expo_push_token: token,
        platform: Platform.OS,
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        app_version: Constants.expoConfig?.version ?? null,
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,expo_push_token" }
    );

    if (error) {
      captureWarning("push_token_upsert_failed", { errorMessage: error.message });
      return null;
    }

    return token;
  } catch (err) {
    captureWarning("push_token_register_failed", {
      errorType: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

/**
 * Delete the current device's push token from Supabase.
 * Called on signOut. Best-effort — does not throw.
 */
export async function deletePushToken(token: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("push_devices").delete().eq("expo_push_token", token);
    if (error) {
      captureWarning("push_token_delete_failed", { errorMessage: error.message });
    }
  } catch {
    // Best-effort: don't block signout on failure
  }
}

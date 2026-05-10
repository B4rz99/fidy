import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "@/shared/components/rn";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";

const easConfig = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
export const PROJECT_ID = easConfig?.projectId ?? "";
const TRANSIENT_PUSH_TOKEN_COOLDOWN_MS = 60_000;

const pushTokenRegistrations = new Map<UserId, Promise<string | null>>();
const transientPushTokenFailureUntilByUserId = new Map<UserId, number>();

const isTransientPushTokenFetchError = (error: unknown): boolean =>
  error instanceof Error &&
  /fetch failed: (Fetch request has been canceled|The operation was aborted)/i.test(error.message);

async function upsertPushToken(userId: UserId, token: string): Promise<string | null> {
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
}

/**
 * Register the device's push token with Supabase.
 * Called after permission grant and on app launch (idempotent upsert).
 */
export async function registerPushToken(userId: UserId): Promise<string | null> {
  if (Date.now() < (transientPushTokenFailureUntilByUserId.get(userId) ?? 0)) return null;

  const existingRegistration = pushTokenRegistrations.get(userId);
  if (existingRegistration !== undefined) return existingRegistration;

  const registration = registerPushTokenOnce(userId).finally(() => {
    pushTokenRegistrations.delete(userId);
  });
  pushTokenRegistrations.set(userId, registration);

  return registration;
}

async function registerPushTokenOnce(userId: UserId): Promise<string | null> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });

    return await upsertPushToken(userId, token);
  } catch (err) {
    if (isTransientPushTokenFetchError(err)) {
      transientPushTokenFailureUntilByUserId.set(
        userId,
        Date.now() + TRANSIENT_PUSH_TOKEN_COOLDOWN_MS
      );
    }
    captureWarning("push_token_register_failed", {
      errorType: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function registerKnownPushToken(
  userId: UserId,
  token: string
): Promise<string | null> {
  try {
    return await upsertPushToken(userId, token);
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

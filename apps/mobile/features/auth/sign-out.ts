import { cleanupCurrentPushToken } from "@/features/notifications/public";
import { getSupabase } from "@/shared/db/supabase";
import { captureWarning } from "@/shared/lib";

const captureAuthFailure = (event: string, err: unknown) => {
  captureWarning(event, {
    errorType: err instanceof Error ? err.message : "unknown",
  });
};

export async function cleanupPushTokenBeforeSignOut() {
  await Promise.race([
    cleanupCurrentPushToken().catch((error) => {
      captureAuthFailure("auth_signout_push_token_cleanup_failed", error);
    }),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}

export async function signOutRemoteSession() {
  try {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  } catch {
    // Clear local state regardless.
  }
}

// biome-ignore-all lint/style/useNamingConvention: Supabase user_metadata uses snake_case keys
import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { getSupabase } from "@/shared/db/supabase";

const SECURE_STORE_KEY = "onboarding_completed";

/** Pure check — no side effects */
export const isOnboardingComplete = (session: Session | null): boolean =>
  session?.user?.user_metadata?.onboarding_completed === true;

/** Reads SecureStore synchronously (returns cached value) */
export const getOnboardingCompleteFromStore = (): boolean => {
  try {
    return SecureStore.getItem(SECURE_STORE_KEY) === "true";
  } catch {
    return false;
  }
};

/** Marks onboarding as complete in both SecureStore and Supabase user_metadata.
 *  SecureStore is the critical path; Supabase update is best-effort for cross-device sync. */
export const markOnboardingComplete = async (): Promise<void> => {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, "true");
  // Best-effort: persist to Supabase for cross-device, but don't block on failure
  getSupabase()
    .auth.updateUser({ data: { onboarding_completed: true } })
    .catch(() => {});
};

/** Clears the onboarding flag from SecureStore and Supabase (e.g., on sign-out or dev reset). */
export const clearOnboardingFromStore = (): void => {
  SecureStore.deleteItemAsync(SECURE_STORE_KEY).catch(() => {});
  getSupabase()
    .auth.updateUser({ data: { onboarding_completed: null } })
    .catch(() => {});
};

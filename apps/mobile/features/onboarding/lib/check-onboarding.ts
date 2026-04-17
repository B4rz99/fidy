// biome-ignore-all lint/style/useNamingConvention: Supabase user_metadata uses snake_case keys
import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { getSupabase } from "@/shared/db";

const SECURE_STORE_KEY = "onboarding_completed";

/** Pure check — no side effects */
export const isOnboardingComplete = (session: Session | null): boolean =>
  session?.user.user_metadata.onboarding_completed === true;

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
  void getSupabase()
    .auth.updateUser({ data: { onboarding_completed: true } })
    .catch(() => undefined);
};

/** Clears the local onboarding flag from SecureStore only (used on sign-out). */
export const clearOnboardingFromStore = (): void => {
  void SecureStore.deleteItemAsync(SECURE_STORE_KEY).catch(() => undefined);
};

/** Clears onboarding from both SecureStore and Supabase metadata (dev reset only). */
export const resetOnboarding = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
  await getSupabase()
    .auth.updateUser({ data: { onboarding_completed: null } })
    .catch(() => undefined);
};

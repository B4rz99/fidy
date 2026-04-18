import { getSupabase } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { NotificationPreferences } from "../store";

type NotificationPreferencesRow = {
  // biome-ignore lint/style/useNamingConvention: Supabase row shape
  readonly budget_alerts: boolean | null;
  // biome-ignore lint/style/useNamingConvention: Supabase row shape
  readonly goal_milestones: boolean | null;
  // biome-ignore lint/style/useNamingConvention: Supabase row shape
  readonly spending_anomalies: boolean | null;
  // biome-ignore lint/style/useNamingConvention: Supabase row shape
  readonly weekly_digest: boolean | null;
};

export const notificationPreferencesQueryKey = (userId: UserId) =>
  ["settings", "notification-preferences", userId] as const;

export function toNotificationPreferences(
  row: NotificationPreferencesRow
): NotificationPreferences {
  return {
    budgetAlerts: row.budget_alerts ?? true,
    goalMilestones: row.goal_milestones ?? true,
    spendingAnomalies: row.spending_anomalies ?? true,
    weeklyDigest: row.weekly_digest ?? true,
  };
}

export async function fetchNotificationPreferencesRemote(
  userId: UserId
): Promise<NotificationPreferences | null> {
  const { data, error } = await getSupabase()
    .from("notification_preferences")
    .select("budget_alerts, goal_milestones, spending_anomalies, weekly_digest")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data == null ? null : toNotificationPreferences(data as NotificationPreferencesRow);
}

export async function saveNotificationPreferencesRemote(
  userId: UserId,
  prefs: NotificationPreferences
): Promise<void> {
  const { error } = await getSupabase().from("notification_preferences").upsert(
    {
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      user_id: userId,
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      budget_alerts: prefs.budgetAlerts,
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      goal_milestones: prefs.goalMilestones,
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      spending_anomalies: prefs.spendingAnomalies,
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      weekly_digest: prefs.weeklyDigest,
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

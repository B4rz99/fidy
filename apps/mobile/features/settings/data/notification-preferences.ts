import { getSupabase } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { NotificationPreferences } from "../store";

export async function saveNotificationPreferences(
  userId: UserId,
  preferences: NotificationPreferences
): Promise<void> {
  const { error } = await getSupabase().from("notification_preferences").upsert(
    {
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      user_id: userId,
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      budget_alerts: preferences.budgetAlerts,
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      goal_milestones: preferences.goalMilestones,
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      spending_anomalies: preferences.spendingAnomalies,
    },
    { onConflict: "user_id" }
  );

  if (error != null) {
    throw new Error(error.message);
  }
}

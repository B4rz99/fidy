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

export async function deleteAccountRequest(supabaseUrl: string, token: string): Promise<void> {
  const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      // biome-ignore lint/style/useNamingConvention: HTTP header
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "delete_failed");
  }
}

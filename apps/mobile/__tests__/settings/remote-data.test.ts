import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  fetchNotificationPreferencesRemote,
  saveNotificationPreferencesRemote,
  toNotificationPreferences,
} from "@/features/settings/data/notification-preferences";
import { getSupabase } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

vi.mock("@/shared/db", () => ({
  getSupabase: vi.fn(),
}));

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const userId = "user-1" as UserId;

function makeNotificationPreferencesRow(
  overrides: {
    budgetAlerts?: boolean | null;
    goalMilestones?: boolean | null;
    spendingAnomalies?: boolean | null;
    weeklyDigest?: boolean | null;
  } = {}
) {
  return {
    // biome-ignore lint/style/useNamingConvention: Supabase row shape
    budget_alerts: overrides.budgetAlerts ?? false,
    // biome-ignore lint/style/useNamingConvention: Supabase row shape
    goal_milestones: overrides.goalMilestones ?? true,
    // biome-ignore lint/style/useNamingConvention: Supabase row shape
    spending_anomalies: overrides.spendingAnomalies ?? false,
    // biome-ignore lint/style/useNamingConvention: Supabase row shape
    weekly_digest: overrides.weeklyDigest ?? true,
  };
}

beforeEach(() => {
  mockMaybeSingle.mockReset();
  mockEq.mockReset().mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReset().mockReturnValue({ eq: mockEq });
  mockUpsert.mockReset();
  vi.mocked(getSupabase).mockReturnValue({
    from: vi.fn(() => ({ select: mockSelect, upsert: mockUpsert })),
  } as never);
});

describe("notification preferences remote data", () => {
  test("maps remote row to NotificationPreferences", () => {
    expect(toNotificationPreferences(makeNotificationPreferencesRow())).toEqual({
      budgetAlerts: false,
      goalMilestones: true,
      spendingAnomalies: false,
      weeklyDigest: true,
    });
  });

  test("fetchNotificationPreferencesRemote returns null when no row exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchNotificationPreferencesRemote(userId)).resolves.toBeNull();
  });

  test("fetchNotificationPreferencesRemote returns mapped prefs", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: makeNotificationPreferencesRow(),
      error: null,
    });

    await expect(fetchNotificationPreferencesRemote(userId)).resolves.toEqual({
      budgetAlerts: false,
      goalMilestones: true,
      spendingAnomalies: false,
      weeklyDigest: true,
    });
  });

  test("saveNotificationPreferencesRemote writes Supabase row", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await saveNotificationPreferencesRemote(userId, {
      budgetAlerts: false,
      goalMilestones: true,
      spendingAnomalies: false,
      weeklyDigest: true,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        user_id: userId,
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        budget_alerts: false,
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        goal_milestones: true,
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        spending_anomalies: false,
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        weekly_digest: true,
      },
      { onConflict: "user_id" }
    );
  });
});

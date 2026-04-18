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
    expect(
      toNotificationPreferences({
        budget_alerts: false,
        goal_milestones: true,
        spending_anomalies: false,
        weekly_digest: true,
      })
    ).toEqual({
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
      data: {
        budget_alerts: false,
        goal_milestones: true,
        spending_anomalies: false,
        weekly_digest: true,
      },
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
        user_id: userId,
        budget_alerts: false,
        goal_milestones: true,
        spending_anomalies: false,
        weekly_digest: true,
      },
      { onConflict: "user_id" }
    );
  });
});

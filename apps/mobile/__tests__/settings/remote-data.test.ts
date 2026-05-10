// biome-ignore-all lint/style/useNamingConvention: Supabase payload fixtures use snake_case
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  deleteAccountRequest,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  toNotificationPreferences,
} from "@/features/settings/data/notification-preferences";
import { getSupabase } from "@/shared/db";
import en from "@/shared/i18n/locales/en";
import es from "@/shared/i18n/locales/es";
import type { UserId } from "@/shared/types/branded";

vi.mock("@/shared/db", () => ({
  getSupabase: vi.fn<(...args: any[]) => any>(),
}));

const mockSelect = vi.fn<(...args: any[]) => any>();
const mockEq = vi.fn<(...args: any[]) => any>();
const mockMaybeSingle = vi.fn<(...args: any[]) => any>();
const mockUpsert = vi.fn<(...args: any[]) => any>();
const mockFrom = vi.fn<(...args: any[]) => any>((_table: string) => ({
  select: mockSelect.mockReturnValue({
    eq: mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle }),
  }),
  upsert: mockUpsert,
}));

describe("settings remote data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);
  });

  test("maps a remote row to NotificationPreferences", () => {
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

  test("remote fetch returns null when no row exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchNotificationPreferences("user-1" as UserId)).resolves.toBeNull();
  });

  test("remote save upserts the correct Supabase shape", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await saveNotificationPreferences("user-1" as UserId, {
      budgetAlerts: false,
      goalMilestones: true,
      spendingAnomalies: false,
      weeklyDigest: true,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        budget_alerts: false,
        goal_milestones: true,
        spending_anomalies: false,
        weekly_digest: true,
      },
      { onConflict: "user_id" }
    );
  });

  test("delete-account helper throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<(...args: any[]) => any>().mockResolvedValue({
        ok: false,
        json: vi.fn<(...args: any[]) => any>().mockResolvedValue({ error: "delete_failed" }),
      })
    );

    await expect(deleteAccountRequest("https://example.supabase.co", "token")).rejects.toThrow(
      "delete_failed"
    );
  });
});

describe("settings remote callers", () => {
  test("notification preferences screen uses the mutation hook instead of store-owned remote effects", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/settings/components/NotificationPreferencesScreen.tsx"),
      "utf-8"
    );

    expect(source).toContain("useNotificationPreferencesMutation");
    expect(source).not.toContain("persistPreferences");
  });

  test("delete-account sheet uses the delete mutation hook instead of the settings store action", () => {
    const source = readFileSync(resolve(__dirname, "../../app/delete-account.tsx"), "utf-8");

    expect(source).toContain("useDeleteAccountMutation");
    expect(source).not.toContain("deleteAccount = useSettingsStore");
  });

  test("delete-account confirmation copy says encrypted backups are unrecoverable", () => {
    expect(en.settings.deleteAccountWarning).toContain("encrypted backups");
    expect(en.settings.deleteAccountWarning).toContain("cannot be recovered");
    expect(es.settings.deleteAccountWarning).toContain("copias privadas");
    expect(es.settings.deleteAccountWarning).toContain("no se podrán recuperar");
  });
});

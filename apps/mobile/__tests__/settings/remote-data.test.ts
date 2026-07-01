// biome-ignore-all lint/style/useNamingConvention: Supabase payload fixtures use snake_case
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  deleteAccountRequest,
  isDeleteAccountLocalCleanupRequiredError,
} from "@/features/settings/data/delete-account";
import { saveNotificationPreferences } from "@/features/settings/data/notification-preferences";
import { getSupabase } from "@/shared/db";
import en from "@/shared/i18n/locales/en";
import es from "@/shared/i18n/locales/es";
import type { UserId } from "@/shared/types/branded";

vi.mock("@/shared/db", () => ({
  getSupabase: vi.fn<(...args: any[]) => any>(),
}));

const mockUpsert = vi.fn<(...args: any[]) => any>();
const mockFrom = vi.fn<(...args: any[]) => any>((_table: string) => ({
  upsert: mockUpsert,
}));

describe("settings remote data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);
  });

  test("remote save upserts the correct Supabase shape", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await saveNotificationPreferences("user-1" as UserId, {
      budgetAlerts: false,
      goalMilestones: true,
      spendingAnomalies: false,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        budget_alerts: false,
        goal_milestones: true,
        spending_anomalies: false,
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

  test("delete-account helper preserves the deleted-account local cleanup signal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<(...args: any[]) => any>().mockResolvedValue({
        ok: false,
        json: vi.fn<(...args: any[]) => any>().mockResolvedValue({
          error: "delete_failed",
          localCleanupRequired: true,
        }),
      })
    );

    const result = deleteAccountRequest("https://example.supabase.co", "token");

    await expect(result).rejects.toThrow("delete_failed");
    await expect(result).rejects.toSatisfy(isDeleteAccountLocalCleanupRequiredError);
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

  test("delete-account success uses the deleted-account local cleanup path", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/settings/hooks/use-delete-account.ts"),
      "utf-8"
    );

    expect(source).toContain("queryClient.clear()");
    expect(source).toContain("useAuthStore.getState().completeDeletedAccountSignOut()");
    expect(source).toContain("isDeleteAccountLocalCleanupRequiredError");
    expect(source).not.toContain("useAuthStore.getState().signOut()");
  });

  test("delete-account confirmation copy says Cloud Ledger records and linked samples are deleted", () => {
    expect(en.settings.deleteAccountWarning).toContain("Cloud Ledger");
    expect(en.settings.deleteAccountWarning).toContain("financial records");
    expect(en.settings.deleteAccountWarning).toContain("capture improvement samples");
    expect(en.settings.deleteAccountWarning).toContain("private backups");
    expect(es.settings.deleteAccountWarning).toContain("Cloud Ledger");
    expect(es.settings.deleteAccountWarning).toContain("registros financieros");
    expect(es.settings.deleteAccountWarning).toContain("muestras de mejora de captura");
    expect(es.settings.deleteAccountWarning).toContain("copias privadas");
  });

  test("logout pending-change copy says unsent Cloud Ledger work is discarded", () => {
    expect(en.settings.logoutPendingChangesConfirmMessage).toContain("pending changes");
    expect(en.settings.logoutPendingChangesConfirmMessage).toContain("discard");
    expect(es.settings.logoutPendingChangesConfirmMessage).toContain("cambios pendientes");
    expect(es.settings.logoutPendingChangesConfirmMessage).toContain("descartará");
  });
});

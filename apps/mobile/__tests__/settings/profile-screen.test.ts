import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { describe, expect, test, vi } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { ProfileScreen } from "@/features/settings/components/ProfileScreen";
import { Alert } from "@/shared/components/rn";
import { i18n, useLocaleStore } from "@/shared/i18n";
import en from "@/shared/i18n/locales/en";

const { mockAuthState, mockHasPendingCloudLedgerOutboxChanges, mockSignOut } = vi.hoisted(() => ({
  mockAuthState: {
    authMode: "remote",
    userId: "user-1",
  },
  mockHasPendingCloudLedgerOutboxChanges: vi.fn<(...args: unknown[]) => unknown>(),
  mockSignOut: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("@/features/auth/public", () => ({
  useAuthIdentity: () => ({
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    profileImageUrl: null,
  }),
  useAuthMode: () => mockAuthState.authMode,
  useAuthStore: Object.assign(vi.fn(), {
    getState: () => ({ signOut: mockSignOut }),
  }),
  useOptionalUserId: () => mockAuthState.userId,
}));

vi.mock("@/features/cloud-ledger/outbox.public", () => ({
  hasPendingCloudLedgerOutboxChanges: mockHasPendingCloudLedgerOutboxChanges,
}));

vi.mock("@/features/qa/routes.public", () => ({
  LocalQaProfileTools: () => null,
}));

type AlertAction = {
  readonly text: string;
  readonly style?: string;
  readonly onPress?: () => void;
};

type RenderProfileScreenOptions = {
  readonly pendingChanges?: boolean | Promise<boolean>;
  readonly pendingChangesError?: Error;
};

describe("Profile screen", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/settings/components/ProfileScreen.tsx"),
    "utf-8"
  );
  const qaToolsSource = readFileSync(
    resolve(__dirname, "../../features/qa/components/LocalQaProfileTools.tsx"),
    "utf-8"
  );

  test("renders local QA scenario actions when auth mode is local QA", () => {
    expect(source).toContain("LocalQaProfileTools");
    expect(qaToolsSource).toContain('authMode !== "local-qa"');
    expect(qaToolsSource).toContain('t("settings.localQaReset")');
    expect(qaToolsSource).toContain('t("settings.localQaOpenTools")');
    expect(qaToolsSource).toContain('router.push("/qa-tools")');
  });

  test("warns that pending Cloud Ledger outbox changes are discarded on logout", () => {
    expect(source).toContain("hasPendingCloudLedgerOutboxChanges");
    expect(source).toContain("logoutPendingChangesConfirmMessage");
    expect(source.indexOf("hasPendingCloudLedgerOutboxChanges")).toBeLessThan(
      source.indexOf("Alert.alert")
    );
  });

  test("shows the pending-change warning only after the outbox check resolves", async () => {
    const pendingCheck = createDeferred<boolean>();
    renderProfileScreen({ pendingChanges: pendingCheck.promise }).pressByText(en.settings.logout);

    expect(mockHasPendingCloudLedgerOutboxChanges).toHaveBeenCalledWith("user-1");
    expect(Alert.alert).not.toHaveBeenCalled();

    pendingCheck.resolve(true);
    await vi.waitFor(() => expect(Alert.alert).toHaveBeenCalledOnce());

    expect(Alert.alert).toHaveBeenCalledWith(
      en.settings.logoutConfirmTitle,
      en.settings.logoutPendingChangesConfirmMessage,
      expect.any(Array)
    );
    expect(mockSignOut).not.toHaveBeenCalled();

    const logoutAction = findAlertAction(en.settings.logout);
    expect(logoutAction.style).toBe("destructive");
    logoutAction.onPress?.();

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  test("uses the standard logout confirmation when no pending outbox changes exist", async () => {
    renderProfileScreen({ pendingChanges: false }).pressByText(en.settings.logout);

    await vi.waitFor(() => expect(Alert.alert).toHaveBeenCalledOnce());

    expect(mockHasPendingCloudLedgerOutboxChanges).toHaveBeenCalledWith("user-1");
    expect(Alert.alert).toHaveBeenCalledWith(
      en.settings.logoutConfirmTitle,
      en.settings.logoutConfirmMessage,
      expect.any(Array)
    );
    expect(mockSignOut).not.toHaveBeenCalled();

    const logoutAction = findAlertAction(en.settings.logout);
    expect(logoutAction.style).toBe("destructive");
    logoutAction.onPress?.();

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  test("fails closed to the pending-change warning when the outbox check errors", async () => {
    renderProfileScreen({ pendingChangesError: new Error("db unavailable") }).pressByText(
      en.settings.logout
    );

    await vi.waitFor(() => expect(Alert.alert).toHaveBeenCalledOnce());

    expect(mockHasPendingCloudLedgerOutboxChanges).toHaveBeenCalledWith("user-1");
    expect(Alert.alert).toHaveBeenCalledWith(
      en.settings.logoutConfirmTitle,
      en.settings.logoutPendingChangesConfirmMessage,
      expect.any(Array)
    );
    expect(mockSignOut).not.toHaveBeenCalled();

    const logoutAction = findAlertAction(en.settings.logout);
    expect(logoutAction.style).toBe("destructive");
    logoutAction.onPress?.();

    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});

function renderProfileScreen(options: RenderProfileScreenOptions = {}) {
  i18n.locale = "en";
  useLocaleStore.setState({ locale: "en" });
  mockAuthState.authMode = "remote";
  mockAuthState.userId = "user-1";
  mockHasPendingCloudLedgerOutboxChanges.mockReset();
  if (options.pendingChangesError) {
    mockHasPendingCloudLedgerOutboxChanges.mockRejectedValueOnce(options.pendingChangesError);
  } else if (options.pendingChanges instanceof Promise) {
    mockHasPendingCloudLedgerOutboxChanges.mockReturnValueOnce(options.pendingChanges);
  } else {
    mockHasPendingCloudLedgerOutboxChanges.mockResolvedValueOnce(options.pendingChanges ?? false);
  }
  mockSignOut.mockReset();
  vi.mocked(Alert.alert).mockClear();

  return renderFidy(createElement(ProfileScreen));
}

function findAlertAction(text: string): AlertAction {
  const actions = vi.mocked(Alert.alert).mock.calls[0]?.[2] as AlertAction[] | undefined;
  const action = actions?.find((item) => item.text === text);
  if (!action) {
    throw new Error(`Unable to find alert action: ${text}`);
  }
  return action;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderFidy } from "../helpers/render";

const mocks = vi.hoisted(() => ({
  cleanupExpiredChatSessions: vi.fn<(...args: any[]) => any>(),
  currentDb: null as unknown,
  currentUserId: null as unknown,
  tryGetDb: vi.fn<(...args: any[]) => any>(),
  useSubscription: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/auth/public", () => ({
  useOptionalUserId: () => mocks.currentUserId,
}));

vi.mock("@/shared/db", () => ({
  tryGetDb: (...args: any[]) => mocks.tryGetDb(...args),
}));

vi.mock("@/shared/hooks", () => ({
  useSubscription: (...args: any[]) => mocks.useSubscription(...args),
}));

vi.mock("@/shared/i18n/store", () => ({
  useLocaleStore: { getState: () => ({ t: (key: string) => key }) },
}));

vi.mock("@/shared/lib", () => ({
  captureError: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/ai-chat/store", () => ({
  cleanupExpiredChatSessions: (...args: any[]) => mocks.cleanupExpiredChatSessions(...args),
}));

const chatScreenSource = readFileSync(
  resolve(__dirname, "../../features/ai-chat/components/ChatScreen.tsx"),
  "utf-8"
);


describe("ai chat callers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentDb = null;
    mocks.currentUserId = null;
    mocks.cleanupExpiredChatSessions.mockResolvedValue([]);
    mocks.tryGetDb.mockImplementation((userId) => (userId ? mocks.currentDb : null));
  });

  test("session cleanup subscribes when the auth-scoped runtime becomes available", async () => {
    const { useSessionCleanup } = await import("@/features/ai-chat/hooks/use-session-cleanup");
    const userId = "user-1" as never;
    const db = { id: "db-1" } as never;
    function SessionCleanupHarness() {
      useSessionCleanup();
      return null;
    }

    const rendered = renderFidy(createElement(SessionCleanupHarness)) as ReturnType<
      typeof renderFidy
    > & {
      readonly rerender: (ui: ReactElement) => void;
    };
    const [disabledSubscribe, disabledDeps, disabledEnabled] = mocks.useSubscription.mock.calls[0]!;

    expect(disabledDeps).toEqual([null, null]);
    expect(disabledEnabled).toBe(false);
    expect(disabledSubscribe()).toBeUndefined();
    expect(mocks.cleanupExpiredChatSessions).not.toHaveBeenCalled();

    mocks.currentUserId = userId;
    mocks.currentDb = db;
    rendered.rerender(createElement(SessionCleanupHarness));
    const [enabledSubscribe, enabledDeps, enabledEnabled] = mocks.useSubscription.mock.calls[1]!;

    expect(mocks.tryGetDb).toHaveBeenLastCalledWith(userId);
    expect(enabledDeps).toEqual([db, userId]);
    expect(enabledEnabled).toBe(true);
    expect(enabledSubscribe()).toEqual(expect.any(Function));
    expect(mocks.cleanupExpiredChatSessions).toHaveBeenCalledWith(db, userId);
  });

  test("ChatScreen catches action-status persistence failures", () => {
    expect(chatScreenSource).toContain("updateChatActionStatus({ db, userId, messageId, status })");
    expect(chatScreenSource).toContain(".catch(captureError)");
    expect(chatScreenSource).toContain("persistActionStatus");
    expect(chatScreenSource).not.toContain(
      'void updateChatActionStatus({ db, userId, messageId, status: "confirmed" })'
    );
    expect(chatScreenSource).not.toContain(
      'void updateChatActionStatus({ db, userId, messageId, status: "dismissed" })'
    );
  });

  test("ChatScreen exposes a header action for starting a new chat", () => {
    expect(chatScreenSource).toContain("rightActions={<NewChatButton onPress={onNewChat} />}");
    expect(chatScreenSource).toContain("readonly onNewChat: () => void");
  });

  test("ChatScreen keyboard offset matches the custom header height", () => {
    expect(chatScreenSource).toContain("safeTop + HEADER_HEIGHT");
    expect(chatScreenSource).not.toContain("safeTop + 54");
  });
});

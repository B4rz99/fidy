import { describe, expect, it } from "vitest";
import {
  deriveConversationTitle,
  findExpiredSessions,
  formatCleanupMessage,
} from "../../features/ai-chat/lib/sessions";
import type { ChatSession } from "../../features/ai-chat/schema";

const makeSession = (overrides: Partial<ChatSession>): ChatSession => ({
  id: "sess_1",
  userId: "u1",
  title: "Test session",
  createdAt: "2026-02-01T00:00:00.000Z",
  expiresAt: "2026-03-03T00:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

describe("deriveConversationTitle", () => {
  it("truncates long messages to 50 characters with ellipsis", () => {
    const longMessage =
      "How much did I spend on food and transportation this month compared to last month?";
    const title = deriveConversationTitle(longMessage);

    expect(title.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(title).toMatch(/\.\.\.$/);
  });

  it("keeps short messages as-is", () => {
    const shortMessage = "Food spending?";
    expect(deriveConversationTitle(shortMessage)).toBe("Food spending?");
  });

  it("handles exactly 50 characters", () => {
    const msg = "A".repeat(50);
    expect(deriveConversationTitle(msg)).toBe(msg);
  });
});

describe("findExpiredSessions", () => {
  it("returns only sessions past their expiresAt", () => {
    const now = "2026-03-10T00:00:00.000Z";
    const sessions = [
      makeSession({ id: "s1", expiresAt: "2026-03-05T00:00:00.000Z" }), // expired
      makeSession({ id: "s2", expiresAt: "2026-03-15T00:00:00.000Z" }), // not expired
      makeSession({ id: "s3", expiresAt: "2026-03-09T23:59:59.999Z" }), // expired
    ];

    const result = findExpiredSessions(sessions, now);

    expect(result.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("excludes already-deleted sessions", () => {
    const now = "2026-03-10T00:00:00.000Z";
    const sessions = [
      makeSession({
        id: "s1",
        expiresAt: "2026-03-05T00:00:00.000Z",
        deletedAt: "2026-03-06T00:00:00.000Z",
      }),
      makeSession({ id: "s2", expiresAt: "2026-03-05T00:00:00.000Z" }),
    ];

    const result = findExpiredSessions(sessions, now);

    expect(result.map((s) => s.id)).toEqual(["s2"]);
  });

  it("returns empty array when nothing expired", () => {
    const now = "2026-03-01T00:00:00.000Z";
    const sessions = [makeSession({ expiresAt: "2026-03-15T00:00:00.000Z" })];

    expect(findExpiredSessions(sessions, now)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(findExpiredSessions([], "2026-03-10T00:00:00.000Z")).toEqual([]);
  });
});

describe("formatCleanupMessage", () => {
  it("returns singular message for 1 session", () => {
    expect(formatCleanupMessage(1)).toBe("1 expired conversation was removed");
  });

  it("returns plural message for multiple sessions", () => {
    expect(formatCleanupMessage(3)).toBe("3 expired conversations were removed");
  });

  it("returns null for 0 sessions", () => {
    expect(formatCleanupMessage(0)).toBeNull();
  });
});

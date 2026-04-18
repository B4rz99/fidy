import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const sessionCleanupSource = readFileSync(
  resolve(__dirname, "../../features/ai-chat/hooks/use-session-cleanup.ts"),
  "utf-8"
);

const chatScreenSource = readFileSync(
  resolve(__dirname, "../../features/ai-chat/components/ChatScreen.tsx"),
  "utf-8"
);

describe("ai chat callers", () => {
  test("session cleanup resubscribes when auth-scoped runtime becomes available", () => {
    expect(sessionCleanupSource).toContain("useSubscription(");
    expect(sessionCleanupSource).toContain("[db, userId]");
    expect(sessionCleanupSource).toContain("Boolean(db && userId)");
    expect(sessionCleanupSource).not.toContain("useMountEffect(");
  });

  test("ChatScreen catches action-status persistence failures", () => {
    expect(chatScreenSource).toContain("updateChatActionStatus(db, userId, messageId, status)");
    expect(chatScreenSource).toContain(".catch(captureError)");
    expect(chatScreenSource).toContain("persistActionStatus");
    expect(chatScreenSource).not.toContain(
      'void updateChatActionStatus(db, userId, messageId, "confirmed")'
    );
    expect(chatScreenSource).not.toContain(
      'void updateChatActionStatus(db, userId, messageId, "dismissed")'
    );
  });
});

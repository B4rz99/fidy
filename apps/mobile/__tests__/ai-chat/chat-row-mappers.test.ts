import { describe, expect, it } from "vitest";
import { mapChatMessageRow } from "@/features/ai-chat/lib/chat-row-mappers";
import { generateChatMessageId, generateChatSessionId, toIsoDateTime } from "@/shared/lib";

type ChatMessageRow = Parameters<typeof mapChatMessageRow>[0];

const makeRow = (overrides: Partial<ChatMessageRow> = {}): ChatMessageRow => ({
  id: generateChatMessageId(),
  sessionId: generateChatSessionId(),
  role: "assistant",
  content: "I can help with that",
  action: null,
  actionStatus: null,
  createdAt: toIsoDateTime(new Date("2026-04-18T10:15:00.000Z")),
  ...overrides,
});

describe("chat row mappers", () => {
  it("maps valid persisted actions", () => {
    const message = mapChatMessageRow(
      makeRow({
        action:
          '{"type":"delete","transactionId":"tx-123","description":"Uber","amount":15000,"date":"2026-03-01"}',
      })
    );

    expect(message.action).toEqual({
      type: "delete",
      transactionId: "tx-123",
      description: "Uber",
      amount: 15000,
      date: "2026-03-01",
    });
  });

  it("returns a null action for malformed persisted JSON", () => {
    expect(() => mapChatMessageRow(makeRow({ action: "{not valid json}" }))).not.toThrow();
    expect(mapChatMessageRow(makeRow({ action: "{not valid json}" })).action).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChatSession,
  initializeChatSession,
  loadChatSessions,
  selectChatSession,
  useChatStore,
} from "@/features/ai-chat/store";
import type { ChatMessageId, ChatSessionId, IsoDateTime, UserId } from "@/shared/types/branded";

vi.mock("@/shared/db", () => ({
  chatMessages: {
    id: "id",
    sessionId: "session_id",
    role: "role",
    content: "content",
    action: "action",
    actionStatus: "action_status",
    createdAt: "created_at",
  },
  chatSessions: {
    id: "id",
    userId: "user_id",
    title: "title",
    createdAt: "created_at",
    expiresAt: "expires_at",
    deletedAt: "deleted_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  asc: vi.fn((column: unknown) => ({ type: "asc", column })),
  desc: vi.fn((column: unknown) => ({ type: "desc", column })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
  isNull: vi.fn((value: unknown) => ({ type: "isNull", value })),
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeSession(overrides: { id?: string; title?: string } = {}) {
  return {
    id: (overrides.id ?? "chat-1") as ChatSessionId,
    userId: "user-1" as UserId,
    title: overrides.title ?? "Trip planning",
    createdAt: "2026-04-18T10:00:00.000Z" as IsoDateTime,
    expiresAt: "2026-05-18T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
  };
}

function makeMessage(
  overrides: { id?: string; sessionId?: string; content?: string; createdAt?: IsoDateTime } = {}
) {
  return {
    id: (overrides.id ?? "message-1") as ChatMessageId,
    sessionId: (overrides.sessionId ?? "chat-1") as ChatSessionId,
    role: "assistant",
    content: overrides.content ?? "Here is your weekly summary",
    action: null,
    actionStatus: null,
    createdAt: overrides.createdAt ?? ("2026-04-18T10:15:00.000Z" as IsoDateTime),
  };
}

describe("ai chat store boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      activeUserId: null,
      sessions: [],
      currentSessionId: null,
      messages: [],
      isStreaming: false,
      streamingContent: "",
      expiredSessionCount: 0,
    });
  });

  it("loads sessions for the active user through the explicit boundary", async () => {
    const rows = [makeSession()];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    initializeChatSession("user-1" as UserId);
    await loadChatSessions(db, "user-1" as UserId);

    expect(select).toHaveBeenCalled();
    expect(useChatStore.getState()).toMatchObject({
      activeUserId: "user-1",
      sessions: rows,
    });
  });

  it("drops stale session results after the active user changes", async () => {
    const deferred = createDeferred<readonly ReturnType<typeof makeSession>[]>();
    const orderBy = vi.fn().mockReturnValue(deferred.promise);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    initializeChatSession("user-1" as UserId);
    const load = loadChatSessions(db, "user-1" as UserId);

    initializeChatSession("user-2" as UserId);
    deferred.resolve([makeSession()]);

    await load;

    expect(useChatStore.getState()).toMatchObject({
      activeUserId: "user-2",
      sessions: [],
      currentSessionId: null,
      messages: [],
    });
  });

  it("drops stale create-session completions after the active user changes", async () => {
    const deferred = createDeferred<void>();
    const values = vi.fn().mockReturnValue(deferred.promise);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as never;

    initializeChatSession("user-1" as UserId);
    const create = createChatSession(db, "user-1" as UserId, "Plan my trip budget");

    initializeChatSession("user-2" as UserId);
    deferred.resolve();

    await create;

    expect(useChatStore.getState()).toMatchObject({
      activeUserId: "user-2",
      sessions: [],
      currentSessionId: null,
      messages: [],
    });
  });

  it("drops stale session-message loads after another session becomes active", async () => {
    const deferred = createDeferred<readonly ReturnType<typeof makeMessage>[]>();
    const orderBy = vi.fn().mockReturnValue(deferred.promise);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    initializeChatSession("user-1" as UserId);

    const firstSessionId = "chat-1" as ChatSessionId;
    const secondSessionId = "chat-2" as ChatSessionId;

    const firstSelect = selectChatSession(db, "user-1" as UserId, firstSessionId);
    await Promise.resolve();

    useChatStore.getState().setCurrentSessionId(secondSessionId);
    deferred.resolve([makeMessage({ sessionId: firstSessionId })]);

    await firstSelect;

    expect(useChatStore.getState()).toMatchObject({
      activeUserId: "user-1",
      currentSessionId: secondSessionId,
      messages: [],
    });
  });
});

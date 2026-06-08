import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionStatus, ChatAction, ChatMessage, ChatRole } from "@/features/ai-chat/schema";
import {
  addAssistantChatMessage,
  addUserChatMessage,
  cleanupExpiredChatSessions,
  createChatSession,
  deleteChatSession,
  initializeChatSession,
  loadChatSessions,
  selectChatSession,
  updateChatActionStatus,
  useChatStore,
} from "@/features/ai-chat/store";
import type { ChatMessageId, ChatSessionId, IsoDateTime, UserId } from "@/shared/types/branded";

type MessageOverrides = {
  id?: string;
  sessionId?: string;
  role?: ChatRole;
  content?: string;
  action?: ChatAction | null;
  actionStatus?: ActionStatus | null;
  createdAt?: IsoDateTime;
};

const defaultMessage = {
  id: "message-1" as ChatMessageId,
  sessionId: "chat-1" as ChatSessionId,
  role: "assistant" as const,
  content: "Here is your weekly summary",
  action: null,
  actionStatus: null,
  createdAt: "2026-04-18T10:15:00.000Z" as IsoDateTime,
};

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
  and: vi.fn<(...args: any[]) => any>((...args: unknown[]) => ({ type: "and", args })),
  asc: vi.fn<(...args: any[]) => any>((column: unknown) => ({ type: "asc", column })),
  desc: vi.fn<(...args: any[]) => any>((column: unknown) => ({ type: "desc", column })),
  eq: vi.fn<(...args: any[]) => any>((left: unknown, right: unknown) => ({
    type: "eq",
    left,
    right,
  })),
  isNull: vi.fn<(...args: any[]) => any>((value: unknown) => ({ type: "isNull", value })),
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

function makeMessage(overrides: MessageOverrides = {}): ChatMessage {
  const nextMessage = { ...defaultMessage, ...overrides };
  return {
    ...nextMessage,
    id: nextMessage.id as ChatMessageId,
    sessionId: nextMessage.sessionId as ChatSessionId,
    createdAt: nextMessage.createdAt as IsoDateTime,
  };
}

function makeInsertDb() {
  const values = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
  const insert = vi.fn<(...args: any[]) => any>(() => ({ values }));
  return { db: { insert } as never, insert, values };
}

function makeUpdateDb() {
  const where = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
  const set = vi.fn<(...args: any[]) => any>(() => ({ where }));
  const update = vi.fn<(...args: any[]) => any>(() => ({ set }));
  return { db: { update } as never, update, set, where };
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
    });
  });

  it("loads sessions for the active user through the explicit boundary", async () => {
    const rows = [makeSession()];
    const orderBy = vi.fn<(...args: any[]) => any>().mockResolvedValue(rows);
    const where = vi.fn<(...args: any[]) => any>().mockReturnValue({ orderBy });
    const from = vi.fn<(...args: any[]) => any>().mockReturnValue({ where });
    const select = vi.fn<(...args: any[]) => any>().mockReturnValue({ from });
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
    const orderBy = vi.fn<(...args: any[]) => any>().mockReturnValue(deferred.promise);
    const where = vi.fn<(...args: any[]) => any>().mockReturnValue({ orderBy });
    const from = vi.fn<(...args: any[]) => any>().mockReturnValue({ where });
    const select = vi.fn<(...args: any[]) => any>().mockReturnValue({ from });
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
    const values = vi.fn<(...args: any[]) => any>().mockReturnValue(deferred.promise);
    const insert = vi.fn<(...args: any[]) => any>().mockReturnValue({ values });
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
    const orderBy = vi.fn<(...args: any[]) => any>().mockReturnValue(deferred.promise);
    const where = vi.fn<(...args: any[]) => any>().mockReturnValue({ orderBy });
    const from = vi.fn<(...args: any[]) => any>().mockReturnValue({ where });
    const select = vi.fn<(...args: any[]) => any>().mockReturnValue({ from });
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

  it("clears the previous session messages while the next session loads", async () => {
    const deferred = createDeferred<readonly ReturnType<typeof makeMessage>[]>();
    const orderBy = vi.fn<(...args: any[]) => any>().mockReturnValue(deferred.promise);
    const where = vi.fn<(...args: any[]) => any>().mockReturnValue({ orderBy });
    const from = vi.fn<(...args: any[]) => any>().mockReturnValue({ where });
    const select = vi.fn<(...args: any[]) => any>().mockReturnValue({ from });
    const db = { select } as never;

    initializeChatSession("user-1" as UserId);
    useChatStore.setState({
      currentSessionId: "chat-1" as ChatSessionId,
      messages: [makeMessage({ sessionId: "chat-1" })],
    });

    const selectPromise = selectChatSession(db, "user-1" as UserId, "chat-2" as ChatSessionId);

    expect(useChatStore.getState()).toMatchObject({
      currentSessionId: "chat-2",
      messages: [],
    });

    deferred.resolve([makeMessage({ sessionId: "chat-2", content: "New conversation" })]);
    await selectPromise;
  });

  it("persists and appends user messages for the active session", async () => {
    const { db, values } = makeInsertDb();
    initializeChatSession("user-1" as UserId);
    useChatStore.setState({ currentSessionId: "chat-1" as ChatSessionId });

    const message = await addUserChatMessage(db, "user-1" as UserId, "Track my lunch spend");

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: message.id,
        sessionId: "chat-1",
        role: "user",
        content: "Track my lunch spend",
        action: null,
        actionStatus: null,
      })
    );
    expect(useChatStore.getState().messages).toEqual([message]);
  });

  it("sets assistant action status from the action type before persisting", async () => {
    const { db, values } = makeInsertDb();
    initializeChatSession("user-1" as UserId);
    useChatStore.setState({ currentSessionId: "chat-1" as ChatSessionId });

    const addMessage = await addAssistantChatMessage(db, "user-1" as UserId, "Added it", {
      type: "add",
      data: {
        type: "expense",
        amount: 15000,
        categoryId: "cat-food",
        description: "Lunch",
        date: "2026-04-18",
      },
    } as never);
    const deleteMessage = await addAssistantChatMessage(db, "user-1" as UserId, "Delete it?", {
      type: "delete",
      transactionId: "tx-1",
      description: "Lunch",
      amount: 15000,
      date: "2026-04-18",
    } as never);
    const editMessage = await addAssistantChatMessage(db, "user-1" as UserId, "Edited it", {
      type: "edit",
      transactionId: "tx-1",
      data: { amount: 16000 },
    } as never);

    expect(addMessage.actionStatus).toBe("confirmed");
    expect(deleteMessage.actionStatus).toBe("pending");
    expect(editMessage.actionStatus).toBeNull();
    expect(values).toHaveBeenCalledTimes(3);
    expect(values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        role: "assistant",
        action: expect.stringContaining('"type":"add"'),
        actionStatus: "confirmed",
      })
    );
    expect(useChatStore.getState().messages.map((message) => message.id)).toEqual([
      addMessage.id,
      deleteMessage.id,
      editMessage.id,
    ]);
  });

  it("soft-deletes sessions and clears active messages", async () => {
    const { db, set } = makeUpdateDb();
    const session = makeSession();
    initializeChatSession("user-1" as UserId);
    useChatStore.setState({
      sessions: [session],
      currentSessionId: session.id,
      messages: [makeMessage({ sessionId: session.id })],
    });

    await deleteChatSession(db, "user-1" as UserId, session.id);

    expect(set).toHaveBeenCalledWith({ deletedAt: expect.any(String) });
    expect(useChatStore.getState()).toMatchObject({
      sessions: [],
      currentSessionId: null,
      messages: [],
    });
  });

  it("updates assistant action status in storage and local state", async () => {
    const { db, set } = makeUpdateDb();
    const message = makeMessage({
      id: "message-action",
      action: { type: "delete" } as never,
      actionStatus: "pending" as never,
    });
    initializeChatSession("user-1" as UserId);
    useChatStore.setState({
      currentSessionId: message.sessionId,
      messages: [message],
    });

    await updateChatActionStatus({
      db,
      userId: "user-1" as UserId,
      messageId: message.id,
      status: "dismissed",
    });

    expect(set).toHaveBeenCalledWith({ actionStatus: "dismissed" });
    expect(useChatStore.getState().messages[0]?.actionStatus).toBe("dismissed");
  });

  it("cleans up expired chat sessions and clears the active expired conversation", async () => {
    const { db, set } = makeUpdateDb();
    const expired = makeSession({
      id: "chat-expired",
      title: "Expired",
    });
    const active = { ...expired, expiresAt: "2026-01-01T00:00:00.000Z" as IsoDateTime };
    const fresh = {
      ...makeSession({ id: "chat-fresh", title: "Fresh" }),
      expiresAt: "2099-01-01T00:00:00.000Z" as IsoDateTime,
    };
    initializeChatSession("user-1" as UserId);
    useChatStore.setState({
      sessions: [active, fresh],
      currentSessionId: active.id,
      messages: [makeMessage({ sessionId: active.id })],
    });

    const expiredSessions = await cleanupExpiredChatSessions(db, "user-1" as UserId);

    expect(expiredSessions).toEqual([active]);
    expect(set).toHaveBeenCalledWith({ deletedAt: expect.any(String) });
    expect(useChatStore.getState()).toMatchObject({
      sessions: [fresh],
      currentSessionId: null,
      messages: [],
    });
  });
});

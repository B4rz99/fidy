import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/email-capture/lib/repository", () => ({
  getEmailAccounts: vi.fn().mockResolvedValue([]),
  insertEmailAccount: vi.fn(),
  deleteEmailAccount: vi.fn(),
  getFailedEmails: vi.fn().mockResolvedValue([]),
  dismissProcessedEmail: vi.fn(),
}));

import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
} from "@/features/email-capture/lib/repository";
import { useEmailCaptureStore } from "@/features/email-capture/store";

// biome-ignore lint/suspicious/noExplicitAny: mock db needs flexible typing
const mockDb = {} as any;
const mockUserId = "user-1";

describe("useEmailCaptureStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEmailCaptureStore.getState().initStore(mockDb, mockUserId);
    useEmailCaptureStore.setState({
      accounts: [],
      failedEmails: [],
      failedCount: 0,
      isFetching: false,
      bannerDismissed: false,
    });
  });

  it("starts with empty state", () => {
    const state = useEmailCaptureStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.failedEmails).toEqual([]);
    expect(state.failedCount).toBe(0);
    expect(state.isFetching).toBe(false);
    expect(state.bannerDismissed).toBe(false);
  });

  it("loadAccounts fetches from DB and sets state", async () => {
    const mockAccounts = [
      {
        id: "ea-1",
        userId: mockUserId,
        provider: "gmail",
        email: "test@gmail.com",
        lastFetchedAt: null,
        createdAt: "2026-03-05T10:00:00Z",
      },
    ];
    vi.mocked(getEmailAccounts).mockResolvedValueOnce(mockAccounts);

    await useEmailCaptureStore.getState().loadAccounts();

    expect(getEmailAccounts).toHaveBeenCalledWith(mockDb, mockUserId);
    expect(useEmailCaptureStore.getState().accounts).toEqual(mockAccounts);
  });

  it("loadFailedEmails fetches from DB and sets state", async () => {
    const mockFailed = [
      {
        id: "pe-1",
        externalId: "msg-1",
        provider: "gmail",
        status: "failed",
        failureReason: "parse error",
        subject: "Compra",
        rawBodyPreview: null,
        receivedAt: "2026-03-05T10:00:00Z",
        transactionId: null,
        createdAt: "2026-03-05T10:00:00Z",
      },
    ];
    vi.mocked(getFailedEmails).mockResolvedValueOnce(mockFailed);

    await useEmailCaptureStore.getState().loadFailedEmails();

    expect(getFailedEmails).toHaveBeenCalledWith(mockDb);
    expect(useEmailCaptureStore.getState().failedEmails).toEqual(mockFailed);
    expect(useEmailCaptureStore.getState().failedCount).toBe(1);
  });

  it("dismissBanner sets bannerDismissed to true", () => {
    useEmailCaptureStore.getState().dismissBanner();
    expect(useEmailCaptureStore.getState().bannerDismissed).toBe(true);
  });

  it("dismissFailedEmail removes from DB and state", async () => {
    useEmailCaptureStore.setState({
      failedEmails: [
        {
          id: "pe-1",
          externalId: "msg-1",
          provider: "gmail",
          status: "failed",
          failureReason: null,
          subject: "Test",
          rawBodyPreview: null,
          receivedAt: "2026-03-05T10:00:00Z",
          transactionId: null,
          createdAt: "2026-03-05T10:00:00Z",
        },
      ],
      failedCount: 1,
    });

    await useEmailCaptureStore.getState().dismissFailedEmail("pe-1");

    expect(dismissProcessedEmail).toHaveBeenCalledWith(mockDb, "pe-1");
    expect(useEmailCaptureStore.getState().failedEmails).toHaveLength(0);
    expect(useEmailCaptureStore.getState().failedCount).toBe(0);
  });

  it("disconnectEmail removes from DB and state", async () => {
    useEmailCaptureStore.setState({
      accounts: [
        {
          id: "ea-1",
          userId: mockUserId,
          provider: "gmail",
          email: "test@gmail.com",
          lastFetchedAt: null,
          createdAt: "2026-03-05T10:00:00Z",
        },
      ],
    });

    await useEmailCaptureStore.getState().disconnectEmail("ea-1");

    expect(deleteEmailAccount).toHaveBeenCalledWith(mockDb, "ea-1");
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(0);
  });
});

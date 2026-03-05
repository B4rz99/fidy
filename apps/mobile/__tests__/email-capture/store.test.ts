import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/email-capture/lib/repository", () => ({
  getEmailAccounts: vi.fn().mockResolvedValue([]),
  insertEmailAccount: vi.fn(),
  deleteEmailAccount: vi.fn(),
  getFailedEmails: vi.fn().mockResolvedValue([]),
  dismissProcessedEmail: vi.fn(),
}));

vi.mock("@/features/email-capture/services/gmail-adapter", () => ({
  connectGmail: vi.fn(),
}));

vi.mock("@/features/email-capture/services/outlook-adapter", () => ({
  connectOutlook: vi.fn(),
}));

vi.mock("@/shared/lib/generate-id", () => ({
  generateId: vi.fn(() => "ea-generated"),
}));

import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
  insertEmailAccount,
} from "@/features/email-capture/lib/repository";
import { connectGmail } from "@/features/email-capture/services/gmail-adapter";
import { connectOutlook } from "@/features/email-capture/services/outlook-adapter";
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

  it("connectEmail calls Gmail adapter and saves account", async () => {
    vi.mocked(connectGmail).mockResolvedValueOnce({
      success: true,
      email: "user@gmail.com",
    });

    await useEmailCaptureStore.getState().connectEmail("gmail", "client-id");

    expect(connectGmail).toHaveBeenCalledWith("client-id");
    expect(insertEmailAccount).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        provider: "gmail",
        email: "user@gmail.com",
        userId: mockUserId,
      })
    );
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(1);
  });

  it("connectEmail calls Outlook adapter for outlook provider", async () => {
    vi.mocked(connectOutlook).mockResolvedValueOnce({
      success: true,
      email: "user@outlook.com",
    });

    await useEmailCaptureStore.getState().connectEmail("outlook", "client-id");

    expect(connectOutlook).toHaveBeenCalledWith("client-id");
    expect(insertEmailAccount).toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(1);
  });

  it("connectEmail does not save account on failure", async () => {
    vi.mocked(connectGmail).mockResolvedValueOnce({
      success: false,
      error: "cancelled",
    });

    await useEmailCaptureStore.getState().connectEmail("gmail", "client-id");

    expect(insertEmailAccount).not.toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(0);
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

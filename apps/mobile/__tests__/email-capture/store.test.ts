import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/email-capture/lib/repository", () => ({
  getEmailAccounts: vi.fn().mockResolvedValue([]),
  insertEmailAccount: vi.fn(),
  deleteEmailAccount: vi.fn(),
  getFailedEmails: vi.fn().mockResolvedValue([]),
  dismissProcessedEmail: vi.fn(),
  updateLastFetchedAt: vi.fn(),
}));

vi.mock("@/features/email-capture/services/gmail-adapter", () => ({
  connectGmail: vi.fn(),
  disconnectGmail: vi.fn().mockResolvedValue(undefined),
  fetchGmailEmails: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/email-capture/services/outlook-adapter", () => ({
  connectOutlook: vi.fn(),
  disconnectOutlook: vi.fn().mockResolvedValue(undefined),
  fetchOutlookEmails: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/email-capture/services/email-pipeline", () => ({
  processEmails: vi
    .fn()
    .mockResolvedValue({ filtered: 0, skippedDuplicate: 0, saved: 0, failed: 0 }),
}));

vi.mock("@/features/email-capture/lib/bank-senders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/email-capture/lib/bank-senders")>();
  return {
    ...actual,
    fetchBankSenders: vi.fn().mockResolvedValue(actual.DEFAULT_BANK_SENDERS),
  };
});

vi.mock("@/shared/lib/generate-id", () => ({
  generateId: vi.fn(() => "ea-generated"),
}));

import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
  insertEmailAccount,
  updateLastFetchedAt,
} from "@/features/email-capture/lib/repository";
import { processEmails } from "@/features/email-capture/services/email-pipeline";
import { connectGmail, fetchGmailEmails } from "@/features/email-capture/services/gmail-adapter";
import {
  connectOutlook,
  fetchOutlookEmails,
} from "@/features/email-capture/services/outlook-adapter";
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
      isFetching: false,
      bannerDismissed: false,
    });
  });

  it("starts with empty state", () => {
    const state = useEmailCaptureStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.failedEmails).toEqual([]);
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
    expect(useEmailCaptureStore.getState().failedEmails).toHaveLength(1);
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
    });

    await useEmailCaptureStore.getState().dismissFailedEmail("pe-1");

    expect(dismissProcessedEmail).toHaveBeenCalledWith(mockDb, "pe-1");
    expect(useEmailCaptureStore.getState().failedEmails).toHaveLength(0);
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

  describe("fetchAndProcess", () => {
    it("fetches Gmail emails and runs pipeline", async () => {
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

      const mockRawEmails = [
        {
          externalId: "ext-1",
          from: "bank@example.com",
          subject: "Alert",
          body: "body",
          receivedAt: "2026-03-05T10:00:00Z",
          provider: "gmail" as const,
        },
      ];
      vi.mocked(fetchGmailEmails).mockResolvedValueOnce(mockRawEmails);
      vi.mocked(processEmails).mockResolvedValueOnce({
        filtered: 0,
        skippedDuplicate: 0,
        saved: 1,
        failed: 0,
      });
      vi.mocked(getFailedEmails).mockResolvedValueOnce([]);

      await useEmailCaptureStore.getState().fetchAndProcess("gmail-client-id", "outlook-client-id");

      expect(fetchGmailEmails).toHaveBeenCalled();
      expect(processEmails).toHaveBeenCalled();
      expect(updateLastFetchedAt).toHaveBeenCalled();
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });

    it("fetches Outlook emails for outlook accounts", async () => {
      useEmailCaptureStore.setState({
        accounts: [
          {
            id: "ea-2",
            userId: mockUserId,
            provider: "outlook",
            email: "test@outlook.com",
            lastFetchedAt: null,
            createdAt: "2026-03-05T10:00:00Z",
          },
        ],
      });

      vi.mocked(fetchOutlookEmails).mockResolvedValueOnce([]);
      vi.mocked(getFailedEmails).mockResolvedValueOnce([]);

      await useEmailCaptureStore.getState().fetchAndProcess("gmail-client-id", "outlook-client-id");

      expect(fetchOutlookEmails).toHaveBeenCalled();
    });

    it("sets isFetching during execution", async () => {
      useEmailCaptureStore.setState({ accounts: [] });
      vi.mocked(getFailedEmails).mockResolvedValueOnce([]);

      const promise = useEmailCaptureStore.getState().fetchAndProcess("g", "o");
      expect(useEmailCaptureStore.getState().isFetching).toBe(true);

      await promise;
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });

    it("does nothing when db or userId is not set", async () => {
      useEmailCaptureStore.getState().initStore(null as any, null as any);

      await useEmailCaptureStore.getState().fetchAndProcess("g", "o");

      expect(fetchGmailEmails).not.toHaveBeenCalled();
      expect(fetchOutlookEmails).not.toHaveBeenCalled();
    });

    it("skips when already fetching", async () => {
      useEmailCaptureStore.setState({
        isFetching: true,
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

      await useEmailCaptureStore.getState().fetchAndProcess("g", "o");

      expect(fetchGmailEmails).not.toHaveBeenCalled();
    });

    it("continues processing other accounts when one fails", async () => {
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
          {
            id: "ea-2",
            userId: mockUserId,
            provider: "outlook",
            email: "test@outlook.com",
            lastFetchedAt: null,
            createdAt: "2026-03-05T10:00:00Z",
          },
        ],
      });

      vi.mocked(fetchGmailEmails).mockRejectedValueOnce(new Error("network error"));
      vi.mocked(fetchOutlookEmails).mockResolvedValueOnce([]);
      vi.mocked(getFailedEmails).mockResolvedValueOnce([]);

      await useEmailCaptureStore.getState().fetchAndProcess("g", "o");

      expect(fetchOutlookEmails).toHaveBeenCalled();
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });
  });
});

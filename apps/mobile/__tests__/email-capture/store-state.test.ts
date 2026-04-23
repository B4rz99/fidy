import { describe, expect, it } from "vitest";
import { create } from "zustand";
import type { EmailAccountRow } from "@/features/email-capture/lib/repository";
import { createEmailCaptureStoreState } from "@/features/email-capture/store/state";
import { requireUserId } from "@/shared/types/assertions";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";

const USER_ID = requireUserId("user-1");

function makeAccount(overrides: Partial<EmailAccountRow> = {}): EmailAccountRow {
  return {
    id: "ea-1" as EmailAccountId,
    userId: USER_ID,
    provider: "gmail",
    email: "person@gmail.com",
    lastFetchedAt: null,
    createdAt: "2026-04-23T10:00:00.000Z" as IsoDateTime,
    ...overrides,
  };
}

describe("email capture store state helper", () => {
  it("begins a new session and clears transient store state", () => {
    const store = create(createEmailCaptureStoreState);

    store.setState({
      activeUserId: "user-0" as UserId,
      accounts: [makeAccount()],
      failedEmails: [{ id: "failed-1" }] as never[],
      needsReviewEmails: [{ id: "review-1" }] as never[],
      isFetching: true,
      progress: { total: 2, completed: 1, saved: 1, failed: 0, needsReview: 0 },
      phase: "processing",
      bannerDismissed: true,
    });

    store.getState().beginSession(USER_ID);

    expect(store.getState()).toMatchObject({
      activeUserId: USER_ID,
      accounts: [],
      failedEmails: [],
      needsReviewEmails: [],
      isFetching: false,
      progress: null,
      phase: null,
      bannerDismissed: false,
    });
  });

  it("updates fetched accounts without mutating unrelated entries", () => {
    const store = create(createEmailCaptureStoreState);
    const accountOne = makeAccount();
    const accountTwo = makeAccount({
      id: "ea-2" as EmailAccountId,
      email: "other@gmail.com",
      lastFetchedAt: "2026-04-22T09:00:00.000Z" as IsoDateTime,
    });
    const fetchedAt = "2026-04-23T12:00:00.000Z" as IsoDateTime;

    store.getState().setAccounts([accountOne, accountTwo]);
    store.getState().markAccountsFetched(new Set([accountOne.id]), fetchedAt);

    expect(store.getState().accounts).toEqual([
      { ...accountOne, lastFetchedAt: fetchedAt },
      accountTwo,
    ]);
  });
});

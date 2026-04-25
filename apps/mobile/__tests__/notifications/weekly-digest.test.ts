import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveLocalWeeklyDigestData,
  deriveWeeklyDigestMessage,
} from "@/features/notifications/lib/weekly-digest";
import { syncWeeklyDigestReminder } from "@/features/notifications/services/weekly-digest";
import { scheduleWeeklyDigestReminder } from "@/features/notifications/services/weekly-digest-schedule";
import { useSettingsStore } from "@/features/settings/store";
import i18n from "@/shared/i18n/i18n";
import type { UserId } from "@/shared/types/branded";

const LOCAL_DIGEST_ROWS = {
  sinceDate: "2026-04-18",
  month: "2026-04",
  transactions: [
    {
      type: "expense",
      amount: 90_000,
      categoryId: "cat-food",
      categoryName: "Food",
      date: "2026-04-20",
    },
    {
      type: "expense",
      amount: 40_000,
      categoryId: "cat-fun",
      categoryName: "Fun",
      date: "2026-04-19",
    },
    {
      type: "income",
      amount: 200_000,
      categoryId: "cat-income",
      categoryName: "Income",
      date: "2026-04-21",
    },
    {
      type: "expense",
      amount: 999_000,
      categoryId: "cat-old",
      categoryName: "Old",
      date: "2026-04-10",
    },
  ],
  budgets: [
    { categoryId: "cat-food", amount: 80_000, month: "2026-04" },
    { categoryId: "cat-fun", amount: 100_000, month: "2026-04" },
  ],
  goalContributions: [
    { amount: 25_000, date: "2026-04-20" },
    { amount: 99_000, date: "2026-04-01" },
  ],
} as const;

const formatAmount = (amount: number): string => `$${amount}`;
const translate = (key: string, params?: Record<string, string | number>): string => {
  const value = params ? JSON.stringify(params) : "";
  return `[${key.split(".").at(-1)}]${value}`;
};

const digestMessageInput = {
  totalSpent: 120_000,
  topCategories: [],
  budgetStatus: "no_budgets",
  goalContributionsThisWeek: 0,
} as const;

beforeEach(() => {
  i18n.locale = "en";
  useSettingsStore.setState(useSettingsStore.getInitialState());
  vi.clearAllMocks();
});

describe("deriveLocalWeeklyDigestData", () => {
  it("derives digest data from local ledger rows", () => {
    const digest = deriveLocalWeeklyDigestData(LOCAL_DIGEST_ROWS);

    expect(digest).toEqual({
      totalSpent: 130_000,
      topCategories: [
        { name: "Food", amount: 90_000 },
        { name: "Fun", amount: 40_000 },
      ],
      budgetStatus: "over",
      goalContributionsThisWeek: 25_000,
    });
  });
});

describe("deriveLocalWeeklyDigestData budget status", () => {
  it("marks digest budgets on track when spending stays below monthly limits", () => {
    const digest = deriveLocalWeeklyDigestData({
      ...LOCAL_DIGEST_ROWS,
      transactions: [
        {
          type: "expense",
          amount: 40_000,
          categoryId: "cat-food",
          categoryName: "Food",
          date: "2026-04-20",
        },
      ],
    });

    expect(digest.budgetStatus).toBe("on_track");
  });

  it("marks digest budgets missing when the current month has no budgets", () => {
    const digest = deriveLocalWeeklyDigestData({
      ...LOCAL_DIGEST_ROWS,
      month: "2026-05",
    });

    expect(digest.budgetStatus).toBe("no_budgets");
  });
});

describe("deriveWeeklyDigestMessage", () => {
  it("omits optional segments when there are no categories, budgets, or goal contributions", () => {
    const message = deriveWeeklyDigestMessage(digestMessageInput, translate, formatAmount);

    expect(message).toEqual({
      title: "[title]",
      body: '[spending]{"amount":"$120000"}',
    });
  });
});

describe("deriveWeeklyDigestMessage category segments", () => {
  it("includes the one-category, budget, and goal segments", () => {
    const message = deriveWeeklyDigestMessage(
      {
        ...digestMessageInput,
        topCategories: [{ name: "Food", amount: 90_000 }],
        budgetStatus: "on_track",
        goalContributionsThisWeek: 25_000,
      },
      translate,
      formatAmount
    );

    expect(message.body).toContain('[categoryOne]{"firstCategory":"Food","secondCategory":""}');
    expect(message.body).toContain("[budgetOnTrack]");
    expect(message.body).toContain('[goalContribution]{"amount":"$25000"}');
  });
});

describe("deriveWeeklyDigestMessage budget segments", () => {
  it("includes the two-category and over-budget segments", () => {
    const message = deriveWeeklyDigestMessage(
      {
        ...digestMessageInput,
        topCategories: [
          { name: "Food", amount: 90_000 },
          { name: "Fun", amount: 40_000 },
        ],
        budgetStatus: "over",
      },
      translate,
      formatAmount
    );

    expect(message.body).toContain('[categoryTwo]{"firstCategory":"Food","secondCategory":"Fun"}');
    expect(message.body).toContain("[budgetOver]");
  });
});

describe("deriveWeeklyDigestMessage truncation", () => {
  it("truncates long notification bodies", () => {
    const message = deriveWeeklyDigestMessage(
      {
        ...digestMessageInput,
        totalSpent: 1_000_000_000_000,
        topCategories: [
          { name: "Groceries and restaurants with a very long category label", amount: 90_000 },
          { name: "Entertainment subscriptions and weekend travel", amount: 40_000 },
        ],
        budgetStatus: "over",
        goalContributionsThisWeek: 1_000_000_000_000,
      },
      translate,
      formatAmount
    );

    expect(message.body).toHaveLength(200);
    expect(message.body.endsWith("...")).toBe(true);
  });
});

describe("weekly digest notification scheduling", () => {
  it("schedules a recurring reminder without frozen financial content", async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("weekly-digest-id");

    const result = await scheduleWeeklyDigestReminder("user-1" as UserId);

    expect(result).toBe("weekly-digest-id");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Your weekly digest is ready",
        body: "Open Fidy to generate it privately from this device.",
        data: { route: "/notifications", type: "weekly_digest" },
      },
      trigger: {
        type: "weekly",
        weekday: 1,
        hour: 19,
        minute: 0,
      },
    });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: expect.stringContaining("$130.000"),
        }),
      })
    );
  });

  it("does not schedule when the weekly digest preference is disabled", async () => {
    useSettingsStore.getState().setNotificationPreference("weeklyDigest", false);

    const result = await syncWeeklyDigestReminder("user-1" as UserId);

    expect(result).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancels the previous local digest schedule when the preference is disabled", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("old-weekly-digest-id");
    useSettingsStore.getState().setNotificationPreference("weeklyDigest", false);

    const result = await syncWeeklyDigestReminder("user-1" as UserId);

    expect(result).toBeNull();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "old-weekly-digest-id"
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

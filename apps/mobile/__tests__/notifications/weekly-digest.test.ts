import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveLocalWeeklyDigestData,
  deriveWeeklyDigestMessage,
} from "@/features/notifications/lib/weekly-digest";
import {
  cancelWeeklyDigestNotification,
  cleanupLegacyWeeklyDigestNotificationSchedules,
} from "@/features/notifications/services/weekly-digest-schedule";
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

const MONTH_TO_DATE_OVER_ROWS = {
  ...LOCAL_DIGEST_ROWS,
  transactions: [
    {
      type: "expense",
      amount: 60_000,
      categoryId: "cat-food",
      categoryName: "Food",
      date: "2026-04-02",
    },
    {
      type: "expense",
      amount: 40_000,
      categoryId: "cat-food",
      categoryName: "Food",
      date: "2026-04-20",
    },
  ],
} as const;

const SCHEDULED_NOTIFICATIONS = [
  {
    identifier: "previous-account-weekly-digest-id",
    content: { data: { type: "weekly_digest" } },
    trigger: null,
  },
  {
    identifier: "unrelated-id",
    content: { data: { type: "bill_reminder" } },
    trigger: null,
  },
] as never;

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
  it("marks digest budgets over when month-to-date spending exceeds monthly limits", () => {
    const digest = deriveLocalWeeklyDigestData(MONTH_TO_DATE_OVER_ROWS);

    expect(digest.budgetStatus).toBe("over");
    expect(digest.totalSpent).toBe(40_000);
    expect(digest.topCategories).toEqual([{ name: "Food", amount: 40_000 }]);
  });
});

describe("deriveLocalWeeklyDigestData missing budgets", () => {
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

describe("weekly digest notification cleanup", () => {
  it("cancels stored and discovered local digest schedules", async () => {
    vi.mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce("device-weekly-digest-id")
      .mockResolvedValueOnce("legacy-weekly-digest-id");
    vi.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue(
      SCHEDULED_NOTIFICATIONS
    );

    await cancelWeeklyDigestNotification("user-1" as UserId);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "device-weekly-digest-id"
    );
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "legacy-weekly-digest-id"
    );
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "previous-account-weekly-digest-id"
    );
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("unrelated-id");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("weekly_digest_notification");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("weekly_digest_notification_user-1");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("weekly digest legacy notification cleanup", () => {
  it("runs legacy local schedule cleanup once per device", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("true");

    await cleanupLegacyWeeklyDigestNotificationSchedules("user-1" as UserId);

    expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});

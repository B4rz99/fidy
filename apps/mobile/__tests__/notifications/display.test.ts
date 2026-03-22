import { describe, expect, it } from "vitest";
import type { NotificationDisplay, StoredNotification } from "@/features/notifications/lib/types";
import type { CategoryId, IsoDateTime, NotificationId, UserId } from "@/shared/types/branded";

// ---------------------------------------------------------------------------
// Lazy imports (will fail RED until implementation exists)
// ---------------------------------------------------------------------------

import {
  deriveNotificationDisplay,
  groupNotificationsBySection,
} from "@/features/notifications/lib/display";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeNotification = (overrides: Partial<StoredNotification> = {}): StoredNotification => ({
  id: "nf-1" as NotificationId,
  userId: "u1" as UserId,
  type: "budget_alert",
  dedupKey: "dedup-1",
  categoryId: null,
  goalId: null,
  titleKey: "notifications.budget_alert.title",
  messageKey: "notifications.budget_alert.message",
  params: null,
  createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
  updatedAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
  deletedAt: null,
  ...overrides,
});

const mockT = (key: string, _params?: Record<string, unknown>): string => key;

// ---------------------------------------------------------------------------
// deriveNotificationDisplay
// ---------------------------------------------------------------------------

describe("deriveNotificationDisplay", () => {
  it("resolves budget_alert with threshold 80 to warning icon and orange color", () => {
    const n = makeNotification({
      type: "budget_alert",
      params: JSON.stringify({ threshold: 80 }),
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("triangle-alert");
    expect(result.iconColor).toBe("#F57C00");
    expect(result.iconBgColor).toBe("#FFF3E0");
    expect(result.route).toBe("/(tabs)/(finance)");
  });

  it("resolves budget_alert with threshold 100 to error icon and red color", () => {
    const n = makeNotification({
      type: "budget_alert",
      params: JSON.stringify({ threshold: 100 }),
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("circle-x");
    expect(result.iconColor).toBe("#D45B5B");
    expect(result.iconBgColor).toBe("#FFEBEE");
    expect(result.route).toBe("/(tabs)/(finance)");
  });

  it("resolves spending_anomaly with category-specific icon and route", () => {
    const n = makeNotification({
      type: "spending_anomaly",
      categoryId: "food" as CategoryId,
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("utensils");
    expect(result.iconColor).toBe("#7CB243");
    expect(result.iconBgColor).toBe("#E8F5E9");
    expect(result.route).toBe("/search?category=food");
  });

  it("resolves spending_anomaly for transport category", () => {
    const n = makeNotification({
      type: "spending_anomaly",
      categoryId: "transport" as CategoryId,
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("car");
    expect(result.iconColor).toBe("#E8A090");
    expect(result.iconBgColor).toBe("#FFF0ED");
  });

  it("resolves budget_pace with category-specific icon and finance route", () => {
    const n = makeNotification({
      type: "budget_pace",
      categoryId: "entertainment" as CategoryId,
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("clapperboard");
    expect(result.iconColor).toBe("#F5C842");
    expect(result.iconBgColor).toBe("#FFFDE7");
    expect(result.route).toBe("/(tabs)/(finance)");
  });

  it("resolves goal_milestone with trophy icon and goal route", () => {
    const n = makeNotification({
      type: "goal_milestone",
      goalId: "goal-42",
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("trophy");
    expect(result.iconColor).toBe("#7CB243");
    expect(result.iconBgColor).toBe("#E8F5E9");
    expect(result.route).toBe("/goal-detail?id=goal-42");
  });

  it("resolves goal_milestone with null goalId to null route", () => {
    const n = makeNotification({
      type: "goal_milestone",
      goalId: null,
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.route).toBeNull();
  });

  it("passes title and message keys through t function", () => {
    const n = makeNotification({
      titleKey: "notifications.test.title",
      messageKey: "notifications.test.message",
      params: JSON.stringify({ amount: 50000 }),
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.title).toBe("notifications.test.title");
    expect(result.message).toBe("notifications.test.message");
  });

  it("preserves id, type, and createdAt from the stored notification", () => {
    const n = makeNotification({
      id: "nf-99" as NotificationId,
      type: "goal_milestone",
      goalId: "g1",
      createdAt: "2026-03-20T10:00:00.000Z" as IsoDateTime,
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.id).toBe("nf-99");
    expect(result.type).toBe("goal_milestone");
    expect(result.createdAt).toBe("2026-03-20T10:00:00.000Z");
  });

  it("falls back to 'other' category visuals when categoryId is null for spending_anomaly", () => {
    const n = makeNotification({
      type: "spending_anomaly",
      categoryId: null,
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("ellipsis");
    expect(result.iconColor).toBe("#B8A9D4");
    expect(result.iconBgColor).toBe("#F3E5F5");
  });

  it("defaults budget_alert with no params to threshold 100 visuals", () => {
    const n = makeNotification({
      type: "budget_alert",
      params: null,
    });
    const result = deriveNotificationDisplay(n, mockT);
    expect(result.iconName).toBe("circle-x");
    expect(result.iconColor).toBe("#D45B5B");
  });
});

// ---------------------------------------------------------------------------
// groupNotificationsBySection
// ---------------------------------------------------------------------------

describe("groupNotificationsBySection", () => {
  const Today = new Date("2026-03-18T12:00:00.000Z"); // Wednesday

  const makeDisplay = (overrides: Partial<NotificationDisplay> = {}): NotificationDisplay => ({
    id: "nf-1" as NotificationId,
    type: "budget_alert",
    title: "Title",
    message: "Message",
    iconName: "triangle-alert",
    iconColor: "#F57C00",
    iconBgColor: "#FFF3E0",
    route: null,
    createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
    ...overrides,
  });

  it("returns empty array for empty input", () => {
    const result = groupNotificationsBySection([], Today, mockT);
    expect(result).toEqual([]);
  });

  it("groups spending_anomaly from current week into weekly moves section", () => {
    const display = makeDisplay({
      type: "spending_anomaly",
      createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([display], Today, mockT);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("notifications.weeklyMovesHeader");
    expect(result[0].notifications).toHaveLength(1);
  });

  it("groups budget_pace from current week into weekly moves section", () => {
    const display = makeDisplay({
      type: "budget_pace",
      createdAt: "2026-03-17T10:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([display], Today, mockT);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("notifications.weeklyMovesHeader");
  });

  it("groups budget_alert into EARLIER section", () => {
    const display = makeDisplay({
      type: "budget_alert",
      createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([display], Today, mockT);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("notifications.earlierHeader");
  });

  it("groups goal_milestone into EARLIER section", () => {
    const display = makeDisplay({
      type: "goal_milestone",
      createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([display], Today, mockT);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("notifications.earlierHeader");
  });

  it("groups spending_anomaly from prior week into EARLIER section", () => {
    const display = makeDisplay({
      type: "spending_anomaly",
      createdAt: "2026-03-10T12:00:00.000Z" as IsoDateTime, // prior week
    });
    const result = groupNotificationsBySection([display], Today, mockT);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("notifications.earlierHeader");
  });

  it("creates both sections when applicable, weekly moves first", () => {
    const weeklyMove = makeDisplay({
      id: "nf-1" as NotificationId,
      type: "spending_anomaly",
      createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
    });
    const earlier = makeDisplay({
      id: "nf-2" as NotificationId,
      type: "budget_alert",
      createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([weeklyMove, earlier], Today, mockT);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe("notifications.weeklyMovesHeader");
    expect(result[1].label).toBe("notifications.earlierHeader");
  });

  it("sorts notifications within each section by createdAt DESC", () => {
    const older = makeDisplay({
      id: "nf-1" as NotificationId,
      type: "spending_anomaly",
      createdAt: "2026-03-17T08:00:00.000Z" as IsoDateTime,
    });
    const newer = makeDisplay({
      id: "nf-2" as NotificationId,
      type: "budget_pace",
      createdAt: "2026-03-18T14:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([older, newer], Today, mockT);
    expect(result[0].notifications[0].id).toBe("nf-2");
    expect(result[0].notifications[1].id).toBe("nf-1");
  });

  it("omits weekly moves section when no qualifying notifications exist", () => {
    const display = makeDisplay({
      type: "budget_alert",
      createdAt: "2026-03-15T12:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([display], Today, mockT);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("notifications.earlierHeader");
  });

  it("formats week range as 'Mar 16–22' for the week of March 16-22", () => {
    const display = makeDisplay({
      type: "spending_anomaly",
      createdAt: "2026-03-18T12:00:00.000Z" as IsoDateTime,
    });
    const result = groupNotificationsBySection([display], Today, mockT);
    expect(result[0].label).toBe("notifications.weeklyMovesHeader");
  });
});

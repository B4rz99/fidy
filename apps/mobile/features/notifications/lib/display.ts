import { endOfWeek, format, isWithinInterval, startOfWeek } from "date-fns";
import type { CategoryId } from "@/shared/types/branded";
import type { NotificationDisplay, NotificationSection, StoredNotification } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ICON_NAMES: Record<string, string> = {
  food: "utensils",
  transport: "car",
  entertainment: "clapperboard",
  health: "heart-pulse",
  education: "graduation-cap",
  home: "house",
  clothing: "shirt",
  services: "wrench",
  transfer: "arrow-left-right",
  other: "ellipsis",
};

const CATEGORY_CHART_COLORS: Record<string, string> = {
  food: "#7CB243",
  transport: "#E8A090",
  entertainment: "#F5C842",
  health: "#E06060",
  education: "#5B9BD5",
  home: "#8BBAE8",
  clothing: "#1A1A1A",
  services: "#F0A04B",
  transfer: "#6DC4B0",
  other: "#B8A9D4",
};

const CATEGORY_BG_COLORS: Record<string, string> = {
  food: "#E8F5E9",
  transport: "#FFF0ED",
  entertainment: "#FFFDE7",
  health: "#FFEBEE",
  education: "#E3F2FD",
  home: "#E3F2FD",
  clothing: "#F5F5F5",
  services: "#FFF3E0",
  transfer: "#E0F2F1",
  other: "#F3E5F5",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

const parseParams = (params: string | null): Record<string, unknown> => {
  if (!params) return {};
  try {
    return JSON.parse(params) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const getCategoryVisuals = (categoryId: CategoryId | null) => {
  const key = categoryId ?? "other";
  return {
    iconName: CATEGORY_ICON_NAMES[key] ?? CATEGORY_ICON_NAMES.other,
    iconColor: CATEGORY_CHART_COLORS[key] ?? CATEGORY_CHART_COLORS.other,
    iconBgColor: CATEGORY_BG_COLORS[key] ?? CATEGORY_BG_COLORS.other,
  };
};

// ---------------------------------------------------------------------------
// deriveNotificationDisplay
// ---------------------------------------------------------------------------

const resolveBudgetAlert = (parsed: Record<string, unknown>) => {
  const threshold = parsed.threshold as number | undefined;
  return threshold === 80
    ? { iconName: "triangle-alert", iconColor: "#F57C00", iconBgColor: "#FFF3E0" }
    : { iconName: "circle-x", iconColor: "#D45B5B", iconBgColor: "#FFEBEE" };
};

export const deriveNotificationDisplay = (
  notification: StoredNotification,
  t: TranslationFn
): NotificationDisplay => {
  const parsed = parseParams(notification.params);

  const visual = (() => {
    switch (notification.type) {
      case "budget_alert":
        return {
          ...resolveBudgetAlert(parsed),
          route: "/(tabs)/(finance)" as string | null,
        };
      case "spending_anomaly":
        return {
          ...getCategoryVisuals(notification.categoryId),
          route: `/search?category=${notification.categoryId ?? "other"}` as string | null,
        };
      case "budget_pace":
        return {
          ...getCategoryVisuals(notification.categoryId),
          route: "/(tabs)/(finance)" as string | null,
        };
      case "goal_milestone":
        return {
          iconName: "trophy",
          iconColor: "#7CB243",
          iconBgColor: "#E8F5E9",
          route: notification.goalId
            ? (`/goal-detail?id=${notification.goalId}` as string | null)
            : null,
        };
    }
  })();

  return {
    id: notification.id,
    type: notification.type,
    title: t(notification.titleKey, parsed),
    message: t(notification.messageKey, parsed),
    iconName: visual.iconName,
    iconColor: visual.iconColor,
    iconBgColor: visual.iconBgColor,
    route: visual.route,
    createdAt: notification.createdAt,
  };
};

// ---------------------------------------------------------------------------
// groupNotificationsBySection
// ---------------------------------------------------------------------------

const WEEKLY_MOVE_TYPES = new Set(["spending_anomaly", "budget_pace"]);

const sortByCreatedAtDesc = (
  notifications: readonly NotificationDisplay[]
): readonly NotificationDisplay[] =>
  [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

export const groupNotificationsBySection = (
  notifications: readonly NotificationDisplay[],
  today: Date,
  t: TranslationFn
): readonly NotificationSection[] => {
  if (notifications.length === 0) return [];

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const isCurrentWeekMove = (n: NotificationDisplay): boolean =>
    WEEKLY_MOVE_TYPES.has(n.type) &&
    isWithinInterval(new Date(n.createdAt), { start: weekStart, end: weekEnd });

  const weeklyMoves = notifications.filter(isCurrentWeekMove);
  const earlier = notifications.filter((n) => !isCurrentWeekMove(n));

  const startLabel = format(weekStart, "MMM d");
  const endLabel = format(weekEnd, "d");
  const weekRange = `${startLabel}\u2013${endLabel}`;

  const sections: readonly NotificationSection[] = [
    ...(weeklyMoves.length > 0
      ? [
          {
            label: t("notifications.weeklyMovesHeader", { weekRange }),
            notifications: sortByCreatedAtDesc(weeklyMoves),
          },
        ]
      : []),
    ...(earlier.length > 0
      ? [
          {
            label: t("notifications.earlierHeader"),
            notifications: sortByCreatedAtDesc(earlier),
          },
        ]
      : []),
  ];

  return sections;
};

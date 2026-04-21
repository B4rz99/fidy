import { endOfWeek, format, isWithinInterval, startOfWeek } from "date-fns";
import type { CategoryId } from "@/shared/types/branded";
import type { NotificationDisplay, NotificationSection, StoredNotification } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type CategoryVisuals = {
  readonly iconName: string;
  readonly iconColor: string;
  readonly iconBgColor: string;
};

const DEFAULT_CATEGORY_VISUALS: CategoryVisuals = {
  iconName: "ellipsis",
  iconColor: "#B8A9D4",
  iconBgColor: "#F3E5F5",
};

const CATEGORY_VISUALS: Record<string, CategoryVisuals> = {
  food: {
    iconName: "utensils",
    iconColor: "#7CB243",
    iconBgColor: "#E8F5E9",
  },
  transport: {
    iconName: "car",
    iconColor: "#E8A090",
    iconBgColor: "#FFF0ED",
  },
  entertainment: {
    iconName: "clapperboard",
    iconColor: "#F5C842",
    iconBgColor: "#FFFDE7",
  },
  health: {
    iconName: "heart-pulse",
    iconColor: "#E06060",
    iconBgColor: "#FFEBEE",
  },
  education: {
    iconName: "graduation-cap",
    iconColor: "#5B9BD5",
    iconBgColor: "#E3F2FD",
  },
  home: {
    iconName: "house",
    iconColor: "#8BBAE8",
    iconBgColor: "#E3F2FD",
  },
  clothing: {
    iconName: "shirt",
    iconColor: "#1A1A1A",
    iconBgColor: "#F5F5F5",
  },
  services: {
    iconName: "wrench",
    iconColor: "#F0A04B",
    iconBgColor: "#FFF3E0",
  },
  transfer: {
    iconName: "arrow-left-right",
    iconColor: "#6DC4B0",
    iconBgColor: "#E0F2F1",
  },
  other: DEFAULT_CATEGORY_VISUALS,
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

const getCategoryVisuals = (categoryId: CategoryId | null): CategoryVisuals =>
  CATEGORY_VISUALS[categoryId ?? "other"] ?? DEFAULT_CATEGORY_VISUALS;

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
          route: `/search?categoryId=${notification.categoryId ?? "other"}` as string | null,
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
            ? (`/goal-detail?goalId=${notification.goalId}` as string | null)
            : null,
        };
      default:
        return { iconName: "bell", iconColor: "#1A1A1A", iconBgColor: "#F5F5F5", route: null };
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

  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startLabel = format(weekStart, "MMM d");
  const endLabel = sameMonth ? format(weekEnd, "d") : format(weekEnd, "MMM d");
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

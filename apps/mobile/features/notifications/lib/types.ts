import type { CategoryId, IsoDateTime, NotificationId, UserId } from "@/shared/types/branded";

export type NotificationType =
  | "budget_alert"
  | "goal_milestone"
  | "spending_anomaly"
  | "budget_pace";

export type StoredNotification = {
  readonly id: NotificationId;
  readonly userId: UserId;
  readonly type: NotificationType;
  readonly dedupKey: string;
  readonly categoryId: CategoryId | null;
  readonly goalId: string | null;
  readonly titleKey: string;
  readonly messageKey: string;
  readonly params: string | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
};

export type NotificationDisplay = {
  readonly id: NotificationId;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly iconName: string;
  readonly iconColor: string;
  readonly iconBgColor: string;
  readonly route: string | null;
  readonly createdAt: IsoDateTime;
};

export type NotificationSection = {
  readonly label: string;
  readonly notifications: readonly NotificationDisplay[];
};

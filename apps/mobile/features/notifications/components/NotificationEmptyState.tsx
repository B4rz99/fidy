import { EmptyState } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

type NotificationEmptyStateProps = {
  readonly titleKey?: string;
};

export const NotificationEmptyState = ({
  titleKey = "notifications.emptyTitle",
}: NotificationEmptyStateProps) => {
  const { t } = useTranslation();

  return <EmptyState title={t(titleKey)} className="px-6" />;
};

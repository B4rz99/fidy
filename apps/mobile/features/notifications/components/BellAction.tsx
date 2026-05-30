import { useRouter } from "expo-router";
import { IconActionButton } from "@/shared/components/IconActionButton";
import { Bell } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useNotificationStore } from "../store";

export const BellAction = () => {
  const { push } = useRouter();
  const { t } = useTranslation();
  const iconColor = useThemeColor("primary");
  const newCount = useNotificationStore((s) => s.newCount);
  const badgeLabel = newCount > 0 ? (newCount > 99 ? "99+" : String(newCount)) : undefined;

  return (
    <IconActionButton
      accessibilityLabel={t("notifications.title")}
      badgeLabel={badgeLabel}
      icon={<Bell size={24} color={iconColor} />}
      onPress={() => push("/notifications" as never)}
    />
  );
};

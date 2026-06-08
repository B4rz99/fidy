import { IconActionButton } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function NewChatButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const iconColor = useThemeColor("primary");

  return (
    <IconActionButton
      onPress={onPress}
      accessibilityLabel={t("aiChat.newChat")}
      icon={<Plus size={24} color={iconColor} />}
      tone="surface"
      size="size-10"
    />
  );
}

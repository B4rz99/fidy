import { Plus } from "@/shared/components/icons";
import { Pressable } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function NewChatButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const iconColor = useThemeColor("primary");

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t("aiChat.newChat")}
    >
      <Plus size={24} color={iconColor} />
    </Pressable>
  );
}

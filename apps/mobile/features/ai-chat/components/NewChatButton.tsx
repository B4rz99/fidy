import { AddActionButton, IconActionButton } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type NewChatButtonProps = {
  readonly onPress: () => void;
  readonly presentation?: "glass" | "plain";
};

export function NewChatButton({ onPress, presentation = "glass" }: NewChatButtonProps) {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const accessibilityLabel = t("aiChat.newChat");

  if (presentation === "glass") {
    return <AddActionButton onPress={onPress} accessibilityLabel={accessibilityLabel} />;
  }

  return (
    <IconActionButton
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      icon={<Plus size={24} color={primaryColor} />}
      size="size-9"
    />
  );
}

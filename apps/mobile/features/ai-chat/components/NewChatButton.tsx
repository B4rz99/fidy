import { AddActionButton } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

export function NewChatButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();

  return <AddActionButton onPress={onPress} accessibilityLabel={t("aiChat.newChat")} />;
}

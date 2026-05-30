import { Button, Card } from "@/shared/components";
import { Trash2 } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { ChatAction } from "../schema";
import { useAiSupportTextColor } from "./use-ai-support-text-color";

type ActionCardProps = {
  readonly action: ChatAction;
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
};

export function ActionCard({ action, onConfirm, onDismiss }: ActionCardProps) {
  const { t } = useTranslation();
  const supportTextColor = useAiSupportTextColor();
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");

  if (action.type !== "delete") return null;

  return (
    <Card
      padded={false}
      style={{
        borderRadius: 18,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: borderSubtle,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Trash2 size={20} color={accentRed} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {t("aiChat.actions.deleteTransaction")}
          </Text>
          <Text className="font-poppins-medium text-label" style={{ color: supportTextColor }}>
            {formatMoney(action.amount)} - {action.description}
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: supportTextColor }}>
            {action.date}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label={t("common.cancel")}
          onPress={onDismiss}
          variant="secondary"
          size="compact"
          className="h-9 flex-1 bg-page dark:bg-page-dark"
        />
        <Button
          label={t("common.delete")}
          onPress={onConfirm}
          variant="danger"
          size="compact"
          className="h-9 flex-1"
        />
      </View>
    </Card>
  );
}

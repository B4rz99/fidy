import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay } from "@/shared/lib";
import { styles } from "./GoalForm.styles";

type GoalAmountFieldProps = {
  readonly digits: string;
  readonly onPress: () => void;
};

export function GoalAmountField({ digits, onPress }: GoalAmountFieldProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const displayAmount = formatInputDisplay(digits);

  return (
    <Pressable
      accessibilityLabel={t("goals.create.targetAmount")}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.amountPressTarget}
    >
      <Text numberOfLines={1} style={[styles.amountText, { color: primary }]}>
        {displayAmount}
      </Text>
    </Pressable>
  );
}

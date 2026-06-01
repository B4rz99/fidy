import { MoneyAmountDisplay } from "@/shared/components";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalFormCursorStyle } from "./useGoalForm";

type GoalAmountFieldProps = {
  readonly cursorStyle: GoalFormCursorStyle;
  readonly digits: string;
  readonly isAmountActive: boolean;
  readonly onPress: () => void;
};

export function GoalAmountField({
  cursorStyle,
  digits,
  isAmountActive,
  onPress,
}: GoalAmountFieldProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");

  return (
    <MoneyAmountDisplay
      accessibilityLabel={t("goals.create.targetAmount")}
      color={primary}
      cursorStyle={cursorStyle}
      cursorVisible={isAmountActive}
      digits={digits}
      onPress={onPress}
      size="hero"
    />
  );
}

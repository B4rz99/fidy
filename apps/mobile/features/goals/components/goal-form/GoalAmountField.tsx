import { FieldButton, MoneyAmountDisplay } from "@/shared/components";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalFormCursorStyle } from "./useGoalForm";

type GoalAmountFieldProps = {
  readonly cursorStyle: GoalFormCursorStyle;
  readonly digits: string;
  readonly hideLabel?: boolean;
  readonly isAmountActive: boolean;
  readonly onPress: () => void;
  readonly size?: "medium" | "large" | "hero";
};

export function GoalAmountField({
  cursorStyle,
  digits,
  hideLabel = false,
  isAmountActive,
  onPress,
  size = "medium",
}: GoalAmountFieldProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const amountDisplay = (
    <MoneyAmountDisplay
      color={primary}
      cursorStyle={cursorStyle}
      cursorVisible={isAmountActive}
      digits={digits}
      onPress={hideLabel ? onPress : undefined}
      size={size}
    />
  );

  if (hideLabel) return amountDisplay;

  return (
    <FieldButton
      label={hideLabel ? undefined : t("goals.create.targetAmount")}
      onPress={onPress}
      active={isAmountActive}
      buttonStyle={{
        justifyContent: "center",
        borderColor: "transparent",
        backgroundColor: "transparent",
        paddingVertical: 2,
      }}
      value={amountDisplay}
    />
  );
}

import { FieldButton, MoneyAmountDisplay } from "@/shared/components";
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
    <FieldButton
      label={t("goals.create.targetAmount")}
      onPress={onPress}
      active={isAmountActive}
      buttonStyle={{
        justifyContent: "center",
        borderColor: "transparent",
        backgroundColor: "transparent",
        paddingVertical: 2,
      }}
      value={
        <MoneyAmountDisplay
          color={primary}
          cursorStyle={cursorStyle}
          cursorVisible={isAmountActive}
          digits={digits}
          size="medium"
        />
      }
    />
  );
}

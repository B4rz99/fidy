import Animated from "react-native-reanimated";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./GoalSheet.styles";
import type { GoalSheetCursorStyle } from "./useGoalSheetForm";

type GoalAmountFieldProps = {
  readonly cursorStyle: GoalSheetCursorStyle;
  readonly displayAmount: string;
  readonly isAmountActive: boolean;
  readonly onPress: () => void;
};

export function GoalAmountField({
  cursorStyle,
  displayAmount,
  isAmountActive,
  onPress,
}: GoalAmountFieldProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");

  return (
    <Pressable style={styles.amountSection} onPress={onPress}>
      <Text style={[styles.fieldLabel, { color: primary }]}>{t("goals.create.targetAmount")}</Text>
      <View style={styles.amountRow}>
        <Text style={[styles.amountDisplay, { color: primary }]}>{displayAmount}</Text>
        {isAmountActive ? (
          <Animated.View style={[styles.cursor, { backgroundColor: primary }, cursorStyle]} />
        ) : null}
      </View>
    </Pressable>
  );
}

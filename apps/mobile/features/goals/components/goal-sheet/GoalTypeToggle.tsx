import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalType } from "../../schema";
import { styles } from "./GoalSheet.styles";

type GoalTypeToggleProps = {
  readonly goalType: GoalType;
  readonly onChange: (goalType: GoalType) => void;
};

type GoalTypeButtonProps = {
  readonly goalType: GoalType;
  readonly isActive: boolean;
  readonly label: string;
  readonly onPress: (goalType: GoalType) => void;
};

function GoalTypeButton({ goalType, isActive, label, onPress }: GoalTypeButtonProps) {
  const card = useThemeColor("card");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");
  const activeColor = goalType === "debt" ? accentRed : accentGreen;
  const buttonStyle = [
    styles.toggleButton,
    isActive
      ? { backgroundColor: activeColor }
      : { backgroundColor: card, borderColor: borderSubtle, borderWidth: 1 },
  ];
  const textColor = isActive ? "#FFFFFF" : secondary;

  return (
    <Pressable style={buttonStyle} onPress={() => onPress(goalType)}>
      <Text style={[styles.toggleText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function GoalTypeToggle({ goalType, onChange }: GoalTypeToggleProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.toggleRow}>
      <GoalTypeButton
        goalType="savings"
        isActive={goalType === "savings"}
        label={t("goals.create.typeSavings")}
        onPress={onChange}
      />
      <GoalTypeButton
        goalType="debt"
        isActive={goalType === "debt"}
        label={t("goals.create.typeDebt")}
        onPress={onChange}
      />
    </View>
  );
}

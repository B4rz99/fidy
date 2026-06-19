import { router } from "expo-router";
import type { PressableProps } from "react-native";
import { ChevronLeft } from "@/shared/components/icons";
import { Pressable, StyleSheet } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type HeaderBackButtonProps = Partial<Pick<PressableProps, "onPress">>;

export function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={12}
      onPress={onPress ?? router.back}
      style={styles.backButton}
    >
      <ChevronLeft size={24} color={primaryColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});

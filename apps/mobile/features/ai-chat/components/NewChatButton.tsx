import { Plus } from "@/shared/components/icons";
import { GlassPressable } from "@/shared/components";
import { StyleSheet } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function NewChatButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const iconColor = useThemeColor("primary");

  return (
    <GlassPressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t("aiChat.newChat")}
      radius={20}
      surfaceStyle={styles.surface}
    >
      <Plus size={24} color={iconColor} />
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});

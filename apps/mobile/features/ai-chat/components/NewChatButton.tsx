import { Plus } from "@/shared/components/icons";
import { GlassSurface } from "@/shared/components";
import { Pressable, StyleSheet } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function NewChatButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const iconColor = useThemeColor("primary");

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t("aiChat.newChat")}
    >
      <GlassSurface padded={false} style={styles.surface}>
        <Plus size={24} color={iconColor} />
      </GlassSurface>
    </Pressable>
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

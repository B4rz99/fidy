import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function SheetCancelButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <Pressable
      style={{
        alignItems: "center",
        borderRadius: 16,
        backgroundColor: card,
        borderWidth: 1,
        borderColor: borderSubtle,
        paddingVertical: 14,
      }}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={{ color: secondary, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
        {t("common.cancel")}
      </Text>
    </Pressable>
  );
}

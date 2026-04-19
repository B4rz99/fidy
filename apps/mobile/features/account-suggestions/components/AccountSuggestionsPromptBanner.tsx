import { ChevronRight, Sparkles } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type AccountSuggestionsPromptBannerProps = {
  readonly count: number;
  readonly onPress: () => void;
};

export function AccountSuggestionsPromptBanner({
  count,
  onPress,
}: AccountSuggestionsPromptBannerProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  if (count === 0) {
    return null;
  }

  return (
    <Pressable style={[styles.container, { backgroundColor: accentGreenLight }]} onPress={onPress}>
      <View style={styles.content}>
        <Sparkles size={18} color={accentGreen} />
        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: primary }]}>
            {t("accountSuggestions.prompt.count", { count })}
          </Text>
          <Text style={[styles.subtitle, { color: secondary }]}>
            {t("accountSuggestions.prompt.subtitle")}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 16,
  },
});

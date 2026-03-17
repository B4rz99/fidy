import { useMemo } from "react";
import { Sparkles } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type StarterSuggestionsProps = {
  readonly onSelect: (text: string) => void;
};

export function StarterSuggestions({ onSelect }: StarterSuggestionsProps) {
  const { t, locale } = useTranslation();
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentGreen = useThemeColor("accentGreen");
  const borderSubtle = useThemeColor("borderSubtle");
  // biome-ignore lint/correctness/useExhaustiveDependencies: locale triggers recompute when language changes
  const suggestions = useMemo(
    () => [
      t("aiChat.suggestions.monthSpending"),
      t("aiChat.suggestions.biggestExpense"),
      t("aiChat.suggestions.compareMonths"),
      t("aiChat.suggestions.addExpense"),
    ],
    [t, locale]
  );

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        gap: 24,
      }}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: accentGreenLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={24} color={accentGreen} />
        </View>
        <Text className="font-poppins-bold text-title text-primary dark:text-primary-dark">
          {t("aiChat.fidyAi")}
        </Text>
        <Text className="font-poppins-medium text-body text-tertiary dark:text-tertiary-dark text-center">
          {t("aiChat.askAnything")}
        </Text>
      </View>
      <View style={{ width: "100%", gap: 10 }}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => onSelect(suggestion)}
            className="bg-peach-light dark:bg-peach-light-dark"
            style={{
              borderRadius: 24,
              borderWidth: 1,
              borderColor: borderSubtle,
              paddingVertical: 12,
              paddingHorizontal: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="font-poppins-medium text-label text-primary dark:text-primary-dark">
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

import { useMemo } from "react";
import { GlassPressable } from "@/shared/components";
import { ChevronRight } from "@/shared/components/icons";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { useAiSupportTextColor } from "./use-ai-support-text-color";

type StarterSuggestionsProps = {
  readonly onSelect: (text: string) => void;
};

export function StarterSuggestions({ onSelect }: StarterSuggestionsProps) {
  const { t } = useTranslation();
  const supportTextColor = useAiSupportTextColor();
  const suggestions = useMemo(
    () => [
      t("aiChat.suggestions.monthSpending"),
      t("aiChat.suggestions.biggestExpense"),
      t("aiChat.suggestions.compareMonths"),
      t("aiChat.suggestions.addExpense"),
    ],
    [t]
  );

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 180,
        gap: 44,
      }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: 12 }}>
        <Text
          className="font-poppins-semibold text-caption uppercase"
          style={{ color: supportTextColor }}
        >
          {t("aiChat.concierge.label")}
        </Text>
        <Text
          className="font-poppins-bold text-primary dark:text-primary-dark"
          style={{ fontSize: 32, lineHeight: 38 }}
        >
          {t("aiChat.concierge.title")}
        </Text>
        <Text
          className="font-poppins-medium text-body"
          style={{ color: supportTextColor, lineHeight: 22, maxWidth: 320 }}
        >
          {t("aiChat.concierge.subtitle")}
        </Text>
      </View>
      <View style={{ width: "100%", gap: 10 }}>
        {suggestions.map((suggestion) => (
          <GlassPressable
            key={suggestion}
            onPress={() => onSelect(suggestion)}
            radius={18}
            surfaceStyle={styles.suggestionButton}
          >
            <Text
              className="font-poppins-semibold text-label text-primary dark:text-primary-dark"
              style={{ flex: 1 }}
            >
              {suggestion}
            </Text>
            <ChevronRight size={18} color={supportTextColor} />
          </GlassPressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  suggestionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});

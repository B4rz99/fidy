import { useRouter } from "expo-router";
import { useState } from "react";
import { useBudgetStore } from "@/features/budget";
import { CATEGORY_MAP, formatCents } from "@/features/transactions";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";

export default function AutoSuggestBudgetsScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);
  const acceptSuggestions = useBudgetStore((s) => s.acceptSuggestions);

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(autoSuggestions.map((s) => s.categoryId))
  );

  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  const handleToggle = (categoryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleAccept = () =>
    guardedRun(async () => {
      const ids = Array.from(selectedIds);
      if (ids.length > 0) {
        await acceptSuggestions(ids);
      }
      router.back();
    });

  const handleSkip = () => {
    router.back();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={[styles.title, { color: primaryColor }]}>{t("budgets.autoSuggest.title")}</Text>
      <Text style={[styles.subtitle, { color: secondaryColor }]}>
        {t("budgets.autoSuggest.subtitle")}
      </Text>

      <View style={styles.list}>
        {autoSuggestions.map((suggestion) => {
          const category = CATEGORY_MAP[suggestion.categoryId];
          const CategoryIcon = category?.icon;
          const categoryLabel = category
            ? getCategoryLabel(category, locale)
            : suggestion.categoryId;
          const isSelected = selectedIds.has(suggestion.categoryId);

          return (
            <View key={suggestion.categoryId} style={[styles.row, { borderColor }]}>
              <View style={styles.rowLeft}>
                {CategoryIcon && <CategoryIcon size={18} color={category?.color ?? primaryColor} />}
                <View>
                  <Text style={[styles.categoryName, { color: primaryColor }]}>
                    {categoryLabel}
                  </Text>
                  <Text style={[styles.suggestedAmount, { color: secondaryColor }]}>
                    {formatCents(suggestion.suggestedAmountCents)}
                  </Text>
                </View>
              </View>
              <Switch
                value={isSelected}
                onValueChange={() => handleToggle(suggestion.categoryId)}
                trackColor={{ true: accentGreen }}
              />
            </View>
          );
        })}
      </View>

      {autoSuggestions.length === 0 && (
        <Text style={[styles.emptyText, { color: secondaryColor }]}>
          {t("budgets.upcomingBills.noBills")}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.acceptButton, { backgroundColor: accentGreen, opacity: isBusy ? 0.5 : 1 }]}
          onPress={handleAccept}
          disabled={isBusy}
        >
          <Text style={styles.acceptButtonText}>{t("budgets.autoSuggest.acceptSelected")}</Text>
        </Pressable>
        <Pressable onPress={handleSkip}>
          <Text style={[styles.skipText, { color: secondaryColor }]}>
            {t("budgets.autoSuggest.skipAll")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  list: {
    gap: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  suggestedAmount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },
  actions: {
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  acceptButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    alignSelf: "stretch",
  },
  acceptButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  skipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
});

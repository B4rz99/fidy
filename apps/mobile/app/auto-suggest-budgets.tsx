import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useBudgetStore } from "@/features/budget";
import { CATEGORY_MAP, formatCents } from "@/features/transactions";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";

function Toggle({
  value,
  onValueChange,
}: {
  value?: boolean;
  onValueChange?: (v: boolean) => void;
}) {
  const accentGreen = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");
  const isOn = value === true;
  const progress = useSharedValue(isOn ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(isOn ? 1 : 0, { duration: 200 }));
  }, [isOn, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.get() > 0.5 ? accentGreen : tertiaryColor,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * 20 }],
  }));

  return (
    <Pressable onPress={() => onValueChange?.(!isOn)}>
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleKnob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

export default function AutoSuggestBudgetsScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);
  const acceptSuggestions = useBudgetStore((s) => s.acceptSuggestions);

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(autoSuggestions.map((s) => s.categoryId))
  );
  const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        autoSuggestions.map((s) => [s.categoryId, String(s.suggestedAmountCents / 100)])
      )
  );

  useEffect(() => {
    setSelectedIds(new Set(autoSuggestions.map((s) => s.categoryId)));
    setEditedAmounts(
      Object.fromEntries(
        autoSuggestions.map((s) => [s.categoryId, String(s.suggestedAmountCents / 100)])
      )
    );
  }, [autoSuggestions]);

  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const pageBg = useThemeColor("page");

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

  const handleAmountChange = (categoryId: string, value: string) => {
    setEditedAmounts((prev) => ({ ...prev, [categoryId]: value }));
  };

  const handleAccept = () =>
    guardedRun(async () => {
      const budgets = new Map<string, number>();
      selectedIds.forEach((categoryId) => {
        const raw = editedAmounts[categoryId] ?? "0";
        const cents = Math.round(parseFloat(raw.replace(",", ".")) * 100);
        if (!Number.isNaN(cents) && cents > 0) {
          budgets.set(categoryId, cents);
        }
      });
      if (budgets.size > 0) {
        await acceptSuggestions(budgets);
      }
      router.back();
    });

  const handleSkip = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: cardBg }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("budgets.autoSuggest.title")}
        </Text>
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
                    <Text style={[styles.lastMonthLabel, { color: secondaryColor }]}>
                      {formatCents(suggestion.suggestedAmountCents)} {t("search.lastMonth").toLowerCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <TextInput
                    style={[
                      styles.amountInput,
                      {
                        backgroundColor: isSelected ? pageBg : pageBg,
                        color: isSelected ? primaryColor : secondaryColor,
                        borderColor,
                        opacity: isSelected ? 1 : 0.4,
                      },
                    ]}
                    value={editedAmounts[suggestion.categoryId] ?? ""}
                    onChangeText={(v) => handleAmountChange(suggestion.categoryId, v)}
                    keyboardType="decimal-pad"
                    editable={isSelected}
                    selectTextOnFocus
                  />
                  <Toggle
                    value={isSelected}
                    onValueChange={() => handleToggle(suggestion.categoryId)}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {autoSuggestions.length === 0 && (
          <Text style={[styles.emptyText, { color: secondaryColor }]}>
            {t("budgets.autoSuggest.noSuggestions")}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  lastMonthLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
  },
  amountInput: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 64,
    textAlign: "right",
    minHeight: 36,
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
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
});

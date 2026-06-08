import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import {
  acceptBudgetSuggestions,
  useBudgetStore,
  useSuggestionSelection,
} from "@/features/budget/hooks.public";
import { CATEGORY_MAP } from "@/features/transactions";
import { AppAuroraBackground, FormTextField } from "@/shared/components";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { trackBudgetSuggestionAccepted, trackBudgetSuggestionRejected } from "@/shared/lib";

export default function AutoSuggestBudgetsScreen() {
  const { back } = useRouter();
  const { t, locale } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);

  const { selectedIds, editedAmounts, handleToggle, handleAmountChange, buildBudgetMap } =
    useSuggestionSelection(autoSuggestions);

  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  const handleAccept = () => {
    void guardedRun(async () => {
      const budgets = buildBudgetMap();
      if (budgets.size > 0) {
        if (!userId || !db) return;
        const success = await acceptBudgetSuggestions(db, userId, budgets);
        if (!success) return;
        trackBudgetSuggestionAccepted({ count: budgets.size });
      } else {
        trackBudgetSuggestionRejected();
      }
      back();
    });
  };

  const handleSkip = () => {
    trackBudgetSuggestionRejected();
    back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AppAuroraBackground isDark={isDark} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 24 }]}
        contentInsetAdjustmentBehavior="automatic"
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
            const category = CATEGORY_MAP[suggestion.categoryId] ?? null;
            const categoryLabel = category
              ? getCategoryLabel(category, locale)
              : suggestion.categoryId;
            const isSelected = selectedIds.has(suggestion.categoryId);

            return (
              <View key={suggestion.categoryId} style={[styles.row, { borderColor }]}>
                <View style={styles.rowLeft}>
                  {category ? <Text style={{ color: category.color }}>{category.icon}</Text> : null}
                  <View>
                    <Text style={[styles.categoryName, { color: primaryColor }]}>
                      {categoryLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <FormTextField
                    label={categoryLabel}
                    labelStyle={{ display: "none" }}
                    style={{ gap: 0 }}
                    inputStyle={[
                      styles.amountInput,
                      {
                        color: isSelected ? primaryColor : secondaryColor,
                        borderColor,
                        opacity: isSelected ? 1 : 0.4,
                      },
                    ]}
                    value={editedAmounts[suggestion.categoryId] ?? ""}
                    onChangeText={(v) => handleAmountChange(suggestion.categoryId, v)}
                    keyboardType="number-pad"
                    editable={isSelected}
                    selectTextOnFocus
                  />
                  <Switch
                    value={isSelected}
                    onValueChange={() => handleToggle(suggestion.categoryId)}
                    trackColor={{ true: accentGreen }}
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
            style={[
              styles.acceptButton,
              { backgroundColor: accentGreen, opacity: isBusy ? 0.5 : 1 },
            ]}
            onPress={handleAccept}
            disabled={isBusy || ((userId == null || db == null) && selectedIds.size > 0)}
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
  flex: { flex: 1 },
  container: { flex: 1 },
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
});

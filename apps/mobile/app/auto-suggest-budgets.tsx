import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import {
  acceptBudgetSuggestions,
  loadBudgetAutoSuggestions,
  useBudgetStore,
  useSuggestionSelection,
} from "@/features/budget/hooks.public";
import { BudgetSuggestionRow } from "@/features/budget/ui.public";
import { AppAuroraBackground } from "@/shared/components";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import {
  useAsyncGuard,
  useColorScheme,
  useMountEffect,
  useThemeColor,
  useTranslation,
} from "@/shared/hooks";
import { trackBudgetSuggestionAccepted, trackBudgetSuggestionRejected } from "@/shared/lib";

export default function AutoSuggestBudgetsScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const autoSuggestions = useBudgetStore((s) => s.autoSuggestions);

  const { selectedIds, editedAmounts, handleToggle, handleAmountChange, buildBudgetMap } =
    useSuggestionSelection(autoSuggestions);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  useMountEffect(() => {
    if (!userId || !db) return;
    loadBudgetAutoSuggestions(db, userId);
  });

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
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
          headerTitle: t("budgets.autoSuggest.title"),
          title: t("budgets.autoSuggest.title"),
        }}
      />
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
            const isSelected = selectedIds.has(suggestion.categoryId);

            return (
              <BudgetSuggestionRow
                key={suggestion.categoryId}
                categoryId={suggestion.categoryId}
                value={editedAmounts[suggestion.categoryId] ?? ""}
                selected={isSelected}
                onAmountChange={handleAmountChange}
                onToggle={handleToggle}
              />
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

import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { ScreenLayout } from "@/shared/components";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import { useAccountSuggestions } from "../hooks/use-account-suggestions";
import { createAccountSuggestionService } from "../services/create-account-suggestion-service";
import { AccountSuggestionCard } from "./AccountSuggestionCard";

export function AccountSuggestionReviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { suggestions, hasLoadedSuggestions, reloadSuggestions } = useAccountSuggestions({
    db,
    userId,
  });
  const service = useMemo(() => createAccountSuggestionService(), []);
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const { run: guardedMutation } = useAsyncGuard();

  const handleCreate = (fingerprint: string) => {
    router.push({
      pathname: "/create-financial-account",
      params: { fingerprint },
    } as never);
  };

  const handleLink = (fingerprint: string) => {
    router.push({
      pathname: "/link-suggested-account",
      params: { fingerprint },
    } as never);
  };

  const handleSkip = (fingerprint: string) => {
    const suggestion = suggestions.find((item) => item.fingerprint === fingerprint);
    if (!db || !userId || !suggestion) {
      return;
    }

    void guardedMutation(async () => {
      try {
        service.dismissSuggestion({ db, userId, suggestion });
        reloadSuggestions();
      } catch {
        showErrorToast(t("accountSuggestions.review.dismissFailed"));
      }
    });
  };

  return (
    <ScreenLayout
      title={t("accountSuggestions.review.title")}
      variant="sub"
      onBack={() => router.back()}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("accountSuggestions.review.subtitle")}
        </Text>

        {hasLoadedSuggestions && suggestions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: primary }]}>
              {t("accountSuggestions.review.emptyTitle")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: secondary }]}>
              {t("accountSuggestions.review.emptySubtitle")}
            </Text>
          </View>
        ) : (
          suggestions.map((suggestion) => (
            <AccountSuggestionCard
              key={suggestion.fingerprint}
              suggestion={suggestion}
              onCreate={(item) => handleCreate(item.fingerprint)}
              onLink={(item) => handleLink(item.fingerprint)}
              onSkip={(item) => handleSkip(item.fingerprint)}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});

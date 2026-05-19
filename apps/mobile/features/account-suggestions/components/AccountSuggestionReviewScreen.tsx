import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { ScreenLayout } from "@/shared/components";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import { useAccountSuggestions } from "../hooks/use-account-suggestions";
import type { AccountCreationSuggestion } from "../lib/derive-account-suggestions";
import { createAccountSuggestionService } from "../services/create-account-suggestion-service";
import { AccountSuggestionCard } from "./AccountSuggestionCard";

const suggestionKeyExtractor = (item: AccountCreationSuggestion) => item.fingerprint;
const SuggestionItemSeparator = () => <View style={styles.itemSeparator} />;

export function AccountSuggestionReviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
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

  const handleCreate = useCallback(
    (fingerprint: string) => {
      router.push({
        pathname: "/create-financial-account",
        params: { fingerprint },
      } as never);
    },
    [router]
  );

  const handleLink = useCallback(
    (fingerprint: string) => {
      router.push({
        pathname: "/link-suggested-account",
        params: { fingerprint },
      } as never);
    },
    [router]
  );

  const handleSkip = useCallback(
    (fingerprint: string) => {
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
    },
    [db, guardedMutation, reloadSuggestions, service, suggestions, t, userId]
  );

  const handleCreateSuggestion = useCallback(
    (suggestion: AccountCreationSuggestion) => handleCreate(suggestion.fingerprint),
    [handleCreate]
  );

  const handleLinkSuggestion = useCallback(
    (suggestion: AccountCreationSuggestion) => handleLink(suggestion.fingerprint),
    [handleLink]
  );

  const handleSkipSuggestion = useCallback(
    (suggestion: AccountCreationSuggestion) => handleSkip(suggestion.fingerprint),
    [handleSkip]
  );

  const renderSuggestion = useCallback(
    ({ item }: ListRenderItemInfo<AccountCreationSuggestion>) => (
      <AccountSuggestionCard
        suggestion={item}
        onCreate={handleCreateSuggestion}
        onLink={handleLinkSuggestion}
        onSkip={handleSkipSuggestion}
      />
    ),
    [handleCreateSuggestion, handleLinkSuggestion, handleSkipSuggestion]
  );

  const listHeader = useMemo(
    () => (
      <Text style={[styles.subtitle, { color: secondary }]}>
        {t("accountSuggestions.review.subtitle")}
      </Text>
    ),
    [secondary, t]
  );

  const emptyState =
    hasLoadedSuggestions && suggestions.length === 0 ? (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: primary }]}>
          {t("accountSuggestions.review.emptyTitle")}
        </Text>
        <Text style={[styles.emptySubtitle, { color: secondary }]}>
          {t("accountSuggestions.review.emptySubtitle")}
        </Text>
      </View>
    ) : null;

  return (
    <ScreenLayout
      title={t("accountSuggestions.review.title")}
      variant="sub"
      onBack={() => router.back()}
    >
      <FlashList
        data={suggestions}
        renderItem={renderSuggestion}
        keyExtractor={suggestionKeyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ItemSeparatorComponent={SuggestionItemSeparator}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  itemSeparator: {
    height: 16,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
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

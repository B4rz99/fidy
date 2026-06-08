import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { getFinancialAccountsForUser } from "@/features/financial-accounts/public";
import { useOnboardingStore } from "@/features/onboarding/store.public";
import { EmptyState, ListRowSurface, ScreenLayout } from "@/shared/components";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import { useAccountSuggestions } from "../hooks/use-account-suggestions";
import { shouldAdvanceOnboardingAfterSuggestionMutation } from "../lib/onboarding-review";
import { rankSuggestedFinancialAccounts } from "../lib/presentation";
import { createAccountSuggestionService } from "../services/create-account-suggestion-service";

function AccountRow({
  name,
  subtitle,
  isLikelyMatch,
  onPress,
}: {
  readonly name: string;
  readonly subtitle: string;
  readonly isLikelyMatch: boolean;
  readonly onPress: () => void;
}) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  return (
    <ListRowSurface
      onPress={onPress}
      radius={16}
      selected={isLikelyMatch}
      selectedBorderColor={accentGreen}
      contentStyle={styles.accountRow}
    >
      <View style={styles.accountText}>
        <Text style={[styles.accountName, { color: primary }]}>{name}</Text>
        <Text style={[styles.accountSubtitle, { color: secondary }]}>{subtitle}</Text>
      </View>
    </ListRowSurface>
  );
}

export default function LinkSuggestedAccountScreen() {
  const { back } = useRouter();
  const { fingerprint } = useLocalSearchParams<{ fingerprint?: string }>();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const onboardingStep = useOnboardingStore((state) => state.step);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const { suggestions, hasLoadedSuggestions } = useAccountSuggestions({ db, userId });
  const service = useMemo(() => createAccountSuggestionService(), []);
  const secondary = useThemeColor("secondary");
  const { run: guardedLink } = useAsyncGuard();

  const hasFingerprint = typeof fingerprint === "string" && fingerprint.trim().length > 0;
  const suggestion = hasFingerprint
    ? (suggestions.find((item) => item.fingerprint === fingerprint) ?? null)
    : null;
  const rankedAccounts =
    db && userId && suggestion
      ? rankSuggestedFinancialAccounts(getFinancialAccountsForUser(db, userId), suggestion)
      : [];
  const likelyMatches = rankedAccounts.filter((item) => item.isLikelyMatch);
  const otherAccounts = rankedAccounts.filter((item) => !item.isLikelyMatch);

  const handleLink = (accountId: (typeof rankedAccounts)[number]["account"]["id"]) => {
    if (!db || !userId || !suggestion) {
      return;
    }

    void guardedLink(async () => {
      try {
        service.acceptSuggestion({
          db,
          userId,
          accountId,
          suggestion,
        });
        const remainingSuggestionCount = service.listSuggestions({
          db,
          userId,
        }).length;
        if (
          shouldAdvanceOnboardingAfterSuggestionMutation({
            onboardingStep,
            remainingSuggestionCount,
          })
        ) {
          nextStep();
        }
        back();
      } catch {
        showErrorToast(t("accountSuggestions.link.linkFailed"));
      }
    });
  };

  return (
    <ScreenLayout title={t("accountSuggestions.link.title")} variant="sub" onBack={back}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
      >
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("accountSuggestions.link.subtitle")}
        </Text>

        {(!hasFingerprint || hasLoadedSuggestions) && suggestion == null ? (
          <EmptyState title={t("accountSuggestions.review.emptyTitle")} className="py-12" />
        ) : (
          <>
            {likelyMatches.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: secondary }]}>
                  {t("accountSuggestions.link.likelyMatches")}
                </Text>
                {likelyMatches.map(({ account, isLikelyMatch }) => (
                  <AccountRow
                    key={account.id}
                    name={account.name}
                    subtitle={t(`financialAccounts.kinds.${account.kind}`)}
                    isLikelyMatch={isLikelyMatch}
                    onPress={() => handleLink(account.id)}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: secondary }]}>
                {t("accountSuggestions.link.allAccounts")}
              </Text>
              {(likelyMatches.length > 0 ? otherAccounts : rankedAccounts).map(({ account }) => (
                <AccountRow
                  key={account.id}
                  name={account.name}
                  subtitle={t(`financialAccounts.kinds.${account.kind}`)}
                  isLikelyMatch={false}
                  onPress={() => handleLink(account.id)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  accountRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accountText: {
    flex: 1,
    gap: 4,
  },
  accountName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  accountSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});

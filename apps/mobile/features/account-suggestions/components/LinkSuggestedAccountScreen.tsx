import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { getFinancialAccountsForUser } from "@/features/financial-accounts/public";
import { useOnboardingStore } from "@/features/onboarding/store";
import { ScreenLayout } from "@/shared/components";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
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
  const accentGreenLight = useThemeColor("accentGreenLight");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <Pressable
      style={[
        styles.accountRow,
        {
          backgroundColor: isLikelyMatch ? accentGreenLight : card,
          borderColor: borderSubtle,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.accountName, { color: primary }]}>{name}</Text>
      <Text style={[styles.accountSubtitle, { color: secondary }]}>{subtitle}</Text>
    </Pressable>
  );
}

export default function LinkSuggestedAccountScreen() {
  const { back } = useRouter();
  const { fingerprint } = useLocalSearchParams<{ fingerprint?: string }>();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const onboardingStep = useOnboardingStore((state) => state.step);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const { suggestions, hasLoadedSuggestions } = useAccountSuggestions({ db, userId });
  const service = useMemo(() => createAccountSuggestionService(), []);
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const { run: guardedLink } = useAsyncGuard();

  if (typeof fingerprint !== "string" || fingerprint.trim().length === 0) {
    return null;
  }

  const suggestion = suggestions.find((item) => item.fingerprint === fingerprint) ?? null;
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
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("accountSuggestions.link.subtitle")}
        </Text>

        {hasLoadedSuggestions && suggestion == null ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: primary }]}>
              {t("accountSuggestions.review.emptyTitle")}
            </Text>
          </View>
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
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
});

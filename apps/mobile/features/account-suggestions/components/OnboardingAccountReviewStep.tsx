import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { trackOnboardingEvent } from "@/features/onboarding/telemetry.public";
import { useOnboardingStore } from "@/features/onboarding/store.public";
import { Button, Card } from "@/shared/components";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useAccountSuggestions } from "../hooks/use-account-suggestions";
import { getDeferredSuggestionReviewState } from "../lib/onboarding-review";
import { AccountSuggestionCard } from "./AccountSuggestionCard";

export function OnboardingAccountReviewStep() {
  const { push } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const { suggestions } = useAccountSuggestions({
    db,
    userId,
    limit: 2,
  });
  const [deferredFingerprints, setDeferredFingerprints] = useState<readonly string[]>([]);
  const deferredFingerprintsRef = useRef<readonly string[]>([]);

  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  const visibleSuggestions = suggestions.filter(
    (suggestion) => !deferredFingerprints.includes(suggestion.fingerprint)
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: accentGreen }]}>
          {t("accountSuggestions.onboarding.eyebrow")}
        </Text>
        <Text style={[styles.title, { color: primary }]}>
          {t("accountSuggestions.onboarding.title")}
        </Text>
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("accountSuggestions.onboarding.subtitle")}
        </Text>

        <Card padded={false} radius={12} contentStyle={styles.noteBanner}>
          <Text style={[styles.noteText, { color: primary }]}>
            {t("accountSuggestions.onboarding.note")}
          </Text>
        </Card>

        <View style={styles.cardList}>
          {visibleSuggestions.map((suggestion) => (
            <AccountSuggestionCard
              key={suggestion.fingerprint}
              suggestion={suggestion}
              onCreate={(item) => {
                trackOnboardingEvent("account_suggestion_create_opened", {
                  evidenceType: item.evidenceType,
                  occurrences: item.occurrences,
                  confidenceScore: item.confidenceScore,
                });
                push({
                  pathname: "/create-financial-account",
                  params: { fingerprint: item.fingerprint },
                } as never);
              }}
              onLink={(item) => {
                trackOnboardingEvent("account_suggestion_link_opened", {
                  evidenceType: item.evidenceType,
                  occurrences: item.occurrences,
                  confidenceScore: item.confidenceScore,
                });
                push({
                  pathname: "/link-suggested-account",
                  params: { fingerprint: item.fingerprint },
                } as never);
              }}
              onSkip={(item) => {
                trackOnboardingEvent("account_suggestion_deferred", {
                  evidenceType: item.evidenceType,
                  occurrences: item.occurrences,
                  confidenceScore: item.confidenceScore,
                });
                const deferredState = getDeferredSuggestionReviewState({
                  suggestions,
                  deferredFingerprints: deferredFingerprintsRef.current,
                  skippedFingerprint: item.fingerprint,
                });
                deferredFingerprintsRef.current = deferredState.deferredFingerprints;
                setDeferredFingerprints(
                  (current) =>
                    getDeferredSuggestionReviewState({
                      suggestions,
                      deferredFingerprints: current,
                      skippedFingerprint: item.fingerprint,
                    }).deferredFingerprints
                );
                if (!deferredState.hasRemainingVisibleSuggestion) {
                  nextStep();
                }
              }}
            />
          ))}
        </View>
      </ScrollView>

      <Button
        label={t("accountSuggestions.onboarding.continue")}
        style={styles.continueButton}
        onPress={() => {
          trackOnboardingEvent("account_review_continue", {
            suggestionCount: suggestions.length,
            visibleSuggestionCount: visibleSuggestions.length,
            deferredCount: deferredFingerprints.length,
          });
          nextStep();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 16,
  },
  content: {
    gap: 12,
  },
  scrollArea: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 30,
    lineHeight: 34,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  noteBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 16,
  },
  cardList: {
    gap: 12,
  },
  continueButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

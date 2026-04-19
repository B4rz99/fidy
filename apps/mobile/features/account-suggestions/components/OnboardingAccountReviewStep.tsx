import { useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { AccountSuggestionCard } from "./AccountSuggestionCard";
import { useAccountSuggestions } from "../hooks/use-account-suggestions";
import { useOnboardingStore } from "@/features/onboarding/store";

export function OnboardingAccountReviewStep() {
  const router = useRouter();
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

  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  const visibleSuggestions = suggestions.filter(
    (suggestion) => !deferredFingerprints.includes(suggestion.fingerprint)
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: accentGreen }]}>
          {t("accountSuggestions.onboarding.eyebrow")}
        </Text>
        <Text style={[styles.title, { color: primary }]}>
          {t("accountSuggestions.onboarding.title")}
        </Text>
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("accountSuggestions.onboarding.subtitle")}
        </Text>

        <View style={[styles.noteBanner, { backgroundColor: accentGreenLight }]}>
          <Text style={[styles.noteText, { color: primary }]}>
            {t("accountSuggestions.onboarding.note")}
          </Text>
        </View>

        <View style={styles.cardList}>
          {visibleSuggestions.map((suggestion) => (
            <AccountSuggestionCard
              key={suggestion.fingerprint}
              suggestion={suggestion}
              onCreate={(item) =>
                router.push({
                  pathname: "/create-financial-account",
                  params: { fingerprint: item.fingerprint },
                } as never)
              }
              onLink={(item) =>
                router.push({
                  pathname: "/link-suggested-account",
                  params: { fingerprint: item.fingerprint },
                } as never)
              }
              onSkip={(item) =>
                setDeferredFingerprints((current) => [...current, item.fingerprint])
              }
            />
          ))}
        </View>
      </View>

      <Pressable style={[styles.continueButton, { backgroundColor: accentGreen }]} onPress={nextStep}>
        <Text style={styles.continueButtonText}>{t("accountSuggestions.onboarding.continue")}</Text>
      </Pressable>
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
    borderRadius: 12,
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

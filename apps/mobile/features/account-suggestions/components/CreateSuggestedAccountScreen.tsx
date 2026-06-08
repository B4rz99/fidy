import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import type { FinancialAccountKind } from "@/features/financial-accounts/public";
import { useOnboardingStore } from "@/features/onboarding/store.public";
import {
  Button,
  Card,
  EmptyState,
  FormTextField,
  GlassPressable,
  ScreenLayout,
} from "@/shared/components";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import { useAccountSuggestions } from "../hooks/use-account-suggestions";
import type { AccountCreationSuggestion } from "../lib/derive-account-suggestions";
import { shouldAdvanceOnboardingAfterSuggestionMutation } from "../lib/onboarding-review";
import { buildSuggestedFinancialAccountDraft } from "../lib/presentation";
import { createAccountSuggestionService } from "../services/create-account-suggestion-service";

const ACCOUNT_KIND_OPTIONS = [
  "checking",
  "savings",
  "wallet",
  "cash",
  "credit_card",
] as const satisfies readonly FinancialAccountKind[];

function ResolvedCreateSuggestedAccountForm({
  db,
  suggestion,
  userId,
}: {
  readonly db: NonNullable<ReturnType<typeof tryGetDb>>;
  readonly suggestion: AccountCreationSuggestion;
  readonly userId: NonNullable<ReturnType<typeof useOptionalUserId>>;
}) {
  const { back } = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const onboardingStep = useOnboardingStore((state) => state.step);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const service = useMemo(() => createAccountSuggestionService(), []);
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  const draft = buildSuggestedFinancialAccountDraft(suggestion);
  const [name, setName] = useState(draft.name);
  const [kind, setKind] = useState<FinancialAccountKind>(draft.kind);
  const { isBusy, run: guardedSave } = useAsyncGuard();

  const handleSave = () => {
    void guardedSave(async () => {
      try {
        service.createSuggestedAccount({
          db,
          userId,
          suggestion,
          name: name.trim(),
          kind,
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
        showErrorToast(t("accountSuggestions.create.saveFailed"));
      }
    });
  };

  return (
    <ScreenLayout title={t("accountSuggestions.create.title")} variant="sub" onBack={back}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("accountSuggestions.create.subtitle")}
        </Text>

        <Card
          backgroundColor={accentGreenLight}
          padded={false}
          radius={12}
          contentStyle={styles.identifierBox}
        >
          <Text style={[styles.identifierLabel, { color: secondary }]}>{draft.sourceLabel}</Text>
          <Text style={[styles.identifierValue, { color: primary }]}>{draft.evidenceLabel}</Text>
        </Card>

        <FormTextField
          label={t("accountSuggestions.create.nameLabel")}
          value={name}
          onChangeText={setName}
          placeholder={draft.name}
          style={styles.fieldGroup}
          labelStyle={[styles.fieldLabel, { color: secondary }]}
        />

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: secondary }]}>
            {t("accountSuggestions.create.kindLabel")}
          </Text>
          <View style={styles.kindRow}>
            {ACCOUNT_KIND_OPTIONS.map((option) => {
              const isSelected = option === kind;

              return (
                <GlassPressable
                  key={option}
                  onPress={() => setKind(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  radius={12}
                  borderColor={isSelected ? accentGreen : undefined}
                  surfaceStyle={styles.kindPill}
                >
                  <Text style={[styles.kindText, { color: primary }]}>
                    {t(`financialAccounts.kinds.${option}`)}
                  </Text>
                </GlassPressable>
              );
            })}
          </View>
        </View>

        <Button
          label={t("accountSuggestions.create.save")}
          onPress={handleSave}
          disabled={isBusy || name.trim().length === 0}
          loading={isBusy}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

export default function CreateSuggestedAccountScreen() {
  const { fingerprint } = useLocalSearchParams<{ fingerprint?: string }>();
  const { back } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { suggestions, hasLoadedSuggestions } = useAccountSuggestions({ db, userId });

  if (typeof fingerprint !== "string" || fingerprint.trim().length === 0) {
    return null;
  }

  const suggestion = suggestions.find((item) => item.fingerprint === fingerprint) ?? null;

  if (hasLoadedSuggestions && suggestion == null) {
    return (
      <ScreenLayout title={t("accountSuggestions.create.title")} variant="sub" onBack={back}>
        <EmptyState title={t("accountSuggestions.review.emptyTitle")} />
      </ScreenLayout>
    );
  }

  if (suggestion == null) {
    return null;
  }

  if (!db || !userId) {
    return null;
  }

  return <ResolvedCreateSuggestedAccountForm db={db} suggestion={suggestion} userId={userId} />;
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  kindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindPill: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  kindText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  identifierBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-start",
    flexDirection: "column",
    gap: 2,
  },
  identifierLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  identifierValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
});

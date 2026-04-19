import { useRouter, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import type { FinancialAccountKind } from "@/features/financial-accounts";
import { useOptionalUserId } from "@/features/auth";
import { ScreenLayout } from "@/shared/components";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import { useAccountSuggestions } from "../hooks/use-account-suggestions";
import type { AccountCreationSuggestion } from "../lib/derive-account-suggestions";
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
  const router = useRouter();
  const { t } = useTranslation();
  const service = useMemo(() => createAccountSuggestionService(), []);
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
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
        router.back();
      } catch {
        showErrorToast(t("accountSuggestions.create.saveFailed"));
      }
    });
  };

  return (
    <ScreenLayout title={t("accountSuggestions.create.title")} variant="sub" onBack={() => router.back()}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("accountSuggestions.create.subtitle")}
        </Text>

        <View style={[styles.identifierBox, { backgroundColor: accentGreenLight }]}>
          <Text style={[styles.identifierLabel, { color: secondary }]}>{draft.sourceLabel}</Text>
          <Text style={[styles.identifierValue, { color: primary }]}>{draft.evidenceLabel}</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: secondary }]}>
            {t("accountSuggestions.create.nameLabel")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: card,
                borderColor: borderSubtle,
                color: primary,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder={draft.name}
            placeholderTextColor={tertiary}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: secondary }]}>
            {t("accountSuggestions.create.kindLabel")}
          </Text>
          <View style={styles.kindRow}>
            {ACCOUNT_KIND_OPTIONS.map((option) => {
              const isSelected = option === kind;

              return (
                <Pressable
                  key={option}
                  style={[
                    styles.kindPill,
                    {
                      backgroundColor: isSelected ? accentGreenLight : card,
                      borderColor: isSelected ? accentGreen : borderSubtle,
                    },
                  ]}
                  onPress={() => setKind(option)}
                >
                  <Text style={[styles.kindText, { color: primary }]}>
                    {t(`financialAccounts.kinds.${option}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: secondary }]}>
            {t("accountSuggestions.create.identifierLabel")}
          </Text>
          <View style={[styles.identifierBox, { backgroundColor: accentGreenLight }]}>
            <Text style={[styles.identifierText, { color: primary }]}>{draft.evidenceLabel}</Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.saveButton,
            {
              backgroundColor: accentGreen,
              opacity: isBusy || name.trim().length === 0 ? 0.5 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={isBusy || name.trim().length === 0}
        >
          <Text style={styles.saveButtonText}>{t("accountSuggestions.create.save")}</Text>
        </Pressable>
      </ScrollView>
    </ScreenLayout>
  );
}

export default function CreateSuggestedAccountScreen() {
  const { fingerprint } = useLocalSearchParams<{ fingerprint?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { suggestions, hasLoadedSuggestions } = useAccountSuggestions({ db, userId });
  const primary = useThemeColor("primary");

  if (typeof fingerprint !== "string" || fingerprint.trim().length === 0) {
    return null;
  }

  const suggestion = suggestions.find((item) => item.fingerprint === fingerprint) ?? null;

  if (hasLoadedSuggestions && suggestion == null) {
    return (
      <ScreenLayout
        title={t("accountSuggestions.create.title")}
        variant="sub"
        onBack={() => router.back()}
      >
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: primary }]}>
            {t("accountSuggestions.review.emptyTitle")}
          </Text>
        </View>
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  kindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindPill: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  kindText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  identifierBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  identifierText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  identifierLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  identifierValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
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

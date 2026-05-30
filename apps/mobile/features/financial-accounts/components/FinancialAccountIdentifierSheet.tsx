import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import { parseFinancialAccountRouteParam } from "@/features/financial-accounts/lib/route-params";
import { canFinancialAccountHaveIdentifiers, readFinancialAccountKind } from "../lib/kind";
import { Button, ScreenLayout } from "@/shared/components";
import { ScrollView, StyleSheet, Text, TextInput, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";

const managementService = createFinancialAccountManagementService();

export function FinancialAccountIdentifierSheet() {
  const { back } = useRouter();
  const { accountId: rawAccountId } = useLocalSearchParams<{ accountId?: string }>();
  const accountId = parseFinancialAccountRouteParam(rawAccountId);
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const card = useThemeColor("card");
  const [value, setValue] = useState("");
  const { isBusy, run: guardedSave } = useAsyncGuard();

  const accountDetails =
    db && accountId ? managementService.getAccountDetails({ db, accountId }) : null;
  const accountCanHaveIdentifiers = accountDetails
    ? canFinancialAccountHaveIdentifiers(readFinancialAccountKind(accountDetails.account.kind))
    : false;

  if (!accountId || !accountDetails || !accountCanHaveIdentifiers) {
    return (
      <ScreenLayout
        title={t("financialAccounts.identifierSheet.title")}
        variant="sub"
        onBack={back}
      >
        <View style={styles.stateContainer}>
          <Text style={[styles.stateTitle, { color: primary }]}>
            {t("financialAccounts.form.missingTitle")}
          </Text>
          <Text style={[styles.stateBody, { color: secondary }]}>
            {t("financialAccounts.form.missingBody")}
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  const handleSave = () => {
    void guardedSave(async () => {
      try {
        if (!db || !userId) {
          return;
        }

        managementService.addManualIdentifier({
          db,
          userId,
          accountId,
          value,
        });
        back();
      } catch {
        showErrorToast(t("financialAccounts.identifierSheet.saveFailed"));
      }
    });
  };

  return (
    <ScreenLayout title={t("financialAccounts.identifierSheet.title")} variant="sub" onBack={back}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("financialAccounts.identifierSheet.subtitle")}
        </Text>

        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: secondary }]}>
            {t("financialAccounts.identifierSheet.label")}
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
            value={value}
            onChangeText={setValue}
            placeholder={t("financialAccounts.identifierSheet.placeholder")}
            placeholderTextColor={tertiary}
          />
        </View>

        <View style={[styles.noteBanner, { backgroundColor: accentGreenLight }]}>
          <Text style={[styles.noteText, { color: secondary }]}>
            {t("financialAccounts.identifierSheet.note")}
          </Text>
        </View>

        <Button
          label={t("financialAccounts.identifierSheet.save")}
          disabled={isBusy || value.trim().length === 0}
          onPress={handleSave}
          loading={isBusy}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  noteBanner: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  stateTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  stateBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 20,
  },
});

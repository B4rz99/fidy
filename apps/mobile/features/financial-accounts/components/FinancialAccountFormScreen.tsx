import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import {
  type FinancialAccountFormLookupStatus,
  getFinancialAccountFormScreenState,
} from "@/features/financial-accounts/lib/form-screen";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import { parseFinancialAccountRouteParam } from "@/features/financial-accounts/lib/route-params";
import { ScreenLayout } from "@/shared/components";
import { ActivityIndicator, Pressable, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./financial-account-form/FinancialAccountForm.styles";
import { FinancialAccountFormBody } from "./financial-account-form/FinancialAccountFormBody";
import type { FinancialAccountFormDetails } from "./financial-account-form/useFinancialAccountForm";

const managementService = createFinancialAccountManagementService();

function FinancialAccountFormLoadingState() {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primary = useThemeColor("primary");

  return (
    <View style={styles.stateContainer}>
      <ActivityIndicator size="small" color={accentGreen} />
      <Text style={[styles.stateTitle, { color: primary }]}>
        {t("financialAccounts.form.loading")}
      </Text>
    </View>
  );
}

function FinancialAccountFormMissingState({ onExit }: { readonly onExit: () => void }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  return (
    <View style={styles.stateContainer}>
      <Text style={[styles.stateTitle, { color: primary }]}>
        {t("financialAccounts.form.missingTitle")}
      </Text>
      <Text style={[styles.stateBody, { color: secondary }]}>
        {t("financialAccounts.form.missingBody")}
      </Text>
      <Pressable
        style={[styles.primaryButton, styles.stateButton, { backgroundColor: accentGreen }]}
        onPress={onExit}
      >
        <Text style={styles.primaryButtonText}>{t("financialAccounts.form.missingCta")}</Text>
      </Pressable>
    </View>
  );
}

export function FinancialAccountFormScreen() {
  const router = useRouter();
  const { accountId: rawAccountId } = useLocalSearchParams<{ accountId?: string }>();
  const accountId = parseFinancialAccountRouteParam(rawAccountId);
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const [existingDetails, setExistingDetails] = useState<FinancialAccountFormDetails | null>(null);
  const [lookupStatus, setLookupStatus] = useState<FinancialAccountFormLookupStatus>(
    accountId ? "loading" : "idle"
  );

  const reloadAccount = useCallback(() => {
    if (!accountId) {
      setExistingDetails(null);
      setLookupStatus("idle");
      return;
    }

    if (!db) {
      setExistingDetails(null);
      setLookupStatus("loading");
      return;
    }

    const nextDetails = managementService.getAccountDetails({ db, accountId });

    setExistingDetails(nextDetails);
    setLookupStatus(nextDetails ? "ready" : "missing");
  }, [accountId, db]);

  useFocusEffect(reloadAccount);

  const screenState = getFinancialAccountFormScreenState({ accountId, lookupStatus });
  const exitToAccountList = () => router.replace("/financial-accounts");

  return (
    <ScreenLayout
      title={
        accountId ? t("financialAccounts.form.editTitle") : t("financialAccounts.form.createTitle")
      }
      variant="sub"
      onBack={screenState === "missing" ? exitToAccountList : () => router.back()}
    >
      {screenState === "loading" ? (
        <FinancialAccountFormLoadingState />
      ) : screenState === "missing" ? (
        <FinancialAccountFormMissingState onExit={exitToAccountList} />
      ) : (
        <FinancialAccountFormBody
          key={accountId ?? "create"}
          existingDetails={existingDetails}
          onManageIdentifiers={
            accountId
              ? () =>
                  router.push({
                    pathname: "/financial-account-identifier",
                    params: { accountId },
                  })
              : null
          }
        />
      )}
    </ScreenLayout>
  );
}

import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import {
  type FinancialAccountFormLookupStatus,
  getFinancialAccountFormScreenState,
} from "@/features/financial-accounts/lib/form-screen";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import { parseFinancialAccountRouteParam } from "@/features/financial-accounts/lib/route-params";
import { Button, ScreenLayout } from "@/shared/components";
import { ActivityIndicator, Text, View } from "@/shared/components/rn";
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
      <Button
        label={t("financialAccounts.form.missingCta")}
        className="self-start"
        onPress={onExit}
      />
    </View>
  );
}

export function FinancialAccountFormScreen() {
  const { back, push, replace } = useRouter();
  const { accountId: rawAccountId } = useLocalSearchParams<{ accountId?: string }>();
  const accountId = parseFinancialAccountRouteParam(rawAccountId);
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const title = accountId
    ? t("financialAccounts.form.editTitle")
    : t("financialAccounts.form.createTitle");
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
  const exitToAccountList = () => replace("/financial-accounts");
  const onManageIdentifiers = accountId
    ? () =>
        push({
          pathname: "/financial-account-identifier",
          params: { accountId },
        })
    : null;
  const formContent = (() => {
    if (screenState === "loading") return <FinancialAccountFormLoadingState />;
    if (screenState === "missing") {
      return <FinancialAccountFormMissingState onExit={exitToAccountList} />;
    }

    return (
      <FinancialAccountFormBody
        key={accountId ?? "create"}
        existingDetails={existingDetails}
        onManageIdentifiers={onManageIdentifiers}
      />
    );
  })();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenLayout
        variant="sub"
        includesNativeHeader={false}
        centerAction={
          <Text style={[styles.headerTitle, { color: primary }]} numberOfLines={1}>
            {title}
          </Text>
        }
        onBack={screenState === "missing" ? exitToAccountList : back}
      >
        {formContent}
      </ScreenLayout>
    </>
  );
}

import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import type { FinancialAccountDetails } from "@/features/financial-accounts/lib/management-service/types";
import { parseFinancialAccountRouteParam } from "@/features/financial-accounts/lib/route-params";
import { tryGetDb } from "@/shared/db";

const managementService = createFinancialAccountManagementService();

export type UseFinancialAccountDetailsScreenResult = {
  readonly accountId: ReturnType<typeof parseFinancialAccountRouteParam>;
  readonly details: FinancialAccountDetails | null;
  readonly kind: ReturnType<typeof readFinancialAccountKind> | null;
  readonly onBack: () => void;
  readonly onEditAccount: () => void;
  readonly onManageIdentifiers: () => void;
};

export function useFinancialAccountDetailsScreen(): UseFinancialAccountDetailsScreenResult {
  const router = useRouter();
  const { accountId: rawAccountId } = useLocalSearchParams<{ accountId?: string | string[] }>();
  const accountId = parseFinancialAccountRouteParam(rawAccountId);
  const userId = useOptionalUserId();
  const [details, setDetails] = useState<FinancialAccountDetails | null>(null);

  const reloadDetails = useCallback(() => {
    if (!userId || !accountId) {
      setDetails(null);
      return;
    }

    const db = tryGetDb(userId);

    if (!db) {
      setDetails(null);
      return;
    }

    setDetails(managementService.getAccountDetails({ db, accountId }));
  }, [accountId, userId]);

  useFocusEffect(reloadDetails);

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  const onManageIdentifiers = useCallback(() => {
    if (!details) {
      return;
    }

    router.push({
      pathname: "/financial-account-identifier",
      params: { accountId: details.account.id },
    });
  }, [details, router]);

  const onEditAccount = useCallback(() => {
    if (!details) {
      return;
    }

    router.push({
      pathname: "/financial-account-form",
      params: { accountId: details.account.id },
    });
  }, [details, router]);

  return {
    accountId,
    details,
    kind: details ? readFinancialAccountKind(details.account.kind) : null,
    onBack,
    onEditAccount,
    onManageIdentifiers,
  };
}

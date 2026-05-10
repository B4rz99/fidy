import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import { getFinancialAccountsForUser } from "@/features/financial-accounts/public";
import { tryGetDb } from "@/shared/db";
import type { FinancialAccountListItem } from "./FinancialAccountsScreen.types";

const managementService = createFinancialAccountManagementService();

export function useFinancialAccountsScreen() {
  const router = useRouter();
  const userId = useOptionalUserId();
  const [items, setItems] = useState<readonly FinancialAccountListItem[]>([]);

  const reloadAccounts = useCallback(() => {
    if (!userId) {
      setItems([]);
      return;
    }

    const db = tryGetDb(userId);

    if (!db) {
      setItems([]);
      return;
    }

    const nextItems = getFinancialAccountsForUser(db, userId).map((account) => {
      const details = managementService.getAccountDetails({ db, accountId: account.id });

      return {
        account,
        identifiersCount: details?.identifiers.length ?? 0,
        hasBillingProfileGap: details?.hasBillingProfileGap ?? false,
      } satisfies FinancialAccountListItem;
    });

    setItems(nextItems);
  }, [userId]);

  useFocusEffect(reloadAccounts);

  const regularAccounts = items.filter(
    (item) => readFinancialAccountKind(item.account.kind) !== "credit_card"
  );
  const creditCardAccounts = items.filter(
    (item) => readFinancialAccountKind(item.account.kind) === "credit_card"
  );

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  const onAddAccount = useCallback(() => {
    router.push("/financial-account-form");
  }, [router]);

  const onOpenAccount = useCallback(
    (accountId: FinancialAccountListItem["account"]["id"]) => {
      router.push({
        pathname: "/financial-account-details",
        params: { accountId },
      });
    },
    [router]
  );

  return {
    creditCardAccounts,
    onAddAccount,
    onBack,
    onOpenAccount,
    regularAccounts,
  };
}

import { useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import {
  persistCloudLedgerRuntimeTransactionShadows,
  refreshTransactions,
} from "@/features/transactions/store.public";
import { ScreenLayout } from "@/shared/components";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useMountEffect, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import type { LedgerChangeId, UserId } from "@/shared/types/branded";
import { getCloudLedgerOutbox, loadCloudLedgerRepairItems } from "../outbox";
import type { CloudLedgerRepairItem } from "../repair-policy";
import {
  discardCloudLedgerRepairItemForUser,
  retryCloudLedgerRepairItemForUser,
  retryCloudLedgerRepairSetForUser,
} from "../runtime-mutations.public";
import { CloudLedgerRepairList } from "./CloudLedgerRepairList";

export function CloudLedgerRepairScreen() {
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const [items, setItems] = useState<readonly CloudLedgerRepairItem[] | null>(null);
  const { run: guardedAction } = useAsyncGuard();

  const reloadItems = async (currentUserId: UserId | null) => {
    setItems(currentUserId === null ? [] : await loadRepairItemsForUser(currentUserId));
  };

  useMountEffect(() => {
    void reloadItems(userId).catch(() => {
      setItems([]);
      showErrorToast(t("cloudLedger.repair.actionFailed"));
    });
  });

  const runRepairAction = (action: (currentUserId: UserId) => Promise<void>) => {
    void guardedAction(async () => {
      if (userId === null) {
        return;
      }
      try {
        await action(userId);
        await Promise.all([refreshRepairTransactionViews(userId), reloadItems(userId)]);
      } catch {
        showErrorToast(t("cloudLedger.repair.actionFailed"));
      }
    });
  };

  const handleRetry = (changeId: LedgerChangeId) =>
    runRepairAction(async (currentUserId) => {
      const didRetry = await retryCloudLedgerRepairItemForUser(currentUserId, changeId);
      if (!didRetry) {
        throw new Error("ledger repair retry failed");
      }
    });

  const handleRetrySet = () =>
    runRepairAction(async (currentUserId) => {
      const didRetry = await retryCloudLedgerRepairSetForUser(currentUserId);
      if (!didRetry) {
        throw new Error("ledger repair set retry failed");
      }
    });

  const handleDiscard = (changeId: LedgerChangeId) =>
    runRepairAction(async (currentUserId) => {
      const didDiscard = await discardCloudLedgerRepairItemForUser(currentUserId, changeId);
      if (!didDiscard) {
        throw new Error("ledger repair discard failed");
      }
    });

  const handleEditAndResubmit = (changeId: LedgerChangeId) => {
    push({
      pathname: "/ledger-repair-transaction",
      params: { changeId },
    });
  };

  return (
    <ScreenLayout variant="sub" title={t("cloudLedger.repair.screenTitle")} onBack={back}>
      {items === null ? null : (
        <CloudLedgerRepairList
          items={items}
          onDiscard={handleDiscard}
          onEditAndResubmit={handleEditAndResubmit}
          onRetry={handleRetry}
          onRetrySet={handleRetrySet}
        />
      )}
    </ScreenLayout>
  );
}

async function loadRepairItemsForUser(userId: UserId): Promise<readonly CloudLedgerRepairItem[]> {
  return await loadCloudLedgerRepairItems(getCloudLedgerOutbox(userId));
}

async function refreshRepairTransactionViews(userId: UserId): Promise<void> {
  const db = tryGetDb(userId);
  if (db === null) {
    return;
  }
  persistCloudLedgerRuntimeTransactionShadows(db, userId);
  await refreshTransactions(db, userId);
}

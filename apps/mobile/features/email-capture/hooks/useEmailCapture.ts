import { refreshTransactions } from "@/features/transactions/store.public";
import { useSettingsStore } from "@/features/settings/hooks.public";
import { AppState } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { handleRecoverableError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { getGmailClientId, getOutlookClientId } from "../schema";
import { fetchAndProcessEmails, loadEmailAccounts } from "../store";

export function useEmailCapture(db: AnyDb | null, userId: UserId | null) {
  const shareAnonymizedParseSamples = useSettingsStore((s) => s.shareAnonymizedParseSamples);

  useSubscription(
    () => {
      if (!db || !userId) return;

      const runFetch = () => {
        fetchAndProcessEmails(
          db,
          userId,
          getGmailClientId(),
          getOutlookClientId(),
          () => refreshTransactions(db, userId),
          { shareParseImprovementSamples: shareAnonymizedParseSamples }
        ).catch(handleRecoverableError("Email sync failed"));
      };

      loadEmailAccounts(db, userId)
        .then(() => runFetch())
        .catch(handleRecoverableError("Email sync failed"));

      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") runFetch();
      });

      return () => {
        subscription.remove();
      };
    },
    [db, userId, shareAnonymizedParseSamples],
    db != null && userId != null
  );
}

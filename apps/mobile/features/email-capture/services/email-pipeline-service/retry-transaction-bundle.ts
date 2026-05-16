import { Effect } from "effect";
import { normalizeTransactionStorageRow } from "@/infrastructure/local-ledger/transaction-storage";
import { fromPromise } from "@/shared/effect/runtime";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { and, eq, isNull } from "drizzle-orm";
import { captureEvidence, processedSourceEvents, transactions } from "@/shared/db/schema";
import { EmailPipelineDeps, insertMerchantRuleEffect } from "./runtime";
import { getParsedCounterpartyName } from "./shared";
import {
  buildTransactionRow,
  defaultRecordTransaction,
  prepareRecordedTransaction,
} from "./transaction-recording";
import { trackSavedTransactionEffect } from "./transaction-tracking";
import type { RetryTransactionContext } from "./types";

export function persistSuccessfulRetrySideEffectsEffect(context: RetryTransactionContext) {
  return Effect.catchAll(
    Effect.gen(function* () {
      yield* insertMerchantRuleEffect({
        db: context.db,
        userId: context.userId,
        merchantKey: normalizeMerchant(getParsedCounterpartyName(context.parsed)),
        categoryId: context.categoryId,
        createdAt: context.now,
      });
      yield* trackSavedTransactionEffect({
        parsed: context.parsed,
        categoryId: context.categoryId,
      });
    }),
    () => Effect.succeed(undefined)
  );
}

export function persistSuccessfulRetryBundleEffect(context: RetryTransactionContext) {
  return Effect.gen(function* () {
    const {
      insertTransaction,
      markSourceEventRetrySuccess,
      recordTransaction = defaultRecordTransaction,
    } = yield* EmailPipelineDeps.tag;

    yield* fromPromise(async () => {
      const transaction = await prepareRecordedTransaction(context, { recordTransaction });
      const persistTransaction = (db: RetryTransactionContext["db"]) =>
        insertTransaction(db, buildTransactionRow(context, transaction));
      const transactionRow = {
        ...buildTransactionRow(context, transaction),
        accountId: context.defaultAccount.id,
      };
      const persistSourceEventStatus = (db: RetryTransactionContext["db"]) =>
        markSourceEventRetrySuccess({
          db,
          id: context.processedSourceEventId,
          status: "processed",
          transactionId: context.txId,
          confidence: context.parsed.confidence,
        });
      const linkSourceEventEvidence = (db: RetryTransactionContext["db"]) =>
        "update" in db && typeof db.update === "function"
          ? db
              .update(captureEvidence)
              .set({ transactionId: context.txId, transferId: null, updatedAt: context.now })
              .where(
                and(
                  eq(captureEvidence.processedSourceEventId, context.processedSourceEventId),
                  isNull(captureEvidence.deletedAt)
                )
              )
              .run()
          : undefined;

      if ("transaction" in context.db && typeof context.db.transaction === "function") {
        context.db.transaction((tx) => {
          tx.insert(transactions).values(normalizeTransactionStorageRow(transactionRow)).run();
          tx.update(processedSourceEvents)
            .set({
              status: "processed",
              transactionId: context.txId,
              confidence: context.parsed.confidence,
              rawBody: null,
            })
            .where(eq(processedSourceEvents.id, context.processedSourceEventId))
            .run();
          linkSourceEventEvidence(tx);
        });
        return;
      }

      await persistTransaction(context.db);
      await persistSourceEventStatus(context.db);
      linkSourceEventEvidence(context.db);
    });
  });
}

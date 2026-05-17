import { Effect } from "effect";
import { fromPromise } from "@/shared/effect/runtime";
import { normalizeMerchant } from "@/shared/lib";
import { and, eq, isNull } from "drizzle-orm";
import { captureEvidence, processedSourceEvents } from "@/shared/db/schema";
import { EmailPipelineDeps, insertMerchantRuleEffect } from "./runtime";
import { getParsedCounterpartyName } from "./shared";
import { buildAutomatedTransactionCommand } from "./transaction-recording";
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
    const { recordAutomatedTransactionWithLocalLedger } = yield* EmailPipelineDeps.tag;

    yield* fromPromise(async () => {
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

      const result = await recordAutomatedTransactionWithLocalLedger({
        db: context.db,
        command: buildAutomatedTransactionCommand(context),
        transactionId: context.txId,
        now: context.now,
        afterRecord: (tx) => {
          tx.update(processedSourceEvents)
            .set({
              status: "processed",
              transactionId: context.txId,
              confidence: context.parsed.confidence,
            })
            .where(eq(processedSourceEvents.id, context.processedSourceEventId))
            .run();
          linkSourceEventEvidence(tx);
        },
      });
      if (!result.success) throw new Error(`RecordTransaction rejected: ${result.error}`);
    });
  });
}

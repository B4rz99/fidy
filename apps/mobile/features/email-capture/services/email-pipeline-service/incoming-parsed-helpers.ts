import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { captureErrorEffect } from "@/shared/effect/telemetry";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { findDuplicateTransactionEffect, insertMerchantRuleEffect } from "./runtime";
import { getParsedCounterpartyName, getPersistedCategoryId } from "./shared";
import type {
  DuplicateLookupOutcome,
  EmailBatchContext,
  IncomingEmailOutcome,
  LlmParsedTransaction,
} from "./types";

export async function lookupIncomingDuplicate(
  context: EmailBatchContext,
  parsed: LlmParsedTransaction
): Promise<DuplicateLookupOutcome> {
  try {
    const transactionId = await context.runtime.runEmailEffect(
      findDuplicateTransactionEffect(context.db, context.userId, parsed)
    );
    return transactionId ? { kind: "duplicate", transactionId } : { kind: "new" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return { kind: "failed" };
  }
}

export async function cacheMerchantRule(input: {
  readonly context: EmailBatchContext;
  readonly parsed: LlmParsedTransaction;
  readonly regexParseStatus: IncomingEmailOutcome["regexParseStatus"];
}) {
  if (input.regexParseStatus === "parsed" && input.parsed.categoryId === "other") {
    return;
  }

  try {
    const createdAt = await input.context.runtime.runClockEffect(currentIsoDateTimeEffect);
    await input.context.runtime.runEmailEffect(
      insertMerchantRuleEffect({
        db: input.context.db,
        userId: input.context.userId,
        merchantKey: normalizeMerchant(getParsedCounterpartyName(input.parsed)),
        categoryId: getPersistedCategoryId(input.parsed.categoryId),
        createdAt,
      })
    );
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
  }
}

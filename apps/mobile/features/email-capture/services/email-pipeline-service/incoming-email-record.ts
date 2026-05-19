import { saveEmailCaptureEvidenceEffect, insertProcessedEmailSourceEventEffect } from "./runtime";
import type { EmailBatchContext, RawEmail, TransactionId } from "./types";

type IncomingEmailPersistenceInput = {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly sourceEventRow: Parameters<typeof insertProcessedEmailSourceEventEffect>[1];
  readonly processedSourceEventId: Parameters<
    typeof saveEmailCaptureEvidenceEffect
  >[0]["processedSourceEventId"];
  readonly transactionId: TransactionId | null;
  readonly createdAt: Parameters<typeof saveEmailCaptureEvidenceEffect>[0]["now"];
};

export async function persistIncomingEmailRecord(input: IncomingEmailPersistenceInput) {
  await input.context.runtime.runEmailEffect(
    insertProcessedEmailSourceEventEffect(input.context.db, input.sourceEventRow)
  );
  await input.context.runtime.runEmailEffect(
    saveEmailCaptureEvidenceEffect({
      db: input.context.db,
      userId: input.context.userId,
      from: input.email.from,
      body: input.email.body,
      processedSourceEventId: input.processedSourceEventId,
      transactionId: input.transactionId,
      now: input.createdAt,
    })
  );
}

import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { generateProcessedEmailId, generateProcessedSourceEventId } from "@/shared/lib/generate-id";
import { assertIsoDateTime } from "@/shared/types/assertions";
import { parseEmailBodyOrReport } from "./parse-email-body";
import type { EmailBatchContext, IncomingParseOutcome, RawEmail } from "./types";

export async function parseIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail
): Promise<IncomingParseOutcome> {
  const result = await parseEmailBodyOrReport(context, {
    body: email.body,
    provider: email.provider,
    warningName: "email_parse_exception",
  });
  return result.kind === "failed"
    ? { kind: "failed" }
    : result.parsed
      ? { kind: "parsed", parsed: result.parsed }
      : { kind: "filtered" };
}

export async function createIncomingEmailPersistenceState(
  context: EmailBatchContext,
  email: RawEmail
) {
  assertIsoDateTime(email.receivedAt);
  return {
    createdAt: await context.runtime.runClockEffect(currentIsoDateTimeEffect),
    processedEmailId: generateProcessedEmailId(),
    processedSourceEventId: generateProcessedSourceEventId(),
  };
}

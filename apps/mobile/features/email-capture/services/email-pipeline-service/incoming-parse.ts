import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { generateProcessedSourceEventId } from "@/shared/lib/generate-id";
import { assertIsoDateTime } from "@/shared/types/assertions";
import { parseKnownBankEmail } from "../bank-email-parser";
import { parseEmailBodyOrReport } from "./parse-email-body";
import type { EmailBatchContext, IncomingParseOutcome, RawEmail } from "./types";

export async function parseIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail
): Promise<IncomingParseOutcome> {
  const bankParse = parseKnownBankEmail(email);
  if (bankParse.kind === "parsed") {
    return { kind: "parsed", parsed: bankParse.parsed, regexParseStatus: "parsed" };
  }

  const result = await parseEmailBodyOrReport(context, {
    body: email.body,
    provider: email.provider,
    warningName: "email_parse_exception",
  });
  const parseImprovementRequest = bankParse.kind === "failed" ? bankParse.request : undefined;
  const regexParseStatus = bankParse.kind === "failed" ? "missed" : "unsupported";
  return result.kind === "failed"
    ? { kind: "failed", parseImprovementRequest, regexParseStatus }
    : result.parsed
      ? { kind: "parsed", parsed: result.parsed, parseImprovementRequest, regexParseStatus }
      : { kind: "filtered", parseImprovementRequest, regexParseStatus };
}

export async function createIncomingEmailPersistenceState(
  context: EmailBatchContext,
  email: RawEmail
) {
  assertIsoDateTime(email.receivedAt);
  return {
    createdAt: await context.runtime.runClockEffect(currentIsoDateTimeEffect),
    processedSourceEventId: generateProcessedSourceEventId(),
  };
}

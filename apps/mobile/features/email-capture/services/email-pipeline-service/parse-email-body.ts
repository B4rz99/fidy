import { captureWarningEffect } from "@/shared/effect/telemetry";
import { EmailParseApiError, parseBodyEffect } from "./runtime";
import type { EmailBatchContext, LlmParsedTransaction, RetryBatchContext } from "./types";

type ParseEmailBodyContext = Pick<
  EmailBatchContext | RetryBatchContext,
  "db" | "runtime" | "userId"
>;

export async function parseEmailBodyOrReport(
  context: ParseEmailBodyContext,
  input: {
    readonly body: string;
    readonly provider: string;
    readonly warningName: string;
  }
): Promise<
  | { readonly kind: "parsed"; readonly parsed: LlmParsedTransaction | null }
  | { readonly kind: "failed" }
> {
  try {
    const parsed = await context.runtime.runEmailEffect(
      parseBodyEffect(context.db, context.userId, input.body)
    );
    return { kind: "parsed", parsed };
  } catch (error) {
    if (!(error instanceof EmailParseApiError)) throw error;
    const originalError = error.originalError;
    try {
      await context.runtime.runTelemetryEffect(
        captureWarningEffect(input.warningName, {
          provider: input.provider,
          errorType: originalError instanceof Error ? originalError.name : "unknown",
        })
      );
    } catch {
      // Warning telemetry must not turn a parse failure into a batch failure.
    }
    return { kind: "failed" };
  }
}

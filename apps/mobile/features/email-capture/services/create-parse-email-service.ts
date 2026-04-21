import { Effect } from "effect";
import { fromPromise } from "@/shared/effect/runtime";
import {
  type AppSupabase,
  bindAppSupabase,
  currentSupabaseClientEffect,
} from "@/shared/effect/supabase";
import {
  type AppTelemetry,
  bindAppTelemetry,
  captureWarningEffect,
} from "@/shared/effect/telemetry";
import type { LlmParsedTransaction } from "./llm-parser";
import { llmOutputSchema } from "./llm-parser";

type ParseMode = "classify" | "full_parse" | "parse_notification";
type ParseFunctionResult<Response> = {
  readonly data?: Response | null;
  readonly error?: {
    readonly message?: string;
  } | null;
};

type ParseEmailResponse = {
  readonly success: boolean;
  readonly data?: unknown;
};

type ClassifyResponse = {
  readonly success: boolean;
  readonly data?: {
    readonly categoryId?: string;
  };
};

type CreateParseEmailServiceDeps = {
  readonly validCategoryIds: readonly string[];
  readonly supabase?: AppSupabase;
  readonly telemetry?: AppTelemetry;
};

export type ParseEmailService = {
  readonly classifyMerchant: (merchant: string) => Promise<string>;
  readonly parseEmail: (emailBody: string) => Promise<LlmParsedTransaction | null>;
  readonly parseNotification: (sanitizedText: string) => Promise<LlmParsedTransaction | null>;
};

function invokeParseEmailFunctionEffect<Response>(body: string, mode: ParseMode) {
  return Effect.flatMap(currentSupabaseClientEffect, (supabase) =>
    fromPromise(() =>
      supabase.functions.invoke<Response>("parse-email", {
        body: { body, mode },
      })
    )
  );
}

function logParseApiFailureEffect(
  warningPrefix: "parse_email" | "parse_notification",
  response: ParseFunctionResult<ParseEmailResponse>
) {
  return Effect.zipRight(
    captureWarningEffect(`${warningPrefix}_api_failed`, {
      errorMessage: response.error?.message ?? "unknown",
      hasData: response.data != null,
    }),
    Effect.succeed(null)
  );
}

function validateParsedTransactionEffect(
  warningPrefix: "parse_email" | "parse_notification",
  data: unknown
) {
  const result = llmOutputSchema.safeParse(data);
  if (!result.success) {
    return Effect.zipRight(
      captureWarningEffect(`${warningPrefix}_validation_failed`, {
        issueCount: result.error.issues.length,
      }),
      Effect.succeed(null)
    );
  }

  return Effect.succeed(result.data);
}

function handleParseTransactionResponseEffect(
  warningPrefix: "parse_email" | "parse_notification",
  response: ParseFunctionResult<ParseEmailResponse>
) {
  if (response.error != null || !response.data?.success) {
    return logParseApiFailureEffect(warningPrefix, response);
  }

  return validateParsedTransactionEffect(warningPrefix, response.data.data);
}

function logParseExceptionEffect(
  warningPrefix: "parse_email" | "parse_notification",
  error: unknown
) {
  return Effect.zipRight(
    captureWarningEffect(`${warningPrefix}_api_exception`, {
      errorType: error instanceof Error ? error.message : "unknown",
    }),
    Effect.succeed(null)
  );
}

function parseTransactionEffect(
  body: string,
  mode: Extract<ParseMode, "full_parse" | "parse_notification">,
  warningPrefix: "parse_email" | "parse_notification"
) {
  return Effect.catchAll(
    Effect.flatMap(invokeParseEmailFunctionEffect<ParseEmailResponse>(body, mode), (response) =>
      handleParseTransactionResponseEffect(warningPrefix, response)
    ),
    (error) => logParseExceptionEffect(warningPrefix, error)
  );
}

function logClassifyApiFailureEffect(response: ParseFunctionResult<ClassifyResponse>) {
  return Effect.zipRight(
    captureWarningEffect("classify_merchant_failed", {
      hasError: response.error != null,
      errorMessage: response.error?.message ?? "unknown",
    }),
    Effect.succeed("other")
  );
}

function handleClassifyMerchantResponseEffect(
  response: ParseFunctionResult<ClassifyResponse>,
  validCategoryIds: readonly string[]
) {
  if (response.error != null || !response.data?.success) {
    return logClassifyApiFailureEffect(response);
  }

  const categoryId = response.data.data?.categoryId;
  return Effect.succeed(
    categoryId != null && validCategoryIds.includes(categoryId) ? categoryId : "other"
  );
}

function classifyMerchantEffect(merchant: string, validCategoryIds: readonly string[]) {
  return Effect.catchAll(
    Effect.flatMap(
      invokeParseEmailFunctionEffect<ClassifyResponse>(merchant, "classify"),
      (response) => handleClassifyMerchantResponseEffect(response, validCategoryIds)
    ),
    () => Effect.succeed("other")
  );
}

export function createParseEmailService({
  validCategoryIds,
  supabase,
  telemetry,
}: CreateParseEmailServiceDeps): ParseEmailService {
  const supabaseRuntime = bindAppSupabase(supabase);
  const telemetryRuntime = bindAppTelemetry(telemetry);
  const runEffect = <A>(effect: Effect.Effect<A, unknown, AppSupabase | AppTelemetry>) =>
    telemetryRuntime.run(supabaseRuntime.provide(effect));

  return {
    classifyMerchant: (merchant) => runEffect(classifyMerchantEffect(merchant, validCategoryIds)),
    parseEmail: (emailBody) =>
      runEffect(parseTransactionEffect(emailBody, "full_parse", "parse_email")),
    parseNotification: (sanitizedText) =>
      runEffect(parseTransactionEffect(sanitizedText, "parse_notification", "parse_notification")),
  };
}

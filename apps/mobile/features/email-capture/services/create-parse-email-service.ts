import { Effect } from "effect";
import {
  interpretCaptureCandidate,
  validateCaptureCandidateForLocalLedger,
} from "@/features/capture-interpreter/public";
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
type ParseTransactionInput = {
  readonly body: string;
  readonly mode: Extract<ParseMode, "full_parse" | "parse_notification">;
  readonly warningPrefix: "parse_email" | "parse_notification";
  readonly validCategoryIds: readonly string[];
};

type CreateParseEmailServiceDeps = {
  readonly validCategoryIds: readonly string[];
  readonly supabase?: AppSupabase;
  readonly telemetry?: AppTelemetry;
};

const AUTHORIZATION_HEADER = "Authorization";

export type ParseEmailService = {
  readonly classifyMerchant: (merchant: string) => Promise<string>;
  readonly parseEmail: (emailBody: string) => Promise<LlmParsedTransaction | null>;
  readonly parseNotification: (sanitizedText: string) => Promise<LlmParsedTransaction | null>;
};

function invokeParseEmailFunctionEffect<Response>(body: string, mode: ParseMode) {
  return Effect.flatMap(currentSupabaseClientEffect, (supabase) =>
    fromPromise(async () => {
      const sessionResult = await supabase.auth?.getSession?.();
      const accessToken = sessionResult?.data.session?.access_token;

      return supabase.functions.invoke<Response>("parse-email", {
        body: { body, mode },
        ...(accessToken ? { headers: { [AUTHORIZATION_HEADER]: `Bearer ${accessToken}` } } : {}),
      });
    })
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
    Effect.fail(new Error(response.error?.message ?? "parse-email request failed"))
  );
}

function validateParsedTransactionEffect(
  warningPrefix: "parse_email" | "parse_notification",
  data: unknown,
  validCategoryIds: readonly string[]
) {
  const interpreted = interpretCaptureCandidate(data, { validCategoryIds });
  if (interpreted.kind === "invalid") {
    return Effect.zipRight(
      captureWarningEffect(`${warningPrefix}_validation_failed`, {
        issueCount: interpreted.reasons.length,
      }),
      Effect.succeed(null)
    );
  }

  const validation = validateCaptureCandidateForLocalLedger(interpreted.candidate, {
    validCategoryIds,
  });

  if (validation.kind === "accepted") {
    return Effect.succeed(llmOutputSchema.parse(validation.transaction));
  }

  return Effect.zipRight(
    captureWarningEffect(`${warningPrefix}_${validation.kind}`, {
      reason: validation.reason,
    }),
    Effect.succeed(null)
  );
}

function handleParseTransactionResponseEffect(
  warningPrefix: "parse_email" | "parse_notification",
  response: ParseFunctionResult<ParseEmailResponse>,
  validCategoryIds: readonly string[]
) {
  if (response.error != null || !response.data?.success) {
    return logParseApiFailureEffect(warningPrefix, response);
  }

  return validateParsedTransactionEffect(warningPrefix, response.data.data, validCategoryIds);
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

function parseApiResponseEffect(
  input: {
    readonly warningPrefix: "parse_email" | "parse_notification";
    readonly validCategoryIds: readonly string[];
  },
  response: ParseFunctionResult<ParseEmailResponse>
) {
  return handleParseTransactionResponseEffect(
    input.warningPrefix,
    response,
    input.validCategoryIds
  );
}

function parseTransactionEffect(input: ParseTransactionInput) {
  const request = Effect.catchAll(
    invokeParseEmailFunctionEffect<ParseEmailResponse>(input.body, input.mode),
    (error) =>
      Effect.zipRight(logParseExceptionEffect(input.warningPrefix, error), Effect.fail(error))
  );

  return Effect.flatMap(request, (response) => parseApiResponseEffect(input, response));
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
      runEffect(
        parseTransactionEffect({
          body: emailBody,
          mode: "full_parse",
          warningPrefix: "parse_email",
          validCategoryIds,
        })
      ),
    parseNotification: (sanitizedText) =>
      runEffect(
        parseTransactionEffect({
          body: sanitizedText,
          mode: "parse_notification",
          warningPrefix: "parse_notification",
          validCategoryIds,
        })
      ),
  };
}

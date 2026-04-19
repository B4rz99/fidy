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

function parseTransactionEffect(
  body: string,
  mode: Extract<ParseMode, "full_parse" | "parse_notification">,
  warningPrefix: "parse_email" | "parse_notification"
) {
  return Effect.catchAll(
    Effect.gen(function* () {
      const response = yield* invokeParseEmailFunctionEffect<ParseEmailResponse>(body, mode);
      const { data, error } = response;

      if (error != null || !data?.success) {
        yield* captureWarningEffect(`${warningPrefix}_api_failed`, {
          errorMessage: error?.message ?? "unknown",
          hasData: data != null,
        });
        return null;
      }

      const result = llmOutputSchema.safeParse(data.data);
      if (!result.success) {
        yield* captureWarningEffect(`${warningPrefix}_validation_failed`, {
          issueCount: result.error.issues.length,
        });
        return null;
      }

      return result.data;
    }),
    (error) =>
      Effect.zipRight(
        captureWarningEffect(`${warningPrefix}_api_exception`, {
          errorType: error instanceof Error ? error.message : "unknown",
        }),
        Effect.succeed(null)
      )
  );
}

function classifyMerchantEffect(merchant: string, validCategoryIds: readonly string[]) {
  return Effect.catchAll(
    Effect.gen(function* () {
      const response = yield* invokeParseEmailFunctionEffect<ClassifyResponse>(
        merchant,
        "classify"
      );
      const { data, error } = response;

      if (error != null || !data?.success) {
        yield* captureWarningEffect("classify_merchant_failed", {
          hasError: error != null,
          errorMessage: error?.message ?? "unknown",
        });
        return "other";
      }

      const categoryId = data.data?.categoryId;
      return categoryId != null && validCategoryIds.includes(categoryId) ? categoryId : "other";
    }),
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

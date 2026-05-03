// biome-ignore-all lint/style/useNamingConvention: OpenAI SDK and API field names
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { readBodyWithLimit } from "../_shared/body-size.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

// Keep in sync with apps/mobile/features/transactions/lib/categories.ts
const CATEGORY_IDS = [
  "food",
  "transport",
  "entertainment",
  "health",
  "education",
  "home",
  "clothing",
  "services",
  "other",
] as const;

const CATEGORY_GUIDE = `- food: groceries, restaurants, bakeries, coffee, food delivery (Éxito, Carulla, D1, Rappi, McDonald's, Juan Valdez, Ara, Crepes, PPC, Frisby)
- transport: taxis, gas stations (EDS), tolls, airlines (Uber, DiDi, Terpel, EDS, peajes, Avianca, LATAM)
- entertainment: movies, streaming, games, bars (Netflix, Spotify, Cine Colombia)
- health: pharmacies, doctors, gym (Farmatodo, Droguería, Bodytech, clínica, hospital)
- education: tuition, courses, books (universidad, fundación, Platzi)
- home: rent, utilities, internet, furniture (EPM, Codensa, Claro hogar, Homecenter, arriendo)
- clothing: apparel, shoes (Zara, Falabella, Tennis, Arturo Calle)
- services: insurance, phone plan, subscriptions (Claro móvil, seguros, MetLife, notaría)
- other: anything unclear, including transfers`;

const CLASSIFY_SYSTEM = `Pick the best category for this Colombian merchant.

${CATEGORY_GUIDE}`;

const FULL_PARSE_SYSTEM = `Interpret this Colombian bank email as one Capture Interpreter candidate.

Rules:
- Return exactly one candidate with kind: "transaction", "transfer", "not_trackable", or "needs_review".
- Fill fields that do not apply to the selected kind with null.
- Use "transaction" only when the evidence clearly describes a ledger expense or income.
- Use "transfer" when the evidence clearly describes movement between the user's own accounts.
- Use "not_trackable" for security alerts, OTPs, marketing, balances, or messages without a financial event.
- Use "needs_review" when amount, merchant, date, or event type is ambiguous.
- All amounts are in Colombian Pesos (COP). Commas and dots are thousands separators. Return amount as whole pesos (integer, no centavos). Examples: 7,500 = 7500, 50,000 = 50000.
- amount: amount in whole pesos (integer)
- description: ONLY the merchant/business name, cleaned up (e.g. "EDS La Castellana", "Farmatodo", "MetLife Colombia")
- merchant/payee goes in description, never in account fields.
- date: transaction date in YYYY-MM-DD
- confidence: 0 to 1
- type: "expense" for purchases/payments, "income" for deposits/transfers received
- fromAccountHint: legacy source account/card/wallet hint exactly as described by the bank, or null when absent.
- toAccountHint: legacy destination account/card/wallet hint exactly as described by the bank, or null when absent.
- cardProductHint: card or account product name only when explicitly described, such as "Visa Oro" or "Mastercard Black"; if unsure, return null.
- accountTypeHint: generic payment instrument/account type only, such as "credit card", "savings account", or "wallet"; if unsure, return null.
- counterpartyHint: merchant/payee/counterparty name only, or null when absent.
- Account fields only contain payment instrument/account descriptions. Do not put merchants, payees, stores, apps, counterparties, authorization numbers, amounts, or dates in account fields.

Category guide — pick based on the MERCHANT NAME:
${CATEGORY_GUIDE}`;

const NOTIFICATION_PARSE_SYSTEM = `Interpret this Colombian bank push notification as one Capture Interpreter candidate.

The text is short (1-2 lines). Apply the same rules:
- If the input includes "Local regex hints", treat them as non-authoritative evidence only; resolve conflicts from the full text and return needs_review when event type remains ambiguous.
- Return exactly one candidate with kind: "transaction", "transfer", "not_trackable", or "needs_review".
- Fill fields that do not apply to the selected kind with null.
- Use "transaction" only when the evidence clearly describes a ledger expense or income.
- Use "transaction" for Apple Pay or Google Pay purchases when they include a merchant and amount.
- Use "transfer" only when the text clearly describes movement between the user's own accounts.
- Use "not_trackable" for security alerts, OTPs, marketing, balances, or messages without a financial event.
- Use "needs_review" when amount, merchant, date, or event type is ambiguous.
- All amounts are in Colombian Pesos (COP). Commas and dots are thousands separators. Return amount as whole pesos (integer, no centavos).
- amount: amount in whole pesos (integer)
- description: ONLY the merchant/business name, cleaned up
- merchant/payee goes in description, never in account fields.
- date: transaction date in YYYY-MM-DD (use today if not stated)
- confidence: 0 to 1
- type: "expense" for purchases/payments, "income" for deposits/transfers received
- fromAccountHint: legacy source account/card/wallet hint exactly as described by the notification, or null when absent.
- toAccountHint: legacy destination account/card/wallet hint exactly as described by the notification, or null when absent.
- cardProductHint: card or account product name only when explicitly described, such as "Visa Oro" or "Mastercard Black"; if unsure, return null.
- accountTypeHint: generic payment instrument/account type only, such as "credit card", "savings account", or "wallet"; if unsure, return null.
- counterpartyHint: merchant/payee/counterparty name only, or null when absent.
- Account fields only contain payment instrument/account descriptions. Do not put merchants, payees, stores, apps, counterparties, authorization numbers, amounts, or dates in account fields.

Category guide — pick based on the MERCHANT NAME:
${CATEGORY_GUIDE}`;

const CLASSIFY_SCHEMA = {
  name: "classify_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      categoryId: { type: "string", enum: [...CATEGORY_IDS] },
    },
    required: ["categoryId"],
    additionalProperties: false,
  },
};

const CAPTURE_INTERPRETER_SCHEMA = {
  name: "capture_interpreter_candidate",
  strict: true,
  schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["transaction", "transfer", "not_trackable", "needs_review"] },
      type: { type: ["string", "null"], enum: ["expense", "income", null] },
      amount: { type: ["integer", "null"] },
      categoryId: { type: ["string", "null"], enum: [...CATEGORY_IDS, null] },
      description: { type: ["string", "null"] },
      date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: ["string", "null"] },
      fromAccountHint: { type: ["string", "null"] },
      toAccountHint: { type: ["string", "null"] },
      cardProductHint: { type: ["string", "null"] },
      accountTypeHint: { type: ["string", "null"] },
      counterpartyHint: { type: ["string", "null"] },
    },
    required: [
      "kind",
      "type",
      "amount",
      "categoryId",
      "description",
      "date",
      "confidence",
      "reason",
      "fromAccountHint",
      "toAccountHint",
      "cardProductHint",
      "accountTypeHint",
      "counterpartyHint",
    ],
    additionalProperties: false,
  },
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);
const LLM_SEED = 0;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 300;

function getParseRateLimit() {
  return { key: "parse-email", limit: DEFAULT_RATE_LIMIT_PER_MINUTE };
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function structuredLog(fields: {
  request_id: string;
  user_id: string;
  mode: string;
  success: boolean;
  latency_ms: number;
  error_type: string | null;
  email_count?: number;
}): void {
  console.log(
    JSON.stringify({
      ...fields,
      timestamp: new Date().toISOString(),
    })
  );
}

function readErrorField(err: unknown, field: "status" | "code" | "param" | "type"): string {
  if (typeof err !== "object" || err === null || !(field in err)) return "";
  const value = (err as Record<string, unknown>)[field];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function classifyInternalError(err: unknown): string {
  const status = readErrorField(err, "status");
  const code = readErrorField(err, "code");
  const param = readErrorField(err, "param");
  const type = readErrorField(err, "type");

  if (status || code || param || type) {
    return ["openai_error", status, code, param, type].filter(Boolean).join(":");
  }

  return err instanceof Error ? err.name : "unknown_error";
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  let userId = "";
  let mode = "";

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      structuredLog({
        request_id: requestId,
        user_id: "",
        mode: "",
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "missing_auth",
      });
      return jsonResponse({ success: false, error: "missing_auth" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      structuredLog({
        request_id: requestId,
        user_id: "",
        mode: "",
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "invalid_auth",
      });
      return jsonResponse({ success: false, error: "invalid_auth" }, 401);
    }

    userId = user.id;

    // Body size limit: 10KB
    const bodyResult = await readBodyWithLimit(req);
    if (!bodyResult.ok) {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode: "",
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "body_too_large",
      });
      return jsonResponse({ success: false, error: "body_too_large" }, 413);
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bodyResult.text);
    } catch {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode: "",
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "invalid_json",
      });
      return jsonResponse({ success: false, error: "invalid_json" }, 400);
    }
    if (!payload || typeof payload !== "object") {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode: "",
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "invalid_request",
      });
      return jsonResponse({ success: false, error: "invalid_request" }, 400);
    }
    const emailBody: unknown = payload.body;
    mode = (payload.mode as string) ?? "";

    if (
      typeof emailBody !== "string" ||
      emailBody.trim().length === 0 ||
      !mode ||
      !["classify", "full_parse", "parse_notification"].includes(mode)
    ) {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode,
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "invalid_request",
      });
      return jsonResponse({ success: false, error: "invalid_request" }, 400);
    }

    const rateLimit = getParseRateLimit();
    const rateResult = await checkRateLimit(userId, rateLimit.key, rateLimit.limit);
    if (!rateResult.allowed) {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode,
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "rate_limited",
      });
      return jsonResponse({ success: false, error: "rate_limited" }, 429, {
        "Retry-After": String(rateResult.retryAfterSeconds),
      });
    }

    const systemPrompt =
      mode === "classify"
        ? CLASSIFY_SYSTEM
        : mode === "parse_notification"
          ? NOTIFICATION_PARSE_SYSTEM
          : FULL_PARSE_SYSTEM;
    const jsonSchema = mode === "classify" ? CLASSIFY_SCHEMA : CAPTURE_INTERPRETER_SCHEMA;
    const maxLength = mode === "parse_notification" ? 500 : 2000;
    // Truncate to focus on transaction details, skip legal/footer noise
    const truncatedBody = emailBody.length > maxLength ? emailBody.slice(0, maxLength) : emailBody;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano-2025-08-07",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncatedBody },
      ],
      seed: LLM_SEED,
      response_format: { type: "json_schema", json_schema: jsonSchema },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode,
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "empty_llm_response",
      });
      return jsonResponse({ success: false, error: "empty_llm_response" }, 502);
    }

    const data = JSON.parse(text);

    structuredLog({
      request_id: requestId,
      user_id: userId,
      mode,
      success: true,
      latency_ms: Date.now() - startTime,
      error_type: null,
      email_count: 1,
    });

    return jsonResponse({ success: true, data });
  } catch (err) {
    const errorType = classifyInternalError(err);
    structuredLog({
      request_id: requestId,
      user_id: userId,
      mode,
      success: false,
      latency_ms: Date.now() - startTime,
      error_type: errorType,
    });
    if (errorType.startsWith("openai_error")) {
      return jsonResponse({ success: false, error: errorType }, 200);
    }
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
});

// biome-ignore-all lint/style/useNamingConvention: OpenAI SDK and API field names
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  "transfer",
  "other",
] as const;

const CLASSIFY_SYSTEM = `Pick the best category for this merchant. Respond with ONLY valid JSON: {"categoryId":"<id>"}
Categories: ${CATEGORY_IDS.join(", ")}`;

const FULL_PARSE_SYSTEM = `You are a JSON extractor for Colombian bank transaction emails. Respond with ONLY a JSON object. No explanation, no text before or after.

Required JSON format:
{"type":"expense"|"income","amountCents":number,"categoryId":"string","description":"string","date":"YYYY-MM-DD","confidence":number}

Rules:
- All amounts are in Colombian Pesos (COP). Commas and dots are thousands separators UNLESS followed by exactly 2 digits at the end, which means centavos. Examples: 7,500 = 7500 pesos = 750000 cents. 50,000 = 50000 pesos = 5000000 cents.
- amountCents: amount in centavos (pesos × 100)
- categoryId: one of [${CATEGORY_IDS.join(", ")}]
- description: short merchant/description from the email
- date: transaction date in YYYY-MM-DD format
- confidence: 0 to 1, how certain you are about the extraction
- type: "expense" for purchases/payments, "income" for deposits/transfers received`;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);
const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "missing_auth" }, 401);
    }

    const { error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError) {
      return jsonResponse({ success: false, error: "invalid_auth" }, 401);
    }

    const { body, mode } = await req.json();

    if (!body || !mode || !["classify", "full_parse"].includes(mode)) {
      return jsonResponse({ success: false, error: "invalid_request" }, 400);
    }

    const systemPrompt = mode === "classify" ? CLASSIFY_SYSTEM : FULL_PARSE_SYSTEM;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return jsonResponse({ success: false, error: "empty_llm_response" }, 502);
    }

    const data = JSON.parse(text);
    return jsonResponse({ success: true, data });
  } catch (err) {
    return jsonResponse(
      { success: false, error: err instanceof Error ? err.message : "unknown" },
      500
    );
  }
});

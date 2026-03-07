// biome-ignore-all lint/style/useNamingConvention: OpenAI SDK and API field names
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "missing_auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError) {
      return new Response(JSON.stringify({ success: false, error: "invalid_auth" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { body, mode } = await req.json();

    if (!body || !mode || !["classify", "full_parse"].includes(mode)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

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

    const text = completion.choices[0]?.message?.content ?? "";
    const data = JSON.parse(text);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

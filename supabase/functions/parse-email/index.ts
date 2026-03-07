// biome-ignore-all lint/style/useNamingConvention: OpenAI SDK and API field names
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const CATEGORY_GUIDE = `- food: groceries, restaurants, bakeries, coffee, food delivery (Éxito, Carulla, D1, Rappi, McDonald's, Juan Valdez, Ara, Crepes, PPC, Frisby)
- transport: taxis, gas stations (EDS), tolls, airlines (Uber, DiDi, Terpel, EDS, peajes, Avianca, LATAM)
- entertainment: movies, streaming, games, bars (Netflix, Spotify, Cine Colombia)
- health: pharmacies, doctors, gym (Farmatodo, Droguería, Bodytech, clínica, hospital)
- education: tuition, courses, books (universidad, fundación, Platzi)
- home: rent, utilities, internet, furniture (EPM, Codensa, Claro hogar, Homecenter, arriendo)
- clothing: apparel, shoes (Zara, Falabella, Tennis, Arturo Calle)
- services: insurance, phone plan, subscriptions (Claro móvil, seguros, MetLife, notaría)
- transfer: money transfers (Nequi, Daviplata, PSE, transferencia)
- other: anything unclear`;

const CLASSIFY_SYSTEM = `Pick the best category for this Colombian merchant.

${CATEGORY_GUIDE}`;

const FULL_PARSE_SYSTEM = `Extract transaction data from this Colombian bank email.

Rules:
- All amounts are in Colombian Pesos (COP). Commas and dots are thousands separators UNLESS followed by exactly 2 digits at the end, which means centavos. Examples: 7,500 = 7500 pesos = 750000 cents. 50,000 = 50000 pesos = 5000000 cents.
- amountCents: amount in centavos (pesos × 100)
- description: ONLY the merchant/business name, cleaned up (e.g. "EDS La Castellana", "Farmatodo", "MetLife Colombia")
- date: transaction date in YYYY-MM-DD
- confidence: 0 to 1
- type: "expense" for purchases/payments, "income" for deposits/transfers received

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

const FULL_PARSE_SCHEMA = {
  name: "transaction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["expense", "income"] },
      amountCents: { type: "integer" },
      categoryId: { type: "string", enum: [...CATEGORY_IDS] },
      description: { type: "string" },
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["type", "amountCents", "categoryId", "description", "date", "confidence"],
    additionalProperties: false,
  },
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

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
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "invalid_auth" }, 401);
    }

    const { body, mode } = await req.json();

    if (
      typeof body !== "string" ||
      body.trim().length === 0 ||
      !mode ||
      !["classify", "full_parse"].includes(mode)
    ) {
      return jsonResponse({ success: false, error: "invalid_request" }, 400);
    }

    const systemPrompt = mode === "classify" ? CLASSIFY_SYSTEM : FULL_PARSE_SYSTEM;
    const jsonSchema = mode === "classify" ? CLASSIFY_SCHEMA : FULL_PARSE_SCHEMA;
    // Truncate to focus on transaction details, skip legal/footer noise
    const truncatedBody = body.length > 2000 ? body.slice(0, 2000) : body;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano-2025-08-07",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncatedBody },
      ],
      response_format: { type: "json_schema", json_schema: jsonSchema },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return jsonResponse({ success: false, error: "empty_llm_response" }, 502);
    }

    const data = JSON.parse(text);
    return jsonResponse({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("parse-email error:", message);
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
});

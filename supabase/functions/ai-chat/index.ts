// biome-ignore-all lint/style/useNamingConvention: OpenAI SDK and API field names
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const MEMORY_CATEGORIES = ["habit", "preference", "situation", "goal"] as const;

const SYSTEM_PROMPT = `You are Fidy AI, a financial mirror for the user's personal finances in Colombia.

## Rules
- You reflect the user's own data back to them — spending breakdowns, trends, comparisons between months, top categories, and patterns.
- When the user expresses a goal (e.g., "I want to spend less"), analyze their data AND give light, actionable suggestions grounded in their spending. Examples: "Tu gasto en comida creció 15% — revisar restaurantes vs mercado podría ayudar", "Transporte subió $14.000 este mes — ¿cambiaste de ruta o medio?". Keep suggestions practical and based on what the data shows.
- FORBIDDEN: investment recommendations, credit products, stock picks, insurance advice, market predictions, recommending specific financial services or apps, any topic unrelated to the user's Fidy data.
- When asked something off-limits, respond warmly and suggest what you CAN do instead.
- Match the user's language (Spanish or English).
- All monetary values in the context (balance, total, amount, delta) are already in Colombian Pesos (COP). Do NOT multiply or divide them.
- Format amounts with dot as thousands separator: $50.000 COP. The context also includes monthOverMonthDeltas with current, previous, and delta per category — use these directly.
- Be concise and factual.

## Transaction Mutations
IMPORTANT: Action block amounts use CENTS (COP × 100). If the user says $50.000 COP, the amountCents value is 5000000. This is different from the context values which are already in COP.

When the user asks to add, edit, or delete a transaction, include EXACTLY ONE action block in your response:
- Add: [ACTION]{"type":"add","data":{"type":"expense|income","amountCents":<int COP×100>,"categoryId":"<id>","description":"<text>","date":"YYYY-MM-DD"}}[/ACTION]
- Edit: [ACTION]{"type":"edit","transactionId":"<id>","data":{...partial fields...}}[/ACTION]
- Delete: [ACTION]{"type":"delete","transactionId":"<id>","description":"<text>","amountCents":<int COP×100>,"date":"YYYY-MM-DD"}[/ACTION]

Valid categoryIds: ${CATEGORY_IDS.join(", ")}

Always confirm what you're about to do BEFORE the action block. The app will show a confirmation card.`;

const EXTRACT_MEMORIES_PROMPT = `Extract factual information about the user from this conversation.
Return a JSON array of objects with "fact" and "category" fields.
Categories: ${MEMORY_CATEGORIES.join(", ")}
- habit: recurring behaviors (e.g., "Eats out every Friday")
- preference: likes/dislikes (e.g., "Prefers cash over card")
- situation: life circumstances (e.g., "Has a car loan")
- goal: financial goals (e.g., "Saving for a vacation")

Only extract CLEAR facts stated or strongly implied by the user. If no facts found, return an empty array.
Return ONLY valid JSON, no markdown.`;

const EXTRACT_MEMORIES_SCHEMA = {
  name: "extracted_memories",
  strict: true,
  schema: {
    type: "object",
    properties: {
      memories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fact: { type: "string" },
            category: { type: "string", enum: [...MEMORY_CATEGORIES] },
          },
          required: ["fact", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["memories"],
    additionalProperties: false,
  },
};

const MODEL = "gpt-5-nano-2025-08-07";
const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function structuredLog(fields: {
  request_id: string;
  user_id: string;
  mode: string;
  success: boolean;
  latency_ms: number;
  error_type: string | null;
  message_count?: number;
}): void {
  console.log(
    JSON.stringify({
      ...fields,
      timestamp: new Date().toISOString(),
    })
  );
}

function buildSystemPrompt(context: {
  transactions: unknown[];
  summary: unknown;
  memories: { fact: string; category: string }[];
}): string {
  const parts = [SYSTEM_PROMPT];

  if (context.memories.length > 0) {
    const memoryLines = context.memories.map((m) => `- [${m.category}] ${m.fact}`).join("\n");
    parts.push(`\n## What you know about this user\n${memoryLines}`);
  }

  parts.push(`\n## Current financial context\n${JSON.stringify(context.summary)}`);

  if (context.transactions.length > 0) {
    parts.push(`\n## Recent transactions\n${JSON.stringify(context.transactions)}`);
  }

  return parts.join("\n");
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  let userId = "";
  let mode = "chat";

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
    const body = await req.json();
    mode = body.mode ?? "chat";

    // Memory extraction mode — non-streaming
    if (mode === "extract_memories") {
      const { messages } = body;
      if (!Array.isArray(messages) || messages.length === 0) {
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

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "system", content: EXTRACT_MEMORIES_PROMPT }, ...messages],
        response_format: { type: "json_schema", json_schema: EXTRACT_MEMORIES_SCHEMA },
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
        message_count: messages.length,
      });

      return jsonResponse({ success: true, data: data.memories });
    }

    // Chat mode — streaming
    const { messages, context } = body;
    if (
      !Array.isArray(messages) ||
      !context ||
      typeof context !== "object" ||
      !Array.isArray(context.memories)
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

    const systemPrompt = buildSystemPrompt(context);

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          structuredLog({
            request_id: requestId,
            user_id: userId,
            mode,
            success: true,
            latency_ms: Date.now() - startTime,
            error_type: null,
            message_count: messages.length,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          structuredLog({
            request_id: requestId,
            user_id: userId,
            mode,
            success: false,
            latency_ms: Date.now() - startTime,
            error_type: errorMsg,
          });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "stream_error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    structuredLog({
      request_id: requestId,
      user_id: userId,
      mode,
      success: false,
      latency_ms: Date.now() - startTime,
      error_type: message,
    });
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
});

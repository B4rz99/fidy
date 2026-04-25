// biome-ignore-all lint/style/useNamingConvention: OpenAI SDK and API field names
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { readBodyWithLimit } from "../_shared/body-size.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

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
Action block amounts are in whole COP (pesos). If the user says $50.000 COP, the amount value is 50000.

When the user asks to add, edit, or delete a transaction, include EXACTLY ONE action block in your response:
- Add: [ACTION]{"type":"add","data":{"type":"expense|income","amount":<int COP>,"categoryId":"<id>","description":"<text>","date":"YYYY-MM-DD"}}[/ACTION]
- Edit: [ACTION]{"type":"edit","transactionId":"<id>","data":{...partial fields...}}[/ACTION]
- Delete: [ACTION]{"type":"delete","transactionId":"<id>","description":"<text>","amount":<int COP>,"date":"YYYY-MM-DD"}[/ACTION]

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

function createUserClient(token: string) {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
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
  message_count?: number;
  context_query_ms?: number;
}): void {
  console.log(
    JSON.stringify({
      ...fields,
      timestamp: new Date().toISOString(),
    })
  );
}

type GoalSummary = {
  readonly name: string;
  readonly type: string;
  readonly targetAmount: number;
  readonly currentAmount: number;
  readonly progressPct: number;
};

type FinancialContextPacket = {
  readonly summary: unknown;
  readonly recentTransactions?: readonly unknown[];
  readonly budgets?: readonly unknown[];
  readonly memories?: readonly { readonly fact: string; readonly category: string }[];
  readonly goals?: readonly GoalSummary[];
  readonly accounts?: readonly unknown[];
  readonly captureEvidence?: readonly unknown[];
};

function formatGoalLine(g: GoalSummary): string {
  const amounts = `$${g.currentAmount.toLocaleString("es-CO")} / $${g.targetAmount.toLocaleString("es-CO")} (${g.progressPct}%)`;
  return `- "${g.name}" (${g.type}): ${amounts}`;
}

function buildSystemPrompt(context: { packet: FinancialContextPacket }): string {
  const parts = [SYSTEM_PROMPT];

  if ((context.packet.memories ?? []).length > 0) {
    const memoryLines = (context.packet.memories ?? [])
      .map((memory) => `- [${memory.category}] ${memory.fact}`)
      .join("\n");
    parts.push(`\n## What you know about this user\n${memoryLines}`);
  }

  if ((context.packet.goals ?? []).length > 0) {
    const goalLines = (context.packet.goals ?? []).map(formatGoalLine).join("\n");
    parts.push(`\n## User's Financial Goals\n${goalLines}`);
  }

  parts.push(`\n## Current financial context\n${JSON.stringify(context.packet.summary)}`);

  if ((context.packet.budgets ?? []).length > 0) {
    parts.push(`\n## Current budgets\n${JSON.stringify(context.packet.budgets)}`);
  }

  if ((context.packet.accounts ?? []).length > 0) {
    parts.push(`\n## Financial accounts\n${JSON.stringify(context.packet.accounts)}`);
  }

  if ((context.packet.captureEvidence ?? []).length > 0) {
    parts.push(`\n## Capture evidence signals\n${JSON.stringify(context.packet.captureEvidence)}`);
  }

  if ((context.packet.recentTransactions ?? []).length > 0) {
    parts.push(`\n## Recent transactions\n${JSON.stringify(context.packet.recentTransactions)}`);
  }

  return parts.join("\n");
}

function isFinancialContextPacket(value: unknown): value is FinancialContextPacket {
  return typeof value === "object" && value !== null && "summary" in value;
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

    // Rate limit: 10 requests per minute per user
    const rateResult = await checkRateLimit(userId, "ai-chat", 10);
    if (!rateResult.allowed) {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode: "",
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "rate_limited",
      });
      return jsonResponse({ success: false, error: "rate_limited" }, 429, {
        "Retry-After": String(rateResult.retryAfterSeconds),
      });
    }

    // Body size limit: 100KB (chat payloads include conversation + financial context)
    const bodyResult = await readBodyWithLimit(req, 102400);
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

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyResult.text);
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
    mode = (body.mode as string) ?? "chat";

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

      const extracted: { fact: string; category: string }[] = JSON.parse(text).memories;
      if (extracted.length === 0) {
        structuredLog({
          request_id: requestId,
          user_id: userId,
          mode,
          success: true,
          latency_ms: Date.now() - startTime,
          error_type: null,
          message_count: messages.length,
        });
        return jsonResponse({ success: true, data: [] });
      }

      // Server-side deduplication
      const userClient = createUserClient(token);
      const { data: existing, error: existingError } = await userClient
        .from("user_memories")
        .select("fact")
        .is("deleted_at", null);

      if (existingError) {
        structuredLog({
          request_id: requestId,
          user_id: userId,
          mode,
          success: false,
          latency_ms: Date.now() - startTime,
          error_type: "memory_read_error",
        });
        return jsonResponse({ success: false, error: "memory_read_error" }, 500);
      }

      const existingLower = new Set(
        (existing ?? []).map((m: { fact: string }) => m.fact.toLowerCase())
      );
      const seen = new Set<string>();
      const newFacts = extracted.filter((f) => {
        const lower = f.fact.toLowerCase();
        if (existingLower.has(lower) || seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });

      if (newFacts.length === 0) {
        structuredLog({
          request_id: requestId,
          user_id: userId,
          mode,
          success: true,
          latency_ms: Date.now() - startTime,
          error_type: null,
          message_count: messages.length,
        });
        return jsonResponse({ success: true, data: [] });
      }

      const { data: inserted, error: insertError } = await userClient
        .from("user_memories")
        .insert(newFacts.map((f) => ({ user_id: userId, fact: f.fact, category: f.category })))
        .select("id, fact, category, created_at");

      if (insertError) {
        structuredLog({
          request_id: requestId,
          user_id: userId,
          mode,
          success: false,
          latency_ms: Date.now() - startTime,
          error_type: insertError.message,
        });
        return jsonResponse({ success: false, error: "memory_insert_failed" }, 500);
      }

      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode,
        success: true,
        latency_ms: Date.now() - startTime,
        error_type: null,
        message_count: messages.length,
      });

      return jsonResponse({ success: true, data: inserted ?? [] });
    }

    // Chat mode — streaming
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

    const { financialContextPacket } = body;
    if (!isFinancialContextPacket(financialContextPacket)) {
      structuredLog({
        request_id: requestId,
        user_id: userId,
        mode,
        success: false,
        latency_ms: Date.now() - startTime,
        error_type: "invalid_context_packet",
      });
      return jsonResponse({ success: false, error: "invalid_context_packet" }, 400);
    }

    const systemPrompt = buildSystemPrompt({ packet: financialContextPacket });

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
            context_query_ms: 0,
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

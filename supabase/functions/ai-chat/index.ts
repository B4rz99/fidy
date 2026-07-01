// biome-ignore-all lint/style/useNamingConvention: OpenAI SDK and API field names
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { readBodyWithLimit } from "../_shared/body-size.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { classifyAiChatInternalError } from "./error-classification.ts";
import {
  type FinancialContextGoalSummary,
  type FinancialContextPacket,
  inferFinancialContextPacketTaskFromMessages,
  readFinancialContextPacket,
} from "./financial-context-packet.ts";

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

const MODEL = "gpt-5-nano-2025-08-07";
const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

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
  // eslint-disable-next-line no-console -- Supabase Edge Function structured request log.
  console.log(
    JSON.stringify({
      ...fields,
      timestamp: new Date().toISOString(),
    })
  );
}

function formatGoalLine(g: FinancialContextGoalSummary): string {
  const amounts = `$${g.currentAmount.toLocaleString("es-CO")} / $${g.targetAmount.toLocaleString("es-CO")} (${g.progressPct}%)`;
  return `- "${g.name}" (${g.type}): ${amounts}`;
}

function buildSystemPrompt(context: { packet: FinancialContextPacket }): string {
  const parts = [SYSTEM_PROMPT];

  parts.push(`\n## Financial context task\n${context.packet.task.kind}`);

  if ((context.packet.goals ?? []).length > 0) {
    const goalLines = (context.packet.goals ?? []).map(formatGoalLine).join("\n");
    parts.push(`\n## User's Financial Goals\n${goalLines}`);
  }

  if (context.packet.summary !== undefined) {
    parts.push(`\n## Current financial context\n${JSON.stringify(context.packet.summary)}`);
  }

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

    const financialContextPacketTask = inferFinancialContextPacketTaskFromMessages(messages);
    const financialContextPacket = readFinancialContextPacket(
      body.financialContextPacket,
      financialContextPacketTask
    );
    if (financialContextPacket === null) {
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
          const errorType = classifyAiChatInternalError(err);
          structuredLog({
            request_id: requestId,
            user_id: userId,
            mode,
            success: false,
            latency_ms: Date.now() - startTime,
            error_type: errorType,
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
    const errorType = classifyAiChatInternalError(err);
    structuredLog({
      request_id: requestId,
      user_id: userId,
      mode,
      success: false,
      latency_ms: Date.now() - startTime,
      error_type: errorType,
    });
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
});

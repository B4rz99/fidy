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
- You reflect the user's own data back to them. You NEVER give financial advice.
- FORBIDDEN: investment recommendations, credit products, stock picks, insurance advice, market predictions, any topic unrelated to the user's Fidy data.
- When asked something off-limits, respond warmly and suggest what you CAN do instead.
- Match the user's language (Spanish or English).
- All amounts are in Colombian Pesos (COP). Format with thousands separators: $50.000 COP.
- Be concise and factual.

## Transaction Mutations
When the user asks to add, edit, or delete a transaction, include EXACTLY ONE action block in your response:
- Add: [ACTION]{"type":"add","data":{"type":"expense|income","amountCents":<int>,"categoryId":"<id>","description":"<text>","date":"YYYY-MM-DD"}}[/ACTION]
- Edit: [ACTION]{"type":"edit","transactionId":"<id>","data":{...partial fields...}}[/ACTION]
- Delete: [ACTION]{"type":"delete","transactionId":"<id>","description":"<text>","amountCents":<int>,"date":"YYYY-MM-DD"}[/ACTION]

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
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

    const body = await req.json();
    const { mode } = body;

    // Memory extraction mode — non-streaming
    if (mode === "extract_memories") {
      const { messages } = body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return jsonResponse({ success: false, error: "invalid_request" }, 400);
      }

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "system", content: EXTRACT_MEMORIES_PROMPT }, ...messages],
        response_format: { type: "json_schema", json_schema: EXTRACT_MEMORIES_SCHEMA },
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        return jsonResponse({ success: false, error: "empty_llm_response" }, 502);
      }

      const data = JSON.parse(text);
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
        } catch (err) {
          console.error("stream error:", err instanceof Error ? err.message : String(err));
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
    console.error("ai-chat error:", message);
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
});

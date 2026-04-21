import { type ChatAction, chatActionSchema } from "../schema";

const ACTION_REGEX = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/;

export const ACTION_BLOCK_REGEX = /\[ACTION\][\s\S]*?\[\/ACTION\]/g;

function extractActionPayload(text: string): string | null {
  const match = ACTION_REGEX.exec(text);
  return match?.[1] ?? null;
}

function parseChatAction(payload: string): ChatAction | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    const result = chatActionSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseActionFromResponse(text: string): ChatAction | null {
  const payload = extractActionPayload(text);
  return payload == null ? null : parseChatAction(payload);
}

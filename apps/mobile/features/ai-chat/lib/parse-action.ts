import { type ChatAction, chatActionSchema } from "../schema";

const ACTION_REGEX = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/;

export const ACTION_BLOCK_REGEX = /\[ACTION\][\s\S]*?\[\/ACTION\]/g;

export function parseActionFromResponse(text: string): ChatAction | null {
  const match = ACTION_REGEX.exec(text);
  if (!match) return null;

  try {
    const parsed: unknown = JSON.parse(match[1] ?? "");
    const result = chatActionSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

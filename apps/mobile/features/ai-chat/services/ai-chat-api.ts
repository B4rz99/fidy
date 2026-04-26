import type { FinancialContextPacket } from "@/features/advisor/public";
import { createAiChatApiService } from "./create-ai-chat-api-service";

type ChatMessage = { readonly role: "user" | "assistant"; readonly content: string };

type StreamCallbacks = {
  readonly onChunk: (text: string) => void;
  readonly onDone: () => void;
  readonly onError: (error: string) => void;
};

type StreamChatOptions = {
  readonly signal?: AbortSignal;
  readonly financialContextPacket?: FinancialContextPacket;
};

const aiChatApi = createAiChatApiService();

export async function streamChat(
  messages: readonly ChatMessage[],
  callbacks: StreamCallbacks,
  options?: StreamChatOptions
): Promise<void> {
  return aiChatApi.streamChat(messages, callbacks, options);
}

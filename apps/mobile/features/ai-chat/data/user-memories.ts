import type { UserId, UserMemoryId } from "@/shared/types/branded";
import type { UserMemory } from "../schema";
import { createUserMemoryRemoteService, toUserMemory } from "./create-user-memory-remote-service";

type ConversationMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

const userMemoryRemoteService = createUserMemoryRemoteService();

export async function listUserMemories(userId: UserId): Promise<readonly UserMemory[]> {
  return userMemoryRemoteService.listUserMemories(userId);
}

export async function softDeleteUserMemory(id: UserMemoryId): Promise<void> {
  return userMemoryRemoteService.softDeleteUserMemory(id);
}

export async function extractMemoriesFromConversation(
  messages: readonly ConversationMessage[]
): Promise<readonly UserMemory[]> {
  return userMemoryRemoteService.extractMemoriesFromConversation(messages);
}

export { toUserMemory };

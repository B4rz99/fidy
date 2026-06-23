import type { UserId } from "@/shared/types/branded";
import { createEmptyCloudLedgerCache, type CloudLedgerCache } from "./cache";

export type CloudLedgerRuntimeCacheWriteToken = {
  readonly userId: UserId;
  readonly generation: number;
};

const cachesByUserId = new Map<string, CloudLedgerCache>();
const generationsByUserId = new Map<string, number>();

function getCloudLedgerRuntimeCacheGeneration(userId: UserId): number {
  return generationsByUserId.get(userId) ?? 0;
}

export function beginCloudLedgerRuntimeCacheWrite(
  userId: UserId
): CloudLedgerRuntimeCacheWriteToken {
  return { userId, generation: getCloudLedgerRuntimeCacheGeneration(userId) };
}

export function getCloudLedgerRuntimeCache(userId: UserId): CloudLedgerCache {
  const existing = cachesByUserId.get(userId);
  if (existing !== undefined) {
    return existing;
  }
  const cache = createEmptyCloudLedgerCache();
  cachesByUserId.set(userId, cache);
  return cache;
}

export function setCloudLedgerRuntimeCache(userId: UserId, cache: CloudLedgerCache): void {
  cachesByUserId.set(userId, cache);
}

export function setCloudLedgerRuntimeCacheIfCurrent(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken,
  cache: CloudLedgerCache
): boolean {
  if (
    writeToken.userId !== userId ||
    writeToken.generation !== getCloudLedgerRuntimeCacheGeneration(userId)
  ) {
    return false;
  }
  setCloudLedgerRuntimeCache(userId, cache);
  return true;
}

export function clearCloudLedgerRuntimeCache(userId: UserId): void {
  cachesByUserId.delete(userId);
  generationsByUserId.set(userId, getCloudLedgerRuntimeCacheGeneration(userId) + 1);
}

export function resetCloudLedgerRuntimeCaches(): void {
  cachesByUserId.clear();
  generationsByUserId.clear();
}

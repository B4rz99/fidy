import type { UserId } from "@/shared/types/branded";
import { createEmptyCloudLedgerCache, type CloudLedgerCache } from "./cache";

const cachesByUserId = new Map<string, CloudLedgerCache>();

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

export function clearCloudLedgerRuntimeCache(userId: UserId): void {
  cachesByUserId.delete(userId);
}

export function resetCloudLedgerRuntimeCaches(): void {
  cachesByUserId.clear();
}

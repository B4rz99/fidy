import type { UserId } from "@/shared/types/branded";
import { createEmptyCloudLedgerCache, type CloudLedgerCache } from "./cache";

export type CloudLedgerRuntimeCacheWriteToken = {
  readonly userId: UserId;
  readonly generation: number;
};

const cachesByUserId = new Map<string, CloudLedgerCache>();
const generationsByUserId = new Map<string, number>();
const abortControllersByUserId = new Map<string, Map<number, Set<AbortController>>>();
const activeWriteGenerationsByUserId = new Map<string, number>();
const suspendedWriteUserIds = new Set<string>();

function getCloudLedgerRuntimeCacheGeneration(userId: UserId): number {
  return generationsByUserId.get(userId) ?? 0;
}

function invalidateCloudLedgerRuntimeCacheWrites(userId: UserId): void {
  abortCloudLedgerRuntimeCacheWriteControllers(userId);
  activeWriteGenerationsByUserId.delete(userId);
  generationsByUserId.set(userId, getCloudLedgerRuntimeCacheGeneration(userId) + 1);
}

function abortCloudLedgerRuntimeCacheWriteControllers(userId: UserId): void {
  const controllersByGeneration = abortControllersByUserId.get(userId);
  if (controllersByGeneration === undefined) {
    return;
  }
  controllersByGeneration.forEach((controllers) => {
    controllers.forEach((controller) => controller.abort());
  });
  abortControllersByUserId.delete(userId);
}

function releaseCloudLedgerRuntimeCacheWriteAbortController(
  userId: UserId,
  generation: number,
  controller: AbortController
): void {
  const controllersByGeneration = abortControllersByUserId.get(userId);
  const controllers = controllersByGeneration?.get(generation);
  if (controllers === undefined) {
    return;
  }
  controllers.delete(controller);
  if (controllers.size === 0) {
    controllersByGeneration?.delete(generation);
  }
  if (controllersByGeneration?.size === 0) {
    abortControllersByUserId.delete(userId);
  }
}

export function suspendCloudLedgerRuntimeCacheWrites(userId: UserId): void {
  suspendedWriteUserIds.add(userId);
  invalidateCloudLedgerRuntimeCacheWrites(userId);
}

export function resumeCloudLedgerRuntimeCacheWrites(userId: UserId): void {
  if (!suspendedWriteUserIds.delete(userId)) {
    return;
  }
  invalidateCloudLedgerRuntimeCacheWrites(userId);
}

export function beginCloudLedgerRuntimeCacheWrite(
  userId: UserId
): CloudLedgerRuntimeCacheWriteToken {
  invalidateCloudLedgerRuntimeCacheWrites(userId);
  const writeToken = { userId, generation: getCloudLedgerRuntimeCacheGeneration(userId) };
  if (!suspendedWriteUserIds.has(userId)) {
    activeWriteGenerationsByUserId.set(userId, writeToken.generation);
  }
  return writeToken;
}

export function beginCloudLedgerRuntimeCacheFlush(
  userId: UserId
): CloudLedgerRuntimeCacheWriteToken | null {
  if (suspendedWriteUserIds.has(userId) || activeWriteGenerationsByUserId.has(userId)) {
    return null;
  }
  invalidateCloudLedgerRuntimeCacheWrites(userId);
  return { userId, generation: getCloudLedgerRuntimeCacheGeneration(userId) };
}

export function finishCloudLedgerRuntimeCacheWrite(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken
): void {
  if (activeWriteGenerationsByUserId.get(userId) === writeToken.generation) {
    activeWriteGenerationsByUserId.delete(userId);
  }
}

export function isCloudLedgerRuntimeCacheWriteCurrent(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken
): boolean {
  return (
    !suspendedWriteUserIds.has(userId) &&
    writeToken.userId === userId &&
    writeToken.generation === getCloudLedgerRuntimeCacheGeneration(userId)
  );
}

export function createCloudLedgerRuntimeCacheWriteAbortSignal(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken
): AbortSignal | null {
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) {
    return null;
  }

  const controller = new AbortController();
  const controllersByGeneration =
    abortControllersByUserId.get(userId) ?? new Map<number, Set<AbortController>>();
  const controllers = controllersByGeneration.get(writeToken.generation) ?? new Set();
  controllers.add(controller);
  controllersByGeneration.set(writeToken.generation, controllers);
  abortControllersByUserId.set(userId, controllersByGeneration);
  controller.signal.addEventListener(
    "abort",
    () =>
      releaseCloudLedgerRuntimeCacheWriteAbortController(userId, writeToken.generation, controller),
    { once: true }
  );
  return controller.signal;
}

export function releaseCloudLedgerRuntimeCacheWriteAbortSignal(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken,
  signal: AbortSignal | null
): void {
  if (signal === null) {
    return;
  }
  const controllers = abortControllersByUserId.get(userId)?.get(writeToken.generation);
  const controller = [...(controllers ?? [])].find((candidate) => candidate.signal === signal);
  if (controller !== undefined) {
    releaseCloudLedgerRuntimeCacheWriteAbortController(userId, writeToken.generation, controller);
  }
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
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) {
    return false;
  }
  setCloudLedgerRuntimeCache(userId, cache);
  return true;
}

export function clearCloudLedgerRuntimeCache(userId: UserId): void {
  cachesByUserId.delete(userId);
  invalidateCloudLedgerRuntimeCacheWrites(userId);
}

export function resetCloudLedgerRuntimeCaches(): void {
  cachesByUserId.clear();
  generationsByUserId.clear();
  activeWriteGenerationsByUserId.clear();
  abortControllersByUserId.forEach((controllersByGeneration) => {
    controllersByGeneration.forEach((controllers) => {
      controllers.forEach((controller) => controller.abort());
    });
  });
  abortControllersByUserId.clear();
  suspendedWriteUserIds.clear();
}

import NetInfo from "@react-native-community/netinfo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/shared/db/supabase";
import type { IsoDateTime, LedgerChangeId, UserId } from "@/shared/types/branded";
import type { CloudLedgerCreateTransactionCommand } from "./cache";
import {
  createOfflineCloudLedgerTransaction,
  flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox,
  restoreOptimisticCloudLedgerCache,
} from "./outbox";
import {
  beginCloudLedgerRuntimeCacheWrite,
  createCloudLedgerRuntimeCacheWriteAbortSignal,
  getCloudLedgerRuntimeCache,
  isCloudLedgerRuntimeCacheWriteCurrent,
  releaseCloudLedgerRuntimeCacheWriteAbortSignal,
  resumeCloudLedgerRuntimeCacheWrites,
  setCloudLedgerRuntimeCacheIfCurrent,
  type CloudLedgerRuntimeCacheWriteToken,
} from "./runtime";

export type CloudLedgerOptimisticCreateResult = {
  readonly didWriteRuntimeCache: boolean;
  readonly flushIfOnline: () => Promise<void>;
};

export async function restoreCloudLedgerOptimisticRuntimeState(userId: UserId): Promise<boolean> {
  resumeCloudLedgerRuntimeCacheWrites(userId);
  const writeToken = beginCloudLedgerRuntimeCacheWrite(userId);
  return setCloudLedgerRuntimeCacheIfCurrent(
    userId,
    writeToken,
    await restoreOptimisticCloudLedgerCache({
      cache: getCloudLedgerRuntimeCache(userId),
      outbox: getCloudLedgerOutbox(userId),
    })
  );
}

export async function flushCloudLedgerOutboxForUser(userId: UserId): Promise<boolean> {
  const writeToken = beginCloudLedgerRuntimeCacheWrite(userId);
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) {
    return false;
  }
  return flushCloudLedgerOutboxIfCurrent(userId, writeToken, getSupabase());
}

export async function enqueueCloudLedgerOptimisticCreate(input: {
  readonly userId: UserId;
  readonly changeId: LedgerChangeId;
  readonly command: CloudLedgerCreateTransactionCommand;
  readonly createdAt: IsoDateTime;
}): Promise<CloudLedgerOptimisticCreateResult> {
  const writeToken = beginCloudLedgerRuntimeCacheWrite(input.userId);
  if (!isCloudLedgerRuntimeCacheWriteCurrent(input.userId, writeToken)) {
    return {
      didWriteRuntimeCache: false,
      flushIfOnline: async () => undefined,
    };
  }
  const optimisticCache = await createOfflineCloudLedgerTransaction({
    cache: getCloudLedgerRuntimeCache(input.userId),
    changeId: input.changeId,
    command: input.command,
    createdAt: input.createdAt,
    outbox: getCloudLedgerOutbox(input.userId),
  });
  const didWriteRuntimeCache = setCloudLedgerRuntimeCacheIfCurrent(
    input.userId,
    writeToken,
    optimisticCache
  );

  return {
    didWriteRuntimeCache,
    flushIfOnline: async () => {
      if (!didWriteRuntimeCache) {
        return;
      }
      await flushCloudLedgerOutboxAfterOptimisticCreate(input.userId, writeToken);
    },
  };
}

async function flushCloudLedgerOutboxAfterOptimisticCreate(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken
): Promise<void> {
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) return;
  const networkState = await NetInfo.fetch();
  if (networkState.isConnected !== true) return;
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) return;

  const supabase = getSupabase();
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error != null || sessionResult.data.session == null) return;
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) return;

  await flushCloudLedgerOutboxIfCurrent(userId, writeToken, supabase);
}

async function flushCloudLedgerOutboxIfCurrent(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken,
  supabase: SupabaseClient
): Promise<boolean> {
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) {
    return false;
  }
  const abortSignal = createCloudLedgerRuntimeCacheWriteAbortSignal(userId, writeToken);
  if (abortSignal === null) {
    return false;
  }
  try {
    const cache = await flushPendingCloudLedgerChanges({
      abortSignal,
      cache: getCloudLedgerRuntimeCache(userId),
      outbox: getCloudLedgerOutbox(userId),
      supabase,
      shouldContinue: () => isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken),
    });
    return setCloudLedgerRuntimeCacheIfCurrent(userId, writeToken, cache);
  } finally {
    releaseCloudLedgerRuntimeCacheWriteAbortSignal(userId, writeToken, abortSignal);
  }
}

import NetInfo from "@react-native-community/netinfo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/shared/db/supabase";
import type { IsoDateTime, LedgerChangeId, TransactionId, UserId } from "@/shared/types/branded";
import type { CloudLedgerCreateTransactionCommand, CloudLedgerTransaction } from "./cache";
import {
  amendOfflineCloudLedgerTransaction,
  createOfflineCloudLedgerTransaction,
  deleteOfflineCloudLedgerTransaction,
  flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox,
  restoreOptimisticCloudLedgerCache,
} from "./outbox";
import {
  beginCloudLedgerRuntimeCacheFlush,
  beginCloudLedgerRuntimeCacheWrite,
  createCloudLedgerRuntimeCacheWriteAbortSignal,
  finishCloudLedgerRuntimeCacheWrite,
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
export type CloudLedgerOptimisticMutationResult = CloudLedgerOptimisticCreateResult;
type EnqueueCloudLedgerOptimisticMutationInput = {
  readonly userId: UserId;
  readonly applyOfflineChange: () => Promise<ReturnType<typeof getCloudLedgerRuntimeCache>>;
};

export async function restoreCloudLedgerOptimisticRuntimeState(userId: UserId): Promise<boolean> {
  resumeCloudLedgerRuntimeCacheWrites(userId);
  const writeToken = beginCloudLedgerRuntimeCacheWrite(userId);
  try {
    return setCloudLedgerRuntimeCacheIfCurrent(
      userId,
      writeToken,
      await restoreOptimisticCloudLedgerCache({
        cache: getCloudLedgerRuntimeCache(userId),
        outbox: getCloudLedgerOutbox(userId),
      })
    );
  } finally {
    finishCloudLedgerRuntimeCacheWrite(userId, writeToken);
  }
}

export async function flushCloudLedgerOutboxForUser(userId: UserId): Promise<boolean> {
  const writeToken = beginCloudLedgerRuntimeCacheFlush(userId);
  if (writeToken === null || !isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) {
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
  return enqueueCloudLedgerOptimisticMutation({
    userId: input.userId,
    applyOfflineChange: () =>
      createOfflineCloudLedgerTransaction({
        cache: getCloudLedgerRuntimeCache(input.userId),
        changeId: input.changeId,
        command: input.command,
        createdAt: input.createdAt,
        outbox: getCloudLedgerOutbox(input.userId),
      }),
  });
}

async function enqueueCloudLedgerOptimisticMutation(
  input: EnqueueCloudLedgerOptimisticMutationInput
): Promise<CloudLedgerOptimisticMutationResult> {
  const writeToken = beginCloudLedgerRuntimeCacheWrite(input.userId);
  try {
    if (!isCloudLedgerRuntimeCacheWriteCurrent(input.userId, writeToken)) {
      return inactiveCloudLedgerOptimisticMutation();
    }
    const optimisticCache = await input.applyOfflineChange();
    const didWriteRuntimeCache = setCloudLedgerRuntimeCacheIfCurrent(
      input.userId,
      writeToken,
      optimisticCache
    );

    return cloudLedgerOptimisticMutationResult(input.userId, writeToken, didWriteRuntimeCache);
  } finally {
    finishCloudLedgerRuntimeCacheWrite(input.userId, writeToken);
  }
}

function inactiveCloudLedgerOptimisticMutation(): CloudLedgerOptimisticMutationResult {
  return {
    didWriteRuntimeCache: false,
    flushIfOnline: async () => undefined,
  };
}

function cloudLedgerOptimisticMutationResult(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken,
  didWriteRuntimeCache: boolean
): CloudLedgerOptimisticMutationResult {
  return {
    didWriteRuntimeCache,
    flushIfOnline: async () => {
      if (!didWriteRuntimeCache) {
        return;
      }
      await flushCloudLedgerOutboxAfterOptimisticMutation(userId, writeToken);
    },
  };
}

export async function enqueueCloudLedgerOptimisticAmend(input: {
  readonly userId: UserId;
  readonly changeId: LedgerChangeId;
  readonly transaction: CloudLedgerTransaction;
  readonly expectedVersion: number;
  readonly createdAt: IsoDateTime;
}): Promise<CloudLedgerOptimisticMutationResult> {
  return enqueueCloudLedgerOptimisticMutation({
    userId: input.userId,
    applyOfflineChange: () =>
      amendOfflineCloudLedgerTransaction({
        cache: getCloudLedgerRuntimeCache(input.userId),
        changeId: input.changeId,
        createdAt: input.createdAt,
        expectedVersion: input.expectedVersion,
        outbox: getCloudLedgerOutbox(input.userId),
        transaction: input.transaction,
      }),
  });
}

export async function enqueueCloudLedgerOptimisticDelete(input: {
  readonly userId: UserId;
  readonly changeId: LedgerChangeId;
  readonly transactionId: TransactionId;
  readonly expectedVersion: number;
  readonly createdAt: IsoDateTime;
}): Promise<CloudLedgerOptimisticMutationResult> {
  return enqueueCloudLedgerOptimisticMutation({
    userId: input.userId,
    applyOfflineChange: () =>
      deleteOfflineCloudLedgerTransaction({
        cache: getCloudLedgerRuntimeCache(input.userId),
        changeId: input.changeId,
        createdAt: input.createdAt,
        expectedVersion: input.expectedVersion,
        outbox: getCloudLedgerOutbox(input.userId),
        transactionId: input.transactionId,
      }),
  });
}

async function flushCloudLedgerOutboxAfterOptimisticMutation(
  userId: UserId,
  writeToken: CloudLedgerRuntimeCacheWriteToken
): Promise<void> {
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) return;
  const networkState = await NetInfo.fetch();
  if (networkState.isConnected !== true) return;
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) return;

  const supabase = getSupabase();
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
  if (!(await hasSupabaseSessionForUser(supabase, userId))) {
    return false;
  }
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

async function hasSupabaseSessionForUser(
  supabase: SupabaseClient,
  userId: UserId
): Promise<boolean> {
  const sessionResult = await supabase.auth.getSession();
  return sessionResult.error == null && sessionResult.data.session?.user.id === userId;
}

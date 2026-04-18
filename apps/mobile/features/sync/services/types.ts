import type { AnyDb } from "@/shared/db";
import type { SyncConflictId } from "@/shared/types/branded";

export type TransactionSnapshot = {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string | null;
  readonly date: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly source: string;
};

export type SyncConflict = {
  readonly id: string;
  readonly transactionId: string;
  readonly localData: TransactionSnapshot;
  readonly serverData: TransactionSnapshot;
  readonly detectedAt: string;
};

export type SyncContext = {
  readonly db: AnyDb;
};

export type SyncReason = "startup" | "foreground" | "reconnected" | "manual";

export type SyncInput = SyncContext & {
  readonly userId: string;
  readonly reason?: SyncReason;
};

export type SyncRunResult =
  | {
      readonly status: "synced";
      readonly unresolvedConflicts: number;
    }
  | {
      readonly status: "skipped_offline";
      readonly unresolvedConflicts: number;
    }
  | {
      readonly status: "failed_pull";
      readonly unresolvedConflicts: number;
    };

export type ConflictResolution = "local" | "server";

export type ResolveTransactionConflictInput = SyncContext & {
  readonly conflictId: SyncConflictId;
  readonly resolution: ConflictResolution;
};

export type ResolveConflictResult = {
  readonly unresolvedConflicts: number;
};

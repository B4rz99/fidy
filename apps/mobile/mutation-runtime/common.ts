import { enqueueSync } from "@/shared/db";
import {
  type CommandEffectResult,
  type MutationCommand,
  type MutationEffect,
  toSyncEntry,
} from "@/shared/mutations";
import type { MutationDb } from "@/shared/mutations/write-through";

export type MutationKind = MutationCommand["kind"];
export type MutationCommandByKind<Kind extends MutationKind = MutationKind> = Extract<
  MutationCommand,
  { kind: Kind }
>;
export type MutationHandler<Kind extends MutationKind> = (
  db: MutationDb,
  command: MutationCommandByKind<Kind>
) => CommandEffectResult;
export type MutationHandlerRegistry = {
  [Kind in MutationKind]: MutationHandler<Kind>;
};
export type MutationHandlerSubset<Kind extends MutationKind> = Pick<MutationHandlerRegistry, Kind>;

type SyncChange = {
  tableName: Parameters<typeof toSyncEntry>[0];
  rowId: Parameters<typeof toSyncEntry>[1];
  operation: Parameters<typeof toSyncEntry>[2];
  createdAt: Parameters<typeof toSyncEntry>[3];
};

export const completeCommand = (
  afterCommit: readonly MutationEffect[] | undefined,
  didMutate = true
): CommandEffectResult => ({ didMutate, effects: afterCommit ?? [] });

export const queueSyncChange = (db: MutationDb, change: SyncChange): void => {
  enqueueSync(db, toSyncEntry(change.tableName, change.rowId, change.operation, change.createdAt));
};

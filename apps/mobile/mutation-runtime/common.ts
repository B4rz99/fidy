import type { CommandEffectResult, MutationCommand, MutationEffect } from "@/shared/mutations";
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

export const completeCommand = (
  afterCommit: readonly MutationEffect[] | undefined,
  didMutate = true
): CommandEffectResult => ({ didMutate, effects: afterCommit ?? [] });

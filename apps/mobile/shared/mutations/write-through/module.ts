import type { MutationCommand, MutationDb, MutationEffect, MutationOutcome } from "./commands";
import { getMutationPolicy } from "./policy";

export type WriteThroughMutationModule = {
  commit: (command: MutationCommand) => Promise<MutationOutcome>;
  commitBatch: (commands: readonly MutationCommand[]) => Promise<readonly MutationOutcome[]>;
};

export type CommandEffectResult = {
  didMutate: boolean;
  effects: readonly MutationEffect[];
};

export type MutationCommandApplier = (
  db: MutationDb,
  command: MutationCommand
) => CommandEffectResult;

function runEffects(effects: readonly MutationEffect[]): Promise<void> {
  return effects.reduce(async (previous, effect) => {
    await previous;
    await effect();
  }, Promise.resolve());
}

export function createGenericWriteThroughMutationModule(
  db: { transaction: (fn: (tx: MutationDb) => unknown) => unknown },
  applyCommand: MutationCommandApplier
): WriteThroughMutationModule {
  return {
    commit: async (command) => {
      try {
        const result = db.transaction((tx) => applyCommand(tx, command)) as CommandEffectResult;
        await runEffects(result.effects);
        return { success: true, didMutate: result.didMutate };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Mutation failed",
        };
      }
    },
    commitBatch: async (commands) => {
      try {
        const result = db.transaction((tx) =>
          commands.reduce<{
            outcomes: readonly MutationOutcome[];
            effects: readonly MutationEffect[];
          }>(
            (acc, command) => {
              const next = applyCommand(tx, command);
              return {
                outcomes: [...acc.outcomes, { success: true, didMutate: next.didMutate }],
                effects: [...acc.effects, ...next.effects],
              };
            },
            { outcomes: [], effects: [] }
          )
        ) as {
          outcomes: readonly MutationOutcome[];
          effects: readonly MutationEffect[];
        };
        await runEffects(result.effects);
        return result.outcomes;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Mutation failed";
        return commands.map(() => ({ success: false, error: message }));
      }
    },
  };
}

export { getMutationPolicy };

export type BootstrapTask<Context> = {
  readonly id: string;
  readonly isEnabled?: (context: Context) => boolean;
  readonly run: (context: Context) => void | Promise<void>;
};

export type SubscriptionTask<Context> = {
  readonly id: string;
  readonly isEnabled?: (context: Context) => boolean;
  readonly subscribe: (context: Context) => void | (() => void);
};

const isTaskEnabled = <Context>(
  task: { readonly isEnabled?: (context: Context) => boolean },
  context: Context
) => task.isEnabled?.(context) ?? true;

export async function runBootstrapTasks<Context>(
  context: Context,
  tasks: readonly BootstrapTask<Context>[]
): Promise<void> {
  for (const task of tasks) {
    if (!isTaskEnabled(task, context)) continue;
    await task.run(context);
  }
}

const isCleanup = (value: void | (() => void)): value is () => void => typeof value === "function";

export const subscribeBootstrapTasks = <Context>(
  context: Context,
  tasks: readonly SubscriptionTask<Context>[]
): (() => void) => {
  const cleanups = tasks
    .filter((task) => isTaskEnabled(task, context))
    .map((task) => task.subscribe(context))
    .filter(isCleanup);

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
};

export type BootstrapTask<Context> = {
  readonly id: string;
  readonly isEnabled?: (context: Context) => boolean;
  readonly run: (context: Context) => void | Promise<void>;
};

export type SubscriptionTask<Context> = {
  readonly id: string;
  readonly isEnabled?: (context: Context) => boolean;
  readonly subscribe: (context: Context) => undefined | (() => void);
};

const isTaskEnabled = <Context>(
  task: { readonly isEnabled?: (context: Context) => boolean },
  context: Context
) => task.isEnabled?.(context) ?? true;

const isBootstrapContextCurrent = <Context>(context: Context): boolean => {
  const currentCheck = (context as { readonly isCurrent?: unknown }).isCurrent;
  return typeof currentCheck === "function" ? currentCheck() === true : true;
};

export async function runBootstrapTasks<Context>(
  context: Context,
  tasks: readonly BootstrapTask<Context>[]
): Promise<void> {
  for (const task of tasks) {
    if (!isBootstrapContextCurrent(context)) return;
    if (!isTaskEnabled(task, context)) continue;
    await task.run(context);
    if (!isBootstrapContextCurrent(context)) return;
  }
}

type Cleanup = () => void;

const isCleanup = (value: undefined | Cleanup): value is Cleanup => typeof value === "function";

const collectCleanupErrors = (cleanups: readonly Cleanup[]): readonly unknown[] => {
  const errors: unknown[] = [];

  for (const cleanup of cleanups) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
    }
  }

  return errors;
};

const throwCleanupErrors = (errors: readonly unknown[], message: string): void => {
  if (errors.length === 0) {
    return;
  }

  if (errors.length === 1) {
    throw errors[0];
  }

  throw new AggregateError(errors, message);
};

const registerCleanup = (cleanups: Cleanup[], value: undefined | Cleanup): void => {
  if (isCleanup(value)) {
    cleanups.push(value);
  }
};

const throwSubscribeFailure = (
  taskId: string,
  error: unknown,
  cleanups: readonly Cleanup[]
): never => {
  const cleanupErrors = collectCleanupErrors(cleanups);
  if (cleanupErrors.length === 0) {
    throw error;
  }

  throw new AggregateError(
    [error, ...cleanupErrors],
    `Bootstrap subscription task "${taskId}" failed`
  );
};

const subscribeTask = <Context>(
  context: Context,
  task: SubscriptionTask<Context>,
  cleanups: Cleanup[]
): void => {
  if (!isTaskEnabled(task, context)) {
    return;
  }

  try {
    registerCleanup(cleanups, task.subscribe(context));
  } catch (error) {
    throwSubscribeFailure(task.id, error, cleanups);
  }
};

export const subscribeBootstrapTasks = <Context>(
  context: Context,
  tasks: readonly SubscriptionTask<Context>[]
): (() => void) => {
  const cleanups: Cleanup[] = [];

  for (const task of tasks) {
    subscribeTask(context, task, cleanups);
  }

  return () => {
    throwCleanupErrors(collectCleanupErrors(cleanups), "Bootstrap cleanup failed");
  };
};

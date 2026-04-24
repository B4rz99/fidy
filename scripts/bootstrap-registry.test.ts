import { expect, test } from "bun:test";
import {
  type BootstrapTask,
  runBootstrapTasks,
  type SubscriptionTask,
  subscribeBootstrapTasks,
} from "../apps/mobile/shared/bootstrap/registry";

type TestContext = {
  readonly enabled: boolean;
  readonly log: string[];
};

test("runBootstrapTasks executes enabled tasks in order", async () => {
  const context: TestContext = { enabled: true, log: [] };
  const tasks: readonly BootstrapTask<TestContext>[] = [
    {
      id: "first",
      run: ({ log }) => {
        log.push("first");
      },
    },
    {
      id: "second",
      isEnabled: ({ enabled }) => enabled,
      run: async ({ log }) => {
        log.push("second");
      },
    },
    {
      id: "skipped",
      isEnabled: () => false,
      run: ({ log }) => {
        log.push("skipped");
      },
    },
  ];

  await runBootstrapTasks(context, tasks);

  expect(context.log).toEqual(["first", "second"]);
});

test("subscribeBootstrapTasks returns a combined cleanup for enabled subscriptions", () => {
  const context: TestContext = { enabled: true, log: [] };
  const tasks: readonly SubscriptionTask<TestContext>[] = [
    {
      id: "first",
      subscribe: ({ log }) => {
        log.push("subscribe:first");
        return () => {
          log.push("cleanup:first");
        };
      },
    },
    {
      id: "second",
      isEnabled: ({ enabled }) => enabled,
      subscribe: ({ log }) => {
        log.push("subscribe:second");
        return () => {
          log.push("cleanup:second");
        };
      },
    },
    {
      id: "skipped",
      isEnabled: () => false,
      subscribe: ({ log }) => {
        log.push("subscribe:skipped");
      },
    },
  ];

  const cleanup = subscribeBootstrapTasks(context, tasks);
  cleanup();

  expect(context.log).toEqual([
    "subscribe:first",
    "subscribe:second",
    "cleanup:first",
    "cleanup:second",
  ]);
});

test("subscribeBootstrapTasks cleans up earlier subscriptions when a later subscribe fails", () => {
  const context: TestContext = { enabled: true, log: [] };
  const subscribeError = new Error("subscribe failed");
  const tasks: readonly SubscriptionTask<TestContext>[] = [
    {
      id: "first",
      subscribe: ({ log }) => {
        log.push("subscribe:first");
        return () => {
          log.push("cleanup:first");
        };
      },
    },
    {
      id: "second",
      subscribe: ({ log }) => {
        log.push("subscribe:second");
        throw subscribeError;
      },
    },
  ];

  expect(() => subscribeBootstrapTasks(context, tasks)).toThrow(subscribeError);
  expect(context.log).toEqual(["subscribe:first", "subscribe:second", "cleanup:first"]);
});

test("subscribeBootstrapTasks runs every cleanup even if one throws", () => {
  const context: TestContext = { enabled: true, log: [] };
  const cleanupError = new Error("cleanup failed");
  const tasks: readonly SubscriptionTask<TestContext>[] = [
    {
      id: "first",
      subscribe: ({ log }) => {
        log.push("subscribe:first");
        return () => {
          log.push("cleanup:first");
          throw cleanupError;
        };
      },
    },
    {
      id: "second",
      subscribe: ({ log }) => {
        log.push("subscribe:second");
        return () => {
          log.push("cleanup:second");
        };
      },
    },
  ];

  const cleanup = subscribeBootstrapTasks(context, tasks);

  expect(() => cleanup()).toThrow(cleanupError);
  expect(context.log).toEqual([
    "subscribe:first",
    "subscribe:second",
    "cleanup:first",
    "cleanup:second",
  ]);
});

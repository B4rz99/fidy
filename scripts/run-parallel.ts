#!/usr/bin/env bun

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Task = {
  name: string;
  cmd: string[];
};

const bunRun = (name: string, ...args: string[]): Task => ({
  name,
  cmd: ["bun", "run", ...args],
});

const taskGroups = {
  "build-packages": [
    bunRun("@fidy/assets build", "--cwd", "packages/assets", "--shell=bun", "build"),
    bunRun("@fidy/types build", "--cwd", "packages/types", "--shell=bun", "build"),
    bunRun("@fidy/schemas build", "--cwd", "packages/schemas", "--shell=bun", "build"),
    bunRun("@fidy/utils build", "--cwd", "packages/utils", "--shell=bun", "build"),
  ],
  "lint-ci": [
    bunRun("root biome", "lint"),
    bunRun("mobile eslint", "lint:mobile"),
    bunRun("complexity gate", "lint:complexity"),
  ],
  "test-suite": [
    bunRun("brand boundary tests", "test:brands"),
    bunRun("complexity tests", "test:complexity"),
    bunRun("mobile vitest", "test:mobile"),
  ],
  "typecheck-packages": [
    bunRun("@fidy/assets typecheck", "--cwd", "packages/assets", "--shell=bun", "typecheck"),
    bunRun("@fidy/types typecheck", "--cwd", "packages/types", "--shell=bun", "typecheck"),
    bunRun("@fidy/schemas typecheck", "--cwd", "packages/schemas", "--shell=bun", "typecheck"),
    bunRun("@fidy/utils typecheck", "--cwd", "packages/utils", "--shell=bun", "typecheck"),
  ],
} satisfies Record<string, Task[]>;

const groupName = process.argv[2];

if (!groupName || !(groupName in taskGroups)) {
  const availableGroups = Object.keys(taskGroups)
    .map((name) => `  - ${name}`)
    .join("\n");
  console.error(
    `Usage: bun ./scripts/run-parallel.ts <group>\n\nAvailable groups:\n${availableGroups}`
  );
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const writePrefixedOutput = async (
  stream: ReadableStream<Uint8Array> | null,
  writer: Pick<typeof process.stdout, "write">,
  taskName: string
) => {
  if (!stream) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      writer.write(`[${taskName}] ${line}\n`);
    }
  }

  buffer += decoder.decode();
  if (buffer.length > 0) {
    writer.write(`[${taskName}] ${buffer}\n`);
  }
};

const runTask = async (task: Task) => {
  const child = Bun.spawn({
    cmd: task.cmd,
    cwd: repoRoot,
    stdin: "inherit",
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutDone = writePrefixedOutput(child.stdout, process.stdout, task.name);
  const stderrDone = writePrefixedOutput(child.stderr, process.stderr, task.name);
  const exitCode = await child.exited;

  await Promise.all([stdoutDone, stderrDone]);

  return {
    exitCode,
    name: task.name,
  };
};

console.log(
  `Running ${taskGroups[groupName].length} tasks in parallel for "${groupName}": ${taskGroups[
    groupName
  ]
    .map((task) => task.name)
    .join(", ")}`
);

const results = await Promise.all(taskGroups[groupName].map(runTask));
const failedTasks = results.filter((result) => result.exitCode !== 0);

if (failedTasks.length > 0) {
  console.error(
    `Parallel group "${groupName}" failed: ${failedTasks.map((task) => task.name).join(", ")}`
  );
  process.exit(1);
}

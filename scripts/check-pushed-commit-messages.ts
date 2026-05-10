#!/usr/bin/env bun

import { validateCommitMessage } from "./check-commit-message";

const text = (command: string[]): string =>
  new TextDecoder()
    .decode(Bun.spawnSync(command, { stderr: "pipe", stdout: "pipe" }).stdout)
    .trim();

const commits = [text(["git", "rev-parse", "HEAD"])];

const failures = commits.flatMap((commit) => {
  const message = text(["git", "show", "-s", "--format=%B", commit]);
  const errors = validateCommitMessage(message);
  const subject = text(["git", "show", "-s", "--format=%s", commit]);

  return errors.map((error) => `${commit.slice(0, 12)} ${subject}\n${error}`);
});

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

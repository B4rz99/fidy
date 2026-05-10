#!/usr/bin/env bun

export const validateCommitMessage = (message: string): string[] => {
  const lines = message.split(/\r?\n/);
  const header = lines[0] ?? "";
  const headerPattern = /^(feat|fix|refactor|chore|docs|test|perf|ci)\([a-z0-9-]+\): .+$/;

  if (!headerPattern.test(header)) {
    return ["Commit message must follow format: type(scope): message (scope is required)"];
  }

  const bodyLines = lines
    .slice(2)
    .filter((line) => line.trim().length > 0 && !line.startsWith("#"));
  const badBodyLine = bodyLines.find((line) => !line.startsWith("- "));

  if (bodyLines.length === 0) {
    return ["Commit body must contain at least one bullet point (- description)"];
  }

  if (badBodyLine) {
    return ["Commit body must contain bullet points only (- description)"];
  }

  return [];
};

if (import.meta.main) {
  const messagePath = Bun.argv[2];

  if (!messagePath) {
    console.error("Usage: bun scripts/check-commit-message.ts <commit-msg-file>");
    process.exit(1);
  }

  const message = await Bun.file(messagePath).text();
  const errors = validateCommitMessage(message);

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}

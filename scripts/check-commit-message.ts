#!/usr/bin/env bun

const messagePath = Bun.argv[2];

if (!messagePath) {
  console.error("Usage: bun scripts/check-commit-message.ts <commit-msg-file>");
  process.exit(1);
}

const message = await Bun.file(messagePath).text();
const lines = message.split(/\r?\n/);
const header = lines[0] ?? "";
const headerPattern = /^(feat|fix|refactor|chore|docs|test|perf|ci)\([a-z0-9-]+\): .+$/;

if (!headerPattern.test(header)) {
  console.error("Commit message must follow format: type(scope): message (scope is required)");
  process.exit(1);
}

const bodyLines = lines.slice(2).filter((line) => line.length > 0 && !line.startsWith("#"));
const badBodyLine = bodyLines.find((line) => !line.startsWith("- "));

if (badBodyLine) {
  console.error("Commit body must contain bullet points only (- description)");
  process.exit(1);
}

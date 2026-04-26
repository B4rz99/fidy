import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const entrySource = readSource("../../mutations/index.ts");
const commonSource = readSource("../../mutation-runtime/common.ts");
const budgetSource = readSource("../../mutation-runtime/budget-handlers.ts");

test("keeps the app mutation entrypoint routed through extracted handler modules", () => {
  expect(entrySource).toContain('from "../mutation-runtime/budget-handlers"');
  expect(entrySource).toContain('from "../mutation-runtime/calendar-handlers"');
  expect(entrySource).toContain('from "../mutation-runtime/goal-handlers"');
  expect(entrySource).toContain('from "../mutation-runtime/notification-handlers"');
  expect(entrySource).toContain('from "../mutation-runtime/transaction-handlers"');
  expect(entrySource).toContain("createGenericWriteThroughMutationModule");
});

test("keeps shared mutation helpers separate from domain handlers", () => {
  expect(commonSource).toContain("completeCommand");
  expect(budgetSource).toContain("copyBudgetsToMonth");
  expect(budgetSource).toContain("createBudgetCopyId");
});

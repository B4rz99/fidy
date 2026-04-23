import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const entrySource = readSource("../../shared/mutations/write-through.ts");
const commandsSource = readSource("../../shared/mutations/write-through/commands.ts");
const moduleSource = readSource("../../shared/mutations/write-through/module.ts");
const policySource = readSource("../../shared/mutations/write-through/policy.ts");

test("keeps the write-through public entrypoint routed through extracted modules", () => {
  expect(entrySource).toContain('from "./write-through/commands"');
  expect(entrySource).toContain('from "./write-through/helpers"');
  expect(entrySource).toContain('from "./write-through/module"');
});

test("keeps command and policy ownership in dedicated modules", () => {
  expect(commandsSource).toContain('kind: "calendar.bill.markPaid"');
  expect(commandsSource).toContain('kind: "budget.copy"');
  expect(policySource).toContain("const MUTATION_POLICY");
  expect(policySource).toContain('"calendar.bill.save": "local-only"');
});

test("keeps the generic module responsible for batched effects and policy export", () => {
  expect(moduleSource).toContain("function runEffects");
  expect(moduleSource).toContain("createGenericWriteThroughMutationModule");
  expect(moduleSource).toContain("commitBatch");
  expect(moduleSource).toContain("const applied = commands.map");
  expect(moduleSource).toContain("applied.flatMap");
  expect(moduleSource).not.toContain("[...acc.outcomes");
  expect(moduleSource).toContain("export { getMutationPolicy }");
});

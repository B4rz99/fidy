import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource("../../features/qa/components/QaToolsScreen.tsx");
const cardButtonSource = readSource("../../features/qa/components/qa-tools/QaToolsCardButton.tsx");
const constantsSource = readSource("../../features/qa/components/qa-tools/QaTools.constants.ts");
const contentSource = readSource("../../features/qa/components/qa-tools/QaToolsContent.tsx");
const runnerSource = readSource("../../features/qa/components/qa-tools/useQaScenarioRunner.ts");

test("contains seeded scenario buttons and direct entry points", () => {
  expect(constantsSource).toContain("transfer-conflict");
  expect(constantsSource).toContain("QA_TARGETS.addTransfer");
  expect(constantsSource).toContain("QA_TARGETS.transferConflict");
});

test("auto-starts routed QA scenarios when search params change after mount", () => {
  expect(runnerSource).toContain("parseLocalQaProfileRouteParam(routeProfile)");
  expect(runnerSource).toContain("parseQaTargetRouteParam(routeTarget) ?? undefined");
  expect(runnerSource).toContain("if (!localQaAvailable) {");
  expect(runnerSource).toContain("if (!profile) {");
  expect(runnerSource).toContain("useEffect(() => {");
  expect(runnerSource).toContain("[localQaAvailable, routeProfile, routeTarget, runScenario]");
});

test("contains QA feature flag toggles, reset tools, and inspectors", () => {
  expect(screenSource).toContain("<QaToolsContent");
  expect(contentSource).toContain('t("qaTools.flagsTitle")');
  expect(contentSource).toContain('t("qaTools.actionsTitle")');
  expect(contentSource).toContain('t("qaTools.logsTitle")');
  expect(contentSource).toContain('t("qaTools.networkTitle")');
  expect(contentSource).toContain(`testId={\`qa.flag.\${flagName}\`}`);
  expect(contentSource).toContain('testId="qa.action.clear-network-events"');
  expect(cardButtonSource).toContain("testID={testId}");
  expect(contentSource).toContain("JSON.stringify(entry.context)");
});

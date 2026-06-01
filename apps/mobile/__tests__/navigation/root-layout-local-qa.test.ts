import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { expectRouteInRootStackGroup } from "@/__tests__/helpers/root-stack-routes";

describe("Root layout local QA gating", () => {
  let source = "";
  let rootStackRoutesSource = "";

  beforeAll(() => {
    source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
    rootStackRoutesSource = readFileSync(
      resolve(__dirname, "../../shared/navigation/root-stack-routes.ts"),
      "utf-8"
    );
  });

  test("disables remote capture hooks when remote effects are off", () => {
    expect(source).toContain("enableRemoteEffects && onboardingComplete ? userId : null");
  });

  test("passes auth mode through to AuthenticatedShell", () => {
    expect(source).toContain('enableRemoteEffects={authMode === "remote"}');
  });

  test("allows QA launcher routes to bypass the normal auth redirect", () => {
    expect(source).toContain('topSegment === "qa-open"');
    expectRouteInRootStackGroup(rootStackRoutesSource, "localQaTransparentHeader", "qa-open");
  });

  test("installs the QA runtime and renders the QA status banner from the root boundary", () => {
    expect(source).toContain("useQaDevtoolsRuntime();");
    expect(source).toContain("<QaStatusBanner />");
  });
});

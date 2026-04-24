import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Root layout local QA gating", () => {
  const source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");

  test("disables sync and capture hooks when remote effects are off", () => {
    expect(source).toContain(
      "useSyncBootstrap({ db, enableRemoteEffects, migrationsReady, userId })"
    );
    expect(source).toContain("enableRemoteEffects ? userId : null");
  });

  test("passes auth mode through to AuthenticatedShell", () => {
    expect(source).toContain('enableRemoteEffects={authMode === "remote"}');
  });

  test("allows QA launcher routes to bypass the normal auth redirect", () => {
    expect(source).toContain('topSegment === "qa-open"');
    expect(source).toContain('name="qa-open"');
  });

  test("installs the QA runtime and renders the QA status banner from the root boundary", () => {
    expect(source).toContain("useQaDevtoolsRuntime();");
    expect(source).toContain("<QaStatusBanner />");
  });
});

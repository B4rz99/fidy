import { expect, test } from "bun:test";

type ForbiddenRule = {
  readonly name: string;
  readonly from?: { readonly path?: string; readonly pathNot?: string };
  readonly to?: {
    readonly dependencyTypes?: readonly string[];
    readonly path?: string;
    readonly pathNot?: string;
  };
};

const config = require("../.dependency-cruiser.cjs") as {
  readonly forbidden: readonly ForbiddenRule[];
  readonly options?: { readonly tsPreCompilationDeps?: boolean | "specify" };
};

type RepresentativeDependency = {
  readonly from: string;
  readonly to: string;
  readonly dependencyTypes: readonly string[];
};

const extractPackageAlternatives = (packagePattern: string): readonly string[] => {
  const match = packagePattern.match(/^\^\(node_modules\/\)\?\((.*)\)$/);
  return match?.[1]?.split("|") ?? [];
};

const matchesPattern = (path: string, pattern: string | undefined): boolean =>
  pattern === undefined || new RegExp(pattern).test(path);

const matchesRule = (rule: ForbiddenRule, dependency: RepresentativeDependency): boolean => {
  const fromMatches =
    matchesPattern(dependency.from, rule.from?.path) &&
    (rule.from?.pathNot === undefined || !matchesPattern(dependency.from, rule.from.pathNot));
  const toMatches =
    matchesPattern(dependency.to, rule.to?.path) &&
    (rule.to?.pathNot === undefined || !matchesPattern(dependency.to, rule.to.pathNot));
  const dependencyTypeMatches =
    rule.to?.dependencyTypes === undefined ||
    dependency.dependencyTypes.some((dependencyType) =>
      rule.to?.dependencyTypes?.includes(dependencyType)
    );

  return fromMatches && toMatches && dependencyTypeMatches;
};

test("guards pure local-ledger code from app layers and runtime infrastructure", () => {
  const internalsRule = config.forbidden.find(
    (forbiddenRule) => forbiddenRule.name === "local-ledger-must-not-import-app-runtime-internals"
  );
  const packagesRule = config.forbidden.find(
    (forbiddenRule) => forbiddenRule.name === "local-ledger-must-not-import-runtime-packages"
  );

  expect(internalsRule).toBeDefined();
  expect(internalsRule?.from?.path).toBe("^apps/mobile/local-ledger/");

  const forbiddenPath = internalsRule?.to?.path ?? "";
  expect(forbiddenPath).toContain("^apps/mobile/features/");
  expect(forbiddenPath).toContain("^apps/mobile/app/");
  expect(forbiddenPath).toContain("^apps/mobile/modules/");
  expect(forbiddenPath).toContain("^apps/mobile/shared/db($|/)");
  expect(forbiddenPath).toContain("^apps/mobile/infrastructure/");
  expect(forbiddenPath).toContain("^apps/mobile/shared/(query|effect|components)($|/)");
  expect(forbiddenPath).toContain("^apps/mobile/shared/lib($|\\.public\\.ts|/index\\.ts)");
  expect(forbiddenPath).toContain("^apps/mobile/shared/lib/(analytics|sentry|toast)\\.ts");
  expect(
    matchesRule(internalsRule!, {
      from: "apps/mobile/local-ledger/domain/public.ts",
      to: "apps/mobile/features/capture-evidence/schema.public.ts",
      dependencyTypes: ["local", "type-only", "type-import"],
    })
  ).toBe(true);

  expect(packagesRule).toBeDefined();
  expect(packagesRule?.from?.path).toBe("^apps/mobile/local-ledger/");
  expect(packagesRule?.to?.dependencyTypes).toEqual(["npm", "npm-dev", "npm-optional", "npm-peer"]);

  const forbiddenPackages = packagesRule?.to?.path ?? "";
  expect(forbiddenPackages).toContain("^(node_modules/)?");
  expect(extractPackageAlternatives(forbiddenPackages)).toEqual([
    "drizzle-orm",
    "react",
    "react-native",
    "expo",
    "expo-[^/]+",
    "@expo/",
    "zustand",
    "@supabase/",
    "@sentry/",
  ]);
});

test("guards local-ledger internals behind public entrypoints for consumers", () => {
  const publicImportsRule = config.forbidden.find(
    (forbiddenRule) => forbiddenRule.name === "local-ledger-consumers-must-use-public-entrypoints"
  );

  expect(publicImportsRule).toBeDefined();
  expect(publicImportsRule?.from?.pathNot).toBe(
    "^apps/mobile/(local-ledger/|infrastructure/local-ledger/|__tests__/)"
  );
  expect(publicImportsRule?.to?.path).toBe("^apps/mobile/local-ledger/");
  expect(publicImportsRule?.to?.pathNot).toBe(
    "^apps/mobile/local-ledger/(public|snapshot\\.public)\\.ts$"
  );
});

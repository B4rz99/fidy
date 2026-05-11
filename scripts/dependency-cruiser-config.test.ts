import { expect, test } from "bun:test";

type ForbiddenRule = {
  readonly name: string;
  readonly from?: { readonly path?: string };
  readonly to?: { readonly path?: string };
};

const config = require("../.dependency-cruiser.cjs") as {
  readonly forbidden: readonly ForbiddenRule[];
};

test("guards pure local-ledger code from app layers and runtime infrastructure", () => {
  const rule = config.forbidden.find(
    (forbiddenRule) => forbiddenRule.name === "local-ledger-pure-must-stay-independent"
  );

  expect(rule).toBeDefined();
  expect(rule?.from?.path).toBe("^apps/mobile/local-ledger/");

  const forbiddenPath = rule?.to?.path ?? "";
  expect(forbiddenPath).toContain("^apps/mobile/features/");
  expect(forbiddenPath).toContain("^apps/mobile/app/");
  expect(forbiddenPath).toContain("^apps/mobile/modules/");
  expect(forbiddenPath).toContain("^apps/mobile/shared/db($|/)");
  expect(forbiddenPath).toContain("^apps/mobile/infrastructure/");
  expect(forbiddenPath).toContain("^apps/mobile/shared/(query|effect|components)($|/)");
  expect(forbiddenPath).toContain("node_modules/(drizzle-orm|react|react-native|expo");
  expect(forbiddenPath).toContain("@supabase/");
  expect(forbiddenPath).toContain("@sentry/");
  expect(forbiddenPath).toContain("zustand");
});

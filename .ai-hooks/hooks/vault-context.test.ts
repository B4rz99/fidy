import { describe, expect, it } from "bun:test";

import { buildVaultAdditionalContext, resolveVaultConfig } from "./vault-context";

describe("resolveVaultConfig", () => {
  it("falls back to .env.local values when shell env is missing", () => {
    const config = resolveVaultConfig({
      env: {},
      envLocalContent: `
# local-only
OBARBOZA_VAULT_PATH=/tmp/obarboza-vault
FIDY_VAULT_PATH=/tmp/fidy-vault
`,
      projectDir: "/tmp/fidy",
    });

    expect(config).toEqual({
      globalVaultPath: "/tmp/obarboza-vault",
      projectVaultPath: "/tmp/fidy-vault",
    });
  });
});

describe("buildVaultAdditionalContext", () => {
  it("includes the dual-vault read order and update-vault contract", () => {
    const context = buildVaultAdditionalContext({
      globalVaultPath: "/tmp/obarboza-vault",
      projectVaultPath: "/tmp/fidy-vault",
    });

    expect(context).toContain("Dual-vault workflow");
    expect(context).toContain("/tmp/obarboza-vault/AGENTS.md");
    expect(context).toContain("/tmp/fidy-vault/wiki/index.md");
    expect(context).toContain('When the user says "update vault"');
    expect(context).toContain("Never hardcode these absolute vault paths");
  });
});

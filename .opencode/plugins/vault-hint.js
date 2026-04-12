module.exports = {
  name: "vault-hint",
  version: "1.0.0",
  executeBefore: ["tool.execute.before"],
  handler: async (context) => {
    const fs = require("node:fs");
    const path = require("node:path");
    const readEnvLocal = () => {
      const envLocalPath = path.join(context.cwd, ".env.local");

      if (!fs.existsSync(envLocalPath)) {
        return {};
      }

      return fs
        .readFileSync(envLocalPath, "utf-8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .reduce((acc, line) => {
          const separatorIndex = line.indexOf("=");
          const key = line.slice(0, separatorIndex).trim();
          const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
          return key ? { ...acc, [key]: value } : acc;
        }, {});
    };

    const localEnv = readEnvLocal();
    const obarbozaVaultPath = process.env.OBARBOZA_VAULT_PATH || localEnv.OBARBOZA_VAULT_PATH;
    const fidyVaultPath = process.env.FIDY_VAULT_PATH || localEnv.FIDY_VAULT_PATH;
    const fidyVaultIndex = fidyVaultPath ? path.join(fidyVaultPath, "wiki/index.md") : null;

    if (fidyVaultIndex && fs.existsSync(fidyVaultIndex)) {
      return {
        hint: `vaults: Read ${fidyVaultIndex} before meaningful changes. Use "update vault" to file session learnings back into ${fidyVaultPath || "FIDY_VAULT_PATH"}.${obarbozaVaultPath ? ` Global context lives in ${obarbozaVaultPath}.` : ""}`,
      };
    }
    return null;
  },
};

import { buildVaultAdditionalContext, resolveVaultConfig } from "./vault-context";

const projectDir = process.env.CODEX_PROJECT_DIR ?? process.cwd();
const context = buildVaultAdditionalContext(resolveVaultConfig({ projectDir }));

if (!context) {
  process.exit(0);
}

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  })
);

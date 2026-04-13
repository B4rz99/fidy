import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type VaultEnv = Readonly<Record<string, string | undefined>>;

export interface VaultConfig {
  globalVaultPath: string | null;
  projectVaultPath: string | null;
}

interface ResolveVaultConfigOptions {
  env?: VaultEnv;
  envLocalContent?: string | null;
  projectDir: string;
}

const readEnvLocal = (projectDir: string): string =>
  readFileSync(join(projectDir, ".env.local"), "utf-8");

const normalizeValue = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length > 0 ? trimmed : null;
};

const parseEnvLocal = (content: string): Record<string, string> =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .reduce<Record<string, string>>((acc, line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      return key.length > 0 ? { ...acc, [key]: value } : acc;
    }, {});

export const resolveVaultConfig = ({
  env = process.env,
  envLocalContent,
  projectDir,
}: ResolveVaultConfigOptions): VaultConfig => {
  const localEnv =
    envLocalContent !== undefined
      ? parseEnvLocal(envLocalContent ?? "")
      : existsSync(join(projectDir, ".env.local"))
        ? parseEnvLocal(readEnvLocal(projectDir))
        : {};

  const globalVaultPath = normalizeValue(env.OBARBOZA_VAULT_PATH ?? localEnv.OBARBOZA_VAULT_PATH);
  const projectVaultPath = normalizeValue(env.FIDY_VAULT_PATH ?? localEnv.FIDY_VAULT_PATH);

  return {
    globalVaultPath,
    projectVaultPath,
  };
};

export const buildVaultAdditionalContext = ({
  globalVaultPath,
  projectVaultPath,
}: VaultConfig): string | null => {
  if (!globalVaultPath && !projectVaultPath) {
    return null;
  }

  const globalSection = globalVaultPath
    ? [
        `Global vault (read-mostly): ${globalVaultPath}`,
        `- Read ${globalVaultPath}/AGENTS.md before substantial work.`,
        `- Read relevant wiki pages there only for cross-project context and working preferences.`,
      ].join("\n")
    : "Global vault is not configured.";

  const projectSection = projectVaultPath
    ? [
        `Project vault (read/write): ${projectVaultPath}`,
        `- Read ${projectVaultPath}/AGENTS.md before substantial work.`,
        `- Read ${projectVaultPath}/wiki/index.md before making meaningful changes.`,
      ].join("\n")
    : "Project vault is not configured.";

  const updateSection = projectVaultPath
    ? [
        'When the user says "update vault":',
        `- Append a concise session entry to ${projectVaultPath}/wiki/log.md.`,
        `- Update ${projectVaultPath}/wiki/index.md if you added or renamed project notes.`,
        `- Create or update notes in decisions/, experiments/, meetings/, or feedback/ only when the session produced durable information.`,
        globalVaultPath
          ? `- Write to ${globalVaultPath} only for lessons that clearly generalize beyond Fidy.`
          : "- Do not invent a global-vault write target.",
      ].join("\n")
    : 'When the user says "update vault", do not invent project-vault paths; ask for configuration if needed.';

  return [
    "<VAULT_CONTEXT>",
    "Dual-vault workflow is configured for this project.",
    "",
    globalSection,
    "",
    projectSection,
    "",
    updateSection,
    "",
    "Never hardcode these absolute vault paths into tracked repo files. Use OBARBOZA_VAULT_PATH and FIDY_VAULT_PATH for configuration.",
    "</VAULT_CONTEXT>",
  ].join("\n");
};

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type RegistryConfig = {
  defaultRegistry: string;
  scopedRegistries: ReadonlyMap<string, string>;
};

const DEFAULT_REGISTRY = "https://registry.npmjs.org";

const normalizeRegistryUrl = (registry: string): string => registry.replace(/\/+$/, "");

const nonEmptyRegistry = (registry: string | undefined): string | undefined => {
  const trimmed = registry?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const parseNpmrc = (content: string): Partial<RegistryConfig> => {
  const entries = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith(";"));
  const defaultRegistry = entries.reduce<string | undefined>((registry, line) => {
    const match = line.match(/^registry\s*=\s*(.+)$/)?.[1];
    return nonEmptyRegistry(match) ?? registry;
  }, undefined);
  const scopedRegistries = entries.reduce<Map<string, string>>((registries, line) => {
    const match = line.match(/^(@[^:]+):registry\s*=\s*(.+)$/);
    if (match?.[1] && match[2]) registries.set(match[1], normalizeRegistryUrl(match[2]));
    return registries;
  }, new Map());

  return {
    defaultRegistry: defaultRegistry ? normalizeRegistryUrl(defaultRegistry) : undefined,
    scopedRegistries,
  };
};

export const createRegistryResolver = (root: string): ((packageName: string) => string) => {
  const npmrcPath = join(root, ".npmrc");
  const npmrcConfig = existsSync(npmrcPath) ? parseNpmrc(readFileSync(npmrcPath, "utf8")) : {};
  const defaultRegistry = normalizeRegistryUrl(
    nonEmptyRegistry(process.env.npm_config_registry) ??
      nonEmptyRegistry(process.env.NPM_CONFIG_REGISTRY) ??
      npmrcConfig.defaultRegistry ??
      DEFAULT_REGISTRY
  );

  return (packageName: string): string => {
    const scope = packageName.startsWith("@") ? packageName.split("/")[0] : undefined;
    return (scope ? npmrcConfig.scopedRegistries?.get(scope) : undefined) ?? defaultRegistry;
  };
};

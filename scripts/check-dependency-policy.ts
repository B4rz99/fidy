#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

type Args = {
  enforce: boolean;
  includeDevDependencies: boolean;
  root: string;
  staleDays: number;
};

type PackageJson = {
  name?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type Dependency = {
  manifestPath: string;
  name: string;
  resolvedVersion: string | null;
  spec: string;
  type: "dependencies" | "devDependencies";
};

type Version = {
  major: number;
  minor: number;
  patch: number;
  raw: string;
};

type NpmPackument = {
  "dist-tags"?: Record<string, string>;
  time?: Record<string, string>;
  versions?: Record<string, unknown>;
};

type Violation = {
  dependency: Dependency;
  current: Version;
  latest: Version;
  latestReleasedAt: Date | null;
  reasons: readonly string[];
};

const DEFAULT_STALE_DAYS = 30;
const IGNORED_DIRECTORIES = new Set([
  ".ai-hooks",
  ".cache",
  ".context",
  ".expo",
  ".git",
  ".next",
  ".opencode",
  "build",
  "dist",
  "node_modules",
]);
const WORKSPACE_SPEC_PREFIXES = ["workspace:", "file:", "link:", "portal:"];

const parseArgs = (argv: readonly string[]): Args => {
  const staleDaysIndex = argv.indexOf("--stale-days");
  const rootIndex = argv.indexOf("--root");
  const rawStaleDays =
    staleDaysIndex === -1 ? String(DEFAULT_STALE_DAYS) : argv[staleDaysIndex + 1];
  const root = rootIndex === -1 ? process.cwd() : argv[rootIndex + 1];
  const staleDays = Number(rawStaleDays);

  if (!root) throw new Error("Missing value for --root");
  if (!Number.isInteger(staleDays) || staleDays <= 0) {
    throw new Error("--stale-days must be a positive integer");
  }

  return {
    enforce: argv.includes("--enforce"),
    includeDevDependencies: !argv.includes("--production-only"),
    root,
    staleDays,
  };
};

const normalizePath = (path: string): string => path.replaceAll("\\", "/");

const listPackageJsonFiles = (root: string, relativeDir = ""): readonly string[] =>
  readdirSync(join(root, relativeDir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name)
        ? []
        : listPackageJsonFiles(root, join(relativeDir, entry.name));
    }

    const entryPath = normalizePath(join(relativeDir, entry.name));
    return entry.name === "package.json" ? [entryPath] : [];
  });

const readPackageJson = (root: string, path: string): PackageJson =>
  JSON.parse(readFileSync(join(root, path), "utf8")) as PackageJson;

const readBunLockResolvedVersions = (root: string): ReadonlyMap<string, string> => {
  const lockPath = join(root, "bun.lock");
  if (!existsSync(lockPath)) return new Map();

  return Array.from(
    readFileSync(lockPath, "utf8").matchAll(
      /^\s+"([^"]+)": \["(?:[^@"]+|@[^/]+\/[^@"]+)@(\d+\.\d+\.\d+)"/gm
    )
  ).reduce<Map<string, string>>((versions, match) => {
    const name = match[1];
    const version = match[2];
    if (name && version && !versions.has(name)) versions.set(name, version);
    return versions;
  }, new Map());
};

const isRegistryDependency = (spec: string): boolean =>
  !WORKSPACE_SPEC_PREFIXES.some((prefix) => spec.startsWith(prefix)) && !spec.startsWith("git+");

const collectDependencies = (
  root: string,
  includeDevDependencies: boolean
): readonly Dependency[] => {
  const resolvedVersions = readBunLockResolvedVersions(root);

  return listPackageJsonFiles(root).flatMap((manifestPath) => {
    const manifest = readPackageJson(root, manifestPath);
    const dependencyEntries = Object.entries(manifest.dependencies ?? {}).map(([name, spec]) => ({
      manifestPath,
      name,
      resolvedVersion: resolvedVersions.get(name) ?? null,
      spec,
      type: "dependencies" as const,
    }));
    const devDependencyEntries = includeDevDependencies
      ? Object.entries(manifest.devDependencies ?? {}).map(([name, spec]) => ({
          manifestPath,
          name,
          resolvedVersion: resolvedVersions.get(name) ?? null,
          spec,
          type: "devDependencies" as const,
        }))
      : [];

    return [...dependencyEntries, ...devDependencyEntries].filter((dependency) =>
      isRegistryDependency(dependency.spec)
    );
  });
};

const parseVersion = (value: string): Version | null => {
  const match = value.match(/^(?:npm:)?(?:[^@\s]+@)?[~^<>=\s]*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match?.[1]) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    raw: value,
  };
};

const isStableVersion = (value: string): boolean => /^\d+\.\d+\.\d+$/.test(value);

const compareVersions = (left: Version, right: Version): number =>
  left.major - right.major || left.minor - right.minor || left.patch - right.patch;

const fetchPackument = async (name: string): Promise<NpmPackument> => {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`npm registry returned ${response.status} for ${name}`);
  return (await response.json()) as NpmPackument;
};

const findHighestStableVersion = (packument: NpmPackument): Version | null => {
  const versions = Object.keys(packument.versions ?? {})
    .filter(isStableVersion)
    .map(parseVersion)
    .filter((version): version is Version => version !== null);

  return versions.reduce<Version | null>(
    (latest, version) =>
      latest === null || compareVersions(version, latest) > 0 ? version : latest,
    null
  );
};

const findLatestStableVersion = (packument: NpmPackument): Version | null => {
  const latestTag = packument["dist-tags"]?.latest;
  if (latestTag && isStableVersion(latestTag)) return parseVersion(latestTag);
  return findHighestStableVersion(packument);
};

const oneDayMs = 24 * 60 * 60 * 1000;

const inspectDependency = async (
  dependency: Dependency,
  staleDays: number
): Promise<Violation | null> => {
  const current = parseVersion(dependency.resolvedVersion ?? dependency.spec);
  if (!current) return null;

  const packument = await fetchPackument(dependency.name);
  const latest = findLatestStableVersion(packument);
  if (!latest) return null;

  const latestReleasedAtRaw = packument.time?.[latest.raw];
  const latestReleasedAt = latestReleasedAtRaw ? new Date(latestReleasedAtRaw) : null;
  const staleCutoff = new Date(Date.now() - staleDays * oneDayMs);
  const reasons = [
    latest.major > current.major ? "major update available" : "",
    latest.major === current.major && latest.minor > current.minor ? "minor update available" : "",
    latestReleasedAt && latestReleasedAt < staleCutoff
      ? `latest stable release is older than ${staleDays} days`
      : "",
  ].filter((reason) => reason.length > 0);

  return reasons.length > 0 ? { dependency, current, latest, latestReleasedAt, reasons } : null;
};

const inspectDependencies = async (
  dependencies: readonly Dependency[],
  staleDays: number
): Promise<readonly Violation[]> => {
  const uniqueDependencies = Array.from(
    new Map(
      dependencies.map((dependency) => [
        `${dependency.name}\0${dependency.resolvedVersion ?? dependency.spec}`,
        dependency,
      ])
    ).values()
  );
  const results = await Promise.all(
    uniqueDependencies.map((dependency) => inspectDependency(dependency, staleDays))
  );

  return results
    .filter((violation): violation is Violation => violation !== null)
    .sort((left, right) => left.dependency.name.localeCompare(right.dependency.name));
};

const formatVersion = (version: Version): string =>
  `${version.major}.${version.minor}.${version.patch}`;

const formatReleaseDate = (date: Date | null): string =>
  date ? date.toISOString().slice(0, 10) : "unknown release date";

const formatViolation = (root: string, violation: Violation): string => {
  const manifest = normalizePath(relative(root, join(root, violation.dependency.manifestPath)));
  return [
    `- ${violation.dependency.name} (${manifest} ${violation.dependency.type})`,
    `  declared: ${violation.dependency.spec}`,
    `  resolved/current: ${formatVersion(violation.current)}`,
    `  latest stable: ${formatVersion(violation.latest)} (${formatReleaseDate(violation.latestReleasedAt)})`,
    `  reasons: ${violation.reasons.join(", ")}`,
  ].join("\n");
};

const formatReport = (
  root: string,
  dependencyCount: number,
  staleDays: number,
  violations: readonly Violation[]
): string =>
  [
    `Dependency policy root: ${normalizePath(relative(process.cwd(), root) || ".")}`,
    `Registry dependencies checked: ${dependencyCount}`,
    `Stale upstream threshold: ${staleDays} days`,
    `Policy violations: ${violations.length}`,
    violations.length > 0
      ? "CI fails for latest stable minor updates, major updates, or packages without a stable release inside the threshold."
      : "No dependency policy violations found.",
    violations.length > 0 ? "" : "",
    ...violations.map((violation) => formatViolation(root, violation)),
  ]
    .filter((line) => line.length > 0)
    .join("\n");

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.root)) throw new Error(`Root does not exist: ${options.root}`);

  const dependencies = collectDependencies(options.root, options.includeDevDependencies);
  const violations = await inspectDependencies(dependencies, options.staleDays);
  console.log(formatReport(options.root, dependencies.length, options.staleDays, violations));

  if (options.enforce && violations.length > 0) process.exit(1);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

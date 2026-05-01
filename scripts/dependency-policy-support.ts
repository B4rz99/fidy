import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

type PackageJson = {
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

type Version = { major: number; minor: number; patch: number; raw: string };

type NpmPackument = {
  "dist-tags"?: Record<string, string>;
  time?: Record<string, string>;
  versions?: Record<string, unknown>;
};

export type DependencyPolicyConfig = { deferredUpdates?: readonly DeferredUpdate[] };

export type DeferredUpdate = { name: string; reason: string; until: string };

type Violation = {
  dependency: Dependency;
  current: Version;
  latest: Version;
  latestReleasedAt: Date | null;
  reasons: readonly string[];
};

export type InspectionResult = { violations: readonly Violation[]; warnings: readonly Violation[] };

const IGNORED_DIRECTORIES = new Set(
  ".ai-hooks,.cache,.context,.expo,.git,.next,.opencode,build,dist,node_modules".split(",")
);
const WORKSPACE_SPEC_PREFIXES = ["workspace:", "file:", "link:", "portal:"];
const oneDayMs = 24 * 60 * 60 * 1000;

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

export const readDependencyPolicyConfig = (root: string): DependencyPolicyConfig => {
  const configPath = join(root, "dependency-policy.json");
  return existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, "utf8")) as DependencyPolicyConfig)
    : {};
};

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

export const collectDependencies = (
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

const isReleasedBefore = (packument: NpmPackument, version: Version, cutoff: Date): boolean => {
  const releasedAtRaw = packument.time?.[version.raw];
  return releasedAtRaw ? new Date(releasedAtRaw) <= cutoff : false;
};

const findLatestEligibleStableVersion = (
  packument: NpmPackument,
  minimumReleaseAgeDays: number
): Version | null => {
  const releaseAgeCutoff = new Date(Date.now() - minimumReleaseAgeDays * oneDayMs);
  const latestTag = packument["dist-tags"]?.latest;
  const latestTagVersion = latestTag && isStableVersion(latestTag) ? parseVersion(latestTag) : null;
  const versions = Object.keys(packument.versions ?? {})
    .filter(isStableVersion)
    .map(parseVersion)
    .filter((version): version is Version => version !== null)
    .filter(
      (version) => latestTagVersion === null || compareVersions(version, latestTagVersion) <= 0
    )
    .filter((version) => isReleasedBefore(packument, version, releaseAgeCutoff));

  return versions.reduce<Version | null>(
    (latest, version) =>
      latest === null || compareVersions(version, latest) > 0 ? version : latest,
    null
  );
};

const inspectDependency = async (
  dependency: Dependency,
  minimumReleaseAgeDays: number,
  staleDays: number
): Promise<InspectionResult> => {
  const current = parseVersion(dependency.resolvedVersion ?? dependency.spec);
  if (!current) return { violations: [], warnings: [] };

  const packument = await fetchPackument(dependency.name);
  const latest = findLatestEligibleStableVersion(packument, minimumReleaseAgeDays);
  if (!latest) return { violations: [], warnings: [] };

  const latestReleasedAtRaw = packument.time?.[latest.raw];
  const latestReleasedAt = latestReleasedAtRaw ? new Date(latestReleasedAtRaw) : null;
  const staleCutoff = new Date(Date.now() - staleDays * oneDayMs);
  const violationReasons = [
    latest.major > current.major ? "major update available" : "",
    latest.major === current.major && latest.minor > current.minor ? "minor update available" : "",
  ].filter((reason) => reason.length > 0);
  const warningReasons = [
    latestReleasedAt && latestReleasedAt < staleCutoff
      ? `latest stable release is older than ${staleDays} days`
      : "",
  ].filter((reason) => reason.length > 0);
  const createFinding = (reasons: readonly string[]): Violation => ({
    dependency,
    current,
    latest,
    latestReleasedAt,
    reasons,
  });

  return {
    violations: violationReasons.length > 0 ? [createFinding(violationReasons)] : [],
    warnings: warningReasons.length > 0 ? [createFinding(warningReasons)] : [],
  };
};

export const inspectDependencies = async (
  dependencies: readonly Dependency[],
  deferredUpdates: ReadonlyMap<string, DeferredUpdate>,
  minimumReleaseAgeDays: number,
  staleDays: number
): Promise<InspectionResult> => {
  const uniqueDependencies = Array.from(
    new Map(
      dependencies.map((dependency) => [
        `${dependency.name}\0${dependency.resolvedVersion ?? dependency.spec}`,
        dependency,
      ])
    ).values()
  );
  const results = await Promise.all(
    uniqueDependencies.map((dependency) =>
      inspectDependency(dependency, minimumReleaseAgeDays, staleDays)
    )
  );
  const sortByName = (findings: readonly Violation[]): readonly Violation[] =>
    [...findings].sort((left, right) => left.dependency.name.localeCompare(right.dependency.name));
  const today = new Date();
  const isActiveDeferral = (violation: Violation): boolean => {
    const deferral = deferredUpdates.get(violation.dependency.name);
    return deferral ? new Date(`${deferral.until}T23:59:59.999Z`) >= today : false;
  };
  const formatDeferredReason = (violation: Violation): Violation => {
    const deferral = deferredUpdates.get(violation.dependency.name);
    return deferral
      ? {
          ...violation,
          reasons: [...violation.reasons, `deferred until ${deferral.until}: ${deferral.reason}`],
        }
      : violation;
  };
  const updateViolations = results.flatMap((result) => result.violations);
  const activeDeferrals = updateViolations.filter(isActiveDeferral).map(formatDeferredReason);

  return {
    violations: sortByName(updateViolations.filter((violation) => !isActiveDeferral(violation))),
    warnings: sortByName([...results.flatMap((result) => result.warnings), ...activeDeferrals]),
  };
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

export const formatReport = (
  root: string,
  dependencyCount: number,
  minimumReleaseAgeDays: number,
  staleDays: number,
  violations: readonly Violation[],
  warnings: readonly Violation[]
): string =>
  [
    `Dependency policy root: ${normalizePath(relative(process.cwd(), root) || ".")}`,
    `Registry dependencies checked: ${dependencyCount}`,
    `Minimum release age: ${minimumReleaseAgeDays} days`,
    `Stale upstream warning threshold: ${staleDays} days`,
    `Policy violations: ${violations.length}`,
    `Policy warnings: ${warnings.length}`,
    violations.length > 0
      ? "CI fails for latest stable minor or major updates. Stale upstream age is reported as a warning."
      : "No dependency policy violations found.",
    violations.length > 0 ? "" : "",
    ...violations.map((violation) => formatViolation(root, violation)),
    warnings.length > 0 ? "" : "",
    warnings.length > 0 ? "Warnings:" : "",
    ...warnings.map((warning) => formatViolation(root, warning)),
  ]
    .filter((line) => line.length > 0)
    .join("\n");

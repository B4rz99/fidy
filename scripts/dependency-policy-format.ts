import { relative, join } from "node:path";
import type { Violation } from "./dependency-policy-support";

const normalizePath = (path: string): string => path.replaceAll("\\", "/");

const formatVersion = (version: Violation["current"]): string =>
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

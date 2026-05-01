#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { formatReport } from "./dependency-policy-format";
import {
  collectDependencies,
  inspectDependencies,
  readDependencyPolicyConfig,
} from "./dependency-policy-support";

type Args = {
  enforce: boolean;
  includeDevDependencies: boolean;
  minimumReleaseAgeDays: number;
  root: string;
  staleDays: number;
};

const DEFAULT_STALE_DAYS = 30;
const DEFAULT_MINIMUM_RELEASE_AGE_DAYS = 7;

const parseArgs = (argv: readonly string[]): Args => {
  const staleDaysIndex = argv.indexOf("--stale-days");
  const minimumReleaseAgeIndex = argv.indexOf("--minimum-release-age-days");
  const rootIndex = argv.indexOf("--root");
  const rawStaleDays =
    staleDaysIndex === -1 ? String(DEFAULT_STALE_DAYS) : argv[staleDaysIndex + 1];
  const rawMinimumReleaseAgeDays =
    minimumReleaseAgeIndex === -1
      ? String(DEFAULT_MINIMUM_RELEASE_AGE_DAYS)
      : argv[minimumReleaseAgeIndex + 1];
  const root = rootIndex === -1 ? process.cwd() : argv[rootIndex + 1];
  const staleDays = Number(rawStaleDays);
  const minimumReleaseAgeDays = Number(rawMinimumReleaseAgeDays);

  if (!root) throw new Error("Missing value for --root");
  if (!Number.isInteger(staleDays) || staleDays <= 0) {
    throw new Error("--stale-days must be a positive integer");
  }
  if (!Number.isInteger(minimumReleaseAgeDays) || minimumReleaseAgeDays < 0) {
    throw new Error("--minimum-release-age-days must be a non-negative integer");
  }

  return {
    enforce: argv.includes("--enforce"),
    includeDevDependencies: !argv.includes("--production-only"),
    minimumReleaseAgeDays,
    root,
    staleDays,
  };
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.root)) throw new Error(`Root does not exist: ${options.root}`);

  const dependencies = collectDependencies(options.root, options.includeDevDependencies);
  const policyConfig = readDependencyPolicyConfig(options.root);
  const deferredUpdates = new Map(
    (policyConfig.deferredUpdates ?? []).map((deferral) => [deferral.name, deferral])
  );
  const { violations, warnings } = await inspectDependencies(
    options.root,
    dependencies,
    deferredUpdates,
    options.minimumReleaseAgeDays,
    options.staleDays
  );
  console.log(
    formatReport(
      options.root,
      dependencies.length,
      options.minimumReleaseAgeDays,
      options.staleDays,
      violations,
      warnings
    )
  );

  if (options.enforce && violations.length > 0) process.exit(1);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

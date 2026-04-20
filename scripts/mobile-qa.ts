#!/usr/bin/env bun

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const APP_DIR = resolve(ROOT, "apps/mobile");
const CONTEXT_DIR = resolve(ROOT, ".context/mobile-qa");
const XCODEBUILD_CONFIG = resolve(ROOT, ".xcodebuildmcp/config.yaml");
const SIMULATOR_NAME = "iPhone 17";
const METRO_STATUS_URL = "http://localhost:8081/status";
const DEV_CLIENT_URL =
  "com.googleusercontent.apps.282682681790-630ti7lmdsjcm32o31m1kq50q20727pn://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081";
const QA_TARGET_KEY_BY_TARGET = {
  "/(tabs)/(index)": "home",
  "/(tabs)/add": "add-chooser",
  "/(auth)/onboarding": "onboarding",
  "/add-transaction": "add-transaction",
  "/add-transfer": "add-transfer",
  "/qa-transfer-conflict": "transfer-conflict",
  "/financial-accounts": "financial-accounts",
  "/profile": "profile",
  "/qa-tools": "qa-tools",
} as const;

type CommandName = "ios" | "reset" | "seed" | "open" | "smoke";

function ensureContextDir() {
  mkdirSync(CONTEXT_DIR, { recursive: true });
}

function ensureXcodebuildConfig() {
  if (!existsSync(XCODEBUILD_CONFIG)) {
    throw new Error(`Missing XcodeBuildMCP config at ${XCODEBUILD_CONFIG}`);
  }
}

async function isMetroRunning() {
  try {
    const response = await fetch(METRO_STATUS_URL);
    return (await response.text()).includes("packager-status:running");
  } catch {
    return false;
  }
}

async function ensureMetroRunning() {
  if (await isMetroRunning()) return;

  Bun.spawn(
    [
      "bun",
      "x",
      "expo",
      "start",
      "--dev-client",
      "--host",
      "localhost",
      "--port",
      "8081",
      "--clear",
    ],
    {
      cwd: APP_DIR,
      detached: true,
      stdout: "ignore",
      stderr: "ignore",
    }
  );

  const startedAt = Date.now();

  while (!(await isMetroRunning())) {
    if (Date.now() - startedAt > 45_000) {
      throw new Error("Metro did not become ready within 45 seconds");
    }

    await Bun.sleep(1_000);
  }
}

function runOrThrow(args: string[], cwd = ROOT) {
  const result = Bun.spawnSync(args, { cwd, stdout: "inherit", stderr: "inherit" });

  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${args.join(" ")}`);
  }
}

function buildQaToolsUrl(profile: string, target?: string) {
  const nextTargetKey = target
    ? QA_TARGET_KEY_BY_TARGET[target as keyof typeof QA_TARGET_KEY_BY_TARGET]
    : null;
  const params = new URLSearchParams({ profile });
  if (nextTargetKey) {
    params.set("targetKey", nextTargetKey);
  }
  return `fidy://qa-open?${params.toString()}`;
}

function createArtifactDir(name: string) {
  const dir = resolve(CONTEXT_DIR, `${new Date().toISOString().replaceAll(":", "-")}-${name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function openDevClient() {
  runOrThrow(["xcrun", "simctl", "openurl", "booted", DEV_CLIENT_URL]);
}

async function buildAndRunSimulator() {
  runOrThrow([
    "bunx",
    "xcodebuildmcp",
    "simulator",
    "build-and-run",
    "--simulator-name",
    SIMULATOR_NAME,
  ]);
}

async function runIos() {
  ensureContextDir();
  ensureXcodebuildConfig();
  await ensureMetroRunning();
  await buildAndRunSimulator();
  await openDevClient();
}

async function runDeepLink(profile: string, target?: string) {
  await runIos();
  runOrThrow(["xcrun", "simctl", "openurl", "booted", buildQaToolsUrl(profile, target)]);
}

async function runSmoke() {
  const artifactDir = createArtifactDir("smoke");

  await runDeepLink("transfer-conflict", "/qa-transfer-conflict");

  runOrThrow(["bunx", "xcodebuildmcp", "simulator", "snapshot-ui"], ROOT);
  runOrThrow(
    ["bunx", "xcodebuildmcp", "ui-automation", "tap", "--id", "transfer.form.to-side"],
    ROOT
  );
  runOrThrow(
    ["bunx", "xcodebuildmcp", "ui-automation", "tap", "--id", "transfer.picker.outside-fidy"],
    ROOT
  );
  runOrThrow(
    [
      "bunx",
      "xcodebuildmcp",
      "simulator",
      "screenshot",
      "--output",
      resolve(artifactDir, "smoke.png"),
    ],
    ROOT
  );

  writeFileSync(
    resolve(artifactDir, "manifest.json"),
    JSON.stringify(
      {
        scenario: "transfer-conflict",
        target: "qa-tools",
        simulator: SIMULATOR_NAME,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

async function main() {
  const [command = "ios", firstArg, secondArg] = process.argv.slice(2) as [
    CommandName | undefined,
    string | undefined,
    string | undefined,
  ];

  if (command === "ios") {
    await runIos();
    return;
  }

  if (command === "reset") {
    await runDeepLink(firstArg ?? "default");
    return;
  }

  if (command === "seed") {
    await runDeepLink(firstArg ?? "default");
    return;
  }

  if (command === "open") {
    await runDeepLink(secondArg ?? "default", firstArg ?? "/(tabs)/(index)");
    return;
  }

  if (command === "smoke") {
    await runSmoke();
    return;
  }

  throw new Error(`Unknown mobile QA command: ${command}`);
}

await main();

import * as SecureStore from "expo-secure-store";
import { requireUserId } from "@/shared/types/assertions";
import type { UserId } from "@/shared/types/branded";

const LOCAL_QA_SESSION_KEY = "qa_local_session_v1";

const LOCAL_QA_PROFILES = [
  "default",
  "empty",
  "two-accounts",
  "transfer-ready",
  "transfer-conflict",
] as const;

export type LocalQaProfile = (typeof LOCAL_QA_PROFILES)[number];

export type LocalQaSession = {
  readonly userId: UserId;
  readonly profile: LocalQaProfile;
  readonly onboardingComplete: boolean;
  readonly displayName: string;
  readonly email: string;
};

function getRuntimeDevFlag() {
  // biome-ignore lint/style/useNamingConvention: React Native global flag
  return (globalThis as { __DEV__?: boolean }).__DEV__;
}

function getLocalQaBuildFlag() {
  return process.env.EXPO_PUBLIC_ENABLE_LOCAL_QA === "1";
}

function isProductionBuild() {
  return process.env.EXPO_PUBLIC_APP_ENV === "production";
}

export function isLocalQaProfile(value: string | null | undefined): value is LocalQaProfile {
  return LOCAL_QA_PROFILES.includes(value as LocalQaProfile);
}

export function isLocalQaAvailable(): boolean {
  if (isProductionBuild()) return false;
  return getRuntimeDevFlag() === true || process.env.NODE_ENV === "test" || getLocalQaBuildFlag();
}

function parseLocalQaSession(value: string | null): LocalQaSession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as {
      userId?: string;
      profile?: string;
      onboardingComplete?: boolean;
      displayName?: string;
      email?: string;
    };

    if (
      typeof parsed.userId !== "string" ||
      !isLocalQaProfile(parsed.profile) ||
      typeof parsed.onboardingComplete !== "boolean" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }

    return {
      userId: requireUserId(parsed.userId),
      profile: parsed.profile,
      onboardingComplete: parsed.onboardingComplete,
      displayName: parsed.displayName,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}

export async function loadLocalQaSession(): Promise<LocalQaSession | null> {
  if (!isLocalQaAvailable()) return null;

  try {
    return parseLocalQaSession(await SecureStore.getItemAsync(LOCAL_QA_SESSION_KEY));
  } catch {
    return null;
  }
}

export async function persistLocalQaSession(session: LocalQaSession): Promise<void> {
  if (!isLocalQaAvailable()) return;

  await SecureStore.setItemAsync(LOCAL_QA_SESSION_KEY, JSON.stringify(session));
}

export async function clearLocalQaSession(): Promise<void> {
  if (!isLocalQaAvailable()) return;

  await SecureStore.deleteItemAsync(LOCAL_QA_SESSION_KEY);
}

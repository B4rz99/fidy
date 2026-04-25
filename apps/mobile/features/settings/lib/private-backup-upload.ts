import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createPrivateBackup } from "@/features/backup/public";
import { Platform } from "@/shared/components/rn";
import { getDb, getSupabase } from "@/shared/db";
import { generateBackupId } from "@/shared/lib";
import { toIsoDateTime } from "@/shared/lib/format-date";
import type { UserId } from "@/shared/types/branded";

type UploadConfirmedPrivateBackupInput = {
  readonly userId: UserId;
  readonly recoveryKey: string;
  readonly confirmedRecoveryKey: string;
};

const trustedDeviceSecretKey = (userId: UserId) => `private-backup-trusted-device-secret-${userId}`;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getOrCreateTrustedDeviceSecret(userId: UserId) {
  const key = trustedDeviceSecretKey(userId);
  const existing = await SecureStore.getItemAsync(key);
  if (existing !== null && existing.length > 0) {
    return existing;
  }

  const secret = toHex(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(key, secret);
  return secret;
}

function getDeviceLabel() {
  if (Platform.OS === "ios") return "iPhone";
  if (Platform.OS === "android") return "Android";
  return "This device";
}

export async function uploadConfirmedPrivateBackup(input: UploadConfirmedPrivateBackupInput) {
  const exportedAt = toIsoDateTime(new Date());
  return createPrivateBackup({
    db: getDb(input.userId),
    supabase: getSupabase(),
    userId: input.userId,
    backupId: generateBackupId(),
    recoveryKey: input.recoveryKey,
    confirmedRecoveryKey: input.confirmedRecoveryKey,
    trustedDeviceSecret: await getOrCreateTrustedDeviceSecret(input.userId),
    exportedAt,
    appVersion: Constants.expoConfig?.version ?? "0.0.1",
    deviceLabel: getDeviceLabel(),
  });
}

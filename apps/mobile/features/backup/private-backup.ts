import {
  type BackupSnapshot,
  exportLocalLedgerBackupSnapshot,
  LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION,
  validateBackupSnapshot,
} from "@/infrastructure/local-ledger/snapshot";
import type { EncryptedLocalLedgerBackupSnapshot } from "./local-ledger-encryption";
import {
  encryptLocalLedgerBackupSnapshot,
  rotateLocalLedgerBackupRecoveryKey,
} from "./local-ledger-encryption";
import type { RemoteBackupMetadata, UploadEncryptedRemoteBackupInput } from "./remote-storage";
import { uploadEncryptedRemoteBackup } from "./remote-storage";

export type PrivateBackupHealthStatus =
  | "not_set_up"
  | "recovery_key_not_confirmed"
  | "ready"
  | "backup_failed";

export type PrivateBackupHealthInput = {
  readonly latestBackup: RemoteBackupMetadata | null;
  readonly hasGeneratedRecoveryKey: boolean;
  readonly isRecoveryKeyConfirmed: boolean;
  readonly lastUploadFailedAt: string | null;
};

export type PrivateBackupHealth =
  | {
      readonly status: "not_set_up";
      readonly latestBackup: null;
    }
  | {
      readonly status: "recovery_key_not_confirmed";
      readonly latestBackup: RemoteBackupMetadata | null;
    }
  | {
      readonly status: "ready";
      readonly latestBackup: RemoteBackupMetadata;
    }
  | {
      readonly status: "backup_failed";
      readonly latestBackup: RemoteBackupMetadata | null;
      readonly failedAt: string;
    };

type RotateBackupKey = (
  encrypted: EncryptedLocalLedgerBackupSnapshot,
  options: {
    readonly currentRecoveryKey: string;
    readonly newRecoveryKey: string;
    readonly confirmedNewRecoveryKey: string;
  }
) => Promise<EncryptedLocalLedgerBackupSnapshot>;

export type RotatePrivateBackupRecoveryKeySafelyInput = {
  readonly currentBackup: EncryptedLocalLedgerBackupSnapshot;
  readonly currentMetadata: RemoteBackupMetadata;
  readonly currentRecoveryKey: string;
  readonly newRecoveryKey: string;
  readonly confirmedNewRecoveryKey: string;
  readonly rotate?: RotateBackupKey;
  readonly uploadReplacement: (
    rotatedBackup: EncryptedLocalLedgerBackupSnapshot
  ) => Promise<RemoteBackupMetadata>;
};

export type RotatePrivateBackupRecoveryKeySafelyResult = {
  readonly encryptedBackup: EncryptedLocalLedgerBackupSnapshot;
  readonly metadata: RemoteBackupMetadata;
};

type ExportBackupSnapshot = (
  db: Parameters<typeof exportLocalLedgerBackupSnapshot>[0],
  options: { readonly exportedAt: string }
) => BackupSnapshot;

type EncryptBackupSnapshot = (
  snapshot: BackupSnapshot,
  options: {
    readonly trustedDeviceSecret: string;
    readonly recoveryKey: string;
    readonly confirmedRecoveryKey: string;
  }
) => Promise<EncryptedLocalLedgerBackupSnapshot>;

type UploadBackup = (
  supabase: Parameters<typeof uploadEncryptedRemoteBackup>[0],
  input: UploadEncryptedRemoteBackupInput
) => Promise<RemoteBackupMetadata>;

type CreatePrivateBackupDependencies = {
  readonly exportSnapshot: ExportBackupSnapshot;
  readonly encryptSnapshot: EncryptBackupSnapshot;
  readonly uploadBackup: UploadBackup;
};

export type CreatePrivateBackupInput = {
  readonly db: Parameters<typeof exportLocalLedgerBackupSnapshot>[0];
  readonly supabase: Parameters<typeof uploadEncryptedRemoteBackup>[0];
  readonly userId: UploadEncryptedRemoteBackupInput["userId"];
  readonly backupId: UploadEncryptedRemoteBackupInput["backupId"];
  readonly recoveryKey: string;
  readonly confirmedRecoveryKey: string;
  readonly trustedDeviceSecret: string;
  readonly exportedAt: UploadEncryptedRemoteBackupInput["createdAt"];
  readonly appVersion: string;
  readonly deviceLabel: string;
  readonly exportSnapshot?: ExportBackupSnapshot;
  readonly encryptSnapshot?: EncryptBackupSnapshot;
  readonly uploadBackup?: UploadBackup;
};

export function derivePrivateBackupHealth(input: PrivateBackupHealthInput): PrivateBackupHealth {
  if (input.lastUploadFailedAt !== null) {
    return {
      status: "backup_failed",
      latestBackup: input.latestBackup,
      failedAt: input.lastUploadFailedAt,
    };
  }

  if (input.hasGeneratedRecoveryKey && !input.isRecoveryKeyConfirmed) {
    return {
      status: "recovery_key_not_confirmed",
      latestBackup: input.latestBackup,
    };
  }

  if (input.latestBackup === null) {
    return {
      status: "not_set_up",
      latestBackup: null,
    };
  }

  return {
    status: "ready",
    latestBackup: input.latestBackup,
  };
}

export async function createPrivateBackup(input: CreatePrivateBackupInput) {
  const dependencies = resolveCreatePrivateBackupDependencies(input);
  const encryptedBackup = await createEncryptedPrivateBackup(input, dependencies);

  return dependencies.uploadBackup(input.supabase, {
    ...createRemoteBackupMetadataInput(input),
    encryptedBackup,
  });
}

const resolveCreatePrivateBackupDependencies = (
  input: CreatePrivateBackupInput
): CreatePrivateBackupDependencies => ({
  exportSnapshot: resolveExportSnapshot(input),
  encryptSnapshot: resolveEncryptSnapshot(input),
  uploadBackup: resolveUploadBackup(input),
});

const resolveExportSnapshot = (input: CreatePrivateBackupInput): ExportBackupSnapshot =>
  input.exportSnapshot ?? exportLocalLedgerBackupSnapshot;

const resolveEncryptSnapshot = (input: CreatePrivateBackupInput): EncryptBackupSnapshot =>
  input.encryptSnapshot ?? encryptLocalLedgerBackupSnapshot;

const resolveUploadBackup = (input: CreatePrivateBackupInput): UploadBackup =>
  input.uploadBackup ?? uploadEncryptedRemoteBackup;

const createEncryptedPrivateBackup = async (
  input: CreatePrivateBackupInput,
  dependencies: CreatePrivateBackupDependencies
) => {
  const snapshot = dependencies.exportSnapshot(input.db, { exportedAt: input.exportedAt });
  const validatedSnapshot = validateBackupSnapshot(snapshot);
  return dependencies.encryptSnapshot(validatedSnapshot, {
    trustedDeviceSecret: input.trustedDeviceSecret,
    recoveryKey: input.recoveryKey,
    confirmedRecoveryKey: input.confirmedRecoveryKey,
  });
};

const createRemoteBackupMetadataInput = (
  input: CreatePrivateBackupInput
): Omit<UploadEncryptedRemoteBackupInput, "encryptedBackup"> => ({
  userId: input.userId,
  backupId: input.backupId,
  createdAt: input.exportedAt,
  schemaVersion: LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION,
  appVersion: input.appVersion,
  deviceLabel: input.deviceLabel,
});

export async function rotatePrivateBackupRecoveryKeySafely(
  input: RotatePrivateBackupRecoveryKeySafelyInput
): Promise<RotatePrivateBackupRecoveryKeySafelyResult> {
  const rotate = input.rotate ?? rotateLocalLedgerBackupRecoveryKey;
  const rotatedBackup = await rotate(input.currentBackup, {
    currentRecoveryKey: input.currentRecoveryKey,
    newRecoveryKey: input.newRecoveryKey,
    confirmedNewRecoveryKey: input.confirmedNewRecoveryKey,
  });
  const metadata = await input.uploadReplacement(rotatedBackup);

  return {
    encryptedBackup: rotatedBackup,
    metadata,
  };
}

export type RemoteBackupMetadata = {
  readonly userId: string;
  readonly backupId: string;
  readonly createdAt: string;
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly deviceLabel: string;
  readonly ciphertextSizeBytes: number;
  readonly ciphertextSha256: string;
};

export type SignedUploadUrl = {
  readonly signedUrl: string;
  readonly token: string;
};

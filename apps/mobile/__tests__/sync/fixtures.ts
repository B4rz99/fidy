type Overrides = Record<string, unknown>;
type ConflictData = Record<string, unknown>;
type ParsedConflictOverrides = {
  id?: string;
  transactionId?: string;
  localData?: ConflictData;
  serverData?: ConflictData;
  detectedAt?: string;
};
type ConflictRowOverrides = Omit<ParsedConflictOverrides, "localData" | "serverData"> & {
  localData?: ConflictData | string;
  serverData?: ConflictData | string;
};

export const SYNC_USER_ID = "user-1";
export const DEFAULT_SYNC_TIMESTAMP = "2026-03-04T10:00:00.000Z";
export const DEFAULT_CONFLICT_DETECTED_AT = "2026-03-15T10:00:00.000Z";

export const createSyncQueueEntry = (overrides: Overrides = {}) => ({
  id: "sq-1",
  tableName: "transactions",
  rowId: "tx-1",
  operation: "insert",
  createdAt: DEFAULT_SYNC_TIMESTAMP,
  ...overrides,
});

export const createLocalTransaction = (overrides: Overrides = {}) => ({
  id: "tx-1",
  userId: SYNC_USER_ID,
  type: "expense",
  amount: 1000,
  categoryId: "food",
  accountId: "fa-default-user-1",
  accountAttributionState: "confirmed",
  supersededAt: null,
  description: "Local merchant",
  date: "2026-03-10",
  createdAt: "2026-03-10T08:00:00.000Z",
  updatedAt: "2026-03-10T10:00:00.000Z",
  deletedAt: null,
  source: "manual",
  ...overrides,
});

export const createServerTransactionRow = (overrides: Overrides = {}) => ({
  id: "tx-1",
  user_id: SYNC_USER_ID,
  type: "expense",
  amount: 2000,
  category_id: "food",
  account_id: "fa-default-user-1",
  account_attribution_state: "confirmed",
  superseded_at: null,
  description: "Server merchant",
  date: "2026-03-10",
  created_at: "2026-03-10T08:00:00.000Z",
  updated_at: "2026-03-10T14:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

export const createLocalFinancialAccount = (overrides: Overrides = {}) => ({
  id: "fa-1",
  userId: SYNC_USER_ID,
  name: "Main wallet",
  kind: "wallet",
  isDefault: true,
  createdAt: DEFAULT_SYNC_TIMESTAMP,
  updatedAt: DEFAULT_SYNC_TIMESTAMP,
  deletedAt: null,
  ...overrides,
});

export const createServerFinancialAccountRow = (overrides: Overrides = {}) => ({
  id: "fa-1",
  user_id: SYNC_USER_ID,
  name: "Main wallet",
  kind: "wallet",
  is_default: true,
  created_at: "2026-04-18T08:00:00.000Z",
  updated_at: "2026-04-18T09:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

export const createLocalAccountSuggestionDismissal = (overrides: Overrides = {}) => ({
  id: "asd-1",
  userId: SYNC_USER_ID,
  scope: "notification:bancolombia:last4",
  value: "1234",
  dismissedScore: 200,
  createdAt: "2026-04-19T10:00:00.000Z",
  updatedAt: "2026-04-19T10:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

export const createServerAccountSuggestionDismissalRow = (overrides: Overrides = {}) => ({
  id: "asd-1",
  user_id: SYNC_USER_ID,
  scope: "notification:bancolombia:last4",
  value: "1234",
  dismissed_score: 200,
  created_at: "2026-04-19T10:00:00.000Z",
  updated_at: "2026-04-19T11:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

export const createLocalTransfer = (overrides: Overrides = {}) => ({
  id: "tr-1",
  userId: SYNC_USER_ID,
  amount: 250000,
  fromAccountId: "fa-1",
  toAccountId: "fa-2",
  fromExternalLabel: null,
  toExternalLabel: null,
  description: "Move to savings",
  date: "2026-04-18",
  createdAt: "2026-04-18T10:00:00.000Z",
  updatedAt: "2026-04-18T10:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

export const createServerTransferRow = (overrides: Overrides = {}) => ({
  id: "tr-1",
  user_id: SYNC_USER_ID,
  amount: 250000,
  from_account_id: "fa-1",
  to_account_id: "fa-2",
  from_external_label: null,
  to_external_label: null,
  description: "Move to savings",
  date: "2026-04-18",
  created_at: "2026-04-18T09:30:00.000Z",
  updated_at: "2026-04-18T10:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

export const createLocalOpeningBalance = (overrides: Overrides = {}) => ({
  id: "ob-1",
  userId: SYNC_USER_ID,
  accountId: "fa-1",
  amount: 500000,
  effectiveDate: "2026-04-01",
  createdAt: "2026-04-18T10:00:00.000Z",
  updatedAt: "2026-04-18T10:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

export const createServerOpeningBalanceRow = (overrides: Overrides = {}) => ({
  id: "ob-1",
  user_id: SYNC_USER_ID,
  account_id: "fa-1",
  amount: 500000,
  effective_date: "2026-04-01",
  created_at: "2026-04-18T10:30:00.000Z",
  updated_at: "2026-04-18T11:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

export const createLocalFinancialAccountIdentifier = (overrides: Overrides = {}) => ({
  id: "fai-1",
  userId: SYNC_USER_ID,
  accountId: "fa-1",
  scope: "email:bancolombia:last4",
  value: "1234",
  createdAt: "2026-04-18T10:00:00.000Z",
  updatedAt: "2026-04-18T10:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

export const createServerFinancialAccountIdentifierRow = (overrides: Overrides = {}) => ({
  id: "fai-1",
  user_id: SYNC_USER_ID,
  account_id: "fa-1",
  scope: "email:bancolombia:last4",
  value: "1234",
  created_at: "2026-04-18T11:30:00.000Z",
  updated_at: "2026-04-18T12:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

export const createLocalCaptureEvidence = (overrides: Overrides = {}) => ({
  id: "ce-1",
  userId: SYNC_USER_ID,
  sourceFamily: "bancolombia",
  evidenceType: "last4",
  scope: "notification:bancolombia:last4",
  value: "1234",
  transactionId: "tx-1",
  processedEmailId: null,
  processedCaptureId: "pc-1",
  createdAt: "2026-04-19T10:00:00.000Z",
  updatedAt: "2026-04-19T10:00:00.000Z",
  deletedAt: null,
  ...overrides,
});

export const createServerCaptureEvidenceRow = (overrides: Overrides = {}) => ({
  id: "ce-1",
  user_id: SYNC_USER_ID,
  source_family: "bancolombia",
  evidence_type: "last4",
  scope: "notification:bancolombia:last4",
  value: "1234",
  transaction_id: "tx-1",
  processed_email_id: null,
  processed_capture_id: "pc-1",
  created_at: "2026-04-18T07:30:00.000Z",
  updated_at: "2026-04-18T08:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

const DEFAULT_SERVER_CONFLICT_DATA = createLocalTransaction({
  amount: 2000,
  description: "Server merchant",
  updatedAt: "2026-03-10T14:00:00.000Z",
  source: "email",
});

export const createParsedConflict = (overrides: ParsedConflictOverrides = {}) => ({
  id: "conflict-1",
  transactionId: "tx-1",
  localData: createLocalTransaction(),
  serverData: DEFAULT_SERVER_CONFLICT_DATA,
  detectedAt: DEFAULT_CONFLICT_DETECTED_AT,
  ...overrides,
});

const serializeConflictData = (value: ConflictData | string) =>
  typeof value === "string" ? value : JSON.stringify(value);

export const createConflictRow = (overrides: ConflictRowOverrides = {}) => {
  const { localData, serverData, ...rest } = overrides;
  const conflict = createParsedConflict(rest);
  return {
    id: conflict.id,
    transactionId: conflict.transactionId,
    localData: serializeConflictData(localData ?? conflict.localData),
    serverData: serializeConflictData(serverData ?? conflict.serverData),
    detectedAt: conflict.detectedAt,
  };
};

export const createSequentialServerTransactions = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    createServerTransactionRow({
      id: `tx-${index + 1}`,
      amount: 1000,
      description: null,
      created_at: `2026-04-18T${String(index).padStart(4, "0")}:00:00.000Z`,
      updated_at: `2026-04-18T${String(index).padStart(4, "0")}:00:00.000Z`,
    })
  );

export const createCursor = (updatedAt: string, id: string) => ({ updatedAt, id });

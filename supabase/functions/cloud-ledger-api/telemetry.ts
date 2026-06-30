export type CloudLedgerChangeTelemetryOutcome = {
  readonly changeId: string;
  readonly status: "accepted" | "repair_required" | "requires_app_update" | "retryable";
  readonly code: string;
};

type CloudLedgerCommandAction =
  | "applyPendingChanges"
  | "bootstrap"
  | "createTransaction"
  | "deleteCaptureImprovementSamples"
  | "refresh"
  | "retainCaptureImprovementSample"
  | "setCaptureImprovementPreference"
  | "unknown";

export type CloudLedgerCommandTelemetryEvent = {
  readonly action: CloudLedgerCommandAction;
  readonly authenticatedUserId: string;
  readonly commandVersion: number | null;
  readonly deviceId: string | null;
  readonly batchId: string | null;
  readonly changeIds: readonly string[];
  readonly acceptedChangeIds: readonly string[];
  readonly rejectedChangeIds: readonly string[];
  readonly changeOutcomes: readonly CloudLedgerChangeTelemetryOutcome[];
  readonly outcomeCode: string;
  readonly status: "failure" | "success";
  readonly retryableChangeIds: readonly string[];
  readonly repairRequiredChangeIds: readonly string[];
  readonly requiresAppUpdateChangeIds: readonly string[];
  readonly latencyMs: number;
  readonly correlationId: string;
};

export type CloudLedgerTelemetry = {
  readonly recordCommand: (event: CloudLedgerCommandTelemetryEvent) => void | Promise<void>;
};

const CLOUD_LEDGER_COMMAND_ACTIONS = new Set<CloudLedgerCommandAction>([
  "applyPendingChanges",
  "bootstrap",
  "createTransaction",
  "deleteCaptureImprovementSamples",
  "refresh",
  "retainCaptureImprovementSample",
  "setCaptureImprovementPreference",
]);
const SAFE_TELEMETRY_ID_PATTERN = /^[a-z]+-[a-z0-9][a-z0-9_-]{0,63}$/;
const SAFE_TELEMETRY_CODE_PATTERN = /^[a-z][a-z0-9_]{0,79}$/;
const SAFE_CORRELATION_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

export function createCloudLedgerConsoleTelemetry(
  log: (message: string) => void = logCloudLedgerTelemetry
): CloudLedgerTelemetry {
  return {
    recordCommand: (event) => {
      log(JSON.stringify({ event: "cloud_ledger_command", ...event }));
    },
  };
}

export function buildCloudLedgerCommandTelemetryEvent(input: {
  readonly body: unknown;
  readonly responseBody: unknown;
  readonly authenticatedUserId: string;
  readonly latencyMs: number;
  readonly correlationId: string;
}): CloudLedgerCommandTelemetryEvent {
  const body = toRecord(input.body);
  const responseData = readResponseData(input.responseBody);
  const changeOutcomes = readChangeOutcomes(responseData);
  const status = readResponseSuccess(input.responseBody) ? "success" : "failure";
  const action = readCommandAction(body?.action);
  const canLogRequestMetadata = status === "success" && action === "applyPendingChanges";

  return {
    action,
    authenticatedUserId: input.authenticatedUserId,
    commandVersion: readInteger(body?.commandVersion),
    deviceId: canLogRequestMetadata ? readTelemetryId(body?.deviceId, "device") : null,
    batchId: canLogRequestMetadata ? readTelemetryId(body?.batchId, "batch") : null,
    changeIds: canLogRequestMetadata ? readBodyChangeIds(body?.changes) : [],
    acceptedChangeIds: readTelemetryIdArray(responseData?.acceptedChangeIds, "change"),
    rejectedChangeIds: readTelemetryIdArray(responseData?.rejectedChangeIds, "change"),
    changeOutcomes,
    outcomeCode: readOutcomeCode(input.responseBody),
    status,
    retryableChangeIds: changeIdsWithStatus(changeOutcomes, "retryable"),
    repairRequiredChangeIds: changeIdsWithStatus(changeOutcomes, "repair_required"),
    requiresAppUpdateChangeIds: changeIdsWithStatus(changeOutcomes, "requires_app_update"),
    latencyMs: input.latencyMs,
    correlationId: readCorrelationId(input.correlationId) ?? "unknown",
  };
}

function logCloudLedgerTelemetry(message: string): void {
  // eslint-disable-next-line no-console -- Supabase Edge Function operational telemetry log.
  console.log(message);
}

function readOutcomeCode(responseBody: unknown): string {
  const response = toRecord(responseBody);
  const data = readResponseData(responseBody);
  return readTelemetryCode(response?.error) ?? readTelemetryCode(data?.code) ?? "accepted";
}

function readResponseSuccess(responseBody: unknown): boolean {
  return toRecord(responseBody)?.success === true;
}

function readResponseData(responseBody: unknown): Record<string, unknown> | null {
  return toRecord(toRecord(responseBody)?.data);
}

function readBodyChangeIds(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value
        .map((change) => readTelemetryId(toRecord(change)?.id, "change"))
        .filter((changeId): changeId is string => changeId !== null)
    : [];
}

function readChangeOutcomes(value: Record<string, unknown> | null) {
  const outcomes = value?.changeOutcomes;
  return Array.isArray(outcomes)
    ? outcomes.map(readChangeOutcome).filter(isChangeTelemetryOutcome)
    : [];
}

function readChangeOutcome(value: unknown): CloudLedgerChangeTelemetryOutcome | null {
  const outcome = toRecord(value);
  const changeId = readTelemetryId(outcome?.changeId, "change");
  const status = readChangeOutcomeStatus(outcome?.status);
  const code = readTelemetryCode(outcome?.code);
  return changeId === null || status === null || code === null
    ? null
    : {
        changeId,
        status,
        code,
      };
}

function isChangeTelemetryOutcome(
  value: CloudLedgerChangeTelemetryOutcome | null
): value is CloudLedgerChangeTelemetryOutcome {
  return value !== null;
}

function changeIdsWithStatus(
  outcomes: readonly CloudLedgerChangeTelemetryOutcome[],
  status: CloudLedgerChangeTelemetryOutcome["status"]
) {
  return outcomes.filter((outcome) => outcome.status === status).map((outcome) => outcome.changeId);
}

function readTelemetryIdArray(value: unknown, prefix: "change"): readonly string[] {
  return Array.isArray(value)
    ? value
        .map((item) => readTelemetryId(item, prefix))
        .filter((item): item is string => item !== null)
    : [];
}

function readCommandAction(value: unknown): CloudLedgerCommandAction {
  return typeof value === "string" &&
    CLOUD_LEDGER_COMMAND_ACTIONS.has(value as CloudLedgerCommandAction)
    ? (value as CloudLedgerCommandAction)
    : "unknown";
}

function readTelemetryId(value: unknown, prefix: "batch" | "change" | "device"): string | null {
  return typeof value === "string" &&
    value.startsWith(`${prefix}-`) &&
    SAFE_TELEMETRY_ID_PATTERN.test(value)
    ? value
    : null;
}

function readTelemetryCode(value: unknown): string | null {
  return typeof value === "string" && SAFE_TELEMETRY_CODE_PATTERN.test(value) ? value : null;
}

function readCorrelationId(value: unknown): string | null {
  return typeof value === "string" && SAFE_CORRELATION_ID_PATTERN.test(value) ? value : null;
}

function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readChangeOutcomeStatus(
  value: unknown
): CloudLedgerChangeTelemetryOutcome["status"] | null {
  return value === "accepted" ||
    value === "repair_required" ||
    value === "requires_app_update" ||
    value === "retryable"
    ? value
    : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

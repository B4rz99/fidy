export type CloudLedgerChangeTelemetryOutcome = {
  readonly changeId: string;
  readonly status: "accepted" | "repair_required" | "requires_app_update" | "retryable";
  readonly code: string;
};

export type CloudLedgerCommandTelemetryEvent = {
  readonly action: string;
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

  return {
    action: readString(body?.action) ?? "unknown",
    authenticatedUserId: input.authenticatedUserId,
    commandVersion: readInteger(body?.commandVersion),
    deviceId: readString(body?.deviceId),
    batchId: readString(body?.batchId),
    changeIds: readBodyChangeIds(body?.changes),
    acceptedChangeIds: readStringArray(responseData?.acceptedChangeIds),
    rejectedChangeIds: readStringArray(responseData?.rejectedChangeIds),
    changeOutcomes,
    outcomeCode: readOutcomeCode(input.responseBody),
    status: readResponseSuccess(input.responseBody) ? "success" : "failure",
    retryableChangeIds: changeIdsWithStatus(changeOutcomes, "retryable"),
    repairRequiredChangeIds: changeIdsWithStatus(changeOutcomes, "repair_required"),
    requiresAppUpdateChangeIds: changeIdsWithStatus(changeOutcomes, "requires_app_update"),
    latencyMs: input.latencyMs,
    correlationId: input.correlationId,
  };
}

function logCloudLedgerTelemetry(message: string): void {
  // eslint-disable-next-line no-console -- Supabase Edge Function operational telemetry log.
  console.log(message);
}

function readOutcomeCode(responseBody: unknown): string {
  const response = toRecord(responseBody);
  const data = readResponseData(responseBody);
  return readString(response?.error) ?? readString(data?.code) ?? "accepted";
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
        .map((change) => readString(toRecord(change)?.id))
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
  const changeId = readString(outcome?.changeId);
  const status = readChangeOutcomeStatus(outcome?.status);
  const code = readString(outcome?.code);
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

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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

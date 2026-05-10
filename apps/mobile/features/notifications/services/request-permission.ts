import type { PermissionStatus } from "expo-notifications";

type RequestPermissionArgs = {
  readonly captureWarning: (
    message: string,
    context?: Record<string, string | number | boolean>
  ) => void;
  readonly requestPermissions: () => Promise<{ readonly status: PermissionStatus }>;
  readonly timeoutMs: number;
};

type TimeoutStatus = {
  readonly cancel: () => void;
  readonly promise: Promise<null>;
};

type RequestState = {
  active: boolean;
};

function reportPermissionFailure(
  captureWarning: RequestPermissionArgs["captureWarning"],
  reason: "rejected" | "timeout",
  timeoutMs: number
): null {
  captureWarning("notification_permission_request_failed", { reason, timeoutMs });
  return null;
}

function reportRejectedPermissionFailure(
  captureWarning: RequestPermissionArgs["captureWarning"],
  timeoutMs: number,
  state: RequestState
): null {
  if (!state.active) return null;

  return reportPermissionFailure(captureWarning, "rejected", timeoutMs);
}

const readPermissionStatus = (result: { readonly status: PermissionStatus }) => result.status;

const requestStatus = (
  { captureWarning, requestPermissions, timeoutMs }: RequestPermissionArgs,
  state: RequestState
): Promise<PermissionStatus | null> =>
  requestPermissions()
    .then(readPermissionStatus)
    .catch(() => reportRejectedPermissionFailure(captureWarning, timeoutMs, state));

function timeoutStatus(
  captureWarning: RequestPermissionArgs["captureWarning"],
  timeoutMs: number,
  state: RequestState
): TimeoutStatus {
  let timeoutId: ReturnType<typeof setTimeout>;

  return {
    cancel: () => clearTimeout(timeoutId),
    promise: new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        state.active = false;
        reportPermissionFailure(captureWarning, "timeout", timeoutMs);
        resolve(null);
      }, timeoutMs);
    }),
  };
}

async function resolveBeforeTimeout(
  statusRequest: Promise<PermissionStatus | null>,
  timeout: TimeoutStatus
): Promise<PermissionStatus | null> {
  const status = await Promise.race([statusRequest, timeout.promise]);

  timeout.cancel();
  return status;
}

export const requestNotificationPermissionStatus = (
  args: RequestPermissionArgs
): Promise<PermissionStatus | null> => {
  const state = { active: true };

  return resolveBeforeTimeout(
    requestStatus(args, state),
    timeoutStatus(args.captureWarning, args.timeoutMs, state)
  ).finally(() => {
    state.active = false;
  });
};

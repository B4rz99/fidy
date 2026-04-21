import { isLocalQaProfile, type LocalQaProfile } from "../local-session";
import { getQaTargetFromKey, isQaTarget, isQaTargetKey, type QaTarget } from "./entry-points";

function getFirstArrayRouteParamValue(value: readonly string[] | null | undefined): string | null {
  return value?.[0] ?? null;
}

function getFirstRouteParamValue(value: string | readonly string[] | null | undefined): string | null {
  return typeof value === "string" ? value : getFirstArrayRouteParamValue(value);
}

export function parseLocalQaProfileRouteParam(
  value: string | readonly string[] | null | undefined
): LocalQaProfile | null {
  const normalizedValue = getFirstRouteParamValue(value)?.trim();

  if (!normalizedValue) {
    return null;
  }

  return isLocalQaProfile(normalizedValue) ? normalizedValue : null;
}

export function parseQaTargetRouteParam(
  value: string | readonly string[] | null | undefined
): QaTarget | null {
  const normalizedValue = getFirstRouteParamValue(value)?.trim();

  if (!normalizedValue) {
    return null;
  }

  return isQaTarget(normalizedValue) ? normalizedValue : null;
}

export function parseQaTargetKeyRouteParam(
  value: string | readonly string[] | null | undefined
): QaTarget | null {
  const normalizedValue = getFirstRouteParamValue(value)?.trim();

  if (!normalizedValue || !isQaTargetKey(normalizedValue)) {
    return null;
  }

  return getQaTargetFromKey(normalizedValue);
}

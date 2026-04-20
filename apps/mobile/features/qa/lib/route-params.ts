import { isLocalQaProfile, type LocalQaProfile } from "../local-session";
import { getQaTargetFromKey, isQaTarget, isQaTargetKey, type QaTarget } from "./entry-points";

function getFirstRouteParamValue(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function parseLocalQaProfileRouteParam(
  value: string | string[] | null | undefined
): LocalQaProfile | null {
  const normalizedValue = getFirstRouteParamValue(value)?.trim();

  if (!normalizedValue) {
    return null;
  }

  return isLocalQaProfile(normalizedValue) ? normalizedValue : null;
}

export function parseQaTargetRouteParam(
  value: string | string[] | null | undefined
): QaTarget | null {
  const normalizedValue = getFirstRouteParamValue(value)?.trim();

  if (!normalizedValue) {
    return null;
  }

  return isQaTarget(normalizedValue) ? normalizedValue : null;
}

export function parseQaTargetKeyRouteParam(
  value: string | string[] | null | undefined
): QaTarget | null {
  const normalizedValue = getFirstRouteParamValue(value)?.trim();

  if (!normalizedValue || !isQaTargetKey(normalizedValue)) {
    return null;
  }

  return getQaTargetFromKey(normalizedValue);
}

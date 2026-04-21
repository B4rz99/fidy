import { toIsoDateTime } from "@/shared/lib";
import { requireIsoDateTime } from "@/shared/types/assertions";
import type { IsoDateTime } from "@/shared/types/branded";

const EPOCH_MILLISECONDS_PATTERN = /^\d{13}$/;
const EPOCH_SECONDS_PATTERN = /^\d{10}$/;

function tryRequireIsoDateTime(timestamp: string): IsoDateTime | null {
  try {
    return requireIsoDateTime(timestamp);
  } catch {
    return null;
  }
}

function parseSmsDetectedDate(timestamp: string): Date {
  if (EPOCH_MILLISECONDS_PATTERN.test(timestamp)) {
    return new Date(Number(timestamp));
  }

  if (EPOCH_SECONDS_PATTERN.test(timestamp)) {
    return new Date(Number(timestamp) * 1000);
  }

  return new Date(timestamp);
}

function toParsedIsoDateTime(timestamp: string): IsoDateTime | null {
  const parsedDate = parseSmsDetectedDate(timestamp);
  return Number.isNaN(parsedDate.getTime()) ? null : toIsoDateTime(parsedDate);
}

export function parseSmsDetectedAt(timestamp: string): IsoDateTime | null {
  const trimmedTimestamp = timestamp.trim();
  if (trimmedTimestamp.length === 0) {
    return null;
  }

  return tryRequireIsoDateTime(trimmedTimestamp) ?? toParsedIsoDateTime(trimmedTimestamp);
}

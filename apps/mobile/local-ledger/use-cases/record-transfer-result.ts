import type { RecordTransferRejectionReason, RecordTransferResult } from "./write.public";

export type RejectedRecordTransferCommand = Extract<RecordTransferResult, { code: "rejected" }>;

export function reject(reason: RecordTransferRejectionReason): RejectedRecordTransferCommand {
  return { code: "rejected", reason, events: [] };
}

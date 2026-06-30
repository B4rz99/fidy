import type { TranslateFn } from "@/shared/i18n/types";
import type {
  CloudLedgerRepairAction,
  CloudLedgerRepairItem,
  CloudLedgerRepairReason,
} from "./outbox";

export type CloudLedgerRepairActionLabel = {
  readonly action: CloudLedgerRepairAction;
  readonly label: string;
};

export type CloudLedgerRepairItemCopy = {
  readonly title: string;
  readonly body: string;
  readonly actionLabels: readonly CloudLedgerRepairActionLabel[];
  readonly parentChangeId?: CloudLedgerRepairItem["parentChangeId"];
};

const REPAIR_REASON_COPY_KEYS: Record<
  CloudLedgerRepairReason,
  { readonly title: string; readonly body: string }
> = {
  dependencyFailure: {
    title: "cloudLedger.repair.dependencyFailure.title",
    body: "cloudLedger.repair.dependencyFailure.body",
  },
  invalidTransaction: {
    title: "cloudLedger.repair.invalidTransaction.title",
    body: "cloudLedger.repair.invalidTransaction.body",
  },
  retryableFailure: {
    title: "cloudLedger.repair.retryableFailure.title",
    body: "cloudLedger.repair.retryableFailure.body",
  },
  staleConflict: {
    title: "cloudLedger.repair.staleConflict.title",
    body: "cloudLedger.repair.staleConflict.body",
  },
  unsupportedCommandVersion: {
    title: "cloudLedger.repair.unsupportedCommandVersion.title",
    body: "cloudLedger.repair.unsupportedCommandVersion.body",
  },
};

const REPAIR_ACTION_COPY_KEYS: Record<CloudLedgerRepairAction, string> = {
  discard: "cloudLedger.repair.actions.discard",
  editAndResubmit: "cloudLedger.repair.actions.editAndResubmit",
  retry: "cloudLedger.repair.actions.retry",
};

export function describeCloudLedgerRepairItem(
  item: CloudLedgerRepairItem,
  t: TranslateFn
): CloudLedgerRepairItemCopy {
  const copyKeys = REPAIR_REASON_COPY_KEYS[item.reason];
  return {
    title: t(copyKeys.title),
    body: t(copyKeys.body),
    actionLabels: item.actions.map((action) => ({
      action,
      label: t(REPAIR_ACTION_COPY_KEYS[action]),
    })),
    ...(item.parentChangeId === undefined ? {} : { parentChangeId: item.parentChangeId }),
  };
}

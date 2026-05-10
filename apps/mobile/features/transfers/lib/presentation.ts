import type { TranslateFn } from "@/shared/i18n";
import type { FinancialAccountId } from "@/shared/types/branded";
import { OUTSIDE_FIDY_LABEL, type StoredTransfer, type TransferSide } from "./build-transfer";

type AccountNameMap = Readonly<Record<string, string>>;

function getExternalSideLabel(label: string, t: TranslateFn): string {
  return label === OUTSIDE_FIDY_LABEL ? t("transfers.outsideFidy") : label;
}

export function getTransferSideLabel(
  side: TransferSide,
  accountNames: AccountNameMap,
  t: TranslateFn
): string {
  return side.kind === "account"
    ? (accountNames[side.accountId] ?? t("common.unknown"))
    : getExternalSideLabel(side.label, t);
}

export function getTransferActivityCopy(
  transfer: StoredTransfer,
  accountNames: AccountNameMap,
  t: TranslateFn
) {
  const fromLabel = getTransferSideLabel(transfer.fromSide, accountNames, t);
  const toLabel = getTransferSideLabel(transfer.toSide, accountNames, t);
  const title = (() => {
    if (transfer.toSide.kind === "account") {
      return t("transfers.activity.toAccount", { name: toLabel });
    }

    if (transfer.fromSide.kind === "account") {
      return t("transfers.activity.fromAccount", { name: fromLabel });
    }

    return t("transfers.activity.generic");
  })();

  return {
    title,
    route: t("transfers.activity.route", { from: fromLabel, to: toLabel }),
  };
}

export function isTransferSideSelected(
  side: TransferSide | null,
  accountId: FinancialAccountId
): boolean {
  return side?.kind === "account" && side.accountId === accountId;
}

import type { TransferSource } from "@/local-ledger/public";
import type { CopAmount, FinancialAccountId, TransferId, UserId } from "@/shared/types/branded";
import {
  buildStoredTransfer,
  buildTransferAmount,
  validateTransferSides,
} from "./build-transfer-helpers";

export {
  toStoredTransfer,
  toStoredTransferFromLocalLedger,
  toTransferRow,
} from "./transfer-row-mappers";

export const OUTSIDE_FIDY_LABEL = "Outside Fidy";

export type TransferSide =
  | {
      readonly kind: "account";
      readonly accountId: FinancialAccountId;
    }
  | {
      readonly kind: "external";
      readonly label: string;
    };

export type StoredTransfer = {
  readonly id: TransferId;
  readonly userId: UserId;
  readonly amount: CopAmount;
  readonly fromSide: TransferSide;
  readonly toSide: TransferSide;
  readonly description: string;
  readonly date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly source: TransferSource;
};

export type BuildTransferInput = {
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly toSide: TransferSide | null;
  readonly description: string;
  readonly date: Date;
};

export type BuildTransferCommand = {
  readonly input: BuildTransferInput;
  readonly userId: UserId;
  readonly id: TransferId;
  readonly now: Date;
  readonly source: TransferSource;
  readonly existing?: StoredTransfer | null;
};

export type TransferBuildError =
  | "amountRequired"
  | "fromSideRequired"
  | "toSideRequired"
  | "trackedAccountRequired"
  | "distinctSidesRequired";

type TransferBuildResult =
  | { success: true; transfer: StoredTransfer }
  | { success: false; error: TransferBuildError };

export function buildTransfer(command: BuildTransferCommand): TransferBuildResult {
  const { input } = command;
  const amount = buildTransferAmount(input.digits);
  if (amount == null) {
    return { success: false, error: "amountRequired" };
  }

  const sides = validateTransferSides(input.fromSide, input.toSide);
  if (!sides.success) {
    return sides;
  }

  return {
    success: true,
    transfer: buildStoredTransfer(command, amount, sides),
  };
}

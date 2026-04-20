import type { FinancialAccountRow } from "@/features/financial-accounts";
import { requireFinancialAccountId } from "@/shared/types/assertions";
import type { TransferSide } from "./build-transfer";

export type TransferQaPreset = "transfer-conflict";

const TRANSFER_QA_PRESETS = ["transfer-conflict"] as const;

type TransferQaDraft = {
  readonly digits: string;
  readonly fromSide: TransferSide;
  readonly toSide: TransferSide;
  readonly lastEditedSide: "from" | "to";
};

export function isTransferQaPreset(
  value: string | string[] | null | undefined
): value is TransferQaPreset {
  return typeof value === "string" && TRANSFER_QA_PRESETS.includes(value as TransferQaPreset);
}

type TransferQaAccount = {
  readonly id: FinancialAccountRow["id"] | string;
  readonly isDefault?: boolean;
};

function getDefaultTrackedAccount(accounts: readonly TransferQaAccount[]) {
  return accounts.find((account) => account.isDefault) ?? accounts[0] ?? null;
}

export function buildTransferQaPreset(
  preset: TransferQaPreset,
  accounts: readonly TransferQaAccount[]
): TransferQaDraft | null {
  const defaultAccount = getDefaultTrackedAccount(accounts);

  if (!defaultAccount) return null;

  if (preset === "transfer-conflict") {
    return {
      digits: "125000",
      fromSide: { kind: "account", accountId: requireFinancialAccountId(defaultAccount.id) },
      toSide: { kind: "account", accountId: requireFinancialAccountId(defaultAccount.id) },
      lastEditedSide: "to",
    };
  }

  return null;
}

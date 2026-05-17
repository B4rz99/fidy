import {
  reclassifyTransactionsAsTransfer as reclassifyTransactionsWithLocalLedger,
  type ReclassifyTransactionsAsTransferError,
} from "@/infrastructure/local-ledger/public";
import type { StoredTransfer } from "./build-transfer";
import { toStoredTransferFromLocalLedger } from "./transfer-row-mappers";

export type { ReclassifyTransactionsAsTransferError };

export type ReclassifyTransactionsAsTransferResult =
  | { readonly success: true; readonly transfer: StoredTransfer }
  | { readonly success: false; readonly error: ReclassifyTransactionsAsTransferError };

export async function reclassifyTransactionsAsTransfer(
  ...args: Parameters<typeof reclassifyTransactionsWithLocalLedger>
): Promise<ReclassifyTransactionsAsTransferResult> {
  const result = await reclassifyTransactionsWithLocalLedger(...args);
  return result.success
    ? { success: true, transfer: toStoredTransferFromLocalLedger(result.transfer) }
    : result;
}

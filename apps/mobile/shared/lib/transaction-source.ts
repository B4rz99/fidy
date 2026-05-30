import {
  TRANSACTION_SOURCES,
  type NormalizedTransactionSource,
} from "@/shared/types/ledger-source";

export { TRANSACTION_SOURCES, type NormalizedTransactionSource };

const isTransactionSource = (source: string): source is NormalizedTransactionSource =>
  TRANSACTION_SOURCES.includes(source as NormalizedTransactionSource);

export const normalizeTransactionSource = (
  source: string | null | undefined
): NormalizedTransactionSource => {
  if (source == null) return "manual";
  if (isTransactionSource(source)) return source;
  throw new Error(`Unsupported transaction source: ${source}`);
};

export type NormalizedTransactionSource = "manual" | "automated";

export const normalizeTransactionSource = (
  source: string | null | undefined
): NormalizedTransactionSource => (source === "manual" || source == null ? "manual" : "automated");

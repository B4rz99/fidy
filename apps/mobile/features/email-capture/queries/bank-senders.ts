import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";
import { type BankSender, DEFAULT_BANK_SENDERS } from "../lib/bank-senders";

type BankSenderRow = { readonly bank: string; readonly email: string };

export const bankSendersQueryKey = ["email-capture", "bank-senders"] as const;

function mergeBankSenders(rows: readonly BankSenderRow[]): readonly BankSender[] {
  const remoteEmails = new Set(rows.map((row) => row.email.toLowerCase()));
  const missingDefaults = DEFAULT_BANK_SENDERS.filter(
    (sender) => !remoteEmails.has(sender.email.toLowerCase())
  );

  return [...rows.map((row) => ({ bank: row.bank, email: row.email })), ...missingDefaults];
}

export async function loadBankSenders(): Promise<readonly BankSender[]> {
  const response = await (async () => {
    try {
      return await getSupabase().from("bank_senders").select("bank, email");
    } catch (err) {
      captureWarning("bank_senders_exception", {
        errorType: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
  })();
  const rows = response.data as readonly BankSenderRow[] | null;

  if (response.error != null || rows == null || rows.length === 0) {
    captureWarning("bank_senders_fetch_failed", {
      errorMessage: response.error?.message ?? "empty_result",
    });
    throw response.error ?? new Error("empty_result");
  }

  return mergeBankSenders(rows);
}

export const bankSendersQueryOptions = queryOptions({
  queryKey: bankSendersQueryKey,
  queryFn: loadBankSenders,
  staleTime: 60 * 60 * 1000,
  gcTime: 2 * 60 * 60 * 1000,
});

export async function ensureBankSenders(queryClient: QueryClient): Promise<readonly BankSender[]> {
  try {
    return await queryClient.ensureQueryData(bankSendersQueryOptions);
  } catch {
    return queryClient.getQueryData(bankSendersQueryKey) ?? DEFAULT_BANK_SENDERS;
  }
}

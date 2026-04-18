import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";
import { type BankSender, DEFAULT_BANK_SENDERS } from "../lib/bank-senders";

type BankSenderRow = {
  readonly bank: string;
  readonly email: string;
};

const BANK_SENDERS_STALE_TIME_MS = 60 * 60 * 1000;

function mergeBankSenders(rows: readonly BankSenderRow[]): readonly BankSender[] {
  const remoteEmails = new Set(rows.map((row) => row.email.toLowerCase()));
  const missingDefaults = DEFAULT_BANK_SENDERS.filter(
    (sender) => !remoteEmails.has(sender.email.toLowerCase())
  );

  return [...rows.map((row) => ({ bank: row.bank, email: row.email })), ...missingDefaults];
}

export const bankSendersQueryKey = ["bank-senders"] as const;

export async function loadBankSenders(): Promise<readonly BankSender[]> {
  const { data, error } = await getSupabase().from("bank_senders").select("bank, email");
  const rows = data as BankSenderRow[] | null;

  if (error != null) {
    throw new Error(error.message);
  }

  if (rows == null || rows.length === 0) {
    throw new Error("empty_result");
  }

  return mergeBankSenders(rows);
}

export const bankSendersQueryOptions = queryOptions({
  queryKey: bankSendersQueryKey,
  queryFn: loadBankSenders,
  gcTime: BANK_SENDERS_STALE_TIME_MS,
  staleTime: BANK_SENDERS_STALE_TIME_MS,
});

export async function ensureBankSenders(queryClient: QueryClient): Promise<readonly BankSender[]> {
  try {
    return await queryClient.ensureQueryData(bankSendersQueryOptions);
  } catch (error) {
    captureWarning("bank_senders_fetch_failed", {
      errorMessage: error instanceof Error ? error.message : "unknown",
    });

    const cachedSenders = queryClient.getQueryData<readonly BankSender[]>(bankSendersQueryKey);
    return cachedSenders ?? DEFAULT_BANK_SENDERS;
  }
}

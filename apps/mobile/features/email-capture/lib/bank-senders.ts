import { getSupabase } from "@/shared/lib/supabase";

export type BankSender = {
  readonly bank: string;
  readonly email: string;
};

export const DEFAULT_BANK_SENDERS: readonly BankSender[] = [
  { bank: "Davibank", email: "davibankinforma@davibank.com" },
  { bank: "BBVA", email: "BBVA@bbvanet.com.co" },
  { bank: "Rappi", email: "noreply@rappicard.co" },
] as const;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cachedSenders: readonly BankSender[] | null = null;
let cachedAt = 0;

export async function fetchBankSenders(): Promise<readonly BankSender[]> {
  if (cachedSenders && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSenders;
  }

  try {
    const { data, error } = await getSupabase().from("bank_senders").select("bank, email");

    if (error || !data || data.length === 0) {
      return cachedSenders ?? DEFAULT_BANK_SENDERS;
    }

    cachedSenders = data.map((row) => ({ bank: row.bank, email: row.email }));
    cachedAt = Date.now();
    return cachedSenders;
  } catch {
    return cachedSenders ?? DEFAULT_BANK_SENDERS;
  }
}

export function resetBankSendersCache() {
  cachedSenders = null;
  cachedAt = 0;
}

export function isBankSender(from: string, senders: readonly BankSender[]): boolean {
  const normalized = from.toLowerCase();
  return senders.some((s) => s.email.toLowerCase() === normalized);
}

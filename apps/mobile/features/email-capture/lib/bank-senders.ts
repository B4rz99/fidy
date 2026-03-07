import { getSupabase } from "@/shared/lib/supabase";

export type BankSender = {
  readonly bank: string;
  readonly email: string;
};

export const DEFAULT_BANK_SENDERS: readonly BankSender[] = [
  { bank: "Davibank", email: "davibankinforma@davibank.com" },
  { bank: "BBVA", email: "BBVA@bbvanet.com.co" },
  { bank: "RappiCard", email: "noreply@rappicard.co" },
  { bank: "RappiPay", email: "noreply@rappipay.co" },
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
      console.warn("[BankSenders] fetch failed or empty, using defaults:", error?.message);
      return cachedSenders ?? DEFAULT_BANK_SENDERS;
    }

    // Merge remote + defaults so hardcoded senders always work
    const remoteEmails = new Set(data.map((r) => r.email.toLowerCase()));
    const missing = DEFAULT_BANK_SENDERS.filter((s) => !remoteEmails.has(s.email.toLowerCase()));
    cachedSenders = [...data.map((row) => ({ bank: row.bank, email: row.email })), ...missing];
    cachedAt = Date.now();
    return cachedSenders;
  } catch (err) {
    console.warn("[BankSenders] exception, using defaults:", err);
    return cachedSenders ?? DEFAULT_BANK_SENDERS;
  }
}

export function resetBankSendersCache() {
  cachedSenders = null;
  cachedAt = 0;
}

export function extractDomain(email: string): string {
  const atIdx = email.lastIndexOf("@");
  return atIdx >= 0 ? email.slice(atIdx + 1).toLowerCase() : email.toLowerCase();
}

export function isBankSender(from: string, senders: readonly BankSender[]): boolean {
  const fromDomain = extractDomain(from);
  return senders.some((s) => extractDomain(s.email) === fromDomain);
}

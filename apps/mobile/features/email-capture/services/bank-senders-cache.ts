import { getSupabase } from "@/shared/db/supabase";
import { type BankSender, DEFAULT_BANK_SENDERS } from "../lib/bank-senders";

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

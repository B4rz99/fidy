import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";
import { type BankSender, DEFAULT_BANK_SENDERS } from "../lib/bank-senders";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const cache = (() => {
  const state = { senders: null as readonly BankSender[] | null, at: 0 };
  return {
    get: (): readonly BankSender[] | null =>
      state.senders && Date.now() - state.at < CACHE_TTL_MS ? state.senders : null,
    set: (s: readonly BankSender[]) => {
      state.senders = s;
      state.at = Date.now();
    },
    reset: () => {
      state.senders = null;
      state.at = 0;
    },
    fallback: (): readonly BankSender[] => state.senders ?? DEFAULT_BANK_SENDERS,
  };
})();

export async function fetchBankSenders(): Promise<readonly BankSender[]> {
  const cached = cache.get();
  if (cached) return cached;

  try {
    const { data, error } = await getSupabase().from("bank_senders").select("bank, email");

    if (error || !data || data.length === 0) {
      captureWarning("bank_senders_fetch_failed", {
        errorMessage: error?.message ?? "empty_result",
      });
      return cache.fallback();
    }

    // Merge remote + defaults so hardcoded senders always work
    const remoteEmails = new Set(data.map((r) => r.email.toLowerCase()));
    const missing = DEFAULT_BANK_SENDERS.filter((s) => !remoteEmails.has(s.email.toLowerCase()));
    const merged = [...data.map((row) => ({ bank: row.bank, email: row.email })), ...missing];
    cache.set(merged);
    return merged;
  } catch (err) {
    captureWarning("bank_senders_exception", {
      errorType: err instanceof Error ? err.message : "unknown",
    });
    return cache.fallback();
  }
}

export function resetBankSendersCache() {
  cache.reset();
}

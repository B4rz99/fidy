import { useTransactionStore } from "@/features/transactions";
import { parseIsoDate, trackTransactionCreated } from "@/shared/lib";
import type { VoiceParseResult } from "../lib/voice-parse-schema";

export async function saveVoiceTransaction(
  parsed: VoiceParseResult
): Promise<{ success: boolean }> {
  const store = useTransactionStore.getState();

  store.setType(parsed.type);
  store.setDigits(String(parsed.amount));
  store.setCategoryId(parsed.categoryId);
  store.setDescription(parsed.description);
  store.setDate(parseIsoDate(parsed.date));

  try {
    const result = await store.saveTransaction();
    if (result.success) {
      trackTransactionCreated({
        type: parsed.type,
        category: parsed.categoryId,
        source: "voice",
      });
    }
    return { success: result.success };
  } finally {
    store.resetForm();
  }
}

import { useCallback, useRef, useState } from "react";
import { voiceParse } from "@/features/ai-chat/services/ai-chat-api";
import { useLocaleStore } from "@/shared/i18n/store";
import { capturePipelineEvent, captureWarning } from "@/shared/lib";
import type { VoiceParseResult } from "../lib/voice-parse-schema";
import { voiceParseResultSchema } from "../lib/voice-parse-schema";
import { saveVoiceTransaction } from "../services/save-voice-transaction";

type VoiceState =
  | { status: "idle" }
  | { status: "listening"; transcript: string }
  | { status: "parsing"; transcript: string }
  | { status: "confirm"; parsed: VoiceParseResult; transcript: string }
  | { status: "saving" }
  | { status: "error"; message: string; transcript: string };

export function useVoiceTransaction() {
  const [state, setState] = useState<VoiceState>({ status: "idle" });
  const subscriptionsRef = useRef<Array<{ remove: () => void }>>([]);
  const finalTranscriptRef = useRef("");
  const sttStartRef = useRef(0);
  const parsedRef = useRef<VoiceParseResult | null>(null);

  const cleanup = useCallback(() => {
    for (const sub of subscriptionsRef.current) {
      sub.remove();
    }
    subscriptionsRef.current = [];
  }, []);

  const parseTranscript = useCallback(async (transcript: string) => {
    const locale = useLocaleStore.getState().locale;
    const sttDurationMs = Date.now() - sttStartRef.current;
    const parseStart = Date.now();
    const result = await voiceParse(transcript, locale);
    const parseDurationMs = Date.now() - parseStart;

    if (!result) {
      captureWarning("voice_parse_failed", {
        reason: "network_or_api_error",
        transcript,
        sttDurationMs,
        parseDurationMs,
      });
      setState({ status: "error", message: "connectToInternet", transcript });
      return;
    }

    const validated = voiceParseResultSchema.safeParse(result);
    if (!validated.success) {
      captureWarning("voice_parse_invalid", {
        transcript,
        validationError: validated.error.issues[0]?.message ?? "unknown",
        sttDurationMs,
        parseDurationMs,
      });
      setState({ status: "error", message: "couldNotUnderstand", transcript });
      return;
    }

    capturePipelineEvent({
      source: "voice",
      outcome: "parsed",
      sttDurationMs,
      parseDurationMs,
      categoryId: String(validated.data.categoryId),
      amount: validated.data.amount,
    });

    parsedRef.current = validated.data;
    setState({ status: "confirm", parsed: validated.data, transcript });
  }, []);

  const startListening = useCallback(async () => {
    // Dynamic import to avoid bundle crash on platforms without the module
    const mod = await import("@/modules/expo-speech-recognition");

    if (!mod.isAvailable()) {
      captureWarning("voice_stt_unavailable", { reason: "module_not_available" });
      setState({ status: "error", message: "speechNotAvailable", transcript: "" });
      return;
    }

    setState({ status: "listening", transcript: "" });
    finalTranscriptRef.current = "";
    sttStartRef.current = Date.now();

    const locale = useLocaleStore.getState().locale;

    const transcriptSub = mod.addTranscriptListener((event) => {
      if (event.isFinal) {
        finalTranscriptRef.current = event.text;
        cleanup();
        setState({ status: "parsing", transcript: event.text });
        parseTranscript(event.text);
      } else {
        setState({ status: "listening", transcript: event.text });
      }
    });

    const errorSub = mod.addErrorListener((event) => {
      cleanup();
      captureWarning("voice_stt_error", {
        errorMessage: event.message,
        sttDurationMs: Date.now() - sttStartRef.current,
      });
      const message = event.message.includes("permission")
        ? "micPermissionDenied"
        : "couldNotUnderstand";
      setState({ status: "error", message, transcript: finalTranscriptRef.current });
    });

    subscriptionsRef.current = [transcriptSub, errorSub];
    mod.startListening(locale);
  }, [cleanup, parseTranscript]);

  const confirm = useCallback(async () => {
    const parsed = parsedRef.current;
    if (!parsed) return;
    setState({ status: "saving" });
    const result = await saveVoiceTransaction(parsed);
    if (result.success) {
      capturePipelineEvent({
        source: "voice",
        outcome: "saved",
        categoryId: String(parsed.categoryId),
        amount: parsed.amount,
      });
      parsedRef.current = null;
      setState({ status: "idle" });
    } else {
      captureWarning("voice_save_failed", {
        categoryId: String(parsed.categoryId),
        amount: parsed.amount,
      });
      setState({ status: "error", message: "couldNotUnderstand", transcript: "" });
    }
  }, []);

  const retry = useCallback(() => {
    cleanup();
    startListening();
  }, [cleanup, startListening]);

  const cancel = useCallback(() => {
    cleanup();
    // Stop listening if active
    import("@/modules/expo-speech-recognition").then((mod) => {
      try {
        mod.stopListening();
      } catch {
        /* ignore */
      }
    });
    capturePipelineEvent({ source: "voice", outcome: "cancelled" });
    setState({ status: "idle" });
  }, [cleanup]);

  return { state, startListening, confirm, retry, cancel };
}

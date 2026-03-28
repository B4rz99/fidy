// biome-ignore-all lint/suspicious/noExplicitAny: mock internals need flexible typing
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock fns ────────────────────────────────────────────────────────────────
const mockIsAvailable = vi.fn();
const mockStartListening = vi.fn();
const mockStopListening = vi.fn();
const mockAddTranscriptListener = vi.fn();
const mockAddErrorListener = vi.fn();

const mockVoiceParse = vi.fn();
const mockCaptureWarning = vi.fn();
const mockCapturePipelineEvent = vi.fn();
const mockSaveVoiceTransaction = vi.fn();

// ── Mocks (hoisted before imports) ──────────────────────────────────────────

vi.mock("@/modules/expo-speech-recognition", () => ({
  isAvailable: (...args: any[]) => mockIsAvailable(...args),
  startListening: (...args: any[]) => mockStartListening(...args),
  stopListening: (...args: any[]) => mockStopListening(...args),
  addTranscriptListener: (...args: any[]) => mockAddTranscriptListener(...args),
  addErrorListener: (...args: any[]) => mockAddErrorListener(...args),
}));

vi.mock("@/features/ai-chat/services/ai-chat-api", () => ({
  voiceParse: (...args: any[]) => mockVoiceParse(...args),
}));

vi.mock("@/shared/lib", () => ({
  captureWarning: (...args: any[]) => mockCaptureWarning(...args),
  capturePipelineEvent: (...args: any[]) => mockCapturePipelineEvent(...args),
  captureError: vi.fn(),
  parseIsoDate: vi.fn((d: string) => new Date(d)),
  trackTransactionCreated: vi.fn(),
}));

vi.mock("@/features/voice/services/save-voice-transaction", () => ({
  saveVoiceTransaction: (...args: any[]) => mockSaveVoiceTransaction(...args),
}));

vi.mock("@/shared/i18n/store", () => ({
  useLocaleStore: {
    getState: () => ({ locale: "es" }),
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Simulate React hooks in a node environment.
 * We call the hook function directly, capturing state updates.
 */
type StateSlot<T = any> = { value: T; setter: (v: T | ((prev: T) => T)) => void };
const stateSlots: StateSlot[] = [];
const refSlots: Array<{ current: any }> = [];
let slotIndex = 0;
let refIndex = 0;

function resetHookState() {
  stateSlots.length = 0;
  refSlots.length = 0;
  slotIndex = 0;
  refIndex = 0;
}

function rewindSlots() {
  slotIndex = 0;
  refIndex = 0;
}

vi.mock("react", () => ({
  useState: (init: any) => {
    if (slotIndex >= stateSlots.length) {
      const slot: StateSlot = {
        value: init,
        setter: (v: any) => {
          slot.value = typeof v === "function" ? v(slot.value) : v;
        },
      };
      stateSlots.push(slot);
    }
    const slot = stateSlots[slotIndex++];
    return [slot.value, slot.setter];
  },
  useCallback: (fn: any, _deps: any[]) => fn,
  memo: (component: any) => component,
  useRef: (init: any) => {
    if (refIndex >= refSlots.length) {
      refSlots.push({ current: init });
    }
    return refSlots[refIndex++];
  },
}));

function getState() {
  return stateSlots[0]?.value;
}

async function callHook() {
  rewindSlots();
  const mod = await import("@/features/voice/hooks/use-voice-transaction");
  // biome-ignore lint/correctness/useHookAtTopLevel: test helper simulates React hook env
  return mod.useVoiceTransaction();
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("useVoiceTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetHookState();

    // Default mocks
    mockIsAvailable.mockReturnValue(true);
    mockAddTranscriptListener.mockReturnValue({ remove: vi.fn() });
    mockAddErrorListener.mockReturnValue({ remove: vi.fn() });
    mockVoiceParse.mockResolvedValue(null);
    mockSaveVoiceTransaction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. startListening — module unavailable ────────────────────────────────

  describe("startListening — when module unavailable", () => {
    it("sets state to error with message 'speechNotAvailable'", async () => {
      mockIsAvailable.mockReturnValue(false);

      const hook = await callHook();
      await hook.startListening();

      expect(getState()).toEqual({
        status: "error",
        message: "speechNotAvailable",
        transcript: "",
      });
    });

    it("calls captureWarning('voice_stt_unavailable')", async () => {
      mockIsAvailable.mockReturnValue(false);

      const hook = await callHook();
      await hook.startListening();

      expect(mockCaptureWarning).toHaveBeenCalledWith("voice_stt_unavailable", {
        reason: "module_not_available",
      });
    });
  });

  // ── 2. startListening — module available ──────────────────────────────────

  describe("startListening — when module available", () => {
    it("calls mod.startListening with locale", async () => {
      const hook = await callHook();
      await hook.startListening();

      expect(mockStartListening).toHaveBeenCalledWith("es");
    });

    it("sets state to 'listening'", async () => {
      const hook = await callHook();
      await hook.startListening();

      // State should be "listening" (set before listeners fire)
      expect(getState()).toEqual({ status: "listening", transcript: "" });
    });
  });

  // ── 3. Transcript listener — partial result ───────────────────────────────

  describe("transcript listener — partial result", () => {
    it("updates transcript in state while still listening", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({ text: "gasté cien", isFinal: false });

      expect(getState()).toEqual({
        status: "listening",
        transcript: "gasté cien",
      });
    });
  });

  // ── 4. Transcript listener — final result ─────────────────────────────────

  describe("transcript listener — final result", () => {
    it("sets state to 'parsing' and calls voiceParse", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      // Make voiceParse hang so we can check the intermediate "parsing" state
      mockVoiceParse.mockReturnValue(new Promise(() => {}));

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      expect(getState()).toEqual({
        status: "parsing",
        transcript: "gasté cien pesos en comida",
      });
      expect(mockVoiceParse).toHaveBeenCalledWith("gasté cien pesos en comida", "es");
    });
  });

  // ── 5. voiceParse returns null (network error) ────────────────────────────

  describe("voiceParse returns null (network error)", () => {
    it("sets state to error with message 'connectToInternet'", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue(null);

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      // Wait for async parseTranscript to resolve
      await vi.waitFor(() => {
        expect(getState().status).toBe("error");
      });

      expect(getState()).toEqual({
        status: "error",
        message: "connectToInternet",
        transcript: "gasté cien pesos en comida",
      });
    });

    it("calls captureWarning('voice_parse_failed')", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue(null);

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      await vi.waitFor(() => {
        expect(mockCaptureWarning).toHaveBeenCalledWith(
          "voice_parse_failed",
          expect.objectContaining({
            reason: "network_or_api_error",
            transcript: "gasté cien pesos en comida",
          })
        );
      });
    });
  });

  // ── 6. voiceParse returns invalid data ────────────────────────────────────

  describe("voiceParse returns invalid data", () => {
    it("sets state to error with message 'couldNotUnderstand'", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      // Return data that fails schema validation (missing required fields)
      mockVoiceParse.mockResolvedValue({ amount: "not-a-number" });

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté algo",
        isFinal: true,
      });

      await vi.waitFor(() => {
        expect(getState().status).toBe("error");
      });

      expect(getState()).toEqual({
        status: "error",
        message: "couldNotUnderstand",
        transcript: "gasté algo",
      });
    });

    it("calls captureWarning('voice_parse_invalid')", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue({ amount: "bad" });

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({ text: "gasté algo", isFinal: true });

      await vi.waitFor(() => {
        expect(mockCaptureWarning).toHaveBeenCalledWith(
          "voice_parse_invalid",
          expect.objectContaining({ transcript: "gasté algo" })
        );
      });
    });
  });

  // ── 7. voiceParse returns valid data ──────────────────────────────────────

  describe("voiceParse returns valid data", () => {
    const validParsed = {
      type: "expense",
      amount: 10000,
      categoryId: "food",
      description: "Lunch",
      date: "2026-03-15",
    };

    it("sets state to 'confirm' with parsed data", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue(validParsed);

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      await vi.waitFor(() => {
        expect(getState().status).toBe("confirm");
      });

      expect(getState()).toEqual({
        status: "confirm",
        parsed: { ...validParsed, date: "2026-03-15" },
        transcript: "gasté cien pesos en comida",
      });
    });

    it("calls capturePipelineEvent with outcome 'parsed'", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue(validParsed);

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      await vi.waitFor(() => {
        expect(mockCapturePipelineEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            source: "voice",
            outcome: "parsed",
            categoryId: "food",
            amount: 10000,
          })
        );
      });
    });
  });

  // ── 8. confirm — on success ───────────────────────────────────────────────

  describe("confirm — on success", () => {
    const validParsed = {
      type: "expense",
      amount: 10000,
      categoryId: "food",
      description: "Lunch",
      date: "2026-03-15",
    };

    it("calls saveVoiceTransaction and sets state to 'idle'", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue(validParsed);
      mockSaveVoiceTransaction.mockResolvedValue({ success: true });

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      await vi.waitFor(() => {
        expect(getState().status).toBe("confirm");
      });

      // Re-call hook to get updated `confirm` with current state closure
      rewindSlots();
      const updatedHook = await callHook();
      await updatedHook.confirm();

      expect(mockSaveVoiceTransaction).toHaveBeenCalled();
      expect(getState()).toEqual({ status: "idle" });
    });

    it("calls capturePipelineEvent with outcome 'saved'", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue(validParsed);
      mockSaveVoiceTransaction.mockResolvedValue({ success: true });

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      await vi.waitFor(() => {
        expect(getState().status).toBe("confirm");
      });

      mockCapturePipelineEvent.mockClear();
      rewindSlots();
      const updatedHook = await callHook();
      await updatedHook.confirm();

      expect(mockCapturePipelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "voice",
          outcome: "saved",
          categoryId: "food",
          amount: 10000,
        })
      );
    });
  });

  // ── 9. confirm — on failure ───────────────────────────────────────────────

  describe("confirm — on failure", () => {
    const validParsed = {
      type: "expense",
      amount: 10000,
      categoryId: "food",
      description: "Lunch",
      date: "2026-03-15",
    };

    it("sets state to error and calls captureWarning('voice_save_failed')", async () => {
      let capturedTranscriptListener: (event: any) => void = () => {};
      mockAddTranscriptListener.mockImplementation((listener: any) => {
        capturedTranscriptListener = listener;
        return { remove: vi.fn() };
      });
      mockVoiceParse.mockResolvedValue(validParsed);
      mockSaveVoiceTransaction.mockResolvedValue({ success: false });

      const hook = await callHook();
      await hook.startListening();

      capturedTranscriptListener({
        text: "gasté cien pesos en comida",
        isFinal: true,
      });

      await vi.waitFor(() => {
        expect(getState().status).toBe("confirm");
      });

      rewindSlots();
      const updatedHook = await callHook();
      await updatedHook.confirm();

      expect(getState()).toEqual({
        status: "error",
        message: "couldNotUnderstand",
        transcript: "",
      });
      expect(mockCaptureWarning).toHaveBeenCalledWith(
        "voice_save_failed",
        expect.objectContaining({
          categoryId: "food",
          amount: 10000,
        })
      );
    });
  });

  // ── 10. cancel ────────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("calls stopListening, sets state to idle, and emits cancelled event", async () => {
      const hook = await callHook();
      await hook.startListening();

      rewindSlots();
      const updatedHook = await callHook();
      await updatedHook.cancel();

      // Allow dynamic import in cancel to resolve
      await vi.waitFor(() => {
        expect(mockStopListening).toHaveBeenCalled();
      });

      expect(getState()).toEqual({ status: "idle" });
      expect(mockCapturePipelineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "voice",
          outcome: "cancelled",
        })
      );
    });
  });

  // ── Error listener ────────────────────────────────────────────────────────

  describe("error listener — permission error", () => {
    it("sets state to error with 'micPermissionDenied' for permission errors", async () => {
      let capturedErrorListener: (event: any) => void = () => {};
      mockAddErrorListener.mockImplementation((listener: any) => {
        capturedErrorListener = listener;
        return { remove: vi.fn() };
      });

      const hook = await callHook();
      await hook.startListening();

      capturedErrorListener({ message: "permission denied by user" });

      expect(getState()).toEqual({
        status: "error",
        message: "micPermissionDenied",
        transcript: "",
      });
    });

    it("sets state to error with 'couldNotUnderstand' for non-permission errors", async () => {
      let capturedErrorListener: (event: any) => void = () => {};
      mockAddErrorListener.mockImplementation((listener: any) => {
        capturedErrorListener = listener;
        return { remove: vi.fn() };
      });

      const hook = await callHook();
      await hook.startListening();

      capturedErrorListener({ message: "network timeout" });

      expect(getState()).toEqual({
        status: "error",
        message: "couldNotUnderstand",
        transcript: "",
      });
    });

    it("calls captureWarning('voice_stt_error')", async () => {
      let capturedErrorListener: (event: any) => void = () => {};
      mockAddErrorListener.mockImplementation((listener: any) => {
        capturedErrorListener = listener;
        return { remove: vi.fn() };
      });

      const hook = await callHook();
      await hook.startListening();

      capturedErrorListener({ message: "some error" });

      expect(mockCaptureWarning).toHaveBeenCalledWith(
        "voice_stt_error",
        expect.objectContaining({
          errorMessage: "some error",
        })
      );
    });
  });
});

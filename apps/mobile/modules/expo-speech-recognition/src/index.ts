import ExpoSpeechRecognitionModule from "./ExpoSpeechRecognitionModule";

export type TranscriptEvent = {
  readonly text: string;
  readonly isFinal: boolean;
};

export type ErrorEvent = {
  readonly message: string;
};

export type Subscription = { remove: () => void };

export function startListening(locale: string): void {
  ExpoSpeechRecognitionModule.startListening(locale);
}

export function stopListening(): void {
  ExpoSpeechRecognitionModule.stopListening();
}

export function addTranscriptListener(
  listener: (event: TranscriptEvent) => void
): Subscription {
  return ExpoSpeechRecognitionModule.addListener("onTranscript", listener);
}

export function addErrorListener(
  listener: (event: ErrorEvent) => void
): Subscription {
  return ExpoSpeechRecognitionModule.addListener("onError", listener);
}

export function isAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isAvailable();
  } catch {
    return false;
  }
}

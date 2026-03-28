import { Platform } from "react-native";
import ExpoAppIntentsModule from "./ExpoAppIntentsModule";

export type { PendingWidgetTransaction } from "./ExpoAppIntentsModule";

export type LogTransactionEvent = {
  amount: number;
  merchant: string;
  card?: string;
};

export type Subscription = { remove: () => void };

export function addLogTransactionListener(
  listener: (event: LogTransactionEvent) => void
): Subscription {
  return ExpoAppIntentsModule.addListener("onLogTransaction", listener);
}

export type DetectBankSmsEvent = {
  senderName: string;
  timestamp: string;
};

export function addDetectBankSmsListener(
  listener: (event: DetectBankSmsEvent) => void
): Subscription {
  return ExpoAppIntentsModule.addListener("onDetectBankSms", listener);
}

export function isAvailable(): boolean {
  if (Platform.OS !== "ios") return false;
  try {
    return ExpoAppIntentsModule.isAvailable();
  } catch {
    return false;
  }
}

export function getPendingTransactions() {
  return ExpoAppIntentsModule.getPendingTransactions();
}

export function clearPendingTransactions() {
  return ExpoAppIntentsModule.clearPendingTransactions();
}

import { buildTransferQaPreset } from "@/features/transfers/qa.public";
import { TransferFormScreen } from "@/features/transfers/routes.public";
import { isLocalQaAvailable } from "../local-session";

export function QaTransferConflictScreen() {
  if (!isLocalQaAvailable()) return null;

  return (
    <TransferFormScreen
      initialDraftResolver={(accounts) => buildTransferQaPreset("transfer-conflict", accounts)}
    />
  );
}

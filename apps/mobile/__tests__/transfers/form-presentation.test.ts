import { describe, expect, it } from "vitest";
import {
  getTransferErrorMessageKey,
  getTransferFormPresentationState,
} from "@/features/transfers/components/transfer-form/TransferForm.helpers";
import { OUTSIDE_FIDY_LABEL } from "@/features/transfers/lib/build-transfer";

describe("transfer form presentation helpers", () => {
  it("marks same-account transfers as conflicts", () => {
    expect(
      getTransferFormPresentationState({
        amount: 1200,
        fromSide: { kind: "account", accountId: "fa-1" as never },
        isReclassification: false,
        toSide: { kind: "account", accountId: "fa-1" as never },
      })
    ).toMatchObject({
      buttonLabelKey: "transfers.chooseDifferentSide",
      canSave: false,
      hintKey: "transfers.conflictHint",
      sameAccountConflict: true,
      subtitleKey: "transfers.conflictSubtitle",
    });
  });

  it("keeps external-to-account transfers saveable with outside copy", () => {
    expect(
      getTransferFormPresentationState({
        amount: 3200,
        fromSide: { kind: "external", label: OUTSIDE_FIDY_LABEL },
        isReclassification: false,
        toSide: { kind: "account", accountId: "fa-2" as never },
      })
    ).toMatchObject({
      buttonLabelKey: "transfers.save",
      canSave: true,
      hasOutsideSide: true,
      hintKey: "transfers.outsideSelectedHint",
      subtitleKey: "transfers.outsideSubtitle",
    });
  });

  it("uses reclassification copy when the sides are valid", () => {
    expect(
      getTransferFormPresentationState({
        amount: 8000,
        fromSide: { kind: "account", accountId: "fa-3" as never },
        isReclassification: true,
        toSide: { kind: "external", label: OUTSIDE_FIDY_LABEL },
      })
    ).toMatchObject({
      buttonLabelKey: "transfers.reclassifySave",
      hintKey: "transfers.reclassifyHint",
      subtitleKey: "transfers.reclassifySubtitle",
    });
  });

  it("maps transfer errors to user-facing translation keys", () => {
    expect(getTransferErrorMessageKey("fromSideRequired")).toBe("transfers.errors.sidesRequired");
    expect(getTransferErrorMessageKey("storeNotInitialized")).toBe("transfers.errors.saveFailed");
    expect(getTransferErrorMessageKey("transactionNotFound")).toBe(
      "transfers.errors.reclassifyFailed"
    );
    expect(getTransferErrorMessageKey("saveFailed")).toBe("transfers.errors.saveFailed");
  });
});

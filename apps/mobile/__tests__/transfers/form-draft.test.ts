import { describe, expect, it, vi } from "vitest";
import { resetSavedTransferDraft } from "@/features/transfers/components/transfer-form/resetTransferDraft";

describe("transfer form draft", () => {
  it("clears saved create-mode transfer fields so the Add tab cannot resubmit the same draft", () => {
    const setters = {
      setDate: vi.fn(),
      setDescription: vi.fn(),
      setDigits: vi.fn(),
      setFromSide: vi.fn(),
      setLastEditedSide: vi.fn(),
      setPickerTarget: vi.fn(),
      setShowDatePicker: vi.fn(),
      setToSide: vi.fn(),
    };

    const defaultFromSide = { kind: "account", accountId: "account-1" as never } as const;

    resetSavedTransferDraft(setters, defaultFromSide);

    expect(setters.setDescription).toHaveBeenCalledWith("");
    expect(setters.setDigits).toHaveBeenCalledWith("");
    expect(setters.setFromSide).toHaveBeenCalledWith(defaultFromSide);
    expect(setters.setToSide).toHaveBeenCalledWith(null);
    expect(setters.setLastEditedSide).toHaveBeenCalledWith("to");
    expect(setters.setPickerTarget).toHaveBeenCalledWith(null);
    expect(setters.setShowDatePicker).toHaveBeenCalledWith(false);
    expect(setters.setDate).toHaveBeenCalledOnce();
  });
});

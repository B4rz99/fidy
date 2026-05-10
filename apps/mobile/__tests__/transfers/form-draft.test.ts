import { describe, expect, it, vi } from "vitest";
import { resetSavedTransferDraft } from "@/features/transfers/components/transfer-form/resetTransferDraft";

describe("transfer form draft", () => {
  it("clears saved create-mode transfer fields so the Add tab cannot resubmit the same draft", () => {
    const setters = {
      setDate: vi.fn<(...args: any[]) => any>(),
      setDescription: vi.fn<(...args: any[]) => any>(),
      setDigits: vi.fn<(...args: any[]) => any>(),
      setFromSide: vi.fn<(...args: any[]) => any>(),
      setLastEditedSide: vi.fn<(...args: any[]) => any>(),
      setPickerTarget: vi.fn<(...args: any[]) => any>(),
      setShowDatePicker: vi.fn<(...args: any[]) => any>(),
      setToSide: vi.fn<(...args: any[]) => any>(),
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

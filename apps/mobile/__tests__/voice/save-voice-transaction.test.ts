import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryId } from "@/shared/types/branded";

// Mock the transaction store before importing the module under test
vi.mock("@/features/transactions", () => ({
  useTransactionStore: {
    getState: vi.fn(),
  },
}));

// Mock shared/lib analytics and date utilities
vi.mock("@/shared/lib", () => ({
  parseIsoDate: vi.fn((isoDate: string) => {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }),
  trackTransactionCreated: vi.fn(),
}));

import { useTransactionStore } from "@/features/transactions";
import type { VoiceParseResult } from "@/features/voice/lib/voice-parse-schema";
import { saveVoiceTransaction } from "@/features/voice/services/save-voice-transaction";
import { parseIsoDate, trackTransactionCreated } from "@/shared/lib";

const mockSetType = vi.fn();
const mockSetDigits = vi.fn();
const mockSetCategoryId = vi.fn();
const mockSetDescription = vi.fn();
const mockSetDate = vi.fn();
const mockSaveTransaction = vi.fn();
const mockResetForm = vi.fn();

const mockGetState = vi.fn().mockReturnValue({
  setType: mockSetType,
  setDigits: mockSetDigits,
  setCategoryId: mockSetCategoryId,
  setDescription: mockSetDescription,
  setDate: mockSetDate,
  saveTransaction: mockSaveTransaction,
  resetForm: mockResetForm,
});

const validParsed: VoiceParseResult = {
  type: "expense",
  amount: 4520,
  categoryId: "food" as CategoryId,
  description: "Lunch at restaurant",
  date: "2026-03-15" as VoiceParseResult["date"],
};

describe("saveVoiceTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTransactionStore.getState).mockImplementation(mockGetState);
    mockSaveTransaction.mockResolvedValue({ success: true, transaction: {} });
  });

  it("sets type on the transaction store", async () => {
    await saveVoiceTransaction(validParsed);
    expect(mockSetType).toHaveBeenCalledWith("expense");
  });

  it("sets digits as string of amount", async () => {
    await saveVoiceTransaction(validParsed);
    expect(mockSetDigits).toHaveBeenCalledWith("4520");
  });

  it("sets categoryId on the transaction store", async () => {
    await saveVoiceTransaction(validParsed);
    expect(mockSetCategoryId).toHaveBeenCalledWith("food");
  });

  it("sets description on the transaction store", async () => {
    await saveVoiceTransaction(validParsed);
    expect(mockSetDescription).toHaveBeenCalledWith("Lunch at restaurant");
  });

  it("sets date using parseIsoDate on the transaction store", async () => {
    await saveVoiceTransaction(validParsed);
    expect(parseIsoDate).toHaveBeenCalledWith("2026-03-15");
    expect(mockSetDate).toHaveBeenCalledWith(
      new Date(2026, 2, 15) // March 15, 2026 (month is 0-indexed)
    );
  });

  it("calls saveTransaction on the store", async () => {
    await saveVoiceTransaction(validParsed);
    expect(mockSaveTransaction).toHaveBeenCalledTimes(1);
  });

  it("tracks with source 'voice' on success", async () => {
    mockSaveTransaction.mockResolvedValue({ success: true, transaction: {} });
    await saveVoiceTransaction(validParsed);
    expect(trackTransactionCreated).toHaveBeenCalledWith({
      type: "expense",
      category: "food",
      source: "voice",
    });
  });

  it("returns { success: true } on success", async () => {
    mockSaveTransaction.mockResolvedValue({ success: true, transaction: {} });
    const result = await saveVoiceTransaction(validParsed);
    expect(result).toEqual({ success: true });
  });

  it("returns { success: false } when saveTransaction fails", async () => {
    mockSaveTransaction.mockResolvedValue({ success: false, error: "DB error" });
    const result = await saveVoiceTransaction(validParsed);
    expect(result).toEqual({ success: false });
  });

  it("does NOT track analytics when saveTransaction fails", async () => {
    mockSaveTransaction.mockResolvedValue({ success: false, error: "DB error" });
    await saveVoiceTransaction(validParsed);
    expect(trackTransactionCreated).not.toHaveBeenCalled();
  });

  it("always resets form on success", async () => {
    mockSaveTransaction.mockResolvedValue({ success: true, transaction: {} });
    await saveVoiceTransaction(validParsed);
    expect(mockResetForm).toHaveBeenCalledTimes(1);
  });

  it("always resets form on failure", async () => {
    mockSaveTransaction.mockResolvedValue({ success: false, error: "DB error" });
    await saveVoiceTransaction(validParsed);
    expect(mockResetForm).toHaveBeenCalledTimes(1);
  });

  it("resets form even if saveTransaction throws", async () => {
    mockSaveTransaction.mockRejectedValue(new Error("Unexpected error"));
    await expect(saveVoiceTransaction(validParsed)).rejects.toThrow("Unexpected error");
    expect(mockResetForm).toHaveBeenCalledTimes(1);
  });
});

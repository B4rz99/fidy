import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BANK_SENDERS,
  fetchBankSenders,
  isBankSender,
  resetBankSendersCache,
} from "@/features/email-capture/lib/bank-senders";

vi.mock("@/shared/lib/supabase", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/shared/lib/supabase";

const mockFrom = vi.fn();
const mockSelect = vi.fn();

beforeEach(() => {
  resetBankSendersCache();
  mockSelect.mockReset();
  mockFrom.mockReset().mockReturnValue({ select: mockSelect });
  vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bank senders", () => {
  it("has default verified bank senders", () => {
    expect(DEFAULT_BANK_SENDERS.length).toBeGreaterThan(0);
    expect(DEFAULT_BANK_SENDERS).toContainEqual(
      expect.objectContaining({ email: "davibankinforma@davibank.com" })
    );
  });

  it("isBankSender returns true for known senders", () => {
    expect(isBankSender("davibankinforma@davibank.com", DEFAULT_BANK_SENDERS)).toBe(true);
  });

  it("isBankSender returns false for unknown senders", () => {
    expect(isBankSender("promo@random.com", DEFAULT_BANK_SENDERS)).toBe(false);
  });

  it("isBankSender is case-insensitive", () => {
    expect(isBankSender("BBVA@BBVANET.COM.CO", DEFAULT_BANK_SENDERS)).toBe(true);
  });
});

describe("fetchBankSenders", () => {
  it("returns remote senders on success", async () => {
    const remote = [{ bank: "RemoteBank", email: "remote@bank.com" }];
    mockSelect.mockResolvedValue({ data: remote, error: null });

    const result = await fetchBankSenders();

    expect(result).toEqual([{ bank: "RemoteBank", email: "remote@bank.com" }]);
  });

  it("caches remote senders for subsequent calls", async () => {
    const remote = [{ bank: "Cached", email: "cached@bank.com" }];
    mockSelect.mockResolvedValue({ data: remote, error: null });

    await fetchBankSenders();

    mockSelect.mockResolvedValue({ data: null, error: { message: "offline" } });
    const result = await fetchBankSenders();

    expect(result).toEqual([{ bank: "Cached", email: "cached@bank.com" }]);
  });

  it("falls back to defaults on Supabase error with no cache", async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: "fail" } });

    const result = await fetchBankSenders();

    expect(result).toBe(DEFAULT_BANK_SENDERS);
  });

  it("falls back to defaults on empty response with no cache", async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });

    const result = await fetchBankSenders();

    expect(result).toBe(DEFAULT_BANK_SENDERS);
  });

  it("falls back to defaults on network exception with no cache", async () => {
    mockSelect.mockRejectedValue(new Error("network error"));

    const result = await fetchBankSenders();

    expect(result).toBe(DEFAULT_BANK_SENDERS);
  });

  it("falls back to cache on network exception when cache exists", async () => {
    const remote = [{ bank: "First", email: "first@bank.com" }];
    mockSelect.mockResolvedValue({ data: remote, error: null });
    await fetchBankSenders();

    mockSelect.mockRejectedValue(new Error("network error"));
    const result = await fetchBankSenders();

    expect(result).toEqual([{ bank: "First", email: "first@bank.com" }]);
  });
});

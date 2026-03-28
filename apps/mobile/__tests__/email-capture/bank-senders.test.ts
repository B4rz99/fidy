import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BANK_SENDERS,
  extractDomain,
  isBankSender,
} from "@/features/email-capture/lib/bank-senders";
import {
  fetchBankSenders,
  resetBankSendersCache,
} from "@/features/email-capture/services/bank-senders-cache";

import { getSupabase } from "@/shared/db/supabase";

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: vi.fn(),
}));

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

  it("extractDomain extracts domain from email", () => {
    expect(extractDomain("user@example.com")).toBe("example.com");
    expect(extractDomain("BBVA@bbvanet.com.co")).toBe("bbvanet.com.co");
  });

  it("isBankSender matches by domain", () => {
    expect(isBankSender("davibankinforma@davibank.com", DEFAULT_BANK_SENDERS)).toBe(true);
    // Different address, same domain — should still match
    expect(isBankSender("alertas@davibank.com", DEFAULT_BANK_SENDERS)).toBe(true);
  });

  it("isBankSender returns false for unknown domains", () => {
    expect(isBankSender("promo@random.com", DEFAULT_BANK_SENDERS)).toBe(false);
  });

  it("isBankSender is case-insensitive", () => {
    expect(isBankSender("BBVA@BBVANET.COM.CO", DEFAULT_BANK_SENDERS)).toBe(true);
  });
});

describe("fetchBankSenders", () => {
  it("merges remote senders with defaults", async () => {
    const remote = [{ bank: "RemoteBank", email: "remote@bank.com" }];
    mockSelect.mockResolvedValue({ data: remote, error: null });

    const result = await fetchBankSenders();

    // Remote senders + defaults that aren't already in remote
    expect(result).toContainEqual({ bank: "RemoteBank", email: "remote@bank.com" });
    expect(result.length).toBe(1 + DEFAULT_BANK_SENDERS.length);
  });

  it("deduplicates when remote overlaps with defaults", async () => {
    const remote = [
      { bank: "Davibank", email: "davibankinforma@davibank.com" },
      { bank: "NewBank", email: "info@newbank.com" },
    ];
    mockSelect.mockResolvedValue({ data: remote, error: null });

    const result = await fetchBankSenders();

    // Davibank is in both remote and defaults — should appear once
    const davibankEntries = result.filter((s) => s.email === "davibankinforma@davibank.com");
    expect(davibankEntries).toHaveLength(1);
    expect(result).toContainEqual({ bank: "NewBank", email: "info@newbank.com" });
  });

  it("caches merged senders for subsequent calls", async () => {
    const remote = [{ bank: "Cached", email: "cached@bank.com" }];
    mockSelect.mockResolvedValue({ data: remote, error: null });

    const first = await fetchBankSenders();

    mockSelect.mockResolvedValue({ data: null, error: { message: "offline" } });
    const second = await fetchBankSenders();

    expect(second).toEqual(first);
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
    const first = await fetchBankSenders();

    mockSelect.mockRejectedValue(new Error("network error"));
    const result = await fetchBankSenders();

    expect(result).toEqual(first);
  });
});

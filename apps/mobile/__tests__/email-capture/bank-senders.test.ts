import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BANK_SENDERS,
  extractDomain,
  isBankSender,
} from "@/features/email-capture/lib/bank-senders";
import {
  bankSendersQueryOptions,
  ensureBankSenders,
  loadBankSenders,
} from "@/features/email-capture/queries/bank-senders";

import { getSupabase } from "@/shared/db/supabase";

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: vi.fn(),
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();

beforeEach(() => {
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

describe("loadBankSenders", () => {
  it("keeps cached bank senders for one hour", () => {
    expect(bankSendersQueryOptions.gcTime).toBe(60 * 60 * 1000);
    expect(bankSendersQueryOptions.staleTime).toBe(60 * 60 * 1000);
  });

  it("merges remote senders with defaults", async () => {
    const remote = [{ bank: "RemoteBank", email: "remote@bank.com" }];
    mockSelect.mockResolvedValue({ data: remote, error: null });

    const result = await loadBankSenders();

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

    const result = await loadBankSenders();

    // Davibank is in both remote and defaults — should appear once
    const davibankEntries = result.filter((s) => s.email === "davibankinforma@davibank.com");
    expect(davibankEntries).toHaveLength(1);
    expect(result).toContainEqual({ bank: "NewBank", email: "info@newbank.com" });
  });

  it("throws on Supabase error from the raw loader", async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: "fail" } });

    await expect(loadBankSenders()).rejects.toThrow("fail");
  });

  it("throws on empty response from the raw loader", async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });

    await expect(loadBankSenders()).rejects.toThrow("empty_result");
  });

  it("ensureBankSenders falls back to cached Query data", async () => {
    const queryClient = new QueryClient();
    const cached = [{ bank: "Cached", email: "cached@bank.com" }];
    queryClient.setQueryData(["bank-senders"], cached);
    mockSelect.mockResolvedValue({ data: null, error: { message: "offline" } });

    const result = await ensureBankSenders(queryClient);

    expect(result).toEqual(cached);
  });

  it("ensureBankSenders falls back to defaults when cache is empty", async () => {
    const queryClient = new QueryClient();
    mockSelect.mockRejectedValue(new Error("network error"));

    const result = await ensureBankSenders(queryClient);

    expect(result).toBe(DEFAULT_BANK_SENDERS);
  });
});

import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BANK_SENDERS } from "@/features/email-capture/lib/bank-senders";
import { ensureBankSenders, loadBankSenders } from "@/features/email-capture/queries/bank-senders";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";

vi.mock("@/shared/db", () => ({
  getSupabase: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/shared/lib", () => ({
  captureWarning: vi.fn<(...args: any[]) => any>(),
}));

const selectBankSenders = vi.fn<(...args: any[]) => any>();

const queryClientWith = ({
  cachedSenders,
  ensureResult,
}: {
  readonly cachedSenders?: typeof DEFAULT_BANK_SENDERS;
  readonly ensureResult: Promise<unknown>;
}) =>
  ({
    ensureQueryData: vi.fn<(...args: any[]) => any>().mockReturnValue(ensureResult),
    getQueryData: vi.fn<(...args: any[]) => any>().mockReturnValue(cachedSenders),
  }) as unknown as QueryClient;

describe("bank sender queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectBankSenders.mockReset();
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn<(...args: any[]) => any>().mockReturnValue({
        select: selectBankSenders,
      }),
    } as unknown as ReturnType<typeof getSupabase>);
  });

  it("loads remote senders and appends defaults missing from the remote list", async () => {
    selectBankSenders.mockResolvedValue({
      data: [
        { bank: "Remote BBVA", email: "bbva@bbvanet.com.co" },
        { bank: "New Bank", email: "alerts@example.com" },
      ],
      error: null,
    });

    const senders = await loadBankSenders();

    expect(senders).toEqual([
      { bank: "Remote BBVA", email: "bbva@bbvanet.com.co" },
      { bank: "New Bank", email: "alerts@example.com" },
      { bank: "Davibank", email: "davibankinforma@davibank.com" },
      { bank: "RappiCard", email: "noreply@rappicard.co" },
      { bank: "RappiPay", email: "noreply@rappipay.co" },
    ]);
  });

  it("throws when the remote query fails or returns no rows", async () => {
    selectBankSenders.mockResolvedValueOnce({
      data: null,
      error: { message: "network_down" },
    });
    await expect(loadBankSenders()).rejects.toThrow("network_down");

    selectBankSenders.mockResolvedValueOnce({ data: [], error: null });
    await expect(loadBankSenders()).rejects.toThrow("empty_result");
  });

  it("falls back to cached or default senders when query loading fails", async () => {
    const cachedSenders = [{ bank: "Cached", email: "cached@example.com" }];
    const cachedClient = queryClientWith({
      cachedSenders,
      ensureResult: Promise.reject(new Error("offline")),
    });

    await expect(ensureBankSenders(cachedClient)).resolves.toEqual(cachedSenders);
    expect(captureWarning).toHaveBeenCalledWith("bank_senders_fetch_failed", {
      errorMessage: "offline",
    });

    const defaultClient = queryClientWith({
      ensureResult: Promise.reject("offline"),
    });

    await expect(ensureBankSenders(defaultClient)).resolves.toEqual(DEFAULT_BANK_SENDERS);
    expect(captureWarning).toHaveBeenLastCalledWith("bank_senders_fetch_failed", {
      errorMessage: "unknown",
    });
  });
});

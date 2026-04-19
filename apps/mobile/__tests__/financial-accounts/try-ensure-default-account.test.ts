import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryEnsureDefaultFinancialAccount } from "@/features/financial-accounts/services/try-ensure-default-account";
import { requireUserId } from "@/shared/types/assertions";

const mockEnsureDefaultFinancialAccount = vi.fn();
const mockCaptureError = vi.fn();

vi.mock("@/features/financial-accounts/lib/repository", () => ({
  ensureDefaultFinancialAccount: (...args: unknown[]) => mockEnsureDefaultFinancialAccount(...args),
}));

vi.mock("@/shared/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

const mockDb = {} as never;
const USER_ID = requireUserId("user-1");

describe("tryEnsureDefaultFinancialAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the ensured default account when bootstrap succeeds", () => {
    const account = {
      id: "fa-default-user-1",
      userId: USER_ID,
      name: "Cash",
      kind: "cash",
      isDefault: true,
      createdAt: "2026-04-18T10:00:00.000Z",
      updatedAt: "2026-04-18T10:00:00.000Z",
      deletedAt: null,
    };
    mockEnsureDefaultFinancialAccount.mockReturnValueOnce(account);

    expect(tryEnsureDefaultFinancialAccount(mockDb, USER_ID)).toEqual(account);
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it("captures bootstrap errors and returns null instead of throwing", () => {
    const error = new Error("db locked");
    mockEnsureDefaultFinancialAccount.mockImplementationOnce(() => {
      throw error;
    });

    expect(tryEnsureDefaultFinancialAccount(mockDb, USER_ID)).toBeNull();
    expect(mockCaptureError).toHaveBeenCalledWith(error);
  });
});

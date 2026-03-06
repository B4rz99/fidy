import { initLlama } from "llama.rn";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("llama.rn", () => ({
  initLlama: vi.fn(),
}));

import {
  getLlmContext,
  releaseLlmContext,
} from "../../features/email-capture/services/llm-context";

describe("llm-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    releaseLlmContext();
  });

  it("initializes context on first call", async () => {
    const mockContext = { id: 1 };
    vi.mocked(initLlama).mockResolvedValue(mockContext as any);

    const ctx = await getLlmContext();
    expect(initLlama).toHaveBeenCalledTimes(1);
    expect(ctx).toBe(mockContext);
  });

  it("reuses context on subsequent calls", async () => {
    const mockContext = { id: 1 };
    vi.mocked(initLlama).mockResolvedValue(mockContext as any);

    await getLlmContext();
    await getLlmContext();
    expect(initLlama).toHaveBeenCalledTimes(1);
  });

  it("releases context and creates new on next call", async () => {
    const mockContext1 = { id: 1, release: vi.fn() };
    const mockContext2 = { id: 2, release: vi.fn() };
    vi.mocked(initLlama)
      .mockResolvedValueOnce(mockContext1 as any)
      .mockResolvedValueOnce(mockContext2 as any);

    await getLlmContext();
    releaseLlmContext();
    expect(mockContext1.release).toHaveBeenCalled();

    const ctx = await getLlmContext();
    expect(ctx).toBe(mockContext2);
  });
});

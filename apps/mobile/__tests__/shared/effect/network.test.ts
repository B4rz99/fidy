import { describe, expect, it, vi } from "vitest";
import { bindAppNetwork, isOnlineEffect } from "@/shared/effect/network";

describe("shared/effect/network", () => {
  it("runs the bound network service", async () => {
    const network = bindAppNetwork({
      isOnline: vi.fn().mockResolvedValue(true),
    });

    await expect(network.run(isOnlineEffect)).resolves.toBe(true);
  });
});

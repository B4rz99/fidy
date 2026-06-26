import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloud Ledger public surface", () => {
  it("keeps native outbox and mutation modules out of the broad public barrel", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/cloud-ledger/public.ts"),
      "utf-8"
    );

    expect(source).not.toContain('from "./outbox"');
    expect(source).not.toContain('from "./runtime-mutations"');
  });
});

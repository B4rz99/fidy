import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const contentSource = readSource(
  "../../features/transfers/components/transfer-form/TransferFormContent.tsx"
);
const stylesSource = readSource(
  "../../features/transfers/components/transfer-form/TransferForm.styles.ts"
);

describe("transfer form dialog layout", () => {
  test("keeps keyboard and scroll containers bounded inside dialogs", () => {
    expect(contentSource).toContain("style={styles.container}");
    expect(stylesSource).toContain("container: {\n    flex: 1,\n  }");
  });
});

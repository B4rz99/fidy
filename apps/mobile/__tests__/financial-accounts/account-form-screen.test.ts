import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { getKindEmoji } from "@/features/financial-accounts/lib/kind-display";
import { financialAccountKindSchema } from "@/features/financial-accounts/schema";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource(
  "../../features/financial-accounts/components/FinancialAccountFormScreen.tsx"
);
const bodySource = readSource(
  "../../features/financial-accounts/components/financial-account-form/FinancialAccountFormBody.tsx"
);
test("keeps the add account form on the selected type-first layout", () => {
  expect(screenSource).toContain("<Stack.Screen options={{ headerShown: false }} />");
  expect(screenSource).toContain("includesNativeHeader={false}");
  expect(screenSource).toContain("centerAction={");
  expect(bodySource).not.toContain("<FormStepper");
  expect(bodySource).not.toContain("styles.stepper");
  expect(bodySource).toContain("styles.typeFirstSection");
  expect(bodySource).toContain('title={t("financialAccounts.form.basicInfoSection")}');
  expect(bodySource).toContain('title={t("financialAccounts.detail.openingBalanceSection")}');
  expect(bodySource).toContain('optionalLabel={t("financialAccounts.form.optionalLabel")}');
  expect(bodySource).not.toContain("styles.subtitle");
});

test("keeps account type choices emoji-first", () => {
  expect(financialAccountKindSchema.options.map((kind) => `${getKindEmoji(kind)}:${kind}`)).toEqual(
    ["🏦:checking", "🐷:savings", "👛:wallet", "💵:cash", "💳:credit_card"]
  );
});

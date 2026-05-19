import { expect, test } from "vitest";
import { resolveNextDigits } from "@/features/budget/components/create-budget/useCreateBudgetDraft";
import { handleNumpadPress } from "@/features/transactions/display.public";

test("resolveNextDigits returns a direct digits replacement", () => {
  expect(resolveNextDigits("12", "450")).toBe("450");
});

test("resolveNextDigits applies updater functions against the latest digits", () => {
  const afterFirstKey = resolveNextDigits("", (currentDigits) =>
    handleNumpadPress(currentDigits, "1")
  );
  const afterSecondKey = resolveNextDigits(afterFirstKey, (currentDigits) =>
    handleNumpadPress(currentDigits, "2")
  );

  expect(afterSecondKey).toBe("12");
});

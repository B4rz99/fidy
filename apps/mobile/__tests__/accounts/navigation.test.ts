import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("accounts navigation", () => {
  const rootLayoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
  const settingsSource = readFileSync(
    resolve(__dirname, "../../features/settings/components/SettingsScreen.tsx"),
    "utf-8"
  );
  const accountsRouteSource = readFileSync(resolve(__dirname, "../../app/accounts.tsx"), "utf-8");
  const createAccountRouteSource = readFileSync(
    resolve(__dirname, "../../app/create-account.tsx"),
    "utf-8"
  );

  test("registers dedicated accounts routes in the root stack", () => {
    for (const screen of ["accounts", "create-account"]) {
      const screenBlock = rootLayoutSource.slice(rootLayoutSource.indexOf(`name="${screen}"`));
      const optionsSlice = screenBlock.slice(0, screenBlock.indexOf("/>") + 2);
      expect(optionsSlice).toContain('headerShown: Platform.OS === "ios"');
      expect(optionsSlice).toContain("theme.page");
    }
  });

  test("links settings to the ledger accounts screen separately from connected emails", () => {
    expect(settingsSource).toContain('router.push("/accounts")');
    expect(settingsSource).toContain('router.push("/connected-accounts")');
  });

  test("exposes top-level route files for the list and creation flows", () => {
    expect(accountsRouteSource).toContain("AccountsScreen");
    expect(createAccountRouteSource).toContain("CreateAccountScreen");
  });
});

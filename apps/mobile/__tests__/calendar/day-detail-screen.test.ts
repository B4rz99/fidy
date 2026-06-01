import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { expectRouteInRootStackGroup } from "@/__tests__/helpers/root-stack-routes";

let source = "";
let layoutSource = "";
let rootStackRoutesSource = "";

beforeAll(() => {
  source = readFileSync(resolve(__dirname, "../../app/day-detail.tsx"), "utf-8");
  layoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
  rootStackRoutesSource = readFileSync(
    resolve(__dirname, "../../shared/navigation/root-stack-routes.ts"),
    "utf-8"
  );
});

describe("day-detail screen", () => {
  test("is registered in root layout as a full screen route", () => {
    expect(layoutSource).toContain("ROOT_STACK_ROUTES.fullScreen");
    expect(source).not.toContain("DialogRouteFrame");
    expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "day-detail");
    expect(layoutSource).toContain("ROOT_STACK_ROUTES.fullScreen.map");
    expect(layoutSource).toContain("routeOptions.fullScreen");
    expect(layoutSource).not.toContain("formSheet");
  });

  test("accepts date param via useLocalSearchParams", () => {
    expect(source).toContain("useLocalSearchParams");
    expect(source).toContain("date");
  });

  test("uses getBillsForDate to list bills for that day", () => {
    expect(source).toContain("getBillsForDate");
  });

  test("shows empty state via i18n", () => {
    expect(source).toContain('t("bills.noBillsOnDay")');
  });

  test("has mark paid/unpaid toggle", () => {
    expect(source).toContain("markBillPaid");
    expect(source).toContain("unmarkBillPaid");
  });

  test("supports bill deletion with confirmation", () => {
    expect(source).toContain("Alert.alert");
    expect(source).toContain("deleteBill");
  });

  test("uses Pressable per ui-pressable rule", () => {
    expect(source).toContain("Pressable");
    expect(source).not.toContain("TouchableOpacity");
  });
});

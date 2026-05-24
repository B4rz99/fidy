import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(resolve(__dirname, "../../app/day-detail.tsx"), "utf-8");
const layoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");

describe("day-detail screen", () => {
  test("is registered in root layout as a full screen route", () => {
    expect(layoutSource).toContain('name="day-detail"');
    expect(source).not.toContain("DialogRouteFrame");
    const dayDetailBlock = layoutSource.slice(layoutSource.indexOf('name="day-detail"'));
    expect(dayDetailBlock.slice(0, 80)).toContain("iosHeaderOptions");
    expect(dayDetailBlock.slice(0, 80)).not.toContain("DIALOG_MODAL");
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

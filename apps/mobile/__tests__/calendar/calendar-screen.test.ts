import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const billsCalendarSource = readSource("../../app/bills-calendar.tsx");
const financeTabSource = readSource("../../app/(tabs)/(finance)/index.tsx");
const gridSource = readSource("../../features/calendar/components/CalendarGrid.tsx");

describe("calendar screen", () => {
  test("calendar grid stretches rows to fill the available screen height", () => {
    expect(gridSource).toContain("container: {\n    flex: 1");
    expect(gridSource).toContain("weekRow: {\n    flex: 1");
  });

  test("standalone bills calendar exposes the add-bill route", () => {
    expect(billsCalendarSource).toContain("rightActions");
    expect(billsCalendarSource).toContain('push("/add-bill")');
    expect(billsCalendarSource).toContain('accessibilityLabel={t("bills.addBill")}');
  });

  test("finance calendar tab exposes the add-bill route in the native header", () => {
    expect(financeTabSource).toContain('activeTab === "calendar"');
    expect(financeTabSource).toContain('push("/add-bill")');
    expect(financeTabSource).toContain('accessibilityLabel={t("bills.addBill")}');
  });

  test("finance calendar leaves room for the native iOS tab bar", () => {
    expect(financeTabSource).toContain("useSafeAreaInsets");
    expect(financeTabSource).toContain("FINANCE_NATIVE_TAB_BAR_OFFSET = 72");
    expect(financeTabSource).toContain(
      'Platform.OS === "ios" ? insets.bottom + FINANCE_NATIVE_TAB_BAR_OFFSET : TAB_BAR_CLEARANCE'
    );
    expect(financeTabSource).toContain("FINANCE_NATIVE_HEADER_CONTENT_HEIGHT = 56");
    expect(financeTabSource).toContain("paddingBottom: tabBarClearance");
    expect(financeTabSource).toContain("paddingTop: topClearance");
  });

  test("add-bill header actions use visible plus icons", () => {
    expect(billsCalendarSource).toContain("Colors.light.card");
    expect(financeTabSource).toContain('useThemeColor("primary")');
    expect(financeTabSource).not.toContain("Colors.light.card");
  });
});

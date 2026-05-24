import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const billsCalendarSource = readSource("../../app/bills-calendar.tsx");
const financeTabSource = readSource("../../app/(tabs)/(finance)/index.tsx");
const dayDetailSource = readSource("../../app/day-detail.tsx");
const rootLayoutSource = readSource("../../app/_layout.tsx");
const monthBoardSource = readSource("../../features/calendar/components/CalendarMonthBoard.tsx");
const gridSource = readSource("../../features/calendar/components/CalendarGrid.tsx");
const dayCellSource = readSource("../../features/calendar/components/CalendarDayCell.tsx");
const monthNavigatorSource = readSource("../../features/calendar/components/MonthNavigator.tsx");
const analyticsScreenSource = readSource("../../features/analytics/components/AnalyticsScreen.tsx");

describe("calendar screen", () => {
  test("calendar grid stretches rows to fill the available screen height", () => {
    expect(gridSource).toContain("container: {\n    flex: 1");
    expect(gridSource).toContain("weekRow: {\n    flex: 1");
  });

  test("calendar month label is centered between fixed navigation controls", () => {
    expect(monthNavigatorSource).toContain('justifyContent: "center"');
    expect(monthNavigatorSource).toContain("previousButton");
    expect(monthNavigatorSource).toContain("nextButton");
    expect(monthNavigatorSource).toContain('position: "absolute"');
  });

  test("finance analytics cards use home activity spacing", () => {
    expect(analyticsScreenSource).toContain("ANALYTICS_CARD_GAP = 8");
    expect(analyticsScreenSource).toContain("gap: ANALYTICS_CARD_GAP");
  });

  test("standalone bills calendar exposes the add-bill route", () => {
    expect(billsCalendarSource).toContain("rightActions");
    expect(billsCalendarSource).toContain('push("/add-bill")');
    expect(billsCalendarSource).toContain('accessibilityLabel={t("bills.addBill")}');
  });

  test("calendar proposal keeps the calendar, legend, and upcoming pending list without summary card", () => {
    expect(monthBoardSource).toContain("buildCalendarMonthSummary");
    expect(monthBoardSource).toContain("monthSummary.monthOccurrences");
    expect(monthBoardSource).toContain("<MonthNavigator");
    expect(monthBoardSource.indexOf("<MonthNavigator")).toBeLessThan(
      monthBoardSource.indexOf("<ScrollView")
    );
    expect(monthBoardSource).not.toContain("summaryCard");
    expect(monthBoardSource).not.toContain('t("calendar.thisMonth")');
    expect(monthBoardSource).not.toContain("bounces={false}");
    expect(monthBoardSource).toContain("alwaysBounceVertical={false}");
    expect(monthBoardSource).toContain('contentInsetAdjustmentBehavior="never"');
    expect(monthBoardSource).toContain('t("calendar.paid")');
    expect(monthBoardSource).toContain('t("calendar.pending")');
    expect(billsCalendarSource).toContain("<CalendarMonthBoard");
    expect(financeTabSource).toContain("<CalendarMonthBoard");
  });

  test("calendar bill cards expose paid, edit, and delete actions without opening day detail", () => {
    expect(monthBoardSource).toContain("onBillPaymentToggle");
    expect(monthBoardSource).toContain("onBillEdit");
    expect(monthBoardSource).toContain("onBillDelete");
    expect(monthBoardSource).toContain("<Check");
    expect(monthBoardSource).toContain("<Pencil");
    expect(monthBoardSource).toContain("<Trash2");
    expect(billsCalendarSource).toContain("markBillPaid");
    expect(billsCalendarSource).toContain("unmarkBillPaid");
    expect(billsCalendarSource).toContain("deleteBill");
    expect(financeTabSource).toContain("markBillPaid");
    expect(financeTabSource).toContain("unmarkBillPaid");
    expect(financeTabSource).toContain("deleteBill");
  });

  test("calendar grid uses payment dots instead of bill-name tags", () => {
    expect(dayCellSource).toContain("styles.dots");
    expect(dayCellSource).toContain("styles.dot");
    expect(dayCellSource).not.toContain("tagText");
  });

  test("finance calendar tab exposes the add-bill route in the native header", () => {
    expect(financeTabSource).toContain('activeTab === "calendar"');
    expect(financeTabSource).toContain('push("/add-bill")');
    expect(financeTabSource).toContain('accessibilityLabel={t("bills.addBill")}');
  });

  test("finance calendar starts after the native header and leaves room for the tab bar", () => {
    expect(financeTabSource).toContain("useSafeAreaInsets");
    expect(financeTabSource).toContain("FINANCE_NATIVE_TAB_BAR_OFFSET = 72");
    expect(financeTabSource).toContain(
      'Platform.OS === "ios" ? insets.bottom + FINANCE_NATIVE_TAB_BAR_OFFSET : TAB_BAR_CLEARANCE'
    );
    expect(financeTabSource).not.toContain("FINANCE_NATIVE_HEADER_CONTENT_HEIGHT");
    expect(financeTabSource).toContain("paddingBottom={tabBarClearance}");
    expect(financeTabSource).toContain('paddingTop={Platform.OS === "ios" ? 96 : 0}');
  });

  test("day detail is a full screen route so bill editing pushes normally", () => {
    const dayDetailBlock = rootLayoutSource.slice(
      rootLayoutSource.indexOf('name="day-detail"'),
      rootLayoutSource.indexOf('name="theme-picker"')
    );
    expect(dayDetailBlock).toContain("iosHeaderOptions");
    expect(dayDetailBlock).not.toContain("DIALOG_MODAL");
    expect(dayDetailSource).not.toContain("DialogRouteFrame");
    expect(dayDetailSource).toContain("<Stack.Screen");
    expect(dayDetailSource).toContain('router.push({ pathname: "/add-bill"');
  });

  test("calendar day navigation and day detail use local ISO dates without UTC day shifts", () => {
    expect(billsCalendarSource).toContain("toIsoDate(date)");
    expect(billsCalendarSource).not.toContain("date.toISOString()");
    expect(financeTabSource).toContain("toIsoDate(date)");
    expect(financeTabSource).not.toContain("date.toISOString()");
    expect(dayDetailSource).toContain("parseDayDetailDateParam");
    expect(dayDetailSource).toContain("parseOptionalIsoDate(value)");
    expect(dayDetailSource).not.toContain("new Date(date)");
  });

  test("add-bill header actions use visible plus icons", () => {
    expect(billsCalendarSource).toContain("Colors.light.card");
    expect(financeTabSource).toContain('useThemeColor("primary")');
    expect(financeTabSource).not.toContain("Colors.light.card");
  });
});

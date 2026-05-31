import { describe, expect, test } from "vitest";
import { getMinimumGoalDate } from "@/features/goals/components/goal-form/GoalDateField.helpers";

describe("getMinimumGoalDate", () => {
  test("normalizes the minimum date to the start of the current day", () => {
    const minimumDate = getMinimumGoalDate(new Date(2026, 3, 22, 18, 45, 31, 500));

    expect(minimumDate.getFullYear()).toBe(2026);
    expect(minimumDate.getMonth()).toBe(3);
    expect(minimumDate.getDate()).toBe(22);
    expect(minimumDate.getHours()).toBe(0);
    expect(minimumDate.getMinutes()).toBe(0);
    expect(minimumDate.getSeconds()).toBe(0);
    expect(minimumDate.getMilliseconds()).toBe(0);
  });
});

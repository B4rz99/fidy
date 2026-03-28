import { describe, expect, test } from "vitest";
import {
  computeArcs,
  computeCircumference,
  computeRadius,
} from "@/features/dashboard/lib/compute-arcs";

describe("computeRadius", () => {
  test("correct radius for default props (140, 22)", () => {
    expect(computeRadius(140, 22)).toBe(59);
  });

  test("correct radius for custom values", () => {
    expect(computeRadius(200, 10)).toBe(95);
  });
});

describe("computeCircumference", () => {
  test("correct circumference for default props (140, 22)", () => {
    const result = computeCircumference(140, 22);
    expect(result).toBeCloseTo(2 * Math.PI * 59, 5);
  });

  test("correct circumference for custom values", () => {
    const result = computeCircumference(200, 10);
    expect(result).toBeCloseTo(2 * Math.PI * 95, 5);
  });
});

describe("computeArcs", () => {
  const circumference = computeCircumference(140, 22);

  test("empty segments returns empty arcs", () => {
    expect(computeArcs([], circumference)).toEqual([]);
  });

  test("single 100% segment", () => {
    const arcs = computeArcs([{ percentage: 100, color: "#FF0000" }], circumference);
    expect(arcs).toHaveLength(1);
    expect(arcs[0]?.dash).toBeCloseTo(circumference, 5);
    expect(arcs[0]?.offset).toBeCloseTo(0, 5);
    expect(arcs[0]?.rotation).toBe(-90);
  });

  test("single 50% segment", () => {
    const arcs = computeArcs([{ percentage: 50, color: "#00FF00" }], circumference);
    expect(arcs).toHaveLength(1);
    expect(arcs[0]?.dash).toBeCloseTo(circumference / 2, 5);
    expect(arcs[0]?.offset).toBeCloseTo(circumference / 2, 5);
  });

  test("two equal 50% segments", () => {
    const arcs = computeArcs(
      [
        { percentage: 50, color: "#FF0000" },
        { percentage: 50, color: "#00FF00" },
      ],
      circumference
    );
    expect(arcs).toHaveLength(2);
    expect(arcs[0]?.rotation).toBe(-90);
    expect(arcs[1]?.rotation).toBeCloseTo(90, 5);
  });

  test("three segments (35/25/40)", () => {
    const arcs = computeArcs(
      [
        { percentage: 35, color: "#FF0000" },
        { percentage: 25, color: "#00FF00" },
        { percentage: 40, color: "#0000FF" },
      ],
      circumference
    );
    expect(arcs).toHaveLength(3);
    const totalDash = arcs.reduce((sum, a) => sum + a.dash, 0);
    expect(totalDash).toBeCloseTo(circumference, 5);
  });

  test("segments summing to 100% cover full circle", () => {
    const arcs = computeArcs(
      [
        { percentage: 30, color: "#FF0000" },
        { percentage: 30, color: "#00FF00" },
        { percentage: 40, color: "#0000FF" },
      ],
      circumference
    );
    const totalDash = arcs.reduce((sum, a) => sum + a.dash, 0);
    expect(totalDash).toBeCloseTo(circumference, 5);
  });

  test("preserves segment colors", () => {
    const arcs = computeArcs(
      [
        { percentage: 50, color: "#AABBCC" },
        { percentage: 50, color: "#DDEEFF" },
      ],
      circumference
    );
    expect(arcs[0]?.color).toBe("#AABBCC");
    expect(arcs[1]?.color).toBe("#DDEEFF");
  });

  test("handles 0% segment", () => {
    const arcs = computeArcs([{ percentage: 0, color: "#000000" }], circumference);
    expect(arcs).toHaveLength(1);
    expect(arcs[0]?.dash).toBe(0);
    expect(arcs[0]?.offset).toBeCloseTo(circumference, 5);
  });
});

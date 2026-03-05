export type Segment = {
  readonly percentage: number;
  readonly color: string;
};

export type Arc = {
  readonly offset: number;
  readonly dash: number;
  readonly rotation: number;
  readonly color: string;
};

export const computeRadius = (size: number, strokeWidth: number): number =>
  (size - strokeWidth) / 2;

export const computeCircumference = (size: number, strokeWidth: number): number =>
  2 * Math.PI * computeRadius(size, strokeWidth);

export const computeArcs = (segments: readonly Segment[], circumference: number): readonly Arc[] =>
  segments.map((segment, i) => {
    const dash = (circumference * segment.percentage) / 100;
    const precedingRotation = segments
      .slice(0, i)
      .reduce((sum, s) => sum + (s.percentage / 100) * 360, 0);
    return {
      offset: circumference - dash,
      dash,
      rotation: precedingRotation - 90,
      color: segment.color,
    };
  });

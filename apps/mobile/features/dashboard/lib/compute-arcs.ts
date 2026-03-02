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

export const computeArcs = (
  segments: readonly Segment[],
  circumference: number
): readonly Arc[] => {
  const arcs: Arc[] = [];
  let accumulated = 0;
  for (const segment of segments) {
    const dash = (circumference * segment.percentage) / 100;
    arcs.push({
      offset: circumference - dash,
      dash,
      rotation: accumulated - 90,
      color: segment.color,
    });
    accumulated += (dash / circumference) * 360;
  }
  return arcs;
};

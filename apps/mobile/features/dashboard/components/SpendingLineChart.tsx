import Svg, { Defs, Line, LinearGradient, Polyline, Stop } from "react-native-svg";

type DataPoint = { readonly date: string; readonly total: number };

type SpendingLineChartProps = {
  readonly data: readonly DataPoint[];
  readonly width: number;
  readonly height?: number;
};

const PADDING_X = 8;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 4;

const buildPoints = (data: readonly DataPoint[], width: number, height: number): string => {
  const count = data.length;
  if (count === 0) return "";

  const maxTotal = data.reduce((max, d) => Math.max(max, d.total), 0);
  const safeMax = maxTotal === 0 ? 1 : maxTotal;
  const plotW = width - PADDING_X * 2;
  const plotH = height - PADDING_TOP - PADDING_BOTTOM;

  if (count === 1) {
    const x = width / 2;
    const y = PADDING_TOP + plotH * (1 - (data[0]?.total ?? 0) / safeMax);
    return `${x},${y}`;
  }

  return data
    .map((d, i) => {
      const x = PADDING_X + (i / (count - 1)) * plotW;
      const y = PADDING_TOP + plotH * (1 - d.total / safeMax);
      return `${x},${y}`;
    })
    .join(" ");
};

const buildAreaPoints = (linePoints: string, width: number, height: number): string => {
  if (linePoints === "") return "";
  const baselineY = height - PADDING_BOTTOM;
  const firstX = PADDING_X;
  const lastX = width - PADDING_X;
  return `${firstX},${baselineY} ${linePoints} ${lastX},${baselineY}`;
};

export const SpendingLineChart = ({ data, width, height = 100 }: SpendingLineChartProps) => {
  const linePoints = buildPoints(data, width, height);
  const areaPoints = buildAreaPoints(linePoints, width, height);
  const baselineY = height - PADDING_BOTTOM;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1A1A1A" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#1A1A1A" stopOpacity="0.02" />
        </LinearGradient>
      </Defs>

      {areaPoints !== "" && <Polyline points={areaPoints} fill="url(#areaFill)" stroke="none" />}

      {linePoints !== "" && (
        <Polyline
          points={linePoints}
          fill="none"
          stroke="#1A1A1A"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      <Line
        x1={PADDING_X}
        y1={baselineY}
        x2={width - PADDING_X}
        y2={baselineY}
        stroke="#C4A882"
        strokeWidth={1}
      />
    </Svg>
  );
};

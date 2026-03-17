import { Text, View } from "@/shared/components/rn";
import Svg, { Circle } from "react-native-svg";
import { useThemeColor } from "@/shared/hooks";
import {
  computeArcs,
  computeCircumference,
  computeRadius,
  type Segment,
} from "../lib/compute-arcs";

type DonutChartProps = {
  readonly segments: readonly Segment[];
  readonly centerLabel?: string;
  readonly centerSubLabel?: string;
  readonly size?: number;
  readonly strokeWidth?: number;
};

export const DonutChart = ({
  segments,
  centerLabel,
  centerSubLabel,
  size = 140,
  strokeWidth = 22,
}: DonutChartProps) => {
  const radius = computeRadius(size, strokeWidth);
  const circumference = computeCircumference(size, strokeWidth);
  const center = size / 2;
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  const arcs = computeArcs(segments, circumference);

  return (
    <View className="items-center justify-center">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc, index) => (
          <Circle
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are derived from props, never reordered
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={arc.offset}
            strokeLinecap="round"
            rotation={arc.rotation}
            origin={`${center}, ${center}`}
          />
        ))}
      </Svg>
      {centerLabel && (
        <View className="absolute items-center">
          <Text className="font-poppins-bold text-body" style={{ color: primaryColor }}>
            {centerLabel}
          </Text>
          {centerSubLabel && (
            <Text className="font-poppins-medium text-caption" style={{ color: secondaryColor }}>
              {centerSubLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

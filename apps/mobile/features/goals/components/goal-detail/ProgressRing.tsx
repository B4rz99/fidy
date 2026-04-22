import Svg, { Circle as SvgCircle } from "react-native-svg";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./GoalDetail.styles";

const RING_SIZE = 96;
const RING_STROKE_WIDTH = 4;

function getProgressRingMetrics(percent: number) {
  const radius = (RING_SIZE - RING_STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return {
    radius,
    circumference,
    label: `${percent}%`,
    strokeDashoffset: circumference * (1 - clampedPercent / 100),
  };
}

export function ProgressRing({ percent }: { readonly percent: number }) {
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const primaryColor = useThemeColor("primary");
  const metrics = getProgressRingMetrics(percent);

  return (
    <View style={styles.ringContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <SvgCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={metrics.radius}
          stroke={accentGreenLight}
          strokeWidth={RING_STROKE_WIDTH}
          fill="none"
        />
        <SvgCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={metrics.radius}
          stroke={accentGreen}
          strokeWidth={RING_STROKE_WIDTH}
          fill="none"
          strokeDasharray={metrics.circumference}
          strokeDashoffset={metrics.strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <Text style={[styles.ringText, { color: primaryColor }]}>{metrics.label}</Text>
    </View>
  );
}

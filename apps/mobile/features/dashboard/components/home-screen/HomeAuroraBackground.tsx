import { memo } from "react";
import Svg, {
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { StyleSheet, useWindowDimensions, View } from "@/shared/components/rn";

type HomeAuroraBackgroundProps = {
  readonly isDark: boolean;
};

export const HomeAuroraBackground = memo(function HomeAuroraBackground({
  isDark,
}: HomeAuroraBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const background = isDark ? "#0D0D0D" : "#FDFCF9";
  const fadeBottom = isDark ? "#0D0D0D" : "#FDFCF9";
  const green = isDark ? "#8BC34A" : "#7CB243";
  const peachGlow = isDark ? "#F5E1C8" : "#E8A090";
  const peachCore = "#E8A090";
  const overlayOpacity = isDark ? 0.84 : 1;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <RadialGradient id="topLeftGreen" cx="0%" cy="0%" r={isDark ? "58%" : "62%"}>
            <Stop offset="0%" stopColor={green} stopOpacity={isDark ? 0.38 : 0.48} />
            <Stop offset="100%" stopColor={green} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="topRightPeach"
            cx="100%"
            cy={isDark ? "18%" : "16%"}
            r={isDark ? "62%" : "64%"}
          >
            <Stop offset="0%" stopColor={peachGlow} stopOpacity={isDark ? 0.3 : 0.58} />
            <Stop offset="100%" stopColor={peachGlow} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="topRightPeachCore" cx="90%" cy="20%" r="34%">
            <Stop offset="0%" stopColor={peachCore} stopOpacity={isDark ? 0.16 : 0.3} />
            <Stop offset="100%" stopColor={peachCore} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="lowerLeftPeach"
            cx={isDark ? "10%" : "4%"}
            cy={isDark ? "70%" : "64%"}
            r={isDark ? "68%" : "68%"}
          >
            <Stop offset="0%" stopColor={peachGlow} stopOpacity={isDark ? 0.16 : 0.42} />
            <Stop offset="100%" stopColor={peachGlow} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="lowerRightGreen"
            cx="96%"
            cy={isDark ? "86%" : "88%"}
            r={isDark ? "68%" : "70%"}
          >
            <Stop offset="0%" stopColor={green} stopOpacity={isDark ? 0.16 : 0.36} />
            <Stop offset="100%" stopColor={green} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={fadeBottom} stopOpacity="0" />
            <Stop offset="70%" stopColor={fadeBottom} stopOpacity={isDark ? 0.52 : 0.12} />
            <Stop offset="100%" stopColor={fadeBottom} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="peachBand" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={peachGlow} stopOpacity="0" />
            <Stop offset="46%" stopColor={peachGlow} stopOpacity={isDark ? 0.28 : 0.46} />
            <Stop offset="82%" stopColor={peachGlow} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="greenBand" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={green} stopOpacity="0" />
            <Stop offset="22%" stopColor={green} stopOpacity={isDark ? 0.3 : 0.42} />
            <Stop offset="54%" stopColor={green} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="peachCoreBand" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={peachCore} stopOpacity="0" />
            <Stop offset="52%" stopColor={peachCore} stopOpacity={isDark ? 0.12 : 0.22} />
            <Stop offset="72%" stopColor={peachCore} stopOpacity="0" />
          </LinearGradient>
          <Filter id="softAuroraBlur" x="-20%" y="-20%" width="140%" height="140%">
            <FeGaussianBlur stdDeviation="14" />
          </Filter>
        </Defs>
        <Rect width={width} height={height} fill={background} />
        <Rect width={width} height={height} fill="url(#topLeftGreen)" />
        <Rect width={width} height={height} fill="url(#topRightPeach)" />
        <Rect width={width} height={height} fill="url(#topRightPeachCore)" />
        <Rect width={width} height={height} fill="url(#lowerLeftPeach)" />
        <Rect width={width} height={height} fill="url(#lowerRightGreen)" />
        <G filter="url(#softAuroraBlur)">
          <Path
            d={`M ${-width * 0.28} ${height * 0.02} C ${width * 0.2} ${height * 0.1}, ${width * 0.46} ${height * 0.24}, ${width * 1.16} ${height * 0.04} L ${width * 1.18} ${height * 0.34} C ${width * 0.58} ${height * 0.48}, ${width * 0.1} ${height * 0.24}, ${-width * 0.28} ${height * 0.2} Z`}
            fill="url(#greenBand)"
            opacity={overlayOpacity}
          />
          <Path
            d={`M ${-width * 0.16} ${height * 0.18} C ${width * 0.28} ${height * 0.08}, ${width * 0.58} ${height * 0.18}, ${width * 1.2} ${height * 0.42} L ${width * 1.16} ${height * 0.82} C ${width * 0.72} ${height * 0.54}, ${width * 0.2} ${height * 0.42}, ${-width * 0.18} ${height * 0.62} Z`}
            fill="url(#peachBand)"
            opacity={overlayOpacity}
          />
          <Path
            d={`M ${-width * 0.1} ${height * 0.26} C ${width * 0.3} ${height * 0.16}, ${width * 0.62} ${height * 0.26}, ${width * 1.1} ${height * 0.18} L ${width * 1.2} ${height * 0.42} C ${width * 0.66} ${height * 0.48}, ${width * 0.34} ${height * 0.4}, ${-width * 0.18} ${height * 0.56} Z`}
            fill="url(#peachCoreBand)"
            opacity={isDark ? 0.7 : 0.82}
          />
        </G>
        <Rect width={width} height={height} fill="url(#bottomFade)" />
      </Svg>
    </View>
  );
});

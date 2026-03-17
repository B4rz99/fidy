import { CheckCircle, Mail, Search, TriangleAlert } from "@/shared/components/icons";
import { useEffect, useRef } from "react";
import { Text, View } from "@/shared/components/rn";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useThemeColor } from "@/shared/hooks";
import type { ProgressDisplay, ProgressPhase } from "../lib/progress-phases";
import { shouldMorphToBanner } from "../lib/progress-phases";

type EmailProgressCardProps = {
  readonly phase: ProgressPhase;
  readonly display: ProgressDisplay;
  readonly onComplete: () => void;
};

const MORPH_DELAY_MS = 1500;
const FADE_DELAY_MS = 3000;
const NEEDS_REVIEW_BG = "#FFF3E0";
const NEEDS_REVIEW_ICON = "#E65100";

export const EmailProgressCard = ({ phase, display, onComplete }: EmailProgressCardProps) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barWidth = useSharedValue(0);
  const morphProgress = useSharedValue(0);

  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const borderSubtle = useThemeColor("borderSubtle");

  // Animate progress bar
  useEffect(() => {
    barWidth.value = withTiming(display.fractionComplete, { duration: 300 });
  }, [display.fractionComplete, barWidth]);

  // Handle completion phase
  useEffect(() => {
    if (phase !== "complete") return;

    const delay = shouldMorphToBanner(display.needsReview) ? MORPH_DELAY_MS : FADE_DELAY_MS;

    if (shouldMorphToBanner(display.needsReview)) {
      morphProgress.value = withTiming(1, { duration: 400 });
    }

    timerRef.current = setTimeout(onComplete, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, display.needsReview, onComplete, morphProgress]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: morphProgress.value > 0.5 ? NEEDS_REVIEW_BG : cardBg,
  }));

  const isMorphing = phase === "complete" && shouldMorphToBanner(display.needsReview);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[containerStyle, { borderRadius: 12, padding: 14, gap: 10 }]}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {phase === "fetching" && <Mail size={18} color={accentGreen} />}
        {phase === "processing" && <Search size={18} color={accentGreen} />}
        {phase === "complete" && !isMorphing && <CheckCircle size={18} color={accentGreen} />}
        {isMorphing && <TriangleAlert size={18} color={NEEDS_REVIEW_ICON} />}
        <Text
          className="font-poppins-semibold text-body"
          style={{ color: isMorphing ? "#1A1A1A" : primaryColor }}
        >
          {isMorphing
            ? `${display.needsReview} ${display.needsReview === 1 ? "transaction needs" : "transactions need"} review`
            : display.title}
        </Text>
      </View>

      {phase === "processing" && (
        <View>
          <View
            style={{
              backgroundColor: borderSubtle,
              borderRadius: 4,
              height: 5,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={[
                progressBarStyle,
                {
                  backgroundColor: accentGreen,
                  height: "100%",
                  borderRadius: 4,
                },
              ]}
            />
          </View>
          <View className="flex-row justify-between" style={{ marginTop: 6 }}>
            <Text className="font-poppins-medium" style={{ color: secondaryColor, fontSize: 12 }}>
              {display.subtitle}
            </Text>
            {display.transactionsFound > 0 && (
              <Text className="font-poppins-medium" style={{ color: accentGreen, fontSize: 12 }}>
                {display.transactionsFound}{" "}
                {display.transactionsFound === 1 ? "transaction" : "transactions"} found
              </Text>
            )}
          </View>
        </View>
      )}

      {phase === "fetching" && (
        <Text className="font-poppins-medium" style={{ color: secondaryColor, fontSize: 12 }}>
          {display.subtitle}
        </Text>
      )}
      {phase === "complete" && !isMorphing && (
        <Text className="font-poppins-medium" style={{ color: secondaryColor, fontSize: 12 }}>
          {display.subtitle}
        </Text>
      )}
      {isMorphing && (
        <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
          Low confidence parses
        </Text>
      )}
    </Animated.View>
  );
};

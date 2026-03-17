import { useMemo } from "react";
import { MessageSquare, Smartphone } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useCaptureSourcesStore } from "../store";

const StepList = ({
  steps,
  circleBg,
  circleText,
}: {
  steps: readonly string[];
  circleBg: string;
  circleText: string;
}) => (
  <View style={{ gap: 10 }}>
    {steps.map((text, index) => (
      <View key={text} className="flex-row items-start" style={{ gap: 10 }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: circleBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="font-poppins-bold text-caption" style={{ color: circleText }}>
            {index + 1}
          </Text>
        </View>
        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark flex-1 leading-relaxed">
          {text}
        </Text>
      </View>
    ))}
  </View>
);

export const ApplePaySetupCard = () => {
  const { t, locale } = useTranslation();
  const isApplePaySetupComplete = useCaptureSourcesStore((s) => s.isApplePaySetupComplete);

  // biome-ignore lint/correctness/useExhaustiveDependencies: locale triggers recompute when language changes
  const applePaySteps = useMemo(
    () => [
      t("applePay.steps.0"),
      t("applePay.steps.1"),
      t("applePay.steps.2"),
      t("applePay.steps.3"),
    ],
    [t, locale]
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: locale triggers recompute when language changes
  const smsSteps = useMemo(
    () => [
      t("smsDetection.steps.0"),
      t("smsDetection.steps.1"),
      t("smsDetection.steps.2"),
      t("smsDetection.steps.3"),
    ],
    [t, locale]
  );

  const secondaryColor = useThemeColor("secondary");
  const greenColor = useThemeColor("accentGreen");
  const greenLightBg = useThemeColor("accentGreenLight");
  const peachLightBg = useThemeColor("peachLight");
  const primaryColor = useThemeColor("primary");
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <View style={{ gap: 16 }}>
      {/* Apple Pay Capture */}
      <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Smartphone size={22} color={secondaryColor} />
            <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
              Apple Pay
            </Text>
          </View>

          <View
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: isApplePaySetupComplete ? greenLightBg : peachLightBg,
            }}
          >
            <Text
              className="font-poppins-semibold text-caption"
              style={{
                color: isApplePaySetupComplete ? greenColor : tertiaryColor,
              }}
            >
              {isApplePaySetupComplete ? t("applePay.connected") : t("applePay.notSetUp")}
            </Text>
          </View>
        </View>

        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
          {t("applePay.description")}
        </Text>

        <StepList steps={applePaySteps} circleBg={peachLightBg} circleText={primaryColor} />
      </View>

      {/* SMS Detection */}
      <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <MessageSquare size={22} color={greenColor} />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {t("smsDetection.title")}
          </Text>
        </View>

        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
          {t("smsDetection.description")}
        </Text>

        <StepList steps={smsSteps} circleBg={greenLightBg} circleText={greenColor} />
      </View>
    </View>
  );
};

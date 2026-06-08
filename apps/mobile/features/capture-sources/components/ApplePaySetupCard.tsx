import { useMemo } from "react";
import { Card, GlassSurface } from "@/shared/components";
import { MessageSquare, Smartphone } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useCaptureSourcesStore } from "../store";

const StepList = ({ steps, circleColor }: { steps: readonly string[]; circleColor: string }) => (
  <View style={{ gap: 10 }}>
    {steps.map((text, index) => (
      <View key={text} className="flex-row items-start" style={{ gap: 10 }}>
        <GlassSurface
          nativeGlass={false}
          padded={false}
          radius={12}
          borderColor={circleColor}
          style={{
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="font-poppins-bold text-caption" style={{ color: circleColor }}>
            {index + 1}
          </Text>
        </GlassSurface>
        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark flex-1 leading-relaxed">
          {text}
        </Text>
      </View>
    ))}
  </View>
);

export const ApplePaySetupCard = () => {
  const { t } = useTranslation();
  const isApplePaySetupComplete = useCaptureSourcesStore((s) => s.isApplePaySetupComplete);

  const applePaySteps = useMemo(
    () => [
      t("applePay.steps.0"),
      t("applePay.steps.1"),
      t("applePay.steps.2"),
      t("applePay.steps.3"),
    ],
    [t]
  );
  const smsSteps = useMemo(
    () => [
      t("smsDetection.steps.0"),
      t("smsDetection.steps.1"),
      t("smsDetection.steps.2"),
      t("smsDetection.steps.3"),
    ],
    [t]
  );

  const secondaryColor = useThemeColor("secondary");
  const greenColor = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");

  return (
    <View style={{ gap: 16 }}>
      {/* Apple Pay Capture */}
      <Card padded={false} contentStyle={{ gap: 14, padding: 20 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Smartphone size={22} color={secondaryColor} />
            <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
              Apple Pay
            </Text>
          </View>

          <GlassSurface
            nativeGlass={false}
            padded={false}
            radius={999}
            borderColor={isApplePaySetupComplete ? greenColor : primaryColor}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              className="font-poppins-semibold text-caption"
              style={{
                color: isApplePaySetupComplete ? greenColor : primaryColor,
              }}
            >
              {isApplePaySetupComplete ? t("applePay.connected") : t("applePay.notSetUp")}
            </Text>
          </GlassSurface>
        </View>

        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
          {t("applePay.description")}
        </Text>

        <StepList steps={applePaySteps} circleColor={primaryColor} />
      </Card>

      {/* SMS Detection */}
      <Card padded={false} contentStyle={{ gap: 14, padding: 20 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <MessageSquare size={22} color={greenColor} />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {t("smsDetection.title")}
          </Text>
        </View>

        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
          {t("smsDetection.description")}
        </Text>

        <StepList steps={smsSteps} circleColor={greenColor} />
      </Card>
    </View>
  );
};

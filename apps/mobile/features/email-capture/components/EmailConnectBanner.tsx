import { Card, IconActionButton } from "@/shared/components";
import { Button } from "@/shared/components/Button";
import { Mail, X } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useEmailCaptureStore } from "../store";

export const EmailConnectBanner = ({
  onConnect,
}: {
  onConnect: (provider: "gmail" | "outlook") => void;
}) => {
  const { t } = useTranslation();
  const accounts = useEmailCaptureStore((s) => s.accounts);
  const bannerDismissed = useEmailCaptureStore((s) => s.bannerDismissed);
  const dismissBanner = useEmailCaptureStore((s) => s.dismissBanner);
  const iconColor = useThemeColor("accentRed");
  const closeColor = useThemeColor("tertiary");

  if (accounts.length > 0 || bannerDismissed) return null;

  return (
    <Card padded={false} contentStyle={{ gap: 16, padding: 20 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Mail size={22} color={iconColor} />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {t("emailCapture.autoCapture")}
          </Text>
        </View>
        <IconActionButton
          accessibilityLabel={t("common.dismiss")}
          icon={<X size={18} color={closeColor} />}
          onPress={dismissBanner}
          size="size-8"
        />
      </View>

      <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
        {t("emailCapture.connectDescription")}
      </Text>

      <View className="flex-row" style={{ gap: 10 }}>
        <Button
          label={t("emailCapture.connectProviders.gmail")}
          onPress={() => onConnect("gmail")}
          variant="secondary"
          icon={<Mail size={18} color={iconColor} />}
          className="h-11 flex-1 rounded-icon"
        />

        <Button
          label={t("emailCapture.connectProviders.outlook")}
          onPress={() => onConnect("outlook")}
          variant="secondary"
          icon={<Mail size={18} color="#4A90D9" />}
          className="h-11 flex-1 rounded-icon"
        />
      </View>
    </Card>
  );
};

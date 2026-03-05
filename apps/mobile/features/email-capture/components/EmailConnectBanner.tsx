import { Mail, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useEmailCaptureStore } from "../store";

export const EmailConnectBanner = ({
  onConnect,
}: {
  onConnect: (provider: "gmail" | "outlook") => void;
}) => {
  const accounts = useEmailCaptureStore((s) => s.accounts);
  const bannerDismissed = useEmailCaptureStore((s) => s.bannerDismissed);
  const dismissBanner = useEmailCaptureStore((s) => s.dismissBanner);
  const iconColor = useThemeColor("accentRed");
  const closeColor = useThemeColor("tertiary");

  if (accounts.length > 0 || bannerDismissed) return null;

  return (
    <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 16 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Mail size={22} color={iconColor} />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            Auto-capture transactions
          </Text>
        </View>
        <Pressable onPress={dismissBanner} hitSlop={12}>
          <X size={18} color={closeColor} />
        </Pressable>
      </View>

      <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
        Connect your email to automatically capture bank transactions.
      </Text>

      <View className="flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={() => onConnect("gmail")}
          className="flex-1 flex-row items-center justify-center rounded-icon bg-peach-btn dark:bg-peach-btn-dark"
          style={{ height: 44, gap: 8, borderWidth: 1, borderColor: "#EBEBEB" }}
        >
          <Mail size={18} color={iconColor} />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            Gmail
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onConnect("outlook")}
          className="flex-1 flex-row items-center justify-center rounded-icon bg-peach-btn dark:bg-peach-btn-dark"
          style={{ height: 44, gap: 8, borderWidth: 1, borderColor: "#EBEBEB" }}
        >
          <Mail size={18} color="#4A90D9" />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            Outlook
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

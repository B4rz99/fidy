import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmailConnectBanner } from "@/features/email-capture/components/EmailConnectBanner";
import { FailedEmailsBanner } from "@/features/email-capture/components/FailedEmailsBanner";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { TransactionsPreview } from "./TransactionsPreview";

const Header = () => {
  const iconColor = useThemeColor("primary");

  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-poppins-extrabold text-logo text-primary dark:text-primary-dark">
        fidy
      </Text>
      <Bell size={22} color={iconColor} />
    </View>
  );
};

const TAB_BAR_CLEARANCE = 100;

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);

  return (
    <View className="flex-1 bg-page dark:bg-page-dark">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: TAB_BAR_CLEARANCE }}
        className="flex-1 px-5"
      >
        <View className="gap-4">
          <Header />
          <EmailConnectBanner
            onConnect={(provider) => {
              const clientId = provider === "gmail" ? "" : "";
              connectEmail(provider, clientId);
            }}
          />
          <FailedEmailsBanner onPress={() => router.push("/failed-emails" as never)} />
          <BalanceSection />
          <ChartSection />
          <TransactionsPreview />
        </View>
      </ScrollView>
    </View>
  );
};

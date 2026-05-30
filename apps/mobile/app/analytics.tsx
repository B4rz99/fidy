import { useRouter } from "expo-router";
import { AnalyticsScreen } from "@/features/analytics";
import { ScreenLayout } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

export default function AnalyticsRoute() {
  const { back } = useRouter();
  const { t } = useTranslation();

  return (
    <ScreenLayout title={t("analytics.title")} variant="sub" onBack={() => back()}>
      <AnalyticsScreen />
    </ScreenLayout>
  );
}

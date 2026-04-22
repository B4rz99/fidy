import { ScreenLayout } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";
import { QaToolsContent } from "./qa-tools/QaToolsContent";
import { QaToolsUnavailable } from "./qa-tools/QaToolsUnavailable";
import { useQaToolsScreen } from "./qa-tools/useQaToolsScreen";

export function QaToolsScreen() {
  const { t } = useTranslation();
  const qaTools = useQaToolsScreen();

  return (
    <ScreenLayout variant="sub" title={t("qaTools.title")} onBack={qaTools.onBack}>
      {qaTools.localQaAvailable ? <QaToolsContent qaTools={qaTools} /> : <QaToolsUnavailable />}
    </ScreenLayout>
  );
}

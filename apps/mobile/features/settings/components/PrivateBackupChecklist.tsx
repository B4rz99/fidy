import { Card } from "@/shared/components";
import { CheckCircle } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function PrivateBackupChecklist() {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  return (
    <Card padded={false} contentStyle={{ padding: 14, gap: 10 }}>
      {["passwordManager", "newDevice", "lostKey"].map((key) => (
        <View key={key} className="flex-row items-start" style={{ gap: 10 }}>
          <CheckCircle size={18} color={accentGreen} />
          <Text className="font-poppins text-xs text-primary dark:text-primary-dark">
            {t(`privateBackup.checklist.${key}`)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

import { CheckCircle } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";

export function PrivateBackupChecklist() {
  const { t } = useTranslation();
  return (
    <View className="rounded-2xl bg-card dark:bg-card-dark" style={{ padding: 14, gap: 10 }}>
      {["passwordManager", "newDevice", "lostKey"].map((key) => (
        <View key={key} className="flex-row items-start" style={{ gap: 10 }}>
          <CheckCircle size={18} color="#7CB243" />
          <Text className="font-poppins text-xs text-primary dark:text-primary-dark">
            {t(`privateBackup.checklist.${key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

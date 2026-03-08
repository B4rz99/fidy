import { ChevronRight, MessageSquare } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useCaptureSourcesStore } from "../store";

export const DetectedTransactionsBanner = ({ onPress }: { onPress: () => void }) => {
  const count = useCaptureSourcesStore((s) => s.detectedSmsCount);
  const secondaryColor = useThemeColor("secondary");

  if (count === 0) return null;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-xl p-3"
      style={{ backgroundColor: "#E3F2FD", gap: 12 }}
    >
      <View className="flex-1 flex-row items-center" style={{ gap: 10 }}>
        <MessageSquare size={18} color="#1565C0" />
        <View>
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {count} {count === 1 ? "movimiento bancario" : "movimientos bancarios"} hoy
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: secondaryColor }}>
            SMS detectados - toca para revisar
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={secondaryColor} />
    </Pressable>
  );
};

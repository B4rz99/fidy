import { Clock, X } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useChatStore } from "../store";

export function ExpiredSessionsBanner() {
  const count = useChatStore((s) => s.expiredSessionCount);
  const dismiss = useChatStore((s) => s.dismissExpiredBanner);

  if (count === 0) return null;

  return (
    <View
      className="flex-row items-center rounded-xl"
      style={{ backgroundColor: "#FFF3E0", padding: 12, gap: 10 }}
    >
      <Clock size={18} color="#E65100" />
      <Text className="font-poppins-medium text-body flex-1" style={{ color: "#4E342E" }}>
        {count} {count === 1 ? "conversation" : "conversations"} expired and removed
      </Text>
      <Pressable onPress={dismiss} hitSlop={12} style={{ padding: 4 }}>
        <X size={16} color="#6D6D6D" />
      </Pressable>
    </View>
  );
}

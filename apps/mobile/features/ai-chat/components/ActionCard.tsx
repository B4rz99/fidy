import { formatMoney } from "@/shared/lib/format-money";
import { Trash2 } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { ChatAction } from "../schema";

type ActionCardProps = {
  readonly action: ChatAction;
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
};

export function ActionCard({ action, onConfirm, onDismiss }: ActionCardProps) {
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");

  if (action.type !== "delete") return null;

  return (
    <View
      className="bg-card dark:bg-card-dark"
      style={{
        borderRadius: 16,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: borderSubtle,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Trash2 size={20} color={accentRed} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            Delete transaction
          </Text>
          <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark">
            {formatMoney(action.amount)} — {action.description}
          </Text>
          <Text className="font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
            {action.date}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={onDismiss}
          className="bg-page dark:bg-page-dark"
          style={{
            flex: 1,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="font-poppins-semibold text-label text-secondary dark:text-secondary-dark">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 12,
            backgroundColor: accentRed,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="font-poppins-semibold text-label" style={{ color: "#FFFFFF" }}>
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

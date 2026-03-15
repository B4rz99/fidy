import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { CATEGORY_MAP } from "@/features/transactions/lib/categories";
import { formatSignedAmount } from "@/features/transactions/lib/format-amount";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import type { SyncConflict } from "../store";

type ConflictCardProps = {
  readonly conflict: SyncConflict;
  readonly onKeepLocal: () => void;
  readonly onAcceptServer: () => void;
};

type DiffRowProps = {
  readonly label: string;
  readonly localValue: string;
  readonly serverValue: string;
};

const DiffRow = memo(function DiffRow({ label, localValue, serverValue }: DiffRowProps) {
  return (
    <View className="flex-row items-center py-1.5" style={{ gap: 8 }}>
      <Text className="w-20 font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
        {label}
      </Text>
      <View className="flex-1 rounded-md bg-red-50 px-2 py-1 dark:bg-red-950">
        <Text className="font-poppins-medium text-caption text-accent-red dark:text-accent-red-dark">
          {localValue}
        </Text>
      </View>
      <View className="flex-1 rounded-md bg-green-50 px-2 py-1 dark:bg-green-950">
        <Text className="font-poppins-medium text-caption text-accent-green dark:text-accent-green-dark">
          {serverValue}
        </Text>
      </View>
    </View>
  );
});

function getCategoryLabel(categoryId: string): string {
  const cat = CATEGORY_MAP[categoryId as keyof typeof CATEGORY_MAP];
  return cat?.label.en ?? categoryId;
}

export const ConflictCard = memo(function ConflictCard({
  conflict,
  onKeepLocal,
  onAcceptServer,
}: ConflictCardProps) {
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const { localData, serverData } = conflict;

  const diffs: DiffRowProps[] = [];

  if (localData.amountCents !== serverData.amountCents) {
    diffs.push({
      label: "Amount",
      localValue: formatSignedAmount(localData.amountCents, localData.type as "expense" | "income"),
      serverValue: formatSignedAmount(
        serverData.amountCents,
        serverData.type as "expense" | "income"
      ),
    });
  }

  if (localData.categoryId !== serverData.categoryId) {
    diffs.push({
      label: "Category",
      localValue: getCategoryLabel(localData.categoryId),
      serverValue: getCategoryLabel(serverData.categoryId),
    });
  }

  if (localData.description !== serverData.description) {
    diffs.push({
      label: "Description",
      localValue: localData.description ?? "(none)",
      serverValue: serverData.description ?? "(none)",
    });
  }

  if (localData.date !== serverData.date) {
    diffs.push({
      label: "Date",
      localValue: localData.date,
      serverValue: serverData.date,
    });
  }

  if (localData.type !== serverData.type) {
    diffs.push({
      label: "Type",
      localValue: localData.type,
      serverValue: serverData.type,
    });
  }

  if (localData.deletedAt !== serverData.deletedAt) {
    diffs.push({
      label: "Status",
      localValue: localData.deletedAt ? "Deleted" : "Active",
      serverValue: serverData.deletedAt ? "Deleted" : "Active",
    });
  }

  return (
    <View className="rounded-xl bg-chart-bg p-4 dark:bg-chart-bg-dark">
      <Text className="mb-1 font-poppins-semibold text-body text-primary dark:text-primary-dark">
        {localData.description || serverData.description || "Transaction"}
      </Text>

      <View className="mb-2 flex-row" style={{ gap: 8 }}>
        <View className="flex-1">
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            Your version
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            Synced version
          </Text>
        </View>
      </View>

      {diffs.map((diff) => (
        <DiffRow key={diff.label} {...diff} />
      ))}

      <View className="mt-3 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={onKeepLocal}
          className="flex-1 items-center rounded-lg py-2"
          style={{ backgroundColor: `${accentRed}20` }}
        >
          <Text className="font-poppins-semibold text-caption" style={{ color: accentRed }}>
            Keep mine
          </Text>
        </Pressable>
        <Pressable
          onPress={onAcceptServer}
          className="flex-1 items-center rounded-lg py-2"
          style={{ backgroundColor: `${accentGreen}20` }}
        >
          <Text className="font-poppins-semibold text-caption" style={{ color: accentGreen }}>
            Accept synced
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

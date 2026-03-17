import { memo } from "react";
import { CATEGORY_MAP, formatSignedAmount } from "@/features/transactions";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
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
  readonly accentRed: string;
  readonly accentGreen: string;
};

const DiffRow = memo(function DiffRow({
  label,
  localValue,
  serverValue,
  accentRed,
  accentGreen,
}: DiffRowProps) {
  return (
    <View className="flex-row items-center py-1.5" style={{ gap: 8 }}>
      <Text className="w-20 font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
        {label}
      </Text>
      <View className="flex-1 rounded-lg px-2 py-1.5" style={{ backgroundColor: `${accentRed}18` }}>
        <Text className="font-poppins-medium text-caption" style={{ color: accentRed }}>
          {localValue}
        </Text>
      </View>
      <View
        className="flex-1 rounded-lg px-2 py-1.5"
        style={{ backgroundColor: `${accentGreen}18` }}
      >
        <Text className="font-poppins-medium text-caption" style={{ color: accentGreen }}>
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
  const peachBg = useThemeColor("peachLight");
  const { localData, serverData } = conflict;

  const diffs: Omit<DiffRowProps, "accentRed" | "accentGreen">[] = [];

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

  const localDeleted = localData.deletedAt != null;
  const serverDeleted = serverData.deletedAt != null;
  if (localDeleted !== serverDeleted) {
    diffs.push({
      label: "Status",
      localValue: localDeleted ? "Deleted" : "Active",
      serverValue: serverDeleted ? "Deleted" : "Active",
    });
  }

  return (
    <View className="rounded-xl p-4" style={{ backgroundColor: peachBg }}>
      <Text className="mb-2 font-poppins-semibold text-body text-primary dark:text-primary-dark">
        {localData.description || serverData.description || "Transaction"}
      </Text>

      <View className="mb-1 flex-row" style={{ gap: 8, paddingLeft: 80 + 8 }}>
        <Text className="flex-1 font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          Your version
        </Text>
        <Text className="flex-1 font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          Synced version
        </Text>
      </View>

      {diffs.map((diff) => (
        <DiffRow key={diff.label} {...diff} accentRed={accentRed} accentGreen={accentGreen} />
      ))}

      <View className="mt-4 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={onKeepLocal}
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: `${accentRed}20` }}
        >
          <Text className="font-poppins-semibold text-body" style={{ color: accentRed }}>
            Keep mine
          </Text>
        </Pressable>
        <Pressable
          onPress={onAcceptServer}
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: `${accentGreen}20` }}
        >
          <Text className="font-poppins-semibold text-body" style={{ color: accentGreen }}>
            Accept synced
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

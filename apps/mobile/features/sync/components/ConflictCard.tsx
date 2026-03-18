import { memo } from "react";
import { CATEGORY_MAP } from "@/features/transactions";
import { formatSignedMoney } from "@/shared/lib/format-money";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
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

function resolveCategoryLabel(categoryId: string, locale: string): string {
  const cat = CATEGORY_MAP[categoryId as keyof typeof CATEGORY_MAP];
  return cat ? getCategoryLabel(cat, locale) : categoryId;
}

export const ConflictCard = memo(function ConflictCard({
  conflict,
  onKeepLocal,
  onAcceptServer,
}: ConflictCardProps) {
  const { t, locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const peachBg = useThemeColor("peachLight");
  const { localData, serverData } = conflict;

  const diffs: Omit<DiffRowProps, "accentRed" | "accentGreen">[] = [];

  if (localData.amount !== serverData.amount) {
    diffs.push({
      label: t("common.amount"),
      localValue: formatSignedMoney(localData.amount, localData.type as "expense" | "income"),
      serverValue: formatSignedMoney(
        serverData.amount,
        serverData.type as "expense" | "income"
      ),
    });
  }

  if (localData.categoryId !== serverData.categoryId) {
    diffs.push({
      label: t("common.category"),
      localValue: resolveCategoryLabel(localData.categoryId, locale),
      serverValue: resolveCategoryLabel(serverData.categoryId, locale),
    });
  }

  if (localData.description !== serverData.description) {
    diffs.push({
      label: t("common.description"),
      localValue: localData.description ?? t("common.none"),
      serverValue: serverData.description ?? t("common.none"),
    });
  }

  if (localData.date !== serverData.date) {
    diffs.push({
      label: t("common.date"),
      localValue: localData.date,
      serverValue: serverData.date,
    });
  }

  if (localData.type !== serverData.type) {
    diffs.push({
      label: t("common.type"),
      localValue: localData.type,
      serverValue: serverData.type,
    });
  }

  const localDeleted = localData.deletedAt != null;
  const serverDeleted = serverData.deletedAt != null;
  if (localDeleted !== serverDeleted) {
    diffs.push({
      label: t("common.status"),
      localValue: localDeleted ? t("common.deleted") : t("common.active"),
      serverValue: serverDeleted ? t("common.deleted") : t("common.active"),
    });
  }

  return (
    <View className="rounded-xl p-4" style={{ backgroundColor: peachBg }}>
      <Text className="mb-2 font-poppins-semibold text-body text-primary dark:text-primary-dark">
        {localData.description || serverData.description || t("common.transaction")}
      </Text>

      <View className="mb-1 flex-row" style={{ gap: 8, paddingLeft: 80 + 8 }}>
        <Text className="flex-1 font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {t("syncConflicts.yourVersion")}
        </Text>
        <Text className="flex-1 font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {t("syncConflicts.syncedVersion")}
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
            {t("syncConflicts.keepMine")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onAcceptServer}
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: `${accentGreen}20` }}
        >
          <Text className="font-poppins-semibold text-body" style={{ color: accentGreen }}>
            {t("syncConflicts.acceptSynced")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

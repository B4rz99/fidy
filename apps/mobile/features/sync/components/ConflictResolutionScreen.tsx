import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ScreenLayout } from "@/shared/components";
import { FlatList, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import type { SyncConflict } from "../store";
import { useSyncConflictStore } from "../store";
import { ConflictCard } from "./ConflictCard";

export default function ConflictResolutionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const conflicts = useSyncConflictStore((s) => s.conflicts);
  const resolveConflict = useSyncConflictStore((s) => s.resolveConflict);

  const renderItem = useCallback(
    ({ item }: { item: SyncConflict }) => (
      <ConflictCard
        conflict={item}
        onKeepLocal={() => resolveConflict(item.id, "local")}
        onAcceptServer={() => resolveConflict(item.id, "server")}
      />
    ),
    [resolveConflict]
  );

  const keyExtractor = useCallback((item: SyncConflict) => item.id, []);

  return (
    <ScreenLayout title={t("syncConflicts.title")} variant="sub" onBack={() => router.back()}>
      {conflicts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="font-poppins-semibold text-base text-primary dark:text-primary-dark">
            {t("syncConflicts.allResolved")}
          </Text>
          <Text className="mt-1 text-center font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            {t("syncConflicts.noConflicts")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conflicts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        />
      )}
    </ScreenLayout>
  );
}

import { Pressable, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { CATEGORY_MAP } from "@/features/transactions/lib/categories";
import type { VoiceParseResult } from "../lib/voice-parse-schema";

type VoiceConfirmCardProps = {
  readonly parsed: VoiceParseResult;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export function VoiceConfirmCard({
  parsed,
  onConfirm,
  onCancel,
}: VoiceConfirmCardProps) {
  const { t, locale } = useTranslation();
  const category = CATEGORY_MAP[parsed.categoryId];
  const CategoryIcon = category?.icon;
  const categoryLabel =
    locale === "es" ? category?.label.es : category?.label.en;
  const formattedAmount = `$${parsed.amount.toLocaleString("es-CO")}`;
  const isExpense = parsed.type === "expense";

  return (
    <View className="rounded-2xl bg-card p-5 dark:bg-card-dark">
      <View className="mb-4 flex-row items-center gap-3">
        {CategoryIcon && (
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: category?.color ?? "#888" }}
          >
            <CategoryIcon size={20} color="#fff" />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-lg font-semibold text-primary dark:text-primary-dark">
            {formattedAmount}
          </Text>
          <Text className="text-sm text-secondary dark:text-secondary-dark">
            {categoryLabel}
            {parsed.description ? ` · ${parsed.description}` : ""}
          </Text>
        </View>
        <View
          className={`rounded-full px-2 py-0.5 ${isExpense ? "bg-red-100 dark:bg-red-900" : "bg-green-100 dark:bg-green-900"}`}
        >
          <Text
            className={`text-xs font-medium ${isExpense ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}
          >
            {isExpense ? t("transactions.expense") : t("transactions.income")}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onCancel}
          className="flex-1 items-center rounded-xl border border-border py-3 dark:border-border-dark"
        >
          <Text className="font-medium text-secondary dark:text-secondary-dark">
            {t("common.cancel")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          className="flex-1 items-center rounded-xl bg-accent-green py-3 dark:bg-accent-green-dark"
        >
          <Text className="font-medium text-white">{t("voice.confirm")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

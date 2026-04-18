import { format } from "date-fns";
import { useCallback, useState } from "react";
import {
  CATEGORIES,
  type CategoryId,
  getBuiltInCategoryId,
  isValidCategoryId,
  type StoredTransaction,
} from "@/features/transactions";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatSignedMoney } from "@/shared/lib";
import type { ProcessedEmailRow } from "../lib/repository";

type NeedsReviewCardProps = {
  readonly processedEmail: ProcessedEmailRow;
  readonly transaction: StoredTransaction | undefined;
  readonly onConfirm: (processedEmailId: string, categoryId: string) => void;
};

const FALLBACK_CATEGORY_ID = getBuiltInCategoryId("other");

export const NeedsReviewCard = ({
  processedEmail,
  transaction,
  onConfirm,
}: NeedsReviewCardProps) => {
  const { t, locale } = useTranslation();
  const suggestedCategory: CategoryId =
    transaction?.categoryId && isValidCategoryId(transaction.categoryId)
      ? transaction.categoryId
      : FALLBACK_CATEGORY_ID;
  const [prevSuggested, setPrevSuggested] = useState(suggestedCategory);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>(suggestedCategory);
  if (suggestedCategory !== prevSuggested) {
    setPrevSuggested(suggestedCategory);
    setSelectedCategory(suggestedCategory);
  }

  const handleConfirm = useCallback(() => {
    onConfirm(processedEmail.id, selectedCategory);
  }, [processedEmail.id, selectedCategory, onConfirm]);

  if (!transaction) return null;

  return (
    <View className="gap-3 rounded-2xl bg-white p-4" style={{ gap: 12 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-0.5">
          <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
            {processedEmail.subject}
          </Text>
          <Text className="font-poppins-semibold text-base text-primary dark:text-primary-dark">
            {transaction.description || t("common.unknown")}
          </Text>
        </View>
        <View className="items-end gap-0.5">
          <Text
            className={`font-poppins-bold text-base ${
              transaction.type === "income"
                ? "text-accent-green dark:text-accent-green-dark"
                : "text-accent-red dark:text-accent-red-dark"
            }`}
          >
            {formatSignedMoney(transaction.amount, transaction.type)}
          </Text>
          <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
            {format(transaction.date, "PP", { locale: getDateFnsLocale(locale) })}
          </Text>
        </View>
      </View>

      <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
        {t("common.category")}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row" style={{ gap: 8 }}>
          {CATEGORIES.map((cat) => {
            const isSelected = cat.id === selectedCategory;
            const Icon = cat.icon;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                className="flex-row items-center rounded-full"
                style={{
                  backgroundColor: isSelected ? "#7cb243" : "#F5E1C8",
                  paddingVertical: 0,
                  paddingLeft: 10,
                  paddingRight: 14,
                  height: 32,
                  gap: 6,
                }}
              >
                <Icon size={14} color={isSelected ? "#FFFFFF" : "#6D6D6D"} />
                <Text
                  className="font-poppins-medium"
                  style={{
                    fontSize: 12,
                    color: isSelected ? "#FFFFFF" : "#6D6D6D",
                    fontWeight: isSelected ? "600" : "500",
                  }}
                >
                  {getCategoryLabel(cat, locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Pressable
          onPress={handleConfirm}
          className="flex-1 items-center justify-center rounded-xl"
          style={{ backgroundColor: "#7cb243", height: 40 }}
        >
          <Text className="font-poppins-semibold text-sm text-white">{t("common.confirm")}</Text>
        </Pressable>
      </View>
    </View>
  );
};

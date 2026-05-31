import { useCallback } from "react";
import { getTransactionDisplayName } from "@/features/transactions/display.public";
import { Card } from "@/shared/components";
import { ChevronRight } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatSignedMoney } from "@/shared/lib";
import type { TransactionId } from "@/shared/types/branded";
import type { useAttributionReviewQueue } from "../hooks/use-attribution-review-queue";
import { ActionButton } from "./shared";

type AttributionQueueItem = ReturnType<typeof useAttributionReviewQueue>["items"][number];

type AttributionQueueCardProps = {
  readonly disabled: boolean;
  readonly item: AttributionQueueItem;
  readonly onChooseAnother: (fingerprint: string) => void;
  readonly onConfirm: (transactionId: TransactionId) => void;
  readonly onOpenDetails: (transactionId: TransactionId) => void;
  readonly onSkip: (transactionId: TransactionId) => void;
};

export function AttributionQueueCard({
  item,
  disabled,
  onConfirm,
  onChooseAnother,
  onOpenDetails,
  onSkip,
}: AttributionQueueCardProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const accentRed = useThemeColor("accentRed");
  const transactionId = item.transaction.id;
  const handleConfirmPress = useCallback(
    () => onConfirm(transactionId),
    [onConfirm, transactionId]
  );
  const handleChooseAnotherPress = useCallback(
    () => onChooseAnother(item.suggestion.fingerprint),
    [item.suggestion.fingerprint, onChooseAnother]
  );
  const handleOpenDetailsPress = useCallback(
    () => onOpenDetails(transactionId),
    [onOpenDetails, transactionId]
  );
  const handleSkipPress = useCallback(() => onSkip(transactionId), [onSkip, transactionId]);

  return (
    <Card contentClassName="gap-3.5 p-3.5">
      <Pressable onPress={handleOpenDetailsPress} disabled={disabled} style={styles.cardPressable}>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.metaLabel, { color: tertiary }]}>
            {t("attributionReview.provisionalLabel")}
          </Text>
          <ChevronRight size={16} color={tertiary} />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: primary }]} numberOfLines={2}>
              {getTransactionDisplayName(item.transaction, t("common.unknown"))}
            </Text>
            <Text style={[styles.supportingCopy, { color: secondary }]}>{item.evidenceLabel}</Text>
          </View>
          <Text style={[styles.amount, { color: accentRed }]}>
            {formatSignedMoney(item.transaction.amount, item.transaction.type)}
          </Text>
        </View>

        <View style={styles.ownerColumn}>
          <View style={styles.ownerRow}>
            <Text style={[styles.ownerLabel, { color: secondary }]}>
              {t("attributionReview.currentOwner")}
            </Text>
            <Text style={[styles.ownerValue, { color: primary }]}>
              {item.currentAccount?.name ?? t("common.unknown")}
            </Text>
          </View>
          <View style={styles.ownerRow}>
            <Text style={[styles.ownerLabel, { color: secondary }]}>
              {t("attributionReview.suggestedOwner")}
            </Text>
            <Text style={[styles.ownerValue, { color: primary }]}>
              {item.suggestedAccount.name}
            </Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <ActionButton
          label={t("attributionReview.confirmOwner")}
          onPress={handleConfirmPress}
          disabled={disabled}
        />
        <ActionButton
          label={t("attributionReview.chooseAnother")}
          onPress={handleChooseAnotherPress}
          variant="outline"
          disabled={disabled}
        />
        <ActionButton
          label={t("attributionReview.skip")}
          onPress={handleSkipPress}
          variant="ghost"
          disabled={disabled}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardPressable: {
    gap: 10,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  titleRow: {
    flexDirection: "row",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    lineHeight: 22,
  },
  supportingCopy: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    textAlign: "right",
  },
  ownerColumn: {
    gap: 8,
  },
  ownerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  ownerLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  ownerValue: {
    flex: 1,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
});

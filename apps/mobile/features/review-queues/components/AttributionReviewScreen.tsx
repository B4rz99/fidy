import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { readFinancialAccountKind } from "@/features/financial-accounts/display.public";
import { getTransactionDisplayName } from "@/features/transactions/display.public";
import { refreshTransactions } from "@/features/transactions/store.public";
import { GlassSurface, ScreenLayout } from "@/shared/components";
import { Info, Landmark, TriangleAlert } from "@/shared/components/icons";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatSignedMoney, showErrorToast } from "@/shared/lib";
import { requireTransactionId } from "@/shared/types/assertions";
import { useAttributionReviewQueue } from "../hooks/use-attribution-review-queue";
import { getFinancialAccountKindIcon } from "../lib/account-presentation";
import { ActionButton, DetailRow, EmptyState, SummaryCard } from "./shared";

export function AttributionReviewScreen() {
  const { push, replace, back } = useRouter();
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { items, hasLoadedQueue, service } = useAttributionReviewQueue({ db, userId });
  const { isBusy, run: guardedAction } = useAsyncGuard();
  const resolvedTransactionId =
    typeof transactionId === "string" && transactionId.trim().length > 0
      ? requireTransactionId(transactionId.trim())
      : null;
  const reviewItem = useMemo(
    () =>
      resolvedTransactionId
        ? (items.find((entry) => entry.transaction.id === resolvedTransactionId) ?? null)
        : null,
    [items, resolvedTransactionId]
  );
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentRed = useThemeColor("accentRed");

  if (hasLoadedQueue && reviewItem == null) {
    return (
      <ScreenLayout title={t("attributionReview.reviewTitle")} variant="sub" onBack={() => back()}>
        <EmptyState
          title={t("attributionReview.emptyTitle")}
          subtitle={t("attributionReview.emptySubtitle")}
        />
      </ScreenLayout>
    );
  }

  if (!reviewItem) {
    return null;
  }

  const CurrentIcon = reviewItem.currentAccount
    ? getFinancialAccountKindIcon(reviewItem.currentAccount.kind)
    : Landmark;
  const SuggestedIcon = getFinancialAccountKindIcon(reviewItem.suggestedAccount.kind);

  const handleConfirm = () => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        const result = service.confirmSuggestedOwner({
          db,
          userId,
          transactionId: reviewItem.transaction.id,
        });

        if (!result.success) {
          showErrorToast(t("attributionReview.errors.confirmFailed"));
          return;
        }

        await refreshTransactions(db, userId);
        replace("/attribution-review-queue" as never);
      } catch {
        showErrorToast(t("attributionReview.errors.confirmFailed"));
      }
    });
  };

  return (
    <ScreenLayout title={t("attributionReview.reviewTitle")} variant="sub" onBack={() => back()}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottom + 28 }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <SummaryCard
          icon={TriangleAlert}
          title={t("attributionReview.reviewPill")}
          subtitle={t("attributionReview.reviewSubtitle")}
          tone="green"
        />

        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: primary }]}>
            {getTransactionDisplayName(reviewItem.transaction, t("common.unknown"))}
          </Text>
          <Text style={[styles.amount, { color: accentRed }]}>
            {formatSignedMoney(reviewItem.transaction.amount, reviewItem.transaction.type)}
          </Text>
        </View>

        <DetailRow
          label={t("attributionReview.currentOwner")}
          title={reviewItem.currentAccount?.name ?? t("attributionReview.fallbackOwner")}
          subtitle={
            reviewItem.currentAccount
              ? t(
                  `financialAccounts.kinds.${readFinancialAccountKind(reviewItem.currentAccount.kind)}`
                )
              : t("attributionReview.fallbackOwnerMissing")
          }
          icon={<CurrentIcon size={18} color={secondary} />}
        />

        <DetailRow
          label={t("attributionReview.suggestedOwner")}
          title={reviewItem.suggestedAccount.name}
          subtitle={reviewItem.evidenceLabel ?? t("attributionReview.suggestedByEvidence")}
          icon={<SuggestedIcon size={18} color={secondary} />}
          emphasis="green"
        />

        <View style={styles.actionColumn}>
          <ActionButton
            label={t("attributionReview.confirmAccount")}
            onPress={handleConfirm}
            disabled={isBusy}
          />
          <ActionButton
            label={t("attributionReview.createNew")}
            onPress={() =>
              push({
                pathname: "/create-financial-account",
                params: { fingerprint: reviewItem.suggestion.fingerprint },
              })
            }
            variant="outline"
            disabled={isBusy}
          />
          <ActionButton
            label={t("attributionReview.skip")}
            onPress={() => back()}
            variant="ghost"
            disabled={isBusy}
          />
        </View>

        <GlassSurface padded={false} radius={18} style={styles.noteCard}>
          <Info size={18} color={secondary} />
          <Text style={[styles.noteCopy, { color: secondary }]}>
            {t("attributionReview.balanceHint")}
          </Text>
        </GlassSurface>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 16,
  },
  headerCopy: {
    gap: 4,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    lineHeight: 28,
  },
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  actionColumn: {
    gap: 10,
  },
  noteCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteCopy: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
});

import { useRouter } from "expo-router";
import {
  AccountSuggestionsPromptBanner,
  useAccountSuggestions,
} from "@/features/account-suggestions/routes.public";
import { useAuthStore, useOptionalUserId } from "@/features/auth/public";
import { DetectedTransactionsBanner } from "@/features/capture-sources/public";
import {
  connectEmailAccount,
  getGmailClientId,
  getOutlookClientId,
} from "@/features/email-capture/public";
import { EmailConnectBanner } from "@/features/email-capture/ui.public";
import { Platform, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { AttributionReviewBanner } from "../AttributionReviewBanner";
import { NeedsReviewBanner } from "../NeedsReviewBanner";
import { HomeSpendingCard } from "./HomeSpendingCard";
import type { CategorySpendingItem } from "./useHomeScreen";

type HomeScreenHeaderProps = {
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly monthlyBudget: number;
};

export function HomeScreenHeader({
  balance,
  categorySpending,
  monthlyBudget,
}: HomeScreenHeaderProps) {
  const { push } = useRouter();
  const userId = useOptionalUserId();
  const localQaProfile = useAuthStore((state) => state.localQaSession?.profile ?? null);
  const db = userId ? tryGetDb(userId) : null;
  const showSetupBanners = localQaProfile !== "home-activity";
  const { suggestions } = useAccountSuggestions({
    db: showSetupBanners ? db : null,
    userId: showSetupBanners ? userId : null,
  });

  return (
    <View className="gap-4 px-4">
      {showSetupBanners ? (
        <>
          <EmailConnectBanner
            onConnect={(provider) => {
              if (!userId) return;
              const db = tryGetDb(userId);
              if (!db) return;
              const clientId = provider === "gmail" ? getGmailClientId() : getOutlookClientId();
              void connectEmailAccount(db, userId, provider, clientId);
            }}
          />
        </>
      ) : null}
      <NeedsReviewBanner onPress={() => push("/needs-review" as never)} />
      <AttributionReviewBanner onPress={() => push("/attribution-review-queue" as never)} />
      {Platform.OS === "ios" ? (
        <DetectedTransactionsBanner onPress={() => push("/connected-accounts" as never)} />
      ) : null}
      {showSetupBanners ? (
        <>
          <AccountSuggestionsPromptBanner
            count={suggestions.length}
            onPress={() => push("/account-suggestions" as never)}
          />
        </>
      ) : null}
      <HomeSpendingCard
        categorySpending={categorySpending}
        balance={balance}
        monthlyBudget={monthlyBudget}
      />
    </View>
  );
}

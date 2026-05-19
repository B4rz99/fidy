import { useRouter } from "expo-router";
import {
  AccountSuggestionsPromptBanner,
  useAccountSuggestions,
} from "@/features/account-suggestions/routes.public";
import { useOptionalUserId } from "@/features/auth/public";
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
import { BalanceSection } from "../BalanceSection";
import { ChartSection } from "../ChartSection";
import { NeedsReviewBanner } from "../NeedsReviewBanner";
import type { CategorySpendingItem } from "./useHomeScreen";

type HomeScreenHeaderProps = {
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
};

export function HomeScreenHeader({ balance, categorySpending }: HomeScreenHeaderProps) {
  const { push } = useRouter();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { suggestions } = useAccountSuggestions({ db, userId });

  return (
    <View className="gap-4 px-4">
      <EmailConnectBanner
        onConnect={(provider) => {
          if (!userId) return;
          const db = tryGetDb(userId);
          if (!db) return;
          const clientId = provider === "gmail" ? getGmailClientId() : getOutlookClientId();
          void connectEmailAccount(db, userId, provider, clientId);
        }}
      />
      <NeedsReviewBanner onPress={() => push("/needs-review" as never)} />
      <AttributionReviewBanner onPress={() => push("/attribution-review-queue" as never)} />
      <AccountSuggestionsPromptBanner
        count={suggestions.length}
        onPress={() => push("/account-suggestions" as never)}
      />
      {Platform.OS === "ios" ? (
        <DetectedTransactionsBanner onPress={() => push("/connected-accounts" as never)} />
      ) : null}
      <BalanceSection balance={balance} />
      <ChartSection
        categorySpending={categorySpending}
        totalSpent={balance}
        onPress={() => push("/analytics" as never)}
      />
    </View>
  );
}

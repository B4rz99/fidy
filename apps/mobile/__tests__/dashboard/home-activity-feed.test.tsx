import { act } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import type { StoredActivityItem } from "@/features/activity/query.public";
import type { HomeActivityFeedModel } from "@/features/dashboard/components/home-screen/useHomeActivityFeed";
import type { AnyDb } from "@/shared/db";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

type UseHomeActivityFeedInput = {
  readonly dataRevision: number;
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
};
type UseHomeActivityFeed = (input: UseHomeActivityFeedInput) => HomeActivityFeedModel;

const loadPageWithCloudLedgerOptimisticView = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const push = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const deleteTransaction = vi.hoisted(() => vi.fn<(...args: any[]) => any>());

vi.mock("@/features/activity/query.public", () => ({
  appendUniqueActivityItems: (
    existingItems: readonly StoredActivityItem[],
    nextItems: readonly StoredActivityItem[]
  ) => {
    const existingIds = new Set(existingItems.map((item) => item.id));
    return [...existingItems, ...nextItems.filter((item) => !existingIds.has(item.id))];
  },
  createActivityQueryService: () => ({
    loadPageWithCloudLedgerOptimisticView,
  }),
}));

vi.mock("@/features/transactions/cloud-ledger.public", () => ({
  loadCloudLedgerOptimisticTransactions: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/transactions/store.public", () => ({
  deleteTransaction,
}));

vi.mock("@/features/dashboard/lib/get-activity-account-names", () => ({
  getActivityAccountNames: () => ({}),
}));

describe("home activity feed", () => {
  let useHomeActivityFeed: UseHomeActivityFeed;

  beforeAll(async () => {
    vi.doMock("expo-router", async () => {
      const React = await import("react");
      return {
        useFocusEffect: (effect: () => void | (() => void)) => {
          React.useEffect(effect, [effect]);
        },
        useRouter: () => ({ push }),
      };
    });
    vi.doMock("@/shared/hooks", async () => {
      return {
        useSubscription: () => undefined,
        useTranslation: () => ({ t: (key: string) => key }),
      };
    });
    ({ useHomeActivityFeed } =
      await import("@/features/dashboard/components/home-screen/useHomeActivityFeed"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears previous user activity while the next user's optimistic feed load is pending", async () => {
    const firstUserActivity = makeActivityItem({
      id: "tx-user-1" as TransactionId,
      userId: "user-1" as UserId,
      description: "First user lunch",
    });
    let resolveSecondUserLoad!: (snapshot: {
      readonly pages: readonly StoredActivityItem[];
      readonly offset: number;
      readonly hasMore: boolean;
    }) => void;
    loadPageWithCloudLedgerOptimisticView
      .mockResolvedValueOnce({
        pages: [firstUserActivity],
        offset: 1,
        hasMore: false,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondUserLoad = resolve;
          })
      );

    const modelRef: { current: HomeActivityFeedModel | null } = { current: null };
    const db = {} as AnyDb;
    const screen = renderFidy(
      <HomeActivityFeedProbe
        dataRevision={0}
        db={db}
        onModel={(model) => {
          modelRef.current = model;
        }}
        useHomeActivityFeed={useHomeActivityFeed}
        userId={"user-1" as UserId}
      />
    );
    await vi.waitFor(() => {
      expect(modelRef.current?.activityPages).toEqual([firstUserActivity]);
    });

    screen.rerender(
      <HomeActivityFeedProbe
        dataRevision={0}
        db={db}
        onModel={(model) => {
          modelRef.current = model;
        }}
        useHomeActivityFeed={useHomeActivityFeed}
        userId={"user-2" as UserId}
      />
    );

    expect(modelRef.current?.activityPages).toEqual([]);

    await act(async () => {
      resolveSecondUserLoad({
        pages: [
          makeActivityItem({
            id: "tx-user-2" as TransactionId,
            userId: "user-2" as UserId,
            description: "Second user lunch",
          }),
        ],
        offset: 1,
        hasMore: false,
      });
    });
    await vi.waitFor(() => {
      expect(
        modelRef.current?.activityPages.map((item) =>
          item.kind === "transaction" ? item.transaction.userId : null
        )
      ).toEqual(["user-2"]);
    });
  });
});

function HomeActivityFeedProbe({
  onModel,
  useHomeActivityFeed,
  ...input
}: UseHomeActivityFeedInput & {
  readonly onModel: (model: HomeActivityFeedModel) => void;
  readonly useHomeActivityFeed: UseHomeActivityFeed;
}) {
  onModel(useHomeActivityFeed(input));
  return null;
}

function makeActivityItem({
  description,
  id,
  userId,
}: {
  readonly description: string;
  readonly id: TransactionId;
  readonly userId: UserId;
}): StoredActivityItem {
  const date = new Date("2026-03-04T00:00:00.000Z");
  const timestamp = new Date("2026-03-04T10:00:00.000Z");
  return {
    kind: "transaction",
    id,
    date,
    updatedAt: timestamp,
    transaction: {
      id,
      userId,
      type: "expense",
      amount: 1000 as CopAmount,
      categoryId: "food" as CategoryId,
      description,
      date,
      createdAt: timestamp,
      updatedAt: timestamp,
      voidedAt: null,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "confirmed",
      source: "manual",
      counterpartyName: "",
      supersededAt: null,
      supersededByTransferId: null,
    },
  };
}

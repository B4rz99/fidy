import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { useTranslation } from "@/shared/hooks";
import type { TabType } from "./GoalDetail.helpers";

const GOAL_DETAIL_TABS: readonly TabType[] = ["contributions", "aiPlan"];

export function TabControl(props: {
  readonly activeTab: TabType;
  readonly onTabChange: (tab: TabType) => void;
}) {
  const { t } = useTranslation();

  return (
    <SegmentedControl
      options={GOAL_DETAIL_TABS.map((tab) => ({
        value: tab,
        label: t(`goals.detail.${tab}`),
      }))}
      variant="detached"
      value={props.activeTab}
      onChange={props.onTabChange}
    />
  );
}

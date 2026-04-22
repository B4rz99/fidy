import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { TabType } from "./GoalDetail.helpers";
import { styles } from "./GoalDetail.styles";

const GOAL_DETAIL_TABS: readonly TabType[] = ["contributions", "aiPlan"];

function GoalDetailTabButton(props: {
  readonly active: boolean;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const accentGreen = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");

  return (
    <Pressable
      style={[styles.tabButton, props.active ? { backgroundColor: accentGreen } : undefined]}
      onPress={props.onPress}
    >
      <Text style={[styles.tabText, { color: props.active ? "#FFFFFF" : secondaryColor }]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function TabControl(props: {
  readonly activeTab: TabType;
  readonly onTabChange: (tab: TabType) => void;
}) {
  const { t } = useTranslation();
  const cardBg = useThemeColor("card");

  return (
    <View style={[styles.tabContainer, { backgroundColor: cardBg }]}>
      {GOAL_DETAIL_TABS.map((tab) => (
        <GoalDetailTabButton
          key={tab}
          active={props.activeTab === tab}
          label={t(`goals.detail.${tab}`)}
          onPress={() => props.onTabChange(tab)}
        />
      ))}
    </View>
  );
}

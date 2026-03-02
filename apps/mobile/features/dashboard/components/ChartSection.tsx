import { View } from "react-native";
import { chartCategories, chartTotal } from "../data/mock-data";
import { CategoryRow } from "./CategoryRow";
import { DonutChart } from "./DonutChart";

export const ChartSection = () => (
  <View className="flex-row gap-4 rounded-chart bg-chart-bg p-4 dark:bg-chart-bg-dark">
    <DonutChart segments={chartCategories} centerLabel={chartTotal} centerSubLabel="spent" />
    <View className="flex-1 justify-center gap-2.5">
      {chartCategories.map((category) => (
        <CategoryRow
          key={category.name}
          color={category.color}
          name={category.name}
          amount={category.amount}
        />
      ))}
    </View>
  </View>
);

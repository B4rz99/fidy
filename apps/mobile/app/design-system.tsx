import { Redirect } from "expo-router";
import { DesignSystemScreen } from "@/features/design-system/ui.public";

export default function DesignSystemRoute() {
  return __DEV__ ? <DesignSystemScreen /> : <Redirect href="/(tabs)/(index)" />;
}

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "@/shared/components/rn";
import { AddNavButton } from "./AddNavButton";
import { NavItem } from "./NavItem";
import { TAB_CONFIG } from "./tab-config";

export { TAB_CONFIG };

export const CustomTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute left-5 right-5 flex-row items-center justify-around rounded-nav-pill bg-nav px-2 py-2 dark:bg-nav-dark"
      style={{ bottom: Math.max(insets.bottom, 16) }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const handlePress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (route.name === "add") {
          return <AddNavButton key={route.key} onPress={handlePress} />;
        }

        const config = TAB_CONFIG[route.name];
        if (!config) return null;

        return (
          <NavItem
            key={route.key}
            icon={config.icon}
            label={config.label}
            isActive={isFocused}
            onPress={handlePress}
          />
        );
      })}
    </View>
  );
};

import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View } from "@/shared/components/rn";
import { HeaderBackButton } from "./HeaderBackButton";

type SolidScreenHeaderProps = {
  readonly title?: string;
  readonly onBack?: () => void;
  readonly rightAction?: ReactNode;
};

export function SolidScreenHeader({ title = "", onBack, rightAction }: SolidScreenHeaderProps) {
  const { top } = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: top }}>
      <View className="px-4 flex-row items-center justify-between h-12">
        <View className="flex-1 flex-row items-center">
          <HeaderBackButton onPress={onBack} />
        </View>
        <Text
          className="absolute left-16 right-16 text-center font-poppins-bold text-title text-primary dark:text-primary-dark"
          numberOfLines={1}
          pointerEvents="none"
        >
          {title}
        </Text>
        <View className="flex-1 flex-row justify-end" pointerEvents="box-none">
          {rightAction}
        </View>
      </View>
    </View>
  );
}

export type { SolidScreenHeaderProps };

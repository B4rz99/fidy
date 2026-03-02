import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useRef } from "react";
import { Keyboard } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useTransactionStore } from "../store";
import { AmountEntry } from "./AmountEntry";
import { TransactionDetails } from "./TransactionDetails";

const SNAP_POINTS = ["85%"];

export const AddTransactionSheet = () => {
  const isOpen = useTransactionStore((s) => s.isOpen);
  const step = useTransactionStore((s) => s.step);
  const closeSheet = useTransactionStore((s) => s.closeSheet);
  const sheetRef = useRef<BottomSheet>(null);
  const cardColor = useThemeColor("card");
  const handleColor = useThemeColor("tertiary");

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.expand();
    } else {
      Keyboard.dismiss();
      sheetRef.current?.close();
    }
  }, [isOpen]);

  const handleAnimate = useCallback((_from: number, to: number) => {
    if (to === -1) {
      Keyboard.dismiss();
    }
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        closeSheet();
      }
    },
    [closeSheet]
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      enablePanDownToClose
      enableDynamicSizing={false}
      snapPoints={SNAP_POINTS}
      onAnimate={handleAnimate}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: cardColor,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: handleColor,
        width: 40,
        height: 4,
      }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        <Animated.View
          key={step}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ flex: 1 }}
        >
          {step === 1 ? <AmountEntry /> : <TransactionDetails />}
        </Animated.View>
      </BottomSheetView>
    </BottomSheet>
  );
};

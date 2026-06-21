import Svg, { Line } from "react-native-svg";
import {
  getCategoryBarBackgroundColor,
  getBuiltInCategory,
  type Category,
  type CategoryId,
} from "@/shared/categories";
import { SurfacePressable } from "@/shared/components";
import { CALENDAR_DAY_CELL_SHADOW } from "@/shared/components/effect-tokens";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { Bill } from "../schema";

type Props = {
  day: number | null;
  date: Date | null;
  bills: Bill[];
  categoryById: ReadonlyMap<CategoryId, Category>;
  paidBillIds: ReadonlySet<string>;
  minHeight?: number;
  onDayPress: (date: Date) => void;
};

const MAX_VISIBLE_MARKERS = 3;

export function CalendarDayCell({
  day,
  date,
  bills,
  categoryById,
  paidBillIds,
  minHeight,
  onDayPress,
}: Props) {
  const primaryColor = useThemeColor("primary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const surfaceRaised = useThemeColor("surfaceRaised");

  if (day === null || !date) {
    return <View style={[styles.cellLayout, minHeight != null ? { minHeight } : undefined]} />;
  }

  const visibleBills = bills.slice(0, MAX_VISIBLE_MARKERS);
  const primaryBill = visibleBills[0] ?? null;
  const primaryCategory = primaryBill ? categoryById.get(primaryBill.categoryId) : null;
  const primaryBuiltInCategory = primaryBill ? getBuiltInCategory(primaryBill.categoryId) : null;
  const primaryCategoryColor = primaryBill
    ? getCategoryBarBackgroundColor(
        primaryBill.categoryId,
        primaryCategory?.color ?? primaryBuiltInCategory?.color ?? surfaceRaised
      )
    : surfaceRaised;
  const hasBills = bills.length > 0;
  const allPaid = hasBills && bills.every((bill) => paidBillIds.has(bill.id));

  return (
    <SurfacePressable
      style={[
        styles.cellLayout,
        minHeight != null ? { minHeight } : undefined,
        hasBills ? styles.cellChrome : null,
      ]}
      backgroundColor={hasBills ? primaryCategoryColor : undefined}
      layoutStyle={styles.cellSurface}
      radius={8}
      padded={false}
      onPress={() => onDayPress(date)}
    >
      {allPaid ? <PaidDiagonalLine color={accentGreen} /> : null}
      <Text style={[styles.dayNumber, { color: primaryColor }]}>{day}</Text>
      {visibleBills.length > 0 ? (
        <View style={styles.categoryMarkers}>
          {visibleBills.map((bill) => {
            const category =
              categoryById.get(bill.categoryId) ?? getBuiltInCategory(bill.categoryId);
            return (
              <Text key={bill.id} style={styles.categoryMarker}>
                {category?.icon}
              </Text>
            );
          })}
        </View>
      ) : null}
      {bills.length > MAX_VISIBLE_MARKERS ? (
        <Text style={[styles.moreText, { color: tertiaryColor }]}>
          +{bills.length - MAX_VISIBLE_MARKERS}
        </Text>
      ) : null}
    </SurfacePressable>
  );
}

function PaidDiagonalLine({ color }: { readonly color: string }) {
  return (
    <View pointerEvents="none" style={styles.paidSlash}>
      <Svg width="100%" height="100%">
        <Line
          x1="100%"
          y1="0"
          x2="0"
          y2="100%"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  cellLayout: {
    flex: 1,
    minHeight: 72,
    margin: 2,
    borderRadius: 8,
    borderCurve: "continuous",
  },
  cellChrome: {
    boxShadow: CALENDAR_DAY_CELL_SHADOW,
  },
  cellSurface: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
    borderRadius: 8,
    borderCurve: "continuous",
  },
  paidSlash: {
    position: "absolute",
    inset: 5,
    opacity: 0.9,
    zIndex: 3,
  },
  dayNumber: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    marginBottom: 6,
    zIndex: 2,
  },
  categoryMarkers: {
    minHeight: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 2,
    zIndex: 2,
  },
  categoryMarker: {
    fontSize: 14,
    lineHeight: 18,
  },
  moreText: {
    marginTop: 2,
    fontSize: 8,
    fontFamily: "Poppins_600SemiBold",
    zIndex: 2,
  },
});

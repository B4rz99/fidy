import { format } from "date-fns";
import { getBuiltInCategory } from "@/shared/categories";
import { Card, Surface, IconActionButton } from "@/shared/components";
import { Check, Pencil, Trash2 } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import type { CalendarBillOccurrence } from "../lib/calendar-utils";
import type { Bill } from "../schema";

type CalendarBillRowProps = {
  readonly occurrence: CalendarBillOccurrence;
  readonly onDelete?: (bill: Bill) => void;
  readonly onEdit?: (bill: Bill) => void;
  readonly onPaymentToggle?: (occurrence: CalendarBillOccurrence) => void;
  readonly radius?: number;
  readonly showDate?: boolean;
};

export function CalendarBillRow({
  occurrence,
  onDelete,
  onEdit,
  onPaymentToggle,
  radius = 18,
  showDate = true,
}: CalendarBillRowProps) {
  const { locale, t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const peach = useThemeColor("peach");
  const category = getBuiltInCategory(occurrence.bill.categoryId);
  const paid = occurrence.isPaid;

  return (
    <Card padded={false} radius={radius} contentStyle={styles.cardContent}>
      <View style={styles.billRow}>
        <View style={styles.billMain}>
          <Text style={styles.billIcon}>{category.icon}</Text>
          <View style={styles.billCopy}>
            <Text
              style={[styles.billName, { color: primary }, paid && styles.paidText]}
              numberOfLines={1}
            >
              {occurrence.bill.name}
            </Text>
            {showDate ? (
              <Text style={[styles.billMeta, { color: secondary }]}>
                {format(occurrence.date, "d MMM", { locale: getDateFnsLocale(locale) })}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={[styles.billAmount, { color: primary }]}>
          {formatMoney(occurrence.bill.amount)}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <Surface radius={8} padded={false} style={styles.statusPill}>
          <Text style={[styles.statusPillText, { color: paid ? accentGreen : peach }]}>
            {paid ? t("calendar.paid") : t("calendar.pending")}
          </Text>
        </Surface>
        <View style={styles.actions}>
          {onPaymentToggle ? (
            <IconActionButton
              accessibilityLabel={paid ? t("calendar.paid") : t("calendar.pending")}
              icon={<Check size={16} color={paid ? accentGreen : primary} />}
              onPress={() => onPaymentToggle(occurrence)}
              size="size-[34px]"
              tone="surface"
            />
          ) : null}
          {onEdit ? (
            <IconActionButton
              accessibilityLabel={t("common.edit")}
              icon={<Pencil size={16} color={primary} />}
              onPress={() => onEdit(occurrence.bill)}
              size="size-[34px]"
              tone="surface"
            />
          ) : null}
          {onDelete ? (
            <IconActionButton
              accessibilityLabel={t("common.delete")}
              icon={<Trash2 size={16} color={accentRed} />}
              onPress={() => onDelete(occurrence.bill)}
              size="size-[34px]"
              tone="surface"
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    padding: 12,
    gap: 10,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  billMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  billIcon: {
    fontSize: 20,
  },
  billCopy: {
    flex: 1,
  },
  billName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  paidText: {
    textDecorationLine: "line-through",
  },
  billMeta: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  billAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
});

import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type BillPayment, getBillsForDate, useCalendarStore } from "@/features/calendar";
import { Check, Pencil, Trash2 } from "@/shared/components/icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { toIsoDate } from "@/shared/lib";
import { formatMoney } from "@/shared/lib/format-money";

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const markBillPaid = useCalendarStore((s) => s.markBillPaid);
  const unmarkBillPaid = useCalendarStore((s) => s.unmarkBillPaid);
  const deleteBill = useCalendarStore((s) => s.deleteBill);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const cardBg = useThemeColor("card");
  const pageBg = useThemeColor("page");
  const borderColor = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentRed = useThemeColor("accentRed");
  const peachBg = useThemeColor("peachLight");

  const dateObj = date ? new Date(date) : new Date();
  const dueDateStr = toIsoDate(dateObj);
  const billsForDate = getBillsForDate(bills, dateObj);

  const isPaymentPaid = (billId: string): BillPayment | undefined =>
    payments.find((p) => p.billId === billId && p.dueDate === dueDateStr);

  const handleTogglePaid = async (billId: string) => {
    const existing = isPaymentPaid(billId);
    if (existing) {
      await unmarkBillPaid(billId, dueDateStr);
    } else {
      await markBillPaid(billId, dueDateStr);
    }
  };

  const handleEdit = (billId: string) => {
    router.push({ pathname: "/add-bill", params: { billId } });
  };

  const handleDelete = (billId: string, billName: string) => {
    Alert.alert(t("bills.deleteBill"), t("bills.deleteBillConfirm", { billName }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteBill(billId);
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: primaryColor }]}>
        {format(dateObj, "EEEE, PP", { locale: getDateFnsLocale(locale) })}
      </Text>

      {billsForDate.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: secondaryColor }]}>
            {t("bills.noBillsOnDay")}
          </Text>
        </View>
      ) : (
        <View style={styles.billList}>
          {billsForDate.map((bill) => {
            const paid = isPaymentPaid(bill.id);
            return (
              <View
                key={bill.id}
                style={[
                  styles.billRow,
                  {
                    backgroundColor: paid ? accentGreenLight : pageBg,
                    borderColor,
                  },
                ]}
              >
                <View style={styles.billInfo}>
                  <Text style={[styles.billName, { color: primaryColor }, paid && styles.paidText]}>
                    {bill.name}
                  </Text>
                  <Text style={[styles.billAmount, { color: secondaryColor }]}>
                    {formatMoney(bill.amount)}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: paid ? accentGreen : peachBg }]}
                    onPress={() => handleTogglePaid(bill.id)}
                    hitSlop={8}
                  >
                    <Check size={16} color={paid ? "#FFFFFF" : primaryColor} />
                  </Pressable>

                  <Pressable
                    style={[styles.actionButton, { backgroundColor: peachBg }]}
                    onPress={() => handleEdit(bill.id)}
                    hitSlop={8}
                  >
                    <Pencil size={16} color={primaryColor} />
                  </Pressable>

                  <Pressable
                    style={[styles.actionButton, { backgroundColor: peachBg }]}
                    onPress={() => handleDelete(bill.id, bill.name)}
                    hitSlop={8}
                  >
                    <Trash2 size={16} color={accentRed} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  billList: {
    gap: 8,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 16,
    minHeight: 56,
  },
  billInfo: {
    flex: 1,
    gap: 2,
  },
  billName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  paidText: {
    textDecorationLine: "line-through",
  },
  billAmount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});

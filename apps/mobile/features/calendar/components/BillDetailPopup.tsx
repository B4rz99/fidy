import { format } from "date-fns";
import { Receipt, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORY_MAP } from "@/features/transactions/lib/categories";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { getNextOccurrence } from "../lib/calendar-utils";
import { useCalendarStore } from "../store";
import { PopupOverlay } from "./PopupOverlay";

export function BillDetailPopup() {
  const popup = useCalendarStore((s) => s.popup);
  const selectedBillId = useCalendarStore((s) => s.selectedBillId);
  const bills = useCalendarStore((s) => s.bills);
  const closePopup = useCalendarStore((s) => s.closePopup);

  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const peachBg = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");

  if (popup !== "billDetail" || !selectedBillId) return null;

  const bill = bills.find((b) => b.id === selectedBillId);
  if (!bill) return null;

  const amount = `$${(bill.amountCents / 100).toFixed(2)}`;
  const nextPayment = getNextOccurrence(bill, new Date());
  const nextPaymentStr = format(nextPayment, "MMM d, yyyy");

  return (
    <PopupOverlay onClose={closePopup}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconCircle, { backgroundColor: peachBg }]}>
              <Receipt size={18} color={primaryColor} />
            </View>
            <Text style={[styles.billName, { color: primaryColor }]}>{bill.name}</Text>
          </View>
          <Pressable onPress={closePopup} hitSlop={8}>
            <X size={20} color={secondaryColor} />
          </Pressable>
        </View>

        {/* Amount */}
        <Text style={[styles.amount, { color: primaryColor }]}>{amount}</Text>

        {/* Details grid */}
        <View style={styles.detailsGrid}>
          <DetailRow label="Category" value={CATEGORY_MAP[bill.categoryId].label.en} />
          <DetailRow label="Frequency" value={bill.frequency} />
          <DetailRow label="Next Payment" value={nextPaymentStr} />
          <DetailRow
            label="Status"
            value={bill.isActive ? "Active" : "Inactive"}
            valueColor={bill.isActive ? accentGreen : undefined}
          />
        </View>
      </View>
    </PopupOverlay>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: secondaryColor }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor ?? primaryColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  billName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 28,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  detailValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    textTransform: "capitalize",
  },
});

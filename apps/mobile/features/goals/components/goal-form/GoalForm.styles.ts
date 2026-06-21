import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  fullScreenContainer: {
    gap: 16,
    paddingBottom: 12,
  },
  fullScreenAmount: {
    alignItems: "center",
  },
  amountPressTarget: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 96,
    width: "100%",
  },
  amountText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 78,
    textAlign: "center",
    width: "100%",
  },
  fullScreenBottomForm: {
    gap: 10,
  },
  goalNameRateRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  goalNameColumn: {
    flex: 1.35,
    minWidth: 0,
  },
  goalRateColumn: {
    flex: 0.85,
    minWidth: 0,
  },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  interestInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  interestInput: { flex: 1 },
  interestSuffix: { fontFamily: "Poppins_700Bold", fontSize: 18 },
});

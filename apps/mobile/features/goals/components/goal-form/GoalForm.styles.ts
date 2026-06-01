import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  fullScreenContainer: {
    gap: 16,
    paddingBottom: 12,
  },
  fullScreenAmount: {
    alignItems: "center",
  },
  fullScreenBottomForm: {
    gap: 10,
  },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  interestInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  interestInput: { flex: 1 },
  interestSuffix: { fontFamily: "Poppins_700Bold", fontSize: 18 },
});

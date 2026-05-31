import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  container: {},
  scrollContent: { padding: 24, gap: 16 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 18, textAlign: "center" },
  fullScreenShell: {
    flex: 1,
  },
  fullScreenScroller: {
    flex: 1,
  },
  fullScreenContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  fullScreenTitle: {
    display: "none",
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 16,
    gap: 16,
  },
  fullScreenForm: {
    gap: 10,
  },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  input: {
    height: 44,
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  dateButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateText: { fontFamily: "Poppins_500Medium", fontSize: 14 },
  clearDateText: { fontSize: 14 },
  amountSection: { alignItems: "center", gap: 2, paddingVertical: 2 },
  interestInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  interestInput: { flex: 1 },
  interestSuffix: { fontFamily: "Poppins_700Bold", fontSize: 18 },
  projectionHint: { fontFamily: "Poppins_500Medium", fontSize: 12, textAlign: "center" },
});

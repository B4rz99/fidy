import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  amountDisplay: {
    fontFamily: "Poppins_700Bold",
    fontSize: 32,
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  amountSection: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  container: {},
  deleteButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    paddingVertical: 14,
  },
  deleteButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  hint: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    fontStyle: "italic",
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderCurve: "continuous",
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
  },
  scrollContent: {
    gap: 16,
    padding: 24,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
});

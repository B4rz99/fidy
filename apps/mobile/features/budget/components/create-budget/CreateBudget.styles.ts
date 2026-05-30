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
  scrollContent: {
    gap: 16,
    padding: 24,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
});

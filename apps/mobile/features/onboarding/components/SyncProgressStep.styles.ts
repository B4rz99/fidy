import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  progressSection: {
    gap: 8,
  },
  counter: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
  previewSection: {
    gap: 8,
  },
  previewList: {
    maxHeight: 168,
  },
  previewTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  previewDescription: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  previewAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  helperText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    textAlign: "center",
  },
  primaryButton: {
    borderRadius: 14,
    borderCurve: "continuous",
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

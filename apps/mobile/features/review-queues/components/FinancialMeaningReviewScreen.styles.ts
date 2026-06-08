import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 16,
  },
  cardSurface: {
    borderWidth: 1,
  },
  cardContent: {
    gap: 14,
  },
  metaLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
  },
  titleRow: {
    flexDirection: "row",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "right",
  },
  separator: {
    height: 1,
    backgroundColor: "#00000012",
  },
  factBlock: {
    gap: 4,
  },
  factLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  factValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
  factCopy: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  actionColumn: {
    gap: 10,
  },
  transferTipSurface: {
    borderWidth: 1,
  },
  transferTipContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  transferTipCopy: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
});

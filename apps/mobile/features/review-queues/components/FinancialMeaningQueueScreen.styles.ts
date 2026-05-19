import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  itemSeparator: {
    height: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  cardPressable: {
    gap: 8,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMetaLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  subjectLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    lineHeight: 22,
  },
  cardSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  cardAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
});

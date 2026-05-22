import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  amount: {
    fontFamily: "Poppins_300Light",
    fontSize: 78,
    fontWeight: "300",
    letterSpacing: -2,
    textAlign: "center",
    width: "100%",
  },
  amountArea: {
    alignItems: "center",
    flex: 0.85,
    justifyContent: "center",
    minHeight: 80,
  },
  container: {
    flex: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  fieldCard: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    height: 50,
    paddingHorizontal: 14,
  },
  fieldInput: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    padding: 0,
  },
  fieldText: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  fields: {
    gap: 9,
    height: 168,
  },
  key: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
  },
  keyFeedback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    borderRadius: 14,
  },
  keyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 19,
    fontWeight: "600",
  },
  numpad: {
    flex: 1,
    gap: 6,
    maxHeight: 252,
    minHeight: 152,
    paddingTop: 6,
  },
  numpadRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  rightColumn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  tab: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    zIndex: 1,
  },
  tabPill: {
    position: "absolute",
    top: 2,
    left: 0,
    borderRadius: 999,
    height: 30,
  },
  tabText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    height: 34,
    position: "relative",
  },
  swipeArea: {
    flex: 1,
  },
});

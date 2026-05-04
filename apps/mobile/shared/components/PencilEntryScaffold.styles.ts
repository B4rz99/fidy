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
    maxHeight: 256,
    minHeight: 80,
  },
  container: {
    flex: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  bottomSpacer: {
    height: 3,
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
  keyConfirm: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
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
    gap: 6,
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  tabLine: {
    borderRadius: 2,
    height: 4,
    width: 88,
  },
  tabText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    height: 52,
  },
});

import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 78,
    textAlign: "center",
    width: "100%",
  },
  amountArea: {
    alignItems: "center",
    flex: 0.85,
    justifyContent: "center",
    minHeight: 80,
  },
  amountBanner: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: "100%",
    paddingHorizontal: 0,
    paddingVertical: 10,
    width: "100%",
  },
  container: {
    flex: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  fieldInput: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    padding: 0,
    textAlignVertical: "center",
  },
  fieldPlaceholder: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    left: 0,
    lineHeight: 20,
    position: "absolute",
    right: 0,
    top: "50%",
    transform: [{ translateY: -10 }],
  },
  fieldText: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  fields: {
    gap: 9,
    height: 188,
  },
  inputWrap: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    position: "relative",
  },
  key: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
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
  tabs: {
    width: "100%",
  },
  swipeArea: {
    flex: 1,
  },
});

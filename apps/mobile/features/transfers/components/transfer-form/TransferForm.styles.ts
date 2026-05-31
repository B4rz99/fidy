import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  amountCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  amountDisplayWrap: {
    position: "relative",
    justifyContent: "center",
  },
  amountInput: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.02,
    color: "transparent",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 18,
  },
  dateCard: {
    borderRadius: 16,
  },
  dateCardAndroid: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateCardIos: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateValue: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  hintCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  hintText: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  pickerHeader: {
    gap: 4,
  },
  pickerOption: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pickerOptionTextWrap: {
    flex: 1,
    gap: 2,
  },
  pickerDialog: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  pickerSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  pickerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 28,
    lineHeight: 32,
  },
  sectionLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
  },
  sectionEyebrow: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sideCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sideIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sideTextWrap: {
    flex: 1,
    gap: 2,
  },
  sideTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  sideSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
});

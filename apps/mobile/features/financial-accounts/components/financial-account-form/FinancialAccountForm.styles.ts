import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  headerTitle: {
    maxWidth: 250,
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
  },
  stateContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  stateBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  formSection: {
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    padding: 16,
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionOptionalLabel: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 12,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 15,
  },
  helperText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  kindWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeFirstSection: {
    marginTop: 0,
  },
  kindChip: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 0,
    justifyContent: "center",
  },
  kindChipSelected: {
    borderWidth: 0,
  },
  kindChipText: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 12,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  noteBanner: {
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  identifierWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  identifierChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  identifierChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  identifierEmpty: {
    paddingTop: 4,
  },
  manageButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manageButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
});

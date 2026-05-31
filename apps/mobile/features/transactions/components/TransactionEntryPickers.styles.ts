import { StyleSheet } from "@/shared/components/rn";

export const pickerStyles = StyleSheet.create({
  dialogBody: {
    gap: 12,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderRadius: 24,
    padding: 16,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});

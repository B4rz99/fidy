import { View } from "@/shared/components/rn";

export function MicrosoftIcon() {
  return (
    <View style={{ width: 20, height: 20, flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
      <View style={{ width: 9, height: 9, backgroundColor: "#F25022" }} />
      <View style={{ width: 9, height: 9, backgroundColor: "#7FBA00" }} />
      <View style={{ width: 9, height: 9, backgroundColor: "#00A4EF" }} />
      <View style={{ width: 9, height: 9, backgroundColor: "#FFB900" }} />
    </View>
  );
}
